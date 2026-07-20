import type { Address } from 'viem'
import { sepolia, baseSepolia } from 'viem/chains'
import { USDC_BY_CHAIN } from '../config/tokens'

/**
 * Real Uniswap V3 testnet deployments — verified two ways before use here, same discipline as
 * aaveClient.ts: (1) cross-checked Uniswap's own docs.uniswap.org deployment pages, and (2) called
 * Factory.getPool()/Pool.token0()/token1()/liquidity() and ERC20.balanceOf(pool) directly against
 * live public RPCs (2026-07-20) to confirm a real, non-empty USDC-WETH pool exists, not just that
 * the Factory/NFPM contracts have code.
 *
 * Six EVM testnets were checked. Two passed cleanly:
 * - Ethereum Sepolia: deepest by far — the 1% fee pool alone held ~21.2M USDC / ~1,370 WETH.
 * - Base Sepolia: real but far thinner — the 0.3% fee pool held ~3,234 USDC / ~2.31 WETH.
 * Excluded despite being technically "real": Arbitrum Sepolia (~$2.5k in its deepest pool) and
 * Optimism Sepolia (~$177, one fee tier only) — both would give a deposit-sized-for-testing
 * meaningful price impact, which reads as broken rather than as a genuine yield destination.
 * Fully ruled out: Polygon Amoy (Factory/NFPM deployed with real code, but getPool() returns the
 * zero address at every standard fee tier — infrastructure exists, no pool was ever created) and
 * Avalanche Fuji (no Uniswap V3 deployment at all — confirmed via Uniswap/docs issue #703, open
 * and unanswered since May 2024; PR #629 only ever added mainnet C-Chain addresses).
 *
 * Fee tier per chain is whichever standard tier (100/500/3000/10000 bps) actually held the
 * deepest real reserves at verification time — not assumed, read live.
 */
export const UNISWAP_CHAIN_IDS = ['ethereum', 'base'] as const
export type UniswapChainId = (typeof UNISWAP_CHAIN_IDS)[number]

export interface UniswapMarketConfig {
  factory: Address
  nfpm: Address
  swapRouter02: Address
  weth: Address
  /** Standard Uniswap V3 fee, in hundredths of a bip (e.g. 3000 = 0.30%). */
  fee: number
  /** Real tick spacing for this fee tier — used to compute valid full-range ticks. */
  tickSpacing: number
}

const UNISWAP_MARKET_BY_EVM_CHAIN_ID: Record<number, UniswapMarketConfig> = {
  [sepolia.id]: {
    factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
    nfpm: '0x1238536071E1c677A632429e3655c799b22cDA52',
    swapRouter02: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
    weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    fee: 10000,
    tickSpacing: 200,
  },
  [baseSepolia.id]: {
    factory: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    nfpm: '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2',
    swapRouter02: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4',
    weth: '0x4200000000000000000000000000000000000006',
    fee: 3000,
    tickSpacing: 60,
  },
}

export function getUniswapMarket(evmChainId: number): UniswapMarketConfig | undefined {
  return UNISWAP_MARKET_BY_EVM_CHAIN_ID[evmChainId]
}

/** Full range, protocol-wide tick bounds (TickMath.MIN_TICK / MAX_TICK) — the absolute limits any tick can take. */
const MIN_TICK = -887272
const MAX_TICK = 887272

/** Rounds a tick to the nearest valid multiple of the pool's tick spacing, clamped inside [MIN_TICK, MAX_TICK]. */
export function nearestUsableTick(tick: number, tickSpacing: number): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing
  if (rounded < MIN_TICK) return rounded + tickSpacing
  if (rounded > MAX_TICK) return rounded - tickSpacing
  return rounded
}

/** Full-range [tickLower, tickUpper] for a given fee tier's tick spacing — the widest valid range, so a v1
 *  position never goes out-of-range and never needs a rebalance UI. Lower capital efficiency than a
 *  concentrated range is the deliberate tradeoff (see Liquidity.tsx's in-UI disclosure). */
export function fullRangeTicks(tickSpacing: number): { tickLower: number; tickUpper: number } {
  return { tickLower: nearestUsableTick(MIN_TICK, tickSpacing), tickUpper: nearestUsableTick(MAX_TICK, tickSpacing) }
}

/**
 * Sorted [token0, token1] the way every Uniswap V3 call requires (ascending address) — which of
 * USDC/WETH is token0 differs per chain (USDC is token0 on Ethereum/Arbitrum Sepolia, token1 on
 * Base/Optimism Sepolia per the live reads above), so this must never be hardcoded per side.
 */
export function sortTokens(a: Address, b: Address): [Address, Address] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a]
}

/**
 * Rough mid-price of token1 in terms of token0, from a pool's live slot0().sqrtPriceX96 — used only
 * to size the pre-mint swap (how much USDC to convert to WETH before depositing both sides). Scaled
 * in BigInt to 1e6 precision rather than converting the raw Q96 value straight to a JS Number, which
 * would silently lose precision (sqrtPriceX96 routinely exceeds Number.MAX_SAFE_INTEGER). This value
 * is never shown to the user as "the price" — it's an internal sizing heuristic only; actual mint
 * amounts always come from real post-swap wallet balances with their own slippage-protected minimums.
 */
