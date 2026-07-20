import { readContract, simulateContract, waitForTransactionReceipt } from '@wagmi/core'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { BaseError, decodeEventLog, erc20Abi, formatUnits, keccak256, pad, parseUnits, toHex, zeroAddress } from 'viem'
import { useAccount, useConfig, useWriteContract } from 'wagmi'
import { CHAINS } from '../../assets/chains'
import { USDC_BY_CHAIN } from '../../config/tokens'
import { useWalletAuthContext } from '../../context/WalletAuthContext'
import { useEvmChainSwitch } from '../../hooks/useEvmChainSwitch'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { useUniswapPool } from '../../hooks/useUniswapPool'
import { useUniswapPosition } from '../../hooks/useUniswapPosition'
import { usdcBalanceQueryKey } from '../../hooks/useUsdcBalances'
import { logUniswapDeposit, logUniswapWithdraw } from '../../lib/activityLogWrites'
import { getExplorerTxUrl } from '../../lib/explorer'
import { getBufferedFees } from '../../lib/gasFees'
import {
  MAX_UINT128,
  NFPM_ABI,
  SWAP_ROUTER_02_ABI,
  UNISWAP_CHAIN_IDS,
  UNISWAP_POOL_ABI,
  farDeadline,
  fullRangeTicks,
  getUniswapMarket,
  priceOfToken1InToken0,
  sortTokens,
  verifyUniswapPool,
  type UniswapChainId,
} from '../../lib/uniswapClient'
import { amountError } from '../../lib/validation'
import Dropdown from './Dropdown'
import FieldError from './FieldError'
import MaxButton from './MaxButton'
import ReviewModal from './ReviewModal'
import { SkeletonBlock } from './Skeleton'

/** Real ERC-721 Transfer event topic — computed from the actual signature string via viem's own
 *  keccak256, never a hand-recalled hex constant (a transcription error there would silently pick
 *  the wrong tokenId out of the mint receipt's logs). */
const TRANSFER_EVENT_TOPIC = keccak256(toHex('Transfer(address,address,uint256)'))
const ZERO_ADDRESS_TOPIC = pad(zeroAddress, { size: 32 })

/** Real Uniswap V3 pool Swap event — same "compute the topic at runtime, never hand-recall a hex
 *  constant" discipline as TRANSFER_EVENT_TOPIC above. Used to read the swap's actual output amount
 *  straight from the pool's own emitted event in the real receipt, rather than diffing two separate
 *  balanceOf reads bracketing the transaction — which is vulnerable to public-RPC read staleness
 *  (a follow-up read landing on a node that hasn't yet seen the block the swap confirmed in), the
 *  exact kind of infra flakiness this app has hit before on other testnets. */
const SWAP_EVENT_ABI = [
  {
    type: 'event',
    name: 'Swap',
    inputs: [
      { indexed: true, name: 'sender', type: 'address' },
      { indexed: true, name: 'recipient', type: 'address' },
      { indexed: false, name: 'amount0', type: 'int256' },
      { indexed: false, name: 'amount1', type: 'int256' },
      { indexed: false, name: 'sqrtPriceX96', type: 'uint160' },
      { indexed: false, name: 'liquidity', type: 'uint128' },
      { indexed: false, name: 'tick', type: 'int24' },
    ],
  },
] as const
const SWAP_EVENT_TOPIC = keccak256(toHex('Swap(address,address,int256,int256,uint160,uint128,int24)'))

/** Slippage tolerance for the swap leg and the mint leg respectively — wider than Aave's single-tx
 *  flow needs, because this is genuinely two separate wallet-confirmed transactions with real time
 *  (and real price drift, however small on a testnet) between them. */
const SWAP_SLIPPAGE_BPS = 100n // 1%
const MINT_SLIPPAGE_BPS = 100n // 1%

const CHAIN_OPTIONS = UNISWAP_CHAIN_IDS.map((id) => {
  const c = CHAINS[id]
  return { value: id, label: c.name, sublabel: c.layer, icon: <c.Icon className="w-7 h-7 shrink-0" /> }
})

