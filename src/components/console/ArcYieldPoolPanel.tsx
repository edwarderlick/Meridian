import { readContract, simulateContract, waitForTransactionReceipt } from '@wagmi/core'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { erc20Abi, parseUnits } from 'viem'
import { useAccount, useConfig, useWriteContract } from 'wagmi'
import { CHAINS } from '../../assets/chains'
import { useWalletAuthContext } from '../../context/WalletAuthContext'
import { useEvmChainSwitch } from '../../hooks/useEvmChainSwitch'
import { useArcYieldPoolHealth, useArcYieldPoolPosition, useArcYieldPoolStrategies, type StrategyOverview } from '../../hooks/useArcYieldPool'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { usdcBalanceQueryKey } from '../../hooks/useUsdcBalances'
import { logArcPoolDeposit, logArcPoolWithdraw } from '../../lib/activityLogWrites'
import {
  ARC_TESTNET_EVM_CHAIN_ID,
  ARC_YIELD_POOL_ABI,
  ARC_YIELD_POOL_USDC,
  describeArcYieldPoolError,
  getArcYieldPoolAddress,
  isArcYieldPoolDeployed,
  verifyArcYieldPoolUsdc,
} from '../../lib/arcYieldPoolClient'
import { getExplorerTxUrl } from '../../lib/explorer'
import { getBufferedFees } from '../../lib/gasFees'
import { amountError } from '../../lib/validation'
import FieldError from './FieldError'
import MaxButton from './MaxButton'
import ReviewModal from './ReviewModal'
import { SkeletonBlock } from './Skeleton'

const DAYS_PER_YEAR = 365

interface PhaseDisplay {
  state: 'idle' | 'pending' | 'success' | 'error'
  txHash?: string
  explorerUrl?: string
}

/** Simple client-side projection off a real, live-read APR — never a fabricated rate. Matches
 *  the contract's own linear-accrual model (principal * apr * elapsed / year) exactly. */
function projectRewards(principal: number, aprPercent: number) {
  const annual = principal * (aprPercent / 100)
  return { daily: annual / DAYS_PER_YEAR, monthly: annual / 12, yearly: annual }
}