export function priceOfToken1InToken0(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
  const PRECISION = 1_000_000n
  const Q192 = 1n << 192n
  const numerator = sqrtPriceX96 * sqrtPriceX96 * PRECISION * 10n ** BigInt(decimals0)
  const denominator = Q192 * 10n ** BigInt(decimals1)
  return Number(numerator / denominator) / Number(PRECISION)
}

/**
 * Live re-verification at call time, not just at build time — mirrors aaveClient.ts's
 * getAaveMarket() degrade-rather-than-throw discipline. Confirms the factory still resolves the
 * exact pool this config expects, and that pool's token0/token1 still match Meridian's own bridged
 * USDC and this config's WETH address, before any real deposit is allowed to proceed.
 */
export async function verifyUniswapPool(
  publicClient: { readContract: (args: unknown) => Promise<unknown> },
  evmChainId: number,
): Promise<{ pool: Address } | undefined> {
  const market = getUniswapMarket(evmChainId)
  const usdc = USDC_BY_CHAIN[evmChainId]
  if (!market || !usdc) return undefined

  const [token0, token1] = sortTokens(usdc.address, market.weth)
  try {
    const pool = (await publicClient.readContract({
      address: market.factory,
      abi: UNISWAP_FACTORY_ABI,
      functionName: 'getPool',
      args: [token0, token1, market.fee],
    })) as Address
    if (!pool || pool === '0x0000000000000000000000000000000000000000') {
      console.error(`[uniswapClient] getPool() returned zero address on chain ${evmChainId} — refusing to treat as live.`)
      return undefined
    }
    const [poolToken0, poolToken1] = await Promise.all([
      publicClient.readContract({ address: pool, abi: UNISWAP_POOL_ABI, functionName: 'token0' }) as Promise<Address>,
      publicClient.readContract({ address: pool, abi: UNISWAP_POOL_ABI, functionName: 'token1' }) as Promise<Address>,
    ])
    const usdcInPool = [poolToken0, poolToken1].some((t) => t.toLowerCase() === usdc.address.toLowerCase())
    const wethInPool = [poolToken0, poolToken1].some((t) => t.toLowerCase() === market.weth.toLowerCase())
    if (!usdcInPool || !wethInPool) {
      console.error(
        `[uniswapClient] Pool on chain ${evmChainId} no longer matches expected USDC/WETH (token0=${poolToken0}, token1=${poolToken1}) — refusing to treat as live.`,
      )
      return undefined
    }
    return { pool }
  } catch (e) {
    console.error(`[uniswapClient] Live pool verification failed on chain ${evmChainId}:`, e)
    return undefined
  }
}

export const UNISWAP_FACTORY_ABI = [
  {
    name: 'getPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }, { name: 'fee', type: 'uint24' }],
    outputs: [{ type: 'address' }],
  },
] as const

export const UNISWAP_POOL_ABI = [
  { name: 'token0', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'token1', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    name: 'slot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
  { name: 'liquidity', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint128' }] },
] as const

/** Minimal SwapRouter02 ABI — exactInputSingle only. SwapRouter02 (unlike the original SwapRouter)
 *  has no `deadline` field on this struct. */
export const SWAP_ROUTER_02_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const

/** Minimal NonfungiblePositionManager ABI — only the functions this app actually calls. */
export const NFPM_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'token0', type: 'address' },
          { name: 'token1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'amount0Desired', type: 'uint256' },
          { name: 'amount1Desired', type: 'uint256' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
    ],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
  {
    name: 'increaseLiquidity',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'amount0Desired', type: 'uint256' },
          { name: 'amount1Desired', type: 'uint256' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
    ],
    outputs: [
      { name: 'liquidity', type: 'uint128' },
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
  {
    name: 'decreaseLiquidity',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'liquidity', type: 'uint128' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
    ],
    outputs: [
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
  {
    name: 'collect',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'recipient', type: 'address' },
          { name: 'amount0Max', type: 'uint128' },
          { name: 'amount1Max', type: 'uint128' },
        ],
      },
    ],
    outputs: [
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
  {
    name: 'burn',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'positions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'nonce', type: 'uint96' },
      { name: 'operator', type: 'address' },
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' },
      { name: 'tokensOwed1', type: 'uint128' },
    ],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'tokenOfOwnerByIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

/** Max uint128 — passed as amount0Max/amount1Max to collect() to sweep everything owed. */
export const MAX_UINT128 = (1n << 128n) - 1n

/** No native-ETH leg in this flow (WETH is acquired via swap, not wrapping), so there's no separate referral/native-value concern — kept here only as a single source of truth for the far-future deadline used across mint/increase/decrease calls. */
export function farDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
}
