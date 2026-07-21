import { readContract, waitForTransactionReceipt } from '@wagmi/core'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BaseError, erc20Abi, parseUnits } from 'viem'
import { useAccount, useConfig, useWriteContract } from 'wagmi'
import { BridgeKit } from '@circle-fin/bridge-kit'
import { CHAIN_LIST_STANDARD, CHAINS, type ChainId } from '../../assets/chains'
import AuthStatusBanner from '../../components/console/AuthStatusBanner'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import Dropdown from '../../components/console/Dropdown'
import FieldError from '../../components/console/FieldError'
import MaxButton from '../../components/console/MaxButton'
import ReviewModal from '../../components/console/ReviewModal'
import { SkeletonBlock } from '../../components/console/Skeleton'
import { BRIDGE_CHAIN_BY_ID, type BridgeableChainId } from '../../config/bridgeChains'
import { USDC_BY_CHAIN } from '../../config/tokens'
import { useSolanaWallet } from '../../context/SolanaWalletContext'
import { useWalletAuthContext } from '../../context/WalletAuthContext'
import { AAVE_CHAIN_IDS, AAVE_POOL_ABI, AAVE_REFERRAL_CODE, getAaveMarket, type AaveChainId } from '../../lib/aaveClient'
import { appendBridgeEvent, logAaveDeposit, logAaveWithdraw, type BridgeSnapshot } from '../../lib/activityLogWrites'
import { IDLE_STEPS, normalizeStepName, STEP_META, stepsFromResult, type StepBucket, type StepDisplay } from '../../lib/bridgeSteps'
import { getExplorerTxUrl } from '../../lib/explorer'
import { getBufferedFees } from '../../lib/gasFees'
import { useAaveOverview } from '../../hooks/useAaveOverview'
import { useEvmAdapter } from '../../hooks/useEvmAdapter'
import { useEvmChainSwitch } from '../../hooks/useEvmChainSwitch'
import { useSolanaAdapter } from '../../hooks/useSolanaAdapter'
import { fetchSolanaSolBalance, useSolanaTokenBalance } from '../../hooks/useSolanaTokenBalance'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { usdcBalanceQueryKey } from '../../hooks/useUsdcBalances'
import { useUniswapOverview } from '../../hooks/useUniswapOverview'
import { UNISWAP_CHAIN_IDS } from '../../lib/uniswapClient'
import UniswapLiquidityPanel from '../../components/console/UniswapLiquidityPanel'
import ArcYieldPoolPanel from '../../components/console/ArcYieldPoolPanel'
import { useArcYieldPoolPosition, useArcYieldPoolStrategies } from '../../hooks/useArcYieldPool'
import { isArcYieldPoolDeployed } from '../../lib/arcYieldPoolClient'
import { amountError } from '../../lib/validation'

/** One kit instance for the app — mirrors Bridge.tsx's own module-level instance; stateless
 *  aside from event subscriptions, which are added/removed per attempt. */
const kit = new BridgeKit()

const REAL_POOL_NAME = 'USDC Yield Vault (Aave V3)'

/** Placeholder-only rows — explicitly NOT wired to any real yield destination (out of scope for
 *  this pass). Kept visually distinct from the real pools above via their status chip. */
const PLACEHOLDER_POOLS = [{ name: 'Stable Aggregator', chains: ['arbitrum', 'polygon', 'optimism'] as const }]

const CHAIN_OPTIONS = CHAIN_LIST_STANDARD.map((c) => ({
  value: c.id,
  label: c.name,
  sublabel: c.layer,
  icon: <c.Icon className="w-7 h-7 shrink-0" />,
  groupLabel: c.isNonEvm ? 'Other Ecosystems' : undefined,
}))

type DepositPhase = 'bridge' | 'approve' | 'supply'
interface PhaseDisplay {
  state: 'idle' | 'pending' | 'success' | 'error'
  txHash?: string
  explorerUrl?: string
  errorMessage?: string
}
const IDLE_PHASES: Record<DepositPhase, PhaseDisplay> = {
  bridge: { state: 'idle' },
  approve: { state: 'idle' },
  supply: { state: 'idle' },
}
const PHASE_META: { phase: DepositPhase; label: string; icon: string }[] = [
  { phase: 'bridge', label: 'Bridge', icon: 'swap_horiz' },
  { phase: 'approve', label: 'Approve', icon: 'task_alt' },
  { phase: 'supply', label: 'Supply', icon: 'savings' },
]

const MIN_SOL_FOR_BURN_FEES = 0.01

