import type { Address } from 'viem'
import { arcTestnet } from '../config/chains'
import { USDC_BY_CHAIN } from '../config/tokens'

/**
 * ArcYieldPool is Meridian's OWN contract (source: contracts/contracts/ArcYieldPool.sol,
 * deployed via contracts/scripts/deploy.ts) — built to give Arc Testnet a real yield destination.
 * Aave only covers Arbitrum/Optimism Sepolia (see aaveClient.ts) and Uniswap V3 has no confirmed
 * deployment on Arc at all (see uniswapClient.ts), so before this contract existed, Arc — the one
 * chain whose native gas token IS USDC — had nothing real to offer in Liquidity.
 *
 * The address is read from an env var, not hardcoded, because as of this writing the contract has
 * not been deployed yet. Until VITE_ARC_YIELD_POOL_ADDRESS is set, every hook/UI surface backed by
 * this file degrades to "unsupported" — same discipline aaveClient.ts uses when its own
 * re-verification fails — never a fabricated or placeholder address.
 */
const ARC_YIELD_POOL_ADDRESS = (import.meta.env.VITE_ARC_YIELD_POOL_ADDRESS || undefined) as Address | undefined

export function getArcYieldPoolAddress(): Address | undefined {
  return ARC_YIELD_POOL_ADDRESS
}

export function isArcYieldPoolDeployed(): boolean {
  return Boolean(ARC_YIELD_POOL_ADDRESS)
}

export const ARC_TESTNET_EVM_CHAIN_ID = arcTestnet.id
export const ARC_YIELD_POOL_USDC = USDC_BY_CHAIN[arcTestnet.id]

export const BPS_DENOMINATOR = 10_000
/** Mirrors the contract's `type(uint256).max` sentinel for "no active obligation" (see
 *  getPoolHealth in ArcYieldPool.sol) — not a real coverage/runway number, a "no obligation" flag. */
export const UINT256_MAX = (1n << 256n) - 1n

export interface StrategyMeta {
  id: 0 | 1 | 2
  label: string
  lockDays: number
}
/** Fixed at deploy time in the contract's constructor — lock durations never change post-deploy,
 *  only APR does (see ArcYieldPool.sol's contract-level notes on why). */
export const STRATEGIES: readonly StrategyMeta[] = [
  { id: 0, label: 'Flexible', lockDays: 0 },
  { id: 1, label: '7-Day Lock', lockDays: 7 },
  { id: 2, label: '30-Day Lock', lockDays: 30 },
]

/** Minimal ABI — only the functions/views this app actually calls, transcribed directly from
 *  contracts/contracts/ArcYieldPool.sol. Keep these two in sync by hand; there's no shared build
 *  step between the isolated Hardhat subproject and the Vite frontend. */
export const ARC_YIELD_POOL_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'strategyId', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'principalAmount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'fundRewardReserve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'pendingRewards',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getPosition',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'strategyId', type: 'uint8' },
      { name: 'principal', type: 'uint256' },
      { name: 'rewardsOwed', type: 'uint256' },
      { name: 'lockedUntil', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    name: 'getStrategy',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'strategyId', type: 'uint8' }],
    outputs: [
      { name: 'lockDuration', type: 'uint64' },
      { name: 'aprBps', type: 'uint16' },
      { name: 'principalInStrategy', type: 'uint256' },
    ],
  },
  {
    name: 'getPoolHealth',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'totalDeposits', type: 'uint256' },
      { name: 'reserve', type: 'uint256' },
      { name: 'projectedAnnualObligation', type: 'uint256' },
      { name: 'reserveCoverageBps', type: 'uint256' },
      { name: 'estimatedRunwaySeconds', type: 'uint256' },
    ],
  },
  { name: 'usdc', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

/** Same live-re-verification discipline as aaveClient.ts's getAaveMarket() — confirms the deployed
 *  pool's own `usdc()` still points at the exact address this app treats as Arc's real USDC before
 *  any write call, rather than trusting the env var forever. */
export async function verifyArcYieldPoolUsdc(readUsdc: () => Promise<Address>): Promise<boolean> {
  if (!ARC_YIELD_POOL_USDC) return false
  const onChainUsdc = await readUsdc()
  return onChainUsdc.toLowerCase() === ARC_YIELD_POOL_USDC.address.toLowerCase()
}