type DepositPhase = 'swap' | 'approve' | 'mint'
type WithdrawPhase = 'decrease' | 'collect' | 'burn'
interface PhaseDisplay {
  state: 'idle' | 'pending' | 'success' | 'error'
  txHash?: string
  explorerUrl?: string
  errorMessage?: string
}
const IDLE_DEPOSIT_PHASES: Record<DepositPhase, PhaseDisplay> = {
  swap: { state: 'idle' },
  approve: { state: 'idle' },
  mint: { state: 'idle' },
}
const DEPOSIT_PHASE_META: { phase: DepositPhase; label: string }[] = [
  { phase: 'swap', label: 'Swap' },
  { phase: 'approve', label: 'Approve' },
  { phase: 'mint', label: 'Mint LP' },
]
const IDLE_WITHDRAW_PHASES: Record<WithdrawPhase, PhaseDisplay> = {
  decrease: { state: 'idle' },
  collect: { state: 'idle' },
  burn: { state: 'idle' },
}
const WITHDRAW_PHASE_META: { phase: WithdrawPhase; label: string }[] = [
  { phase: 'decrease', label: 'Remove' },
  { phase: 'collect', label: 'Collect' },
  { phase: 'burn', label: 'Burn NFT' },
]

const POOL_NAME = 'USDC-WETH Pool (Uniswap V3)'