function LiquidityScreen() {
  const [selectedPool, setSelectedPool] = useState<'aave' | 'uniswap' | 'arcPool'>('aave')
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')

  // ---- Deposit state ----
  const [sourceChain, setSourceChain] = useState<ChainId>('ethereum')
  const [targetChain, setTargetChain] = useState<AaveChainId>('arbitrum')
  const [amount, setAmount] = useState('')
  const [touched, setTouched] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [depositing, setDepositing] = useState(false)
  const [depositError, setDepositError] = useState<string | null>(null)
  const [phases, setPhases] = useState<Record<DepositPhase, PhaseDisplay>>(IDLE_PHASES)
  const [bridgeSubSteps, setBridgeSubSteps] = useState<Record<StepBucket, StepDisplay>>(IDLE_STEPS)
  const [completedDeposit, setCompletedDeposit] = useState<{ txHash: string; explorerUrl?: string } | null>(null)
  const submittingRef = useRef(false)

  // ---- Withdraw state ----
  const [withdrawChain, setWithdrawChain] = useState<AaveChainId>('arbitrum')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawTouched, setWithdrawTouched] = useState(false)
  const [withdrawReviewOpen, setWithdrawReviewOpen] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [completedWithdraw, setCompletedWithdraw] = useState<{ txHash: string; explorerUrl?: string } | null>(null)
  const autoSelectedWithdrawChain = useRef(false)

  const { address: walletAddress } = useAccount()
  const { isAuthenticated } = useWalletAuthContext()
  const { isOnChain, ensureChain, isPending: switchPending } = useEvmChainSwitch()
  const { adapter: evmAdapter, error: evmAdapterError } = useEvmAdapter()
  const solanaAdapter = useSolanaAdapter()
  const { connected: solanaConnected, connect: connectSolana, address: solanaAddress } = useSolanaWallet()
  const { writeContractAsync } = useWriteContract()
  const wagmiConfig = useConfig()
  const queryClient = useQueryClient()
  const aaveOverview = useAaveOverview()
  const uniswapOverview = useUniswapOverview()
  const arcPoolPosition = useArcYieldPoolPosition()
  const { strategies: arcPoolStrategies } = useArcYieldPoolStrategies()
  const arcPoolActivePositions = arcPoolPosition.active ? 1 : 0

  const source = CHAINS[sourceChain]
  const target = CHAINS[targetChain]
  const needsBridge = sourceChain !== targetChain

  const evmBalance = useTokenBalance(source.evmChainId ?? 0)
  const solanaBalance = useSolanaTokenBalance()
  const isSourceSolana = source.evmChainId === undefined && sourceChain === 'solana'
  const availableBalance = isSourceSolana ? Number(solanaBalance.formatted) : Number(evmBalance.formatted)
  const balanceLoading = isSourceSolana ? solanaBalance.isLoading : evmBalance.isLoading

  const amountMsg = useMemo(() => {
    if (balanceLoading) return null
    return amountError(amount, availableBalance)
  }, [amount, availableBalance, balanceLoading])

  const needsSourceChainSwitch = needsBridge && source.evmChainId !== undefined && !isOnChain(source.evmChainId)
  const needsTargetChainSwitch = !needsBridge && !isOnChain(target.evmChainId!)
  const needsSolanaConnect = needsBridge && sourceChain === 'solana' && !solanaConnected
  const isDepositValid =
    !amountMsg && !needsSourceChainSwitch && !needsTargetChainSwitch && !needsSolanaConnect && isAuthenticated

  const selectSourceChain = (id: ChainId) => {
    setSourceChain(id)
    const target = CHAINS[id]
    if (target.evmChainId !== undefined) ensureChain(target.evmChainId)
  }

  const AAVE_CHAIN_OPTIONS = AAVE_CHAIN_IDS.map((id) => {
    const c = CHAINS[id]
    const overview = aaveOverview.chains.find((x) => x.chainId === id)
    return {
      value: id,
      label: c.name,
      sublabel: overview?.apyPercent !== null && overview?.apyPercent !== undefined ? `${overview.apyPercent.toFixed(2)}% APY` : 'Loading rate…',
      icon: <c.Icon className="w-7 h-7 shrink-0" />,
    }
  })

  const handleDeposit = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setDepositError(null)
    setPhases(IDLE_PHASES)
    setBridgeSubSteps(IDLE_STEPS)
    setCompletedDeposit(null)
    setDepositing(true)

    try {
      if (!walletAddress) throw new Error('Wallet not connected.')
      if (!isAuthenticated) throw new Error('Sign in with your wallet first — check the banner above.')

      const targetEvmChainId = target.evmChainId!
      const market = getAaveMarket(targetEvmChainId)
      if (!market) {
        throw new Error('This chain is not a verified Aave market right now — refusing to proceed with a real deposit.')
      }

      if (needsBridge) {
        setPhases((p) => ({ ...p, bridge: { state: 'pending' } }))

        const sourceIsSolana = sourceChain === 'solana'
        if (sourceIsSolana) {
          if (!solanaConnected) throw new Error('Connect a Solana wallet to continue.')
          if (solanaAddress) {
            const solBalance = await fetchSolanaSolBalance(solanaAddress)
            if (solBalance < MIN_SOL_FOR_BURN_FEES) {
              throw new Error(
                `Insufficient SOL for network fees — your Solana wallet has ${solBalance.toFixed(4)} SOL, need at least ${MIN_SOL_FOR_BURN_FEES} SOL. Get Devnet SOL from a faucet (e.g. faucet.solana.com) and try again.`,
              )
            }
          }
        } else if (source.evmChainId !== undefined && !isOnChain(source.evmChainId)) {
          throw new Error('Your wallet must be on the source chain to sign the burn — switch networks and try again.')
        }

        const fromAdapter = sourceIsSolana ? solanaAdapter : evmAdapter
        const toAdapter = evmAdapter
        if (!fromAdapter || !toAdapter) {
          throw new Error(evmAdapterError ?? 'Wallet adapter is not ready yet — try again in a moment.')
        }

        const sourceBridgeChain = BRIDGE_CHAIN_BY_ID[sourceChain as BridgeableChainId]
        const destBridgeChain = BRIDGE_CHAIN_BY_ID[targetChain as BridgeableChainId]

        const rawStepsRef = new Map<string, ReturnType<typeof stepsFromResult>[StepBucket] & { name: string }>()
        const onEvent = (payload: unknown) => {
          const p = payload as { method?: string; values?: { name?: string; state?: string; txHash?: string; explorerUrl?: string; errorMessage?: string } }
          const bucket = p?.method ? normalizeStepName(p.method) : null
          if (!bucket || !p.values) return
          const realName = p.values.name ?? p.method!
          rawStepsRef.set(realName, {
            name: realName,
            state: (p.values.state as StepDisplay['state']) ?? 'pending',
            txHash: p.values.txHash,
            explorerUrl: p.values.explorerUrl,
            errorMessage: p.values.errorMessage,
          })
          setBridgeSubSteps((prev) => ({
            ...prev,
            [bucket]: {
              state: p.values!.state === 'noop' ? 'success' : ((p.values!.state as StepDisplay['state']) ?? 'pending'),
              txHash: p.values!.txHash,
              explorerUrl: p.values!.explorerUrl,
              errorMessage: p.values!.errorMessage,
            },
          }))
        }

        kit.on('*', onEvent)
        let bridgeResult
        try {
          bridgeResult = await kit.bridge({
            from: { adapter: fromAdapter, chain: sourceBridgeChain },
            to: { adapter: toAdapter, chain: destBridgeChain },
            amount,
            token: 'USDC',
          })
        } finally {
          kit.off('*', onEvent)
        }

        setBridgeSubSteps(stepsFromResult(bridgeResult))

        // Same append-only Firestore record Bridge.tsx itself writes — this deposit's bridge leg
        // shows up as a real, resumable `type: 'bridge'` activity entry, not a bespoke shape.
        try {
          const bridgeId = crypto.randomUUID()
          const snapshot: BridgeSnapshot = {
            bridgeId,
            sequence: 0,
            status: bridgeResult.state === 'success' ? 'success' : bridgeResult.state === 'error' ? 'error' : 'pending_attestation',
            amount: bridgeResult.amount,
            token: bridgeResult.token,
            provider: bridgeResult.provider,
            source: { address: bridgeResult.source.address, chain: bridgeResult.source.chain },
            destination: { address: bridgeResult.destination.address, chain: bridgeResult.destination.chain },
            steps: bridgeResult.steps,
          }
          await appendBridgeEvent(walletAddress, snapshot)
        } catch (logErr) {
          console.error('Failed to persist bridge leg to Firestore:', logErr)
        }

        if (bridgeResult.state !== 'success') {
          const failedStep = bridgeResult.steps.find((step) => step.state === 'error')
          setPhases((p) => ({ ...p, bridge: { state: 'error', errorMessage: failedStep?.errorMessage } }))
          throw new Error('Bridge did not complete successfully — see step details below.')
        }
        setPhases((p) => ({ ...p, bridge: { state: 'success' } }))
      } else {
        setPhases((p) => ({ ...p, bridge: { state: 'success' } }))
        if (!isOnChain(targetEvmChainId)) {
          throw new Error(`Switch your wallet to ${target.shortLabel} to continue.`)
        }
      }

      const usdc = USDC_BY_CHAIN[targetEvmChainId]
      const parsedAmount = parseUnits(amount, usdc.decimals)

      setPhases((p) => ({ ...p, approve: { state: 'pending' } }))
      const currentAllowance = await readContract(wagmiConfig, {
        chainId: targetEvmChainId,
        address: usdc.address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [walletAddress, market.pool],
      })
      // Explicit, freshly-fetched fee override — see gasFees.ts for why this can't be left to
      // viem/the wallet's own default on a fast-moving-base-fee chain like Arbitrum Sepolia.
      const approveFees = await getBufferedFees(wagmiConfig, targetEvmChainId)
      if (currentAllowance < parsedAmount) {
        const approveHash = await writeContractAsync({
          chainId: targetEvmChainId,
          address: usdc.address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [market.pool, parsedAmount],
          ...approveFees,
        })
        const approveReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: approveHash, chainId: targetEvmChainId })
        if (approveReceipt.status !== 'success') throw new Error('Approval reverted on-chain.')
        setPhases((p) => ({
          ...p,
          approve: { state: 'success', txHash: approveHash, explorerUrl: getExplorerTxUrl(targetEvmChainId, approveHash) },
        }))
      } else {
        setPhases((p) => ({ ...p, approve: { state: 'success' } }))
      }

      setPhases((p) => ({ ...p, supply: { state: 'pending' } }))
      const supplyFees = await getBufferedFees(wagmiConfig, targetEvmChainId)
      const supplyHash = await writeContractAsync({
        chainId: targetEvmChainId,
        address: market.pool,
        abi: AAVE_POOL_ABI,
        functionName: 'supply',
        args: [usdc.address, parsedAmount, walletAddress, AAVE_REFERRAL_CODE],
        ...supplyFees,
      })
      const supplyReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: supplyHash, chainId: targetEvmChainId })
      if (supplyReceipt.status !== 'success') throw new Error('Supply reverted on-chain.')
      const supplyExplorerUrl = getExplorerTxUrl(targetEvmChainId, supplyHash)
      setPhases((p) => ({ ...p, supply: { state: 'success', txHash: supplyHash, explorerUrl: supplyExplorerUrl } }))

      const depositedChain = aaveOverview.chains.find((c) => c.chainId === targetChain)
      depositedChain?.refetchPosition()
      void queryClient.invalidateQueries({ queryKey: usdcBalanceQueryKey(targetEvmChainId, walletAddress) })

      try {
        await logAaveDeposit(walletAddress, {
          txHash: supplyHash,
          amount,
          token: 'USDC',
          chain: target.name,
          poolName: REAL_POOL_NAME,
          explorerUrl: supplyExplorerUrl,
        })
      } catch (logErr) {
        console.error('Failed to persist Aave deposit to Firestore:', logErr)
      }

      setCompletedDeposit({ txHash: supplyHash, explorerUrl: supplyExplorerUrl })
      setAmount('')
      setTouched(false)
      setReviewOpen(false)
    } catch (err) {
      const message = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : 'Deposit failed.'
      const rejected = /user rejected|denied the transaction|user denied/i.test(message)
      setDepositError(rejected ? 'Deposit cancelled — the wallet request was rejected.' : message)
      setReviewOpen(false)
    } finally {
      setDepositing(false)
      submittingRef.current = false
    }
  }

  // ---- Withdraw ----
  // Re-arms the auto-select whenever the connected address changes — otherwise switching to a
  // different wallet account mid-session would leave the withdraw tab pointed at whichever chain
  // the PREVIOUS account happened to have a balance on, never re-checking the new account's own
  // positions (the balance shown for that selection would still be live/correct for the new
  // account, just not necessarily the chain the new account actually has a position on).
  useEffect(() => {
    autoSelectedWithdrawChain.current = false
  }, [walletAddress])

  useEffect(() => {
    if (autoSelectedWithdrawChain.current || aaveOverview.isLoading) return
    const withBalance = aaveOverview.chains.find((c) => c.balance > 0)
    if (withBalance) {
      setWithdrawChain(withBalance.chainId)
      autoSelectedWithdrawChain.current = true
    }
  }, [aaveOverview.chains, aaveOverview.isLoading])

  const withdrawChainMeta = CHAINS[withdrawChain]
  const withdrawOverview = aaveOverview.chains.find((c) => c.chainId === withdrawChain)
  const withdrawAvailable = withdrawOverview?.balance ?? 0
  const withdrawAmountMsg = useMemo(() => {
    if (aaveOverview.isLoading) return null
    return amountError(withdrawAmount, withdrawAvailable)
  }, [withdrawAmount, withdrawAvailable, aaveOverview.isLoading])
  const needsWithdrawChainSwitch = !isOnChain(withdrawChainMeta.evmChainId!)
  const isWithdrawValid = !withdrawAmountMsg && withdrawAvailable > 0 && !needsWithdrawChainSwitch && isAuthenticated

  const handleWithdraw = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setWithdrawError(null)
    setWithdrawing(true)
    setCompletedWithdraw(null)

    try {
      if (!walletAddress) throw new Error('Wallet not connected.')
      if (!isAuthenticated) throw new Error('Sign in with your wallet first — check the banner above.')
      const evmChainId = withdrawChainMeta.evmChainId!
      const market = getAaveMarket(evmChainId)
      if (!market) throw new Error('This chain is not a verified Aave market right now — refusing to proceed with a real withdrawal.')
      if (!isOnChain(evmChainId)) throw new Error(`Switch your wallet to ${withdrawChainMeta.shortLabel} to continue.`)

      const usdc = USDC_BY_CHAIN[evmChainId]
      const parsedAmount = parseUnits(withdrawAmount, usdc.decimals)

      const withdrawFees = await getBufferedFees(wagmiConfig, evmChainId)
      const hash = await writeContractAsync({
        chainId: evmChainId,
        address: market.pool,
        abi: AAVE_POOL_ABI,
        functionName: 'withdraw',
        args: [usdc.address, parsedAmount, walletAddress],
        ...withdrawFees,
      })
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: evmChainId })
      if (receipt.status !== 'success') throw new Error('Withdrawal reverted on-chain.')
      const explorerUrl = getExplorerTxUrl(evmChainId, hash)

      withdrawOverview?.refetchPosition()
      void queryClient.invalidateQueries({ queryKey: usdcBalanceQueryKey(evmChainId, walletAddress) })

      try {
        await logAaveWithdraw(walletAddress, {
          txHash: hash,
          amount: withdrawAmount,
          token: 'USDC',
          chain: withdrawChainMeta.name,
          poolName: REAL_POOL_NAME,
          explorerUrl,
        })
      } catch (logErr) {
        console.error('Failed to persist Aave withdrawal to Firestore:', logErr)
      }

      setCompletedWithdraw({ txHash: hash, explorerUrl })
      setWithdrawAmount('')
      setWithdrawTouched(false)
      setWithdrawReviewOpen(false)
    } catch (err) {
      const message = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : 'Withdrawal failed.'
      const rejected = /user rejected|denied the transaction|user denied/i.test(message)
      setWithdrawError(rejected ? 'Withdrawal cancelled — the wallet request was rejected.' : message)
      setWithdrawReviewOpen(false)
    } finally {
      setWithdrawing(false)
      submittingRef.current = false
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-gutter">
      <section className="glass-premium rounded-[32px] p-10 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-tertiary/5 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5">
            <h2 className="font-headline-lg text-[20px] font-semibold tracking-tight">Liquidity</h2>
            <span className="status-chip text-[10px]">
              <span className="status-chip-dot status-chip-dot-live" />
              Live
            </span>
          </div>

          <div className="flex gap-10">
            <div>
              <p className="font-label-caps text-on-surface-variant/55 uppercase text-[11px] tracking-[0.14em] mb-2">
                Aave Blended APY
              </p>
              <p className="font-mono-data text-[32px] font-bold text-tertiary tabular-nums">
                {aaveOverview.blendedApyPercent !== null ? `${aaveOverview.blendedApyPercent.toFixed(2)}%` : '—%'}
              </p>
            </div>
            <div>
              <p className="font-label-caps text-on-surface-variant/55 uppercase text-[11px] tracking-[0.14em] mb-2">
                Active Positions
              </p>
              <p className="font-mono-data text-[32px] font-bold tabular-nums">
                {aaveOverview.activePositions + uniswapOverview.activePositions + arcPoolActivePositions}
              </p>
            </div>
          </div>
        </div>
      </section>

      <p className="text-[11px] text-on-surface-variant/45 -mt-2">
        A single portfolio-wide dollar total isn't shown here on purpose — Uniswap's USDC-WETH position has no reliable
        testnet USD price for its WETH leg (see the pool tab for why), so summing it with Aave/ArcYieldPool's USDC
        balances would mean fabricating a number. Real balances for every position are broken out below.
      </p>

      <AuthStatusBanner />

      {(aaveOverview.activePositions > 0 || uniswapOverview.activePositions > 0 || arcPoolActivePositions > 0) && (
        <section className="glass-premium rounded-[32px] overflow-hidden">
          <div className="p-6 border-b border-white/[0.06]">
            <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Your Positions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="font-label-caps text-[10px] text-on-surface-variant/40 border-b border-white/[0.06]">
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">Market</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">Chain</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">Status</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">Balance</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">Est. Yield</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">Unclaimed</th>
                </tr>
              </thead>
              <tbody className="font-body-sm divide-y divide-white/[0.04]">
                {aaveOverview.chains
                  .filter((c) => c.balance > 0)
                  .map((c) => (
                    <tr key={`aave-${c.chainId}`} className="hover:bg-white/[0.03] transition-premium">
                      <td className="px-6 py-4 font-bold tracking-tight">{REAL_POOL_NAME}</td>
                      <td className="px-6 py-4 text-on-surface-variant/60">{CHAINS[c.chainId].name}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="status-chip text-[9px]">
                          <span className="status-chip-dot status-chip-dot-live" />
                          Earning
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono-data">{c.balance.toFixed(4)} USDC</td>
                      <td className="px-6 py-4 text-right font-mono-data text-tertiary">
                        {c.apyPercent !== null ? `${c.apyPercent.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono-data text-on-surface-variant/45">—</td>
                    </tr>
                  ))}
                {uniswapOverview.chains
                  .filter((c) => c.position.hasPosition)
                  .map((c) => {
                    const usdcIsToken0 = c.position.token0?.toLowerCase() === USDC_BY_CHAIN[c.evmChainId]?.address.toLowerCase()
                    return (
                      <tr key={`uni-${c.chainId}`} className="hover:bg-white/[0.03] transition-premium">
                        <td className="px-6 py-4 font-bold tracking-tight">USDC-WETH Pool</td>
                        <td className="px-6 py-4 text-on-surface-variant/60">{c.name}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`status-chip text-[9px] ${c.position.inRange ? '' : '!bg-error/10 !text-error'}`}>
                            <span className={`status-chip-dot ${c.position.inRange ? 'status-chip-dot-live' : ''}`} />
                            {c.position.inRange ? 'In Range' : 'Out of Range'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono-data">
                          {Number(c.position.currentAmount0Formatted).toFixed(4)} {usdcIsToken0 ? 'USDC' : 'WETH'} /{' '}
                          {Number(c.position.currentAmount1Formatted).toFixed(6)} {usdcIsToken0 ? 'WETH' : 'USDC'}
                        </td>
                        <td className="px-6 py-4 text-right font-mono-data text-tertiary">Fee-based</td>
                        <td className="px-6 py-4 text-right font-mono-data text-on-surface-variant/45">
                          {Number(c.position.unclaimedFees0Formatted).toFixed(4)} / {Number(c.position.unclaimedFees1Formatted).toFixed(6)}
                        </td>
                      </tr>
                    )
                  })}
                {arcPoolActivePositions > 0 && (
                  <tr key="arc-pool" className="hover:bg-white/[0.03] transition-premium">
                    <td className="px-6 py-4 font-bold tracking-tight">ArcYieldPool ({arcPoolStrategies.find((s) => s.id === arcPoolPosition.strategyId)?.label ?? 'Flexible'})</td>
                    <td className="px-6 py-4 text-on-surface-variant/60">{CHAINS.arc.name}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="status-chip text-[9px]">
                        <span className="status-chip-dot status-chip-dot-live" />
                        Earning
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono-data">{arcPoolPosition.principalFormatted.toFixed(4)} USDC</td>
                    <td className="px-6 py-4 text-right font-mono-data text-tertiary">
                      {arcPoolStrategies.find((s) => s.id === arcPoolPosition.strategyId)?.aprPercent.toFixed(2) ?? '—'}%
                    </td>
                    <td className="px-6 py-4 text-right font-mono-data text-on-surface-variant/45">
                      {arcPoolPosition.rewardsOwedFormatted.toFixed(6)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid grid-cols-12 gap-gutter items-start">
        <div className="col-span-12 lg:col-span-7 space-y-gutter">
          <div className="glass-premium rounded-3xl p-1.5 flex gap-1">
            <button
              type="button"
              onClick={() => setSelectedPool('aave')}
              className={`flex-1 py-3.5 font-semibold rounded-2xl transition-premium text-sm flex items-center justify-center gap-2 ${
                selectedPool === 'aave'
                  ? 'bg-primary/15 text-primary border border-primary/20 shadow-[0_0_20px_-8px_rgba(255,170,246,0.3)]'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              {REAL_POOL_NAME}
              <span className="status-chip text-[9px]">
                <span className="status-chip-dot status-chip-dot-live" />
                Live
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPool('uniswap')}
              className={`flex-1 py-3.5 font-semibold rounded-2xl transition-premium text-sm flex items-center justify-center gap-2 ${
                selectedPool === 'uniswap'
                  ? 'bg-primary/15 text-primary border border-primary/20 shadow-[0_0_20px_-8px_rgba(255,170,246,0.3)]'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              USDC-WETH Pool (Uniswap V3)
              <span className="status-chip text-[9px]">
                <span className="status-chip-dot" />
                Beta
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPool('arcPool')}
              className={`flex-1 py-3.5 font-semibold rounded-2xl transition-premium text-sm flex items-center justify-center gap-2 ${
                selectedPool === 'arcPool'
                  ? 'bg-primary/15 text-primary border border-primary/20 shadow-[0_0_20px_-8px_rgba(255,170,246,0.3)]'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              ArcYieldPool (Own Contract)
              <span className="status-chip text-[9px]">
                <span className={`status-chip-dot ${isArcYieldPoolDeployed() ? 'status-chip-dot-live' : ''}`} />
                {isArcYieldPoolDeployed() ? 'Live' : 'Not Deployed'}
              </span>
            </button>
          </div>

          {selectedPool === 'uniswap' ? (
            <UniswapLiquidityPanel />
          ) : selectedPool === 'arcPool' ? (
            <ArcYieldPoolPanel />
          ) : (
            <>
          <div className="glass rounded-3xl p-1.5 flex gap-1">
            <button
              type="button"
              onClick={() => setTab('deposit')}
              className={`flex-1 py-3 font-semibold rounded-2xl transition-premium text-sm ${
                tab === 'deposit'
                  ? 'bg-primary/15 text-primary border border-primary/20 shadow-[0_0_20px_-8px_rgba(255,170,246,0.3)]'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              Deposit
            </button>
            <button
              type="button"
              onClick={() => setTab('withdraw')}
              className={`flex-1 py-3 font-semibold rounded-2xl transition-premium text-sm ${
                tab === 'withdraw'
                  ? 'bg-primary/15 text-primary border border-primary/20 shadow-[0_0_20px_-8px_rgba(255,170,246,0.3)]'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              Withdraw
            </button>
          </div>

          {tab === 'deposit' ? (
            <div className="space-y-1">
              {completedDeposit && (
                <div className="banner-success animate-fade-in-up mb-2">
                  <span className="material-symbols-outlined text-green-400 text-[20px] shrink-0">check_circle</span>
                  <div className="min-w-0">
                    <p className="text-body-sm text-green-400 font-medium">Deposit confirmed — now earning real yield on {target.name}.</p>
                    {completedDeposit.explorerUrl && (
                      <a
                        href={completedDeposit.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12px] text-green-400/80 underline underline-offset-2 hover:text-green-400"
                      >
                        View supply transaction
                      </a>
                    )}
                  </div>
                </div>
              )}

              {depositError && (
                <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-error/20 bg-error/5 mb-2 animate-fade-in-up">
                  <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
                  <p className="text-body-sm text-error font-medium">{depositError}</p>
                </div>
              )}

              <div className="panel rounded-t-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <label htmlFor="liquidity-amount" className="font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase">
                    Amount to Deposit
                  </label>
                  {balanceLoading ? (
                    <SkeletonBlock className="h-4 w-28" />
                  ) : (
                    <span className="text-body-sm text-on-surface-variant/70 font-mono-data">
                      Balance: <span className="text-on-surface">{availableBalance.toFixed(2)} USDC</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <input
                    id="liquidity-amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={() => setTouched(true)}
                    inputMode="decimal"
                    className="bg-transparent border-none p-0 text-[40px] font-headline-lg text-on-surface focus:ring-0 w-full placeholder:text-on-surface/20 tracking-tight tabular-nums"
                    placeholder="0.00"
                    type="text"
                  />
                  <MaxButton onClick={() => setAmount(String(availableBalance))} />
                  <div className="bg-white/[0.04] border border-white/10 flex items-center gap-2 px-3 py-2 rounded-xl shrink-0">
                    <div className="w-6 h-6 rounded-full bg-tertiary/20 flex items-center justify-center border border-tertiary/15">
                      <span className="material-symbols-outlined text-tertiary text-sm">monetization_on</span>
                    </div>
                    <span className="font-bold text-on-surface text-sm">USDC</span>
                  </div>
                </div>
                {touched && <FieldError message={amountMsg} />}
              </div>

              <div className="relative h-4 flex items-center justify-center z-10">
                <div className="bg-surface-container h-10 w-10 rounded-full flex items-center justify-center border border-white/10 shadow-glass">
                  <span className="material-symbols-outlined text-primary text-[20px]">south</span>
                </div>
              </div>

              <div className="panel p-6">
                <div className="flex justify-between items-center mb-4">
                  <label className="font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase">
                    Source Chain
                  </label>
                </div>
                <Dropdown
                  value={sourceChain}
                  onChange={(v) => selectSourceChain(v as ChainId)}
                  options={CHAIN_OPTIONS}
                  ariaLabel="Select source chain"
                  triggerClassName="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] transition-premium hover:border-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
                  renderTrigger={(_selected, open) => (
                    <>
                      <div className="flex items-center gap-3">
                        <source.Icon className="w-9 h-9" />
                        <div className="text-left">
                          <p className="font-bold leading-tight tracking-tight text-sm">{source.shortLabel}</p>
                          <p className="text-[11px] text-on-surface-variant/55">{source.layer}</p>
                        </div>
                      </div>
                      <span className={`material-symbols-outlined opacity-40 transition-transform ${open ? 'rotate-180' : ''}`}>
                        expand_more
                      </span>
                    </>
                  )}
                />
              </div>

              <div className="panel rounded-b-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <label className="font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase">
                    Deposit To (Aave V3 Market)
                  </label>
                  {!needsBridge && <span className="text-[11px] text-tertiary/80 font-medium">No bridge needed — same chain</span>}
                </div>
                <Dropdown
                  value={targetChain}
                  onChange={(v) => setTargetChain(v as AaveChainId)}
                  options={AAVE_CHAIN_OPTIONS}
                  ariaLabel="Select Aave destination chain"
                  triggerClassName="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] transition-premium hover:border-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
                  renderTrigger={(_selected, open) => (
                    <>
                      <div className="flex items-center gap-3">
                        <target.Icon className="w-9 h-9" />
                        <div className="text-left">
                          <p className="font-bold leading-tight tracking-tight text-sm">{target.shortLabel}</p>
                          <p className="text-[11px] text-on-surface-variant/55">
                            {aaveOverview.chains.find((c) => c.chainId === targetChain)?.apyPercent?.toFixed(2) ?? '—'}% live supply APY
                          </p>
                        </div>
                      </div>
                      <span className={`material-symbols-outlined opacity-40 transition-transform ${open ? 'rotate-180' : ''}`}>
                        expand_more
                      </span>
                    </>
                  )}
                />
              </div>

              {needsSolanaConnect && (
                <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5 mt-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">account_balance_wallet</span>
                    <p className="text-body-sm text-tertiary font-medium">Connect a Solana wallet to bridge from Solana Devnet</p>
                  </div>
                  <button type="button" onClick={connectSolana} className="btn-secondary px-4 py-2 text-sm shrink-0">
                    Connect Solana Wallet
                  </button>
                </div>
              )}

              {needsSourceChainSwitch && (
                <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5 mt-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">sync_alt</span>
                    <p className="text-body-sm text-tertiary font-medium">
                      Your wallet is on a different network — switch to {source.shortLabel} to continue
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => source.evmChainId !== undefined && ensureChain(source.evmChainId)}
                    disabled={switchPending}
                    className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {switchPending ? 'Switching…' : `Switch to ${source.shortLabel}`}
                  </button>
                </div>
              )}

              {needsTargetChainSwitch && (
                <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5 mt-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">sync_alt</span>
                    <p className="text-body-sm text-tertiary font-medium">
                      Your wallet is on a different network — switch to {target.shortLabel} to continue
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => ensureChain(target.evmChainId!)}
                    disabled={switchPending}
                    className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {switchPending ? 'Switching…' : `Switch to ${target.shortLabel}`}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setTouched(true)
                  if (isDepositValid) setReviewOpen(true)
                }}
                disabled={!isDepositValid || depositing}
                className="btn-primary w-full py-5 rounded-2xl text-lg mt-4 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>{depositing ? 'Depositing…' : 'Deposit into Pool'}</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <p className="text-[11px] text-center text-on-surface-variant/40 mt-2">
                {needsBridge
                  ? 'Bridges via Circle CCTP, then supplies to Aave V3 — self-custodial the whole way. Takes a few minutes, not instant.'
                  : 'Supplies directly to Aave V3 on this chain — self-custodial, real market-rate yield.'}
              </p>

              {(depositing || phases.bridge.state !== 'idle') && (
                <div className="glass-premium rounded-2xl p-6 mt-4">
                  <h4 className="field-label tracking-[0.12em] mb-6">Deposit Progress</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {PHASE_META.map(({ phase, label, icon }) => {
                      const p = phases[phase]
                      const colorClass =
                        p.state === 'success'
                          ? 'text-green-400 border-green-400/30 bg-green-400/10'
                          : p.state === 'error'
                            ? 'text-error border-error/30 bg-error/10'
                            : p.state === 'pending'
                              ? 'text-tertiary border-tertiary/30 bg-tertiary/10 animate-pulse'
                              : 'text-on-surface-variant/55 border-white/10'
                      const displayIcon = p.state === 'success' ? 'check_circle' : p.state === 'error' ? 'error' : icon
                      return (
                        <div key={phase} className="flex flex-col items-center gap-2">
                          <div className={`icon-well w-11 h-11 rounded-full border transition-premium ${colorClass}`}>
                            <span className="material-symbols-outlined text-lg">{displayIcon}</span>
                          </div>
                          <span className="font-mono-data text-xs font-bold text-on-surface-variant/60">{label}</span>
                          {phase === 'bridge' && needsBridge && p.state === 'pending' ? (
                            <div className="flex gap-1 mt-1">
                              {STEP_META.map(({ bucket, label: subLabel }) => {
                                const sub = bridgeSubSteps[bucket]
                                return (
                                  <span
                                    key={bucket}
                                    title={`${subLabel}: ${sub.state}`}
                                    className={`w-2 h-2 rounded-full ${
                                      sub.state === 'success'
                                        ? 'bg-green-400'
                                        : sub.state === 'error'
                                          ? 'bg-error'
                                          : sub.state === 'pending'
                                            ? 'bg-tertiary animate-pulse'
                                            : 'bg-white/15'
                                    }`}
                                  />
                                )
                              })}
                            </div>
                          ) : p.txHash && p.explorerUrl ? (
                            <a href={p.explorerUrl} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline underline-offset-2">
                              View tx
                            </a>
                          ) : (
                            <p className="text-[10px] text-center px-1 text-on-surface-variant/40">
                              {p.state === 'idle' ? '—' : p.state === 'error' && p.errorMessage ? p.errorMessage : p.state}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-premium rounded-2xl p-8">
              <div className="space-y-6">
                <h3 className="font-headline-lg text-[24px] tracking-tight">Withdraw Position</h3>

                {completedWithdraw && (
                  <div className="banner-success animate-fade-in-up">
                    <span className="material-symbols-outlined text-green-400 text-[20px] shrink-0">check_circle</span>
                    <div className="min-w-0">
                      <p className="text-body-sm text-green-400 font-medium">Withdrawal confirmed — USDC returned to your wallet.</p>
                      {completedWithdraw.explorerUrl && (
                        <a
                          href={completedWithdraw.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] text-green-400/80 underline underline-offset-2 hover:text-green-400"
                        >
                          View withdraw transaction
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {withdrawError && (
                  <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-error/20 bg-error/5 animate-fade-in-up">
                    <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
                    <p className="text-body-sm text-error font-medium">{withdrawError}</p>
                  </div>
                )}

                {aaveOverview.activePositions === 0 && !aaveOverview.isLoading ? (
                  <div className="empty-state p-10 rounded-xl border border-dashed border-white/[0.06] bg-white/[0.015]">
                    <div className="empty-state-icon">
                      <span className="material-symbols-outlined">savings</span>
                    </div>
                    <p className="empty-state-title">No positions to withdraw</p>
                    <p className="empty-state-desc">Deposit into the Aave V3 pool first to see withdrawal options here.</p>
                  </div>
                ) : (
                  <>
                    <div className="panel rounded-t-2xl p-6">
                      <div className="flex justify-between items-center mb-4">
                        <label className="font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase">
                          Withdraw From
                        </label>
                      </div>
                      <Dropdown
                        value={withdrawChain}
                        onChange={(v) => setWithdrawChain(v as AaveChainId)}
                        options={AAVE_CHAIN_OPTIONS}
                        ariaLabel="Select chain to withdraw from"
                        triggerClassName="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] transition-premium hover:border-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
                        renderTrigger={(_selected, open) => (
                          <>
                            <div className="flex items-center gap-3">
                              <withdrawChainMeta.Icon className="w-9 h-9" />
                              <div className="text-left">
                                <p className="font-bold leading-tight tracking-tight text-sm">{withdrawChainMeta.shortLabel}</p>
                                <p className="text-[11px] text-on-surface-variant/55">Position: {withdrawAvailable.toFixed(2)} USDC</p>
                              </div>
                            </div>
                            <span className={`material-symbols-outlined opacity-40 transition-transform ${open ? 'rotate-180' : ''}`}>
                              expand_more
                            </span>
                          </>
                        )}
                      />
                    </div>
                    <div className="panel rounded-b-2xl p-6">
                      <div className="flex justify-between items-center mb-4">
                        <label htmlFor="withdraw-amount" className="font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase">
                          Amount to Withdraw
                        </label>
                        {aaveOverview.isLoading ? (
                          <SkeletonBlock className="h-4 w-28" />
                        ) : (
                          <span className="text-body-sm text-on-surface-variant/70 font-mono-data">
                            Available: <span className="text-on-surface">{withdrawAvailable.toFixed(2)} USDC</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <input
                          id="withdraw-amount"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          onBlur={() => setWithdrawTouched(true)}
                          inputMode="decimal"
                          className="bg-transparent border-none p-0 text-[40px] font-headline-lg text-on-surface focus:ring-0 w-full placeholder:text-on-surface/20 tracking-tight tabular-nums"
                          placeholder="0.00"
                          type="text"
                        />
                        <MaxButton onClick={() => setWithdrawAmount(String(withdrawAvailable))} />
                      </div>
                      {withdrawTouched && <FieldError message={withdrawAmountMsg} />}
                    </div>

                    {needsWithdrawChainSwitch && (
                      <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">sync_alt</span>
                          <p className="text-body-sm text-tertiary font-medium">
                            Your wallet is on a different network — switch to {withdrawChainMeta.shortLabel} to continue
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => ensureChain(withdrawChainMeta.evmChainId!)}
                          disabled={switchPending}
                          className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {switchPending ? 'Switching…' : `Switch to ${withdrawChainMeta.shortLabel}`}
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawTouched(true)
                        if (isWithdrawValid) setWithdrawReviewOpen(true)
                      }}
                      disabled={!isWithdrawValid || withdrawing}
                      className="btn-secondary w-full py-5 rounded-2xl text-lg disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {withdrawing ? 'Withdrawing…' : 'Request Withdrawal'}
                    </button>
                    <p className="text-[11px] text-center text-on-surface-variant/40">
                      USDC lands back in your wallet on {withdrawChainMeta.shortLabel} — use Bridge separately if you want it on another chain.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
            </>
          )}
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="glass-premium rounded-[32px] overflow-hidden">
            <div className="p-6 border-b border-white/[0.06]">
              <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Available Pools</h3>
              <p className="text-[11px] text-on-surface-variant/40 mt-1">
                {REAL_POOL_NAME} deposits real, self-custodial funds into Aave V3. USDC-WETH Pool is wired to a real,
                verified Uniswap V3 pool too, but is marked Beta until a real mint and withdraw have been confirmed
                end-to-end on-chain — not before. ArcYieldPool is Meridian's own contract, built because Arc Testnet had
                no yield destination at all until now. The pool below remains shown for reference only, not yet wired to a
                real yield destination.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="font-label-caps text-[10px] text-on-surface-variant/40 border-b border-white/[0.06]">
                    <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">Pool</th>
                    <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">APY</th>
                    <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">Deposited</th>
                    <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="font-body-sm divide-y divide-white/[0.04]">
                  <tr
                    onClick={() => setSelectedPool('aave')}
                    className={`hover:bg-white/[0.03] transition-premium cursor-pointer ${selectedPool === 'aave' ? 'bg-primary/[0.04]' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-bold tracking-tight text-sm mb-1.5">{REAL_POOL_NAME}</p>
                      <div className="flex -space-x-1.5">
                        {AAVE_CHAIN_IDS.map((chainId) => {
                          const c = CHAINS[chainId]
                          return <c.Icon key={chainId} className="w-5 h-5 rounded-full border-2 border-surface-container-low" />
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono-data text-tertiary">
                      {aaveOverview.blendedApyPercent !== null ? `${aaveOverview.blendedApyPercent.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono-data text-on-surface-variant/45">
                      ${aaveOverview.totalDeposited.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="status-chip text-[9px]">
                        <span className="status-chip-dot status-chip-dot-live" />
                        Live
                      </span>
                    </td>
                  </tr>
                  <tr
                    onClick={() => setSelectedPool('uniswap')}
                    className={`hover:bg-white/[0.03] transition-premium cursor-pointer ${selectedPool === 'uniswap' ? 'bg-primary/[0.04]' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-bold tracking-tight text-sm mb-1.5">USDC-WETH Pool (Uniswap V3)</p>
                      <div className="flex -space-x-1.5">
                        {UNISWAP_CHAIN_IDS.map((chainId) => {
                          const c = CHAINS[chainId]
                          return <c.Icon key={chainId} className="w-5 h-5 rounded-full border-2 border-surface-container-low" />
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono-data text-tertiary">Fee-based</td>
                    <td className="px-6 py-4 text-right font-mono-data text-on-surface-variant/45">
                      {uniswapOverview.activePositions > 0 ? `${uniswapOverview.activePositions} active` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="status-chip text-[9px]" title="Real pool, real contracts — not yet confirmed with an end-to-end mint + withdraw transaction">
                        <span className="status-chip-dot" />
                        Beta
                      </span>
                    </td>
                  </tr>
                  <tr
                    onClick={() => setSelectedPool('arcPool')}
                    className={`hover:bg-white/[0.03] transition-premium cursor-pointer ${selectedPool === 'arcPool' ? 'bg-primary/[0.04]' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-bold tracking-tight text-sm mb-1.5">ArcYieldPool (Own Contract)</p>
                      <div className="flex -space-x-1.5">
                        <CHAINS.arc.Icon className="w-5 h-5 rounded-full border-2 border-surface-container-low" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono-data text-tertiary">
                      {arcPoolStrategies.length > 0 ? `${Math.min(...arcPoolStrategies.map((s) => s.aprPercent)).toFixed(2)}–${Math.max(...arcPoolStrategies.map((s) => s.aprPercent)).toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono-data text-on-surface-variant/45">
                      {arcPoolActivePositions > 0 ? `$${arcPoolPosition.principalFormatted.toFixed(2)}` : '$0.00'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="status-chip text-[9px]" title={isArcYieldPoolDeployed() ? 'Meridian\'s own deployed, tested contract' : 'Contract written and tested, not yet deployed'}>
                        <span className={`status-chip-dot ${isArcYieldPoolDeployed() ? 'status-chip-dot-live' : ''}`} />
                        {isArcYieldPoolDeployed() ? 'Live' : 'Not Deployed'}
                      </span>
                    </td>
                  </tr>
                  {PLACEHOLDER_POOLS.map((pool) => (
                    <tr key={pool.name} className="hover:bg-white/[0.03] transition-premium opacity-60">
                      <td className="px-6 py-4">
                        <p className="font-bold tracking-tight text-sm mb-1.5">{pool.name}</p>
                        <div className="flex -space-x-1.5">
                          {pool.chains.map((chainId) => {
                            const c = CHAIN_LIST_STANDARD.find((item) => item.id === chainId)!
                            return <c.Icon key={chainId} className="w-5 h-5 rounded-full border-2 border-surface-container-low" />
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono-data text-tertiary">—</td>
                      <td className="px-6 py-4 text-right font-mono-data text-on-surface-variant/45">$0.00</td>
                      <td className="px-6 py-4 text-right">
                        <span className="status-chip text-[9px] opacity-70">
                          <span className="status-chip-dot" />
                          Reference only
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={() => void handleDeposit()}
        confirming={depositing}
        title="Review Aave Deposit"
        confirmLabel="Confirm Deposit"
        rows={[
          { label: 'Amount', value: `${amount || '0.00'} USDC`, accent: true },
          { label: 'From', value: source.name },
          { label: 'Deposits to', value: `${target.name} (Aave V3)` },
          { label: 'Route', value: needsBridge ? 'Circle CCTP → Aave V3 supply' : 'Aave V3 supply (same chain)' },
        ]}
      />

      <ReviewModal
        open={withdrawReviewOpen}
        onClose={() => setWithdrawReviewOpen(false)}
        onConfirm={() => void handleWithdraw()}
        confirming={withdrawing}
        title="Review Aave Withdrawal"
        confirmLabel="Confirm Withdrawal"
        rows={[
          { label: 'Amount', value: `${withdrawAmount || '0.00'} USDC`, accent: true },
          { label: 'From', value: `${withdrawChainMeta.name} (Aave V3)` },
          { label: 'Destination', value: `Your wallet on ${withdrawChainMeta.name}` },
        ]}
      />
    </div>
  )
}

export default function Liquidity() {
  return (
    <RequireWallet noun="your liquidity positions">
      <LiquidityScreen />
    </RequireWallet>
  )
}