export default function ArcYieldPoolPanel() {
  const deployed = isArcYieldPoolDeployed()
  const poolAddress = getArcYieldPoolAddress()

  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [strategyId, setStrategyId] = useState<0 | 1 | 2>(0)
  const [amount, setAmount] = useState('')
  const [touched, setTouched] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [depositing, setDepositing] = useState(false)
  const [depositError, setDepositError] = useState<string | null>(null)
  const [approvePhase, setApprovePhase] = useState<PhaseDisplay>({ state: 'idle' })
  const [depositPhase, setDepositPhase] = useState<PhaseDisplay>({ state: 'idle' })
  const [completedDeposit, setCompletedDeposit] = useState<{ txHash: string; explorerUrl?: string } | null>(null)

  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawTouched, setWithdrawTouched] = useState(false)
  const [withdrawReviewOpen, setWithdrawReviewOpen] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [completedWithdraw, setCompletedWithdraw] = useState<{ txHash: string; explorerUrl?: string } | null>(null)

  const { address: walletAddress } = useAccount()
  const { isAuthenticated } = useWalletAuthContext()
  const { isOnChain, ensureChain, isPending: switchPending } = useEvmChainSwitch()
  const { writeContractAsync } = useWriteContract()
  const wagmiConfig = useConfig()
  const queryClient = useQueryClient()

  const chain = CHAINS.arc
  const usdc = ARC_YIELD_POOL_USDC
  const usdcBalance = useTokenBalance(ARC_TESTNET_EVM_CHAIN_ID)
  const availableBalance = Number(usdcBalance.formatted)
  const position = useArcYieldPoolPosition()
  const health = useArcYieldPoolHealth()
  const { strategies } = useArcYieldPoolStrategies()

  const needsChainSwitch = !isOnChain(ARC_TESTNET_EVM_CHAIN_ID)
  const amountMsg = useMemo(() => amountError(amount, availableBalance), [amount, availableBalance])
  const isDepositValid = deployed && !amountMsg && !needsChainSwitch && isAuthenticated
  const selectedStrategy: StrategyOverview | undefined = strategies.find((s) => s.id === strategyId)
  const preview = selectedStrategy && Number(amount) > 0 ? projectRewards(Number(amount), selectedStrategy.aprPercent) : null

  const lockedUntilDate = position.lockedUntil > 0 ? new Date(position.lockedUntil * 1000) : null
  const isLocked = Boolean(lockedUntilDate && lockedUntilDate.getTime() > Date.now())
  const withdrawAmountMsg = useMemo(() => amountError(withdrawAmount, position.principalFormatted), [withdrawAmount, position.principalFormatted])
  const isWithdrawValid = deployed && !withdrawAmountMsg && position.active && !isLocked && !needsChainSwitch && isAuthenticated

  const handleDeposit = async () => {
    setDepositError(null)
    setApprovePhase({ state: 'idle' })
    setDepositPhase({ state: 'idle' })
    setCompletedDeposit(null)
    setDepositing(true)
    try {
      if (!walletAddress) throw new Error('Wallet not connected.')
      if (!isAuthenticated) throw new Error('Sign in with your wallet first — check the banner above.')
      if (!poolAddress || !usdc) throw new Error('ArcYieldPool is not deployed yet — refusing to proceed.')
      if (!isOnChain(ARC_TESTNET_EVM_CHAIN_ID)) throw new Error(`Switch your wallet to ${chain.shortLabel} to continue.`)

      const verified = await verifyArcYieldPoolUsdc(() =>
        readContract(wagmiConfig, { chainId: ARC_TESTNET_EVM_CHAIN_ID, address: poolAddress, abi: ARC_YIELD_POOL_ABI, functionName: 'usdc' }),
      )
      if (!verified) throw new Error('Could not re-verify the deployed pool points at real Arc USDC — refusing to proceed.')

      const parsedAmount = parseUnits(amount, usdc.decimals)

      setApprovePhase({ state: 'pending' })
      const allowance = await readContract(wagmiConfig, {
        chainId: ARC_TESTNET_EVM_CHAIN_ID,
        address: usdc.address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [walletAddress, poolAddress],
      })
      if (allowance < parsedAmount) {
        const approveFees = await getBufferedFees(wagmiConfig, ARC_TESTNET_EVM_CHAIN_ID)
        const approveHash = await writeContractAsync({
          chainId: ARC_TESTNET_EVM_CHAIN_ID,
          address: usdc.address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [poolAddress, parsedAmount],
          ...approveFees,
        })
        const approveReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: approveHash, chainId: ARC_TESTNET_EVM_CHAIN_ID })
        if (approveReceipt.status !== 'success') throw new Error('Approval reverted on-chain.')
        setApprovePhase({ state: 'success', txHash: approveHash, explorerUrl: getExplorerTxUrl(ARC_TESTNET_EVM_CHAIN_ID, approveHash) })
      } else {
        setApprovePhase({ state: 'success' })
      }

      setDepositPhase({ state: 'pending' })
      // Pre-flight simulate before ever prompting the wallet — catches a doomed call (e.g. an
      // existing position in a different strategy) as a clearly-decoded message instead of letting
      // the user pay gas for a transaction that was always going to revert.
      try {
        await simulateContract(wagmiConfig, {
          chainId: ARC_TESTNET_EVM_CHAIN_ID,
          address: poolAddress,
          abi: ARC_YIELD_POOL_ABI,
          functionName: 'deposit',
          args: [parsedAmount, strategyId],
          account: walletAddress,
        })
      } catch (simErr) {
        throw new Error(describeArcYieldPoolError(simErr))
      }

      const depositFees = await getBufferedFees(wagmiConfig, ARC_TESTNET_EVM_CHAIN_ID)
      const depositHash = await writeContractAsync({
        chainId: ARC_TESTNET_EVM_CHAIN_ID,
        address: poolAddress,
        abi: ARC_YIELD_POOL_ABI,
        functionName: 'deposit',
        args: [parsedAmount, strategyId],
        ...depositFees,
      })
      const depositReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: depositHash, chainId: ARC_TESTNET_EVM_CHAIN_ID })
      if (depositReceipt.status !== 'success') throw new Error('Deposit reverted on-chain.')
      const depositExplorerUrl = getExplorerTxUrl(ARC_TESTNET_EVM_CHAIN_ID, depositHash)
      setDepositPhase({ state: 'success', txHash: depositHash, explorerUrl: depositExplorerUrl })

      position.refetch()
      health.refetch()
      void queryClient.invalidateQueries({ queryKey: usdcBalanceQueryKey(ARC_TESTNET_EVM_CHAIN_ID, walletAddress) })

      try {
        await logArcPoolDeposit(walletAddress, {
          txHash: depositHash,
          amount,
          token: 'USDC',
          chain: chain.name,
          strategyLabel: selectedStrategy?.label ?? 'Flexible',
          explorerUrl: depositExplorerUrl,
        })
      } catch (logErr) {
        console.error('Failed to persist ArcYieldPool deposit to Firestore:', logErr)
      }

      setCompletedDeposit({ txHash: depositHash, explorerUrl: depositExplorerUrl })
      setAmount('')
      setTouched(false)
      setReviewOpen(false)
    } catch (err) {
      const message = describeArcYieldPoolError(err)
      const rejected = /user rejected|denied the transaction|user denied/i.test(message)
      setDepositError(rejected ? 'Deposit cancelled — the wallet request was rejected.' : message)
      setReviewOpen(false)
    } finally {
      setDepositing(false)
    }
  }

  const handleWithdraw = async () => {
    setWithdrawError(null)
    setCompletedWithdraw(null)
    setWithdrawing(true)
    try {
      if (!walletAddress) throw new Error('Wallet not connected.')
      if (!isAuthenticated) throw new Error('Sign in with your wallet first — check the banner above.')
      if (!poolAddress || !usdc) throw new Error('ArcYieldPool is not deployed yet — refusing to proceed.')
      if (!isOnChain(ARC_TESTNET_EVM_CHAIN_ID)) throw new Error(`Switch your wallet to ${chain.shortLabel} to continue.`)
      if (!position.active) throw new Error('No position to withdraw.')
      if (isLocked) throw new Error(`Still locked until ${lockedUntilDate?.toLocaleString()}.`)

      const parsedAmount = parseUnits(withdrawAmount, usdc.decimals)

      // Same pre-flight simulate as deposit — catches StillLocked/InsufficientReserve/
      // InsufficientPrincipal before the wallet prompt, with a clearly decoded message.
      try {
        await simulateContract(wagmiConfig, {
          chainId: ARC_TESTNET_EVM_CHAIN_ID,
          address: poolAddress,
          abi: ARC_YIELD_POOL_ABI,
          functionName: 'withdraw',
          args: [parsedAmount],
          account: walletAddress,
        })
      } catch (simErr) {
        throw new Error(describeArcYieldPoolError(simErr))
      }

      const withdrawFees = await getBufferedFees(wagmiConfig, ARC_TESTNET_EVM_CHAIN_ID)
      const hash = await writeContractAsync({
        chainId: ARC_TESTNET_EVM_CHAIN_ID,
        address: poolAddress,
        abi: ARC_YIELD_POOL_ABI,
        functionName: 'withdraw',
        args: [parsedAmount],
        ...withdrawFees,
      })
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: ARC_TESTNET_EVM_CHAIN_ID })
      if (receipt.status !== 'success') throw new Error('Withdrawal reverted on-chain.')
      const explorerUrl = getExplorerTxUrl(ARC_TESTNET_EVM_CHAIN_ID, hash)

      position.refetch()
      health.refetch()
      void queryClient.invalidateQueries({ queryKey: usdcBalanceQueryKey(ARC_TESTNET_EVM_CHAIN_ID, walletAddress) })

      try {
        await logArcPoolWithdraw(walletAddress, {
          txHash: hash,
          amount: withdrawAmount,
          token: 'USDC',
          chain: chain.name,
          strategyLabel: selectedStrategy?.label ?? 'Flexible',
          explorerUrl,
        })
      } catch (logErr) {
        console.error('Failed to persist ArcYieldPool withdrawal to Firestore:', logErr)
      }

      setCompletedWithdraw({ txHash: hash, explorerUrl })
      setWithdrawAmount('')
      setWithdrawTouched(false)
      setWithdrawReviewOpen(false)
    } catch (err) {
      const message = describeArcYieldPoolError(err)
      const rejected = /user rejected|denied the transaction|user denied/i.test(message)
      setWithdrawError(rejected ? 'Withdrawal cancelled — the wallet request was rejected.' : message)
      setWithdrawReviewOpen(false)
    } finally {
      setWithdrawing(false)
    }
  }

  if (!deployed) {
    return (
      <div className="empty-state p-10 rounded-xl border border-dashed border-white/[0.06] bg-white/[0.015]">
        <div className="empty-state-icon">
          <span className="material-symbols-outlined">rocket_launch</span>
        </div>
        <p className="empty-state-title">ArcYieldPool isn't deployed yet</p>
        <p className="empty-state-desc">
          The contract (contracts/contracts/ArcYieldPool.sol) is written and tested, but has no live address configured —
          set VITE_ARC_YIELD_POOL_ADDRESS once it's deployed to Arc Testnet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-gutter">
      <p className="text-[11px] text-on-surface-variant/50">
        Meridian's own contract, deployed on Arc Testnet — self-custodial, USDC only, no ETH needed for gas since Arc's
        native token IS USDC. Not audited — an experimental testnet prototype, never for real value.
      </p>

      <div className="glass rounded-2xl px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-[0.1em] mb-1">Total Deposits</p>
          <p className="font-mono-data text-sm font-bold">{health.isLoading ? '—' : `$${health.totalDepositsFormatted.toFixed(2)}`}</p>
        </div>
        <div>
          <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-[0.1em] mb-1">Reward Reserve</p>
          <p className="font-mono-data text-sm font-bold">{health.isLoading ? '—' : `$${health.reserveFormatted.toFixed(2)}`}</p>
        </div>
        <div>
          <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-[0.1em] mb-1">Reserve Coverage</p>
          <p className={`font-mono-data text-sm font-bold ${health.reserveCoveragePercent !== null && health.reserveCoveragePercent < 100 ? 'text-error' : 'text-tertiary'}`}>
            {health.isLoading ? '—' : health.reserveCoveragePercent === null ? 'No obligation' : `${health.reserveCoveragePercent.toFixed(0)}%`}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-[0.1em] mb-1">Runway</p>
          <p className="font-mono-data text-sm font-bold">
            {health.isLoading ? '—' : health.runwayDays === null ? '—' : `${health.runwayDays.toFixed(0)}d`}
          </p>
        </div>
      </div>

      <div className="glass rounded-3xl p-1.5 flex gap-1">
        <button type="button" onClick={() => setTab('deposit')} className={`flex-1 py-3 font-semibold rounded-2xl transition-premium text-sm ${tab === 'deposit' ? 'bg-primary/15 text-primary border border-primary/20' : 'text-on-surface-variant hover:text-on-surface border border-transparent'}`}>
          Deposit
        </button>
        <button type="button" onClick={() => setTab('withdraw')} className={`flex-1 py-3 font-semibold rounded-2xl transition-premium text-sm ${tab === 'withdraw' ? 'bg-primary/15 text-primary border border-primary/20' : 'text-on-surface-variant hover:text-on-surface border border-transparent'}`}>
          Withdraw
        </button>
      </div>

      {tab === 'deposit' ? (
        <div className="space-y-2">
          {completedDeposit && (
            <div className="banner-success animate-fade-in-up">
              <span className="material-symbols-outlined text-green-400 text-[20px] shrink-0">check_circle</span>
              <div className="min-w-0">
                <p className="text-body-sm text-green-400 font-medium">Deposit confirmed — now earning real yield on Arc.</p>
                {completedDeposit.explorerUrl && (
                  <a href={completedDeposit.explorerUrl} target="_blank" rel="noreferrer" className="text-[12px] text-green-400/80 underline underline-offset-2">
                    View deposit transaction
                  </a>
                )}
              </div>
            </div>
          )}
          {depositError && (
            <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-error/20 bg-error/5 animate-fade-in-up">
              <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
              <p className="text-body-sm text-error font-medium">{depositError}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {strategies.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStrategyId(s.id)}
                disabled={position.active && position.strategyId !== s.id}
                className={`panel rounded-2xl p-4 text-left transition-premium disabled:opacity-40 disabled:cursor-not-allowed ${
                  strategyId === s.id ? 'border-primary/40 bg-primary/[0.06]' : 'hover:border-white/12'
                }`}
              >
                <p className="text-[11px] font-bold text-on-surface-variant/70 mb-1">{s.label}</p>
                <p className="font-mono-data text-lg font-bold text-tertiary">{s.aprPercent.toFixed(2)}%</p>
                <p className="text-[10px] text-on-surface-variant/40 mt-1">{s.lockDays === 0 ? 'Withdraw any time' : `${s.lockDays}-day lock`}</p>
              </button>
            ))}
          </div>
          {position.active && (
            <p className="text-[11px] text-tertiary/80 px-1">
              You have an open position in {strategies.find((s) => s.id === position.strategyId)?.label} — depositing more
              tops that up (and restarts its lock, if any). Withdraw fully first to switch strategies.
            </p>
          )}

          <div className="panel rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <label htmlFor="arc-pool-amount" className="font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase">
                Amount to Deposit
              </label>
              {usdcBalance.isLoading ? (
                <SkeletonBlock className="h-4 w-28" />
              ) : (
                <span className="text-body-sm text-on-surface-variant/70 font-mono-data">
                  Balance: <span className="text-on-surface">{availableBalance.toFixed(2)} USDC</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <input
                id="arc-pool-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => setTouched(true)}
                inputMode="decimal"
                className="bg-transparent border-none p-0 text-[40px] font-headline-lg text-on-surface focus:ring-0 w-full placeholder:text-on-surface/20 tracking-tight tabular-nums"
                placeholder="0.00"
                type="text"
              />
              <MaxButton onClick={() => setAmount(String(availableBalance))} />
            </div>
            {touched && <FieldError message={amountMsg} />}
            {preview && (
              <p className="text-[11px] text-on-surface-variant/50 mt-3">
                At {selectedStrategy?.aprPercent.toFixed(2)}% APR: ≈ ${preview.daily.toFixed(4)}/day · ${preview.monthly.toFixed(2)}/month · $
                {preview.yearly.toFixed(2)}/year — a live projection off the pool's current rate, not a guarantee.
              </p>
            )}
          </div>

          {needsChainSwitch && (
            <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">sync_alt</span>
                <p className="text-body-sm text-tertiary font-medium">Switch to {chain.shortLabel} to continue</p>
              </div>
              <button type="button" onClick={() => ensureChain(ARC_TESTNET_EVM_CHAIN_ID)} disabled={switchPending} className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50">
                {switchPending ? 'Switching…' : `Switch to ${chain.shortLabel}`}
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
            className="btn-primary w-full py-5 rounded-2xl text-lg mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>{depositing ? 'Depositing…' : 'Deposit into Pool'}</span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>

          {(depositing || approvePhase.state !== 'idle') && (
            <div className="glass-premium rounded-2xl p-6 mt-4">
              <h4 className="field-label tracking-[0.12em] mb-6">Deposit Progress</h4>
              <div className="grid grid-cols-2 gap-4">
                {[{ label: 'Approve', p: approvePhase }, { label: 'Deposit', p: depositPhase }].map(({ label, p }) => {
                  const colorClass =
                    p.state === 'success'
                      ? 'text-green-400 border-green-400/30 bg-green-400/10'
                      : p.state === 'error'
                        ? 'text-error border-error/30 bg-error/10'
                        : p.state === 'pending'
                          ? 'text-tertiary border-tertiary/30 bg-tertiary/10 animate-pulse'
                          : 'text-on-surface-variant/55 border-white/10'
                  return (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <div className={`icon-well w-11 h-11 rounded-full border transition-premium ${colorClass}`}>
                        <span className="material-symbols-outlined text-lg">{p.state === 'success' ? 'check_circle' : p.state === 'error' ? 'error' : 'radio_button_unchecked'}</span>
                      </div>
                      <span className="font-mono-data text-xs font-bold text-on-surface-variant/60">{label}</span>
                      {p.txHash && p.explorerUrl ? (
                        <a href={p.explorerUrl} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline underline-offset-2">
                          View tx
                        </a>
                      ) : (
                        <p className="text-[10px] text-center px-1 text-on-surface-variant/40">{p.state === 'idle' ? '—' : p.state}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {completedWithdraw && (
            <div className="banner-success animate-fade-in-up">
              <span className="material-symbols-outlined text-green-400 text-[20px] shrink-0">check_circle</span>
              <div className="min-w-0">
                <p className="text-body-sm text-green-400 font-medium">Withdrawal confirmed — principal and rewards returned to your wallet.</p>
                {completedWithdraw.explorerUrl && (
                  <a href={completedWithdraw.explorerUrl} target="_blank" rel="noreferrer" className="text-[12px] text-green-400/80 underline underline-offset-2">
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

          {!position.active && !position.isLoading ? (
            <div className="empty-state p-10 rounded-xl border border-dashed border-white/[0.06] bg-white/[0.015]">
              <div className="empty-state-icon">
                <span className="material-symbols-outlined">savings</span>
              </div>
              <p className="empty-state-title">No position to withdraw</p>
              <p className="empty-state-desc">Deposit into the pool first to see withdrawal options here.</p>
            </div>
          ) : position.isLoading ? (
            <SkeletonBlock className="h-40 w-full rounded-2xl" />
          ) : (
            <>
              <div className="panel rounded-2xl p-6 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase">
                    {strategies.find((s) => s.id === position.strategyId)?.label ?? 'Position'}
                  </span>
                  <span className={`status-chip text-[9px] ${isLocked ? '!bg-error/10 !text-error' : ''}`}>
                    <span className={`status-chip-dot ${isLocked ? '' : 'status-chip-dot-live'}`} />
                    {isLocked ? `Locked until ${lockedUntilDate?.toLocaleDateString()}` : 'Unlocked'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-on-surface-variant/50 mb-1">Principal</p>
                    <p className="font-mono-data text-lg font-bold">{position.principalFormatted.toFixed(4)} USDC</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-on-surface-variant/50 mb-1">Rewards owed</p>
                    <p className="font-mono-data text-lg font-bold text-tertiary">{position.rewardsOwedFormatted.toFixed(6)} USDC</p>
                  </div>
                </div>
              </div>

              <div className="panel rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <label htmlFor="arc-pool-withdraw-amount" className="font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase">
                    Amount to Withdraw
                  </label>
                  <span className="text-body-sm text-on-surface-variant/70 font-mono-data">
                    Available: <span className="text-on-surface">{position.principalFormatted.toFixed(4)} USDC</span>
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    id="arc-pool-withdraw-amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    onBlur={() => setWithdrawTouched(true)}
                    inputMode="decimal"
                    className="bg-transparent border-none p-0 text-[40px] font-headline-lg text-on-surface focus:ring-0 w-full placeholder:text-on-surface/20 tracking-tight tabular-nums"
                    placeholder="0.00"
                    type="text"
                  />
                  <div className="flex gap-1.5 shrink-0">
                    {[0.25, 0.5, 0.75].map((frac) => (
                      <button
                        key={frac}
                        type="button"
                        onClick={() => setWithdrawAmount((position.principalFormatted * frac).toFixed(6))}
                        className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] font-bold text-on-surface-variant/70 hover:bg-white/[0.08] transition-premium"
                      >
                        {frac * 100}%
                      </button>
                    ))}
                    <MaxButton onClick={() => setWithdrawAmount(String(position.principalFormatted))} />
                  </div>
                </div>
                {withdrawTouched && <FieldError message={withdrawAmountMsg} />}
                {isLocked && (
                  <p className="text-[11px] text-error mt-2">Locked until {lockedUntilDate?.toLocaleString()} — withdrawal will revert until then.</p>
                )}
              </div>

              {needsChainSwitch && (
                <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">sync_alt</span>
                    <p className="text-body-sm text-tertiary font-medium">Switch to {chain.shortLabel} to continue</p>
                  </div>
                  <button type="button" onClick={() => ensureChain(ARC_TESTNET_EVM_CHAIN_ID)} disabled={switchPending} className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50">
                    {switchPending ? 'Switching…' : `Switch to ${chain.shortLabel}`}
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
            </>
          )}
        </div>
      )}

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={() => void handleDeposit()}
        confirming={depositing}
        title="Review ArcYieldPool Deposit"
        confirmLabel="Confirm Deposit"
        rows={[
          { label: 'Amount', value: `${amount || '0.00'} USDC`, accent: true },
          { label: 'Strategy', value: selectedStrategy?.label ?? 'Flexible' },
          { label: 'Live APR', value: `${selectedStrategy?.aprPercent.toFixed(2) ?? '—'}%` },
          { label: 'Route', value: 'Approve → ArcYieldPool.deposit()' },
        ]}
      />

      <ReviewModal
        open={withdrawReviewOpen}
        onClose={() => setWithdrawReviewOpen(false)}
        onConfirm={() => void handleWithdraw()}
        confirming={withdrawing}
        title="Review ArcYieldPool Withdrawal"
        confirmLabel="Confirm Withdrawal"
        rows={[
          { label: 'Amount', value: `${withdrawAmount || '0.00'} USDC`, accent: true },
          { label: 'Rewards included', value: `${position.rewardsOwedFormatted.toFixed(6)} USDC` },
          { label: 'Route', value: 'ArcYieldPool.withdraw()' },
        ]}
      />
    </div>
  )
}