export default function UniswapLiquidityPanel() {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [chainId, setChainId] = useState<UniswapChainId>('ethereum')
  const [amount, setAmount] = useState('')
  const [touched, setTouched] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [depositing, setDepositing] = useState(false)
  const [depositError, setDepositError] = useState<string | null>(null)
  const [depositPhases, setDepositPhases] = useState<Record<DepositPhase, PhaseDisplay>>(IDLE_DEPOSIT_PHASES)
  const [completedDeposit, setCompletedDeposit] = useState<{ txHash: string; explorerUrl?: string } | null>(null)

  const [withdrawReviewOpen, setWithdrawReviewOpen] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawPhases, setWithdrawPhases] = useState<Record<WithdrawPhase, PhaseDisplay>>(IDLE_WITHDRAW_PHASES)
  const [completedWithdraw, setCompletedWithdraw] = useState<{ txHash: string; explorerUrl?: string } | null>(null)

  const { address: walletAddress } = useAccount()
  const { isAuthenticated } = useWalletAuthContext()
  const { isOnChain, ensureChain, isPending: switchPending } = useEvmChainSwitch()
  const { writeContractAsync } = useWriteContract()
  const wagmiConfig = useConfig()
  const queryClient = useQueryClient()

  const chain = CHAINS[chainId]
  const evmChainId = chain.evmChainId!
  const market = getUniswapMarket(evmChainId)
  const usdc = USDC_BY_CHAIN[evmChainId]
  const pool = useUniswapPool(evmChainId)
  const position = useUniswapPosition(evmChainId)
  const usdcBalance = useTokenBalance(evmChainId)
  const availableBalance = Number(usdcBalance.formatted)

  const needsChainSwitch = !isOnChain(evmChainId)
  const amountMsg = useMemo(() => amountError(amount, availableBalance), [amount, availableBalance])
  const isDepositValid = !amountMsg && !needsChainSwitch && isAuthenticated && pool.isLive

  const [token0, token1] = usdc && market ? sortTokens(usdc.address, market.weth) : [undefined, undefined]
  const usdcIsToken0 = Boolean(token0 && usdc && token0.toLowerCase() === usdc.address.toLowerCase())

  /** Rough preview only — the actual mint always uses real post-swap wallet balances with their
   *  own slippage-protected minimums, never this estimate directly. */
  const previewWeth = useMemo(() => {
    if (!pool.sqrtPriceX96 || !amount || Number(amount) <= 0 || !usdc) return null
    const half = Number(amount) / 2
    const price = priceOfToken1InToken0(pool.sqrtPriceX96, usdcIsToken0 ? usdc.decimals : 18, usdcIsToken0 ? 18 : usdc.decimals)
    // priceOfToken1InToken0 returns "1 unit of token0 = price units of token1". If USDC is token0
    // (WETH is token1), price is WETH-per-USDC (a tiny number) -> multiply by the USDC amount to
    // get WETH. If USDC is token1 instead, price is USDC-per-WETH (a large number) -> divide.
    return usdcIsToken0 ? half * price : half / price
  }, [pool.sqrtPriceX96, amount, usdc, usdcIsToken0])

  async function ensureAllowance(tokenAddress: `0x${string}`, spender: `0x${string}`, amountNeeded: bigint) {
    const allowance = await readContract(wagmiConfig, {
      chainId: evmChainId,
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [walletAddress!, spender],
    })
    if (allowance >= amountNeeded) return
    const fees = await getBufferedFees(wagmiConfig, evmChainId)
    const hash = await writeContractAsync({
      chainId: evmChainId,
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amountNeeded],
      ...fees,
    })
    const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: evmChainId })
    if (receipt.status !== 'success') throw new Error('Approval reverted on-chain.')
  }

  const handleDeposit = async () => {
    setDepositError(null)
    setDepositPhases(IDLE_DEPOSIT_PHASES)
    setCompletedDeposit(null)
    setDepositing(true)
    try {
      if (!walletAddress) throw new Error('Wallet not connected.')
      if (!isAuthenticated) throw new Error('Sign in with your wallet first — check the banner above.')
      if (!market || !usdc || !token0 || !token1) throw new Error('This chain is not a verified Uniswap V3 market right now.')
      if (!isOnChain(evmChainId)) throw new Error(`Switch your wallet to ${chain.shortLabel} to continue.`)

      // Live re-verification at call time, not just build time — mirrors aaveClient.ts's
      // getAaveMarket() discipline. Refuses to proceed if the pool no longer resolves or its
      // tokens no longer match what this app expects.
      const verified = await verifyUniswapPool(
        { readContract: (args: unknown) => readContract(wagmiConfig, { chainId: evmChainId, ...(args as object) } as Parameters<typeof readContract>[1]) },
        evmChainId,
      )
      if (!verified) throw new Error('Could not re-verify a live pool for this chain right now — refusing to proceed with a real deposit.')

      const parsedAmount = parseUnits(amount, usdc.decimals)
      const halfForSwap = parsedAmount / 2n
      const remainingUsdc = parsedAmount - halfForSwap

      // ---- Swap phase: half the USDC into WETH via Uniswap's own router (Circle's Swap Kit
      // doesn't cover this chain for this leg) ----
      setDepositPhases((p) => ({ ...p, swap: { state: 'pending' } }))
      await ensureAllowance(usdc.address, market.swapRouter02, halfForSwap)

      const slot0 = await readContract(wagmiConfig, {
        chainId: evmChainId,
        address: verified.pool,
        abi: UNISWAP_POOL_ABI,
        functionName: 'slot0',
      })
      const price = priceOfToken1InToken0(slot0[0], usdcIsToken0 ? usdc.decimals : 18, usdcIsToken0 ? 18 : usdc.decimals)
      // Same convention as previewWeth above: price is "1 token0 = price units of token1".
      const expectedWeth = usdcIsToken0 ? Number(formatUnits(halfForSwap, usdc.decimals)) * price : Number(formatUnits(halfForSwap, usdc.decimals)) / price
      const minWethOut = parseUnits((expectedWeth * (1 - Number(SWAP_SLIPPAGE_BPS) / 10_000)).toFixed(18), 18)

      // Fallback only (see below) — the primary source of truth is the Swap event decoded from
      // the real receipt, not this balance snapshot.
      const wethBeforeFallback = await readContract(wagmiConfig, {
        chainId: evmChainId,
        address: market.weth,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress],
      })

      const swapFees = await getBufferedFees(wagmiConfig, evmChainId)
      const swapHash = await writeContractAsync({
        chainId: evmChainId,
        address: market.swapRouter02,
        abi: SWAP_ROUTER_02_ABI,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: usdc.address,
            tokenOut: market.weth,
            fee: market.fee,
            recipient: walletAddress,
            amountIn: halfForSwap,
            amountOutMinimum: minWethOut,
            sqrtPriceLimitX96: 0n,
          },
        ],
        ...swapFees,
      })
      const swapReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: swapHash, chainId: evmChainId })
      if (swapReceipt.status !== 'success') throw new Error('Swap reverted on-chain.')
      setDepositPhases((p) => ({ ...p, swap: { state: 'success', txHash: swapHash, explorerUrl: getExplorerTxUrl(evmChainId, swapHash) } }))

      // Ground truth: decode the pool's own Swap event from the real receipt. amount0/amount1 are
      // signed from the pool's perspective — negative means the pool paid it out (i.e. the user
      // received it), positive means the pool took it in. Whichever side is WETH, its value here
      // will be negative; the received amount is its negation.
      let wethForMint: bigint | null = null
      const swapLog = swapReceipt.logs.find((log) => log.address.toLowerCase() === verified.pool.toLowerCase() && log.topics[0] === SWAP_EVENT_TOPIC)
      if (swapLog) {
        try {
          const decoded = decodeEventLog({ abi: SWAP_EVENT_ABI, data: swapLog.data, topics: swapLog.topics })
          const wethIsAmount0 = !usdcIsToken0
          const wethDelta = wethIsAmount0 ? decoded.args.amount0 : decoded.args.amount1
          if (wethDelta < 0n) wethForMint = -wethDelta
        } catch (decodeErr) {
          console.error('[UniswapLiquidityPanel] Failed to decode Swap event, falling back to balance diff:', decodeErr)
        }
      }
      if (wethForMint === null) {
        // Fallback path — only reached if the Swap event wasn't found/decodable. A public RPC read
        // shortly after a confirmed receipt can occasionally hit a lagging node, so this is treated
        // as a fallback, not the primary check.
        const wethAfterFallback = await readContract(wagmiConfig, {
          chainId: evmChainId,
          address: market.weth,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [walletAddress],
        })
        wethForMint = wethAfterFallback - wethBeforeFallback
      }
      if (wethForMint <= 0n) throw new Error('Swap produced no WETH — refusing to proceed with mint.')

      // ---- Approve phase: both tokens to the NFPM ----
      setDepositPhases((p) => ({ ...p, approve: { state: 'pending' } }))
      await ensureAllowance(usdc.address, market.nfpm, remainingUsdc)
      await ensureAllowance(market.weth, market.nfpm, wethForMint)
      setDepositPhases((p) => ({ ...p, approve: { state: 'success' } }))

      // ---- Mint phase ----
      setDepositPhases((p) => ({ ...p, mint: { state: 'pending' } }))
      const { tickLower, tickUpper } = fullRangeTicks(market.tickSpacing)
      const amount0Desired = usdcIsToken0 ? remainingUsdc : wethForMint
      const amount1Desired = usdcIsToken0 ? wethForMint : remainingUsdc
      const amount0Min = (amount0Desired * (10_000n - MINT_SLIPPAGE_BPS)) / 10_000n
      const amount1Min = (amount1Desired * (10_000n - MINT_SLIPPAGE_BPS)) / 10_000n
      const deadline = farDeadline()

      const mintParams = {
        token0,
        token1,
        fee: market.fee,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        recipient: walletAddress,
        deadline,
      } as const

      const simulated = await simulateContract(wagmiConfig, {
        chainId: evmChainId,
        address: market.nfpm,
        abi: NFPM_ABI,
        functionName: 'mint',
        args: [mintParams],
        account: walletAddress,
      })

      const mintFees = await getBufferedFees(wagmiConfig, evmChainId)
      const mintHash = await writeContractAsync({
        chainId: evmChainId,
        address: market.nfpm,
        abi: NFPM_ABI,
        functionName: 'mint',
        args: [mintParams],
        ...mintFees,
      })
      const mintReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: mintHash, chainId: evmChainId })
      if (mintReceipt.status !== 'success') throw new Error('Mint reverted on-chain.')

      // Ground-truth tokenId decoded from the real receipt's Transfer(0x0 -> recipient) log —
      // cross-checked against the simulated value rather than trusted blindly.
      const transferLog = mintReceipt.logs.find(
        (log) =>
          log.address.toLowerCase() === market.nfpm.toLowerCase() &&
          log.topics[0] === TRANSFER_EVENT_TOPIC &&
          log.topics[1] === ZERO_ADDRESS_TOPIC,
      )
      const realTokenId = transferLog?.topics[3] ? BigInt(transferLog.topics[3]) : simulated.result[0]
      if (transferLog?.topics[3] && BigInt(transferLog.topics[3]) !== simulated.result[0]) {
        console.error('[UniswapLiquidityPanel] simulated tokenId did not match the real minted tokenId — using the real one.', {
          simulated: simulated.result[0].toString(),
          real: realTokenId.toString(),
        })
      }

      const mintExplorerUrl = getExplorerTxUrl(evmChainId, mintHash)
      setDepositPhases((p) => ({ ...p, mint: { state: 'success', txHash: mintHash, explorerUrl: mintExplorerUrl } }))

      position.refetch()
      pool.refetch()
      void queryClient.invalidateQueries({ queryKey: usdcBalanceQueryKey(evmChainId, walletAddress) })

      try {
        await logUniswapDeposit(walletAddress, {
          txHash: mintHash,
          chain: chain.name,
          poolName: POOL_NAME,
          tokenId: realTokenId.toString(),
          amount0: formatUnits(simulated.result[2], usdcIsToken0 ? usdc.decimals : 18),
          amount1: formatUnits(simulated.result[3], usdcIsToken0 ? 18 : usdc.decimals),
          token0Symbol: usdcIsToken0 ? 'USDC' : 'WETH',
          token1Symbol: usdcIsToken0 ? 'WETH' : 'USDC',
          explorerUrl: mintExplorerUrl,
        })
      } catch (logErr) {
        console.error('Failed to persist Uniswap deposit to Firestore:', logErr)
      }

      setCompletedDeposit({ txHash: mintHash, explorerUrl: mintExplorerUrl })
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
    }
  }

  const handleWithdraw = async () => {
    setWithdrawError(null)
    setWithdrawPhases(IDLE_WITHDRAW_PHASES)
    setCompletedWithdraw(null)
    setWithdrawing(true)
    try {
      if (!walletAddress) throw new Error('Wallet not connected.')
      if (!isAuthenticated) throw new Error('Sign in with your wallet first — check the banner above.')
      if (!market || !usdc) throw new Error('This chain is not a verified Uniswap V3 market right now.')
      if (!isOnChain(evmChainId)) throw new Error(`Switch your wallet to ${chain.shortLabel} to continue.`)
      if (!position.hasPosition || position.tokenId === undefined) throw new Error('No position to withdraw on this chain.')

      // Re-read live liquidity right before decreasing — never trust a value that could be stale
      // by even one block, same discipline as verifyUniswapPool for deposit.
      const freshPosition = await readContract(wagmiConfig, {
        chainId: evmChainId,
        address: market.nfpm,
        abi: NFPM_ABI,
        functionName: 'positions',
        args: [position.tokenId],
      })
      const liveLiquidity = freshPosition[7]
      if (liveLiquidity <= 0n) throw new Error('This position has no liquidity left to remove.')

      const amount0Min = (position.currentAmount0 * (10_000n - MINT_SLIPPAGE_BPS)) / 10_000n
      const amount1Min = (position.currentAmount1 * (10_000n - MINT_SLIPPAGE_BPS)) / 10_000n
      const deadline = farDeadline()

      setWithdrawPhases((p) => ({ ...p, decrease: { state: 'pending' } }))
      const decreaseFees = await getBufferedFees(wagmiConfig, evmChainId)
      const decreaseHash = await writeContractAsync({
        chainId: evmChainId,
        address: market.nfpm,
        abi: NFPM_ABI,
        functionName: 'decreaseLiquidity',
        args: [{ tokenId: position.tokenId, liquidity: liveLiquidity, amount0Min, amount1Min, deadline }],
        ...decreaseFees,
      })
      const decreaseReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: decreaseHash, chainId: evmChainId })
      if (decreaseReceipt.status !== 'success') throw new Error('Remove-liquidity reverted on-chain.')
      setWithdrawPhases((p) => ({ ...p, decrease: { state: 'success', txHash: decreaseHash, explorerUrl: getExplorerTxUrl(evmChainId, decreaseHash) } }))

      setWithdrawPhases((p) => ({ ...p, collect: { state: 'pending' } }))
      const collectParams = { tokenId: position.tokenId, recipient: walletAddress, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 } as const
      const simulatedCollect = await simulateContract(wagmiConfig, {
        chainId: evmChainId,
        address: market.nfpm,
        abi: NFPM_ABI,
        functionName: 'collect',
        args: [collectParams],
        account: walletAddress,
      })
      const collectFees = await getBufferedFees(wagmiConfig, evmChainId)
      const collectHash = await writeContractAsync({
        chainId: evmChainId,
        address: market.nfpm,
        abi: NFPM_ABI,
        functionName: 'collect',
        args: [collectParams],
        ...collectFees,
      })
      const collectReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: collectHash, chainId: evmChainId })
      if (collectReceipt.status !== 'success') throw new Error('Collect reverted on-chain.')
      setWithdrawPhases((p) => ({ ...p, collect: { state: 'success', txHash: collectHash, explorerUrl: getExplorerTxUrl(evmChainId, collectHash) } }))

      setWithdrawPhases((p) => ({ ...p, burn: { state: 'pending' } }))
      const burnFees = await getBufferedFees(wagmiConfig, evmChainId)
      const burnHash = await writeContractAsync({
        chainId: evmChainId,
        address: market.nfpm,
        abi: NFPM_ABI,
        functionName: 'burn',
        args: [position.tokenId],
        ...burnFees,
      })
      const burnReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: burnHash, chainId: evmChainId })
      if (burnReceipt.status !== 'success') throw new Error('Burn reverted on-chain.')
      const burnExplorerUrl = getExplorerTxUrl(evmChainId, burnHash)
      setWithdrawPhases((p) => ({ ...p, burn: { state: 'success', txHash: burnHash, explorerUrl: burnExplorerUrl } }))

      position.refetch()
      pool.refetch()
      void queryClient.invalidateQueries({ queryKey: usdcBalanceQueryKey(evmChainId, walletAddress) })

      try {
        await logUniswapWithdraw(walletAddress, {
          txHash: burnHash,
          chain: chain.name,
          poolName: POOL_NAME,
          tokenId: position.tokenId.toString(),
          amount0: formatUnits(simulatedCollect.result[0], usdcIsToken0 ? usdc.decimals : 18),
          amount1: formatUnits(simulatedCollect.result[1], usdcIsToken0 ? 18 : usdc.decimals),
          token0Symbol: usdcIsToken0 ? 'USDC' : 'WETH',
          token1Symbol: usdcIsToken0 ? 'WETH' : 'USDC',
          explorerUrl: burnExplorerUrl,
        })
      } catch (logErr) {
        console.error('Failed to persist Uniswap withdrawal to Firestore:', logErr)
      }

      setCompletedWithdraw({ txHash: burnHash, explorerUrl: burnExplorerUrl })
      setWithdrawReviewOpen(false)
    } catch (err) {
      const message = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : 'Withdrawal failed.'
      const rejected = /user rejected|denied the transaction|user denied/i.test(message)
      setWithdrawError(rejected ? 'Withdrawal cancelled — the wallet request was rejected.' : message)
      setWithdrawReviewOpen(false)
    } finally {
      setWithdrawing(false)
    }
  }

  const usdcLabel = 'USDC'
  const wethLabel = 'WETH'

  return (
    <div className="space-y-gutter">
      <p className="text-[11px] text-on-surface-variant/50">
        Fee tier {(market?.fee ?? 0) / 10_000}% · Full-range position · Self-custodial — the LP position NFT is minted
        directly to your own wallet, Meridian never holds it.
      </p>

      <div className="glass rounded-2xl px-5 py-4 space-y-2 border-tertiary/15 bg-tertiary/[0.03]">
        <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
          <span className="font-semibold text-tertiary">New risk vs. the Aave pool above:</span> this position holds two
          assets (USDC + WETH), so its value moves with WETH's price — including impermanent loss if that price shifts a
          lot from where you deposited. A full-range position never goes out of range, but it also earns less per dollar
          than a tight range would. Prices on this testnet pool don't reflect real market rates, so amounts below are
          shown in USDC/WETH directly rather than converted to a single dollar figure.
        </p>
      </div>

      <div className="glass rounded-3xl p-1.5 flex gap-1">
        <button
          type="button"
          onClick={() => setTab('deposit')}
          className={`flex-1 py-3 font-semibold rounded-2xl transition-premium text-sm ${
            tab === 'deposit'
              ? 'bg-primary/15 text-primary border border-primary/20'
              : 'text-on-surface-variant hover:text-on-surface border border-transparent'
          }`}
        >
          Deposit
        </button>
        <button
          type="button"
          onClick={() => setTab('withdraw')}
          className={`flex-1 py-3 font-semibold rounded-2xl transition-premium text-sm ${
            tab === 'withdraw'
              ? 'bg-primary/15 text-primary border border-primary/20'
              : 'text-on-surface-variant hover:text-on-surface border border-transparent'
          }`}
        >
          Withdraw
        </button>
      </div>

      <div className="panel rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <label className="font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase">Chain</label>
        </div>
        <Dropdown
          value={chainId}
          onChange={(v) => setChainId(v as UniswapChainId)}
          options={CHAIN_OPTIONS}
          ariaLabel="Select chain"
          triggerClassName="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] transition-premium hover:border-white/12"
          renderTrigger={(_selected, open) => (
            <>
              <div className="flex items-center gap-3">
                <chain.Icon className="w-9 h-9" />
                <div className="text-left">
                  <p className="font-bold leading-tight tracking-tight text-sm">{chain.shortLabel}</p>
                  <p className="text-[11px] text-on-surface-variant/55">
                    {pool.usdcReserveFormatted ? `Pool: ${Number(pool.usdcReserveFormatted).toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC + ${Number(pool.wethReserveFormatted).toFixed(2)} WETH` : 'Loading pool…'}
                  </p>
                </div>
              </div>
              <span className={`material-symbols-outlined opacity-40 transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
            </>
          )}
        />
      </div>

      {tab === 'deposit' ? (
        <div className="space-y-2">
          {completedDeposit && (
            <div className="banner-success animate-fade-in-up">
              <span className="material-symbols-outlined text-green-400 text-[20px] shrink-0">check_circle</span>
              <div className="min-w-0">
                <p className="text-body-sm text-green-400 font-medium">LP position minted — held directly in your wallet.</p>
                {completedDeposit.explorerUrl && (
                  <a href={completedDeposit.explorerUrl} target="_blank" rel="noreferrer" className="text-[12px] text-green-400/80 underline underline-offset-2">
                    View mint transaction
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

          <div className="panel rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <label htmlFor="uni-amount" className="font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase">
                Total USDC to deposit
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
                id="uni-amount"
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
            {previewWeth !== null && Number(amount) > 0 && (
              <p className="text-[11px] text-on-surface-variant/50 mt-3">
                ≈ {(Number(amount) / 2).toFixed(2)} {usdcLabel} deposited directly, ≈ {(Number(amount) / 2).toFixed(2)} {usdcLabel}
                {' '}swapped for ≈ {previewWeth.toFixed(6)} {wethLabel} first — Uniswap needs both sides to mint an LP
                position. Exact split depends on the live swap and may differ slightly.
              </p>
            )}
          </div>

          {needsChainSwitch && (
            <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">sync_alt</span>
                <p className="text-body-sm text-tertiary font-medium">Switch to {chain.shortLabel} to continue</p>
              </div>
              <button type="button" onClick={() => ensureChain(evmChainId)} disabled={switchPending} className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50">
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

          {(depositing || depositPhases.swap.state !== 'idle') && (
            <div className="glass-premium rounded-2xl p-6 mt-4">
              <h4 className="field-label tracking-[0.12em] mb-6">Deposit Progress</h4>
              <div className="grid grid-cols-3 gap-4">
                {DEPOSIT_PHASE_META.map(({ phase, label }) => {
                  const p = depositPhases[phase]
                  const colorClass =
                    p.state === 'success'
                      ? 'text-green-400 border-green-400/30 bg-green-400/10'
                      : p.state === 'error'
                        ? 'text-error border-error/30 bg-error/10'
                        : p.state === 'pending'
                          ? 'text-tertiary border-tertiary/30 bg-tertiary/10 animate-pulse'
                          : 'text-on-surface-variant/55 border-white/10'
                  return (
                    <div key={phase} className="flex flex-col items-center gap-2">
                      <div className={`icon-well w-11 h-11 rounded-full border transition-premium ${colorClass}`}>
                        <span className="material-symbols-outlined text-lg">
                          {p.state === 'success' ? 'check_circle' : p.state === 'error' ? 'error' : 'radio_button_unchecked'}
                        </span>
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
                <p className="text-body-sm text-green-400 font-medium">Position withdrawn — funds and fees returned to your wallet.</p>
                {completedWithdraw.explorerUrl && (
                  <a href={completedWithdraw.explorerUrl} target="_blank" rel="noreferrer" className="text-[12px] text-green-400/80 underline underline-offset-2">
                    View burn transaction
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

          {!position.hasPosition && !position.isLoading ? (
            <div className="empty-state p-10 rounded-xl border border-dashed border-white/[0.06] bg-white/[0.015]">
              <div className="empty-state-icon">
                <span className="material-symbols-outlined">account_balance</span>
              </div>
              <p className="empty-state-title">No position on {chain.shortLabel}</p>
              <p className="empty-state-desc">Deposit into the pool first to see withdrawal options here.</p>
            </div>
          ) : position.isLoading ? (
            <SkeletonBlock className="h-40 w-full rounded-2xl" />
          ) : (
            <>
              <div className="panel rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase">Your Position</span>
                  <span className={`status-chip text-[9px] ${position.inRange ? '' : '!bg-error/10 !text-error'}`}>
                    <span className={`status-chip-dot ${position.inRange ? 'status-chip-dot-live' : ''}`} />
                    {position.inRange === null ? 'Loading…' : position.inRange ? 'In Range' : 'Out of Range'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-on-surface-variant/50 mb-1">Current value</p>
                    <p className="font-mono-data text-lg font-bold">
                      {Number(position.currentAmount0Formatted).toFixed(4)} {usdcIsToken0 ? usdcLabel : wethLabel}
                    </p>
                    <p className="font-mono-data text-lg font-bold">
                      {Number(position.currentAmount1Formatted).toFixed(6)} {usdcIsToken0 ? wethLabel : usdcLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-on-surface-variant/50 mb-1">Unclaimed fees (as of last update)</p>
                    <p className="font-mono-data text-sm text-tertiary">
                      {Number(position.unclaimedFees0Formatted).toFixed(6)} {usdcIsToken0 ? usdcLabel : wethLabel}
                    </p>
                    <p className="font-mono-data text-sm text-tertiary">
                      {Number(position.unclaimedFees1Formatted).toFixed(8)} {usdcIsToken0 ? wethLabel : usdcLabel}
                    </p>
                  </div>
                </div>
              </div>

              {needsChainSwitch && (
                <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">sync_alt</span>
                    <p className="text-body-sm text-tertiary font-medium">Switch to {chain.shortLabel} to continue</p>
                  </div>
                  <button type="button" onClick={() => ensureChain(evmChainId)} disabled={switchPending} className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50">
                    {switchPending ? 'Switching…' : `Switch to ${chain.shortLabel}`}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setWithdrawReviewOpen(true)}
                disabled={needsChainSwitch || withdrawing || !isAuthenticated}
                className="btn-secondary w-full py-5 rounded-2xl text-lg disabled:cursor-not-allowed disabled:opacity-40"
              >
                {withdrawing ? 'Withdrawing…' : 'Withdraw Entire Position'}
              </button>
              <p className="text-[11px] text-center text-on-surface-variant/40">
                Removes all liquidity, collects fees, and burns the position NFT — three transactions, all self-custodial.
              </p>

              {(withdrawing || withdrawPhases.decrease.state !== 'idle') && (
                <div className="glass-premium rounded-2xl p-6 mt-4">
                  <h4 className="field-label tracking-[0.12em] mb-6">Withdraw Progress</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {WITHDRAW_PHASE_META.map(({ phase, label }) => {
                      const p = withdrawPhases[phase]
                      const colorClass =
                        p.state === 'success'
                          ? 'text-green-400 border-green-400/30 bg-green-400/10'
                          : p.state === 'error'
                            ? 'text-error border-error/30 bg-error/10'
                            : p.state === 'pending'
                              ? 'text-tertiary border-tertiary/30 bg-tertiary/10 animate-pulse'
                              : 'text-on-surface-variant/55 border-white/10'
                      return (
                        <div key={phase} className="flex flex-col items-center gap-2">
                          <div className={`icon-well w-11 h-11 rounded-full border transition-premium ${colorClass}`}>
                            <span className="material-symbols-outlined text-lg">
                              {p.state === 'success' ? 'check_circle' : p.state === 'error' ? 'error' : 'radio_button_unchecked'}
                            </span>
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
            </>
          )}
        </div>
      )}

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={() => void handleDeposit()}
        confirming={depositing}
        title="Review Uniswap V3 Deposit"
        confirmLabel="Confirm Deposit"
        rows={[
          { label: 'Total amount', value: `${amount || '0.00'} USDC`, accent: true },
          { label: 'Chain', value: chain.name },
          { label: 'Pool', value: `USDC/WETH ${(market?.fee ?? 0) / 10_000}%` },
          { label: 'Position range', value: 'Full range' },
          { label: 'Route', value: 'Uniswap swap → Uniswap V3 mint' },
        ]}
      />

      <ReviewModal
        open={withdrawReviewOpen}
        onClose={() => setWithdrawReviewOpen(false)}
        onConfirm={() => void handleWithdraw()}
        confirming={withdrawing}
        title="Review Uniswap V3 Withdrawal"
        confirmLabel="Confirm Withdrawal"
        rows={[
          { label: 'Chain', value: chain.name },
          { label: 'Position value', value: `${Number(position.currentAmount0Formatted).toFixed(4)} / ${Number(position.currentAmount1Formatted).toFixed(6)}`, accent: true },
          { label: 'Route', value: 'Remove liquidity → Collect → Burn NFT' },
        ]}
      />
    </div>
  )
}
