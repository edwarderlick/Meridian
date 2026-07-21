import { BaseError, ContractFunctionRevertedError, type Address } from 'viem'
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
  // Custom errors — transcribed from ArcYieldPool.sol. Required in the ABI for viem to decode a
  // revert's 4-byte selector back into a name + args; without these entries a revert just shows as
  // an opaque "execution reverted" / "custom error" with no explanation of what actually happened.
  { name: 'ZeroAmount', type: 'error', inputs: [] },
  { name: 'InvalidStrategy', type: 'error', inputs: [] },
  {
    name: 'StrategyMismatch',
    type: 'error',
    inputs: [
      { name: 'activeStrategyId', type: 'uint8' },
      { name: 'requestedStrategyId', type: 'uint8' },
    ],
  },
  { name: 'NoPosition', type: 'error', inputs: [] },
  { name: 'StillLocked', type: 'error', inputs: [{ name: 'unlocksAt', type: 'uint256' }] },
  {
    name: 'InsufficientPrincipal',
    type: 'error',
    inputs: [
      { name: 'requested', type: 'uint256' },
      { name: 'available', type: 'uint256' },
    ],
  },
  {
    name: 'InsufficientReserve',
    type: 'error',
    inputs: [
      { name: 'requested', type: 'uint256' },
      { name: 'available', type: 'uint256' },
    ],
  },
] as const

/** Same live-re-verification discipline as aaveClient.ts's getAaveMarket() — confirms the deployed
 *  pool's own `usdc()` still points at the exact address this app treats as Arc's real USDC before
 *  any write call, rather than trusting the env var forever. */
export async function verifyArcYieldPoolUsdc(readUsdc: () => Promise<Address>): Promise<boolean> {
  if (!ARC_YIELD_POOL_USDC) return false
  const onChainUsdc = await readUsdc()
  return onChainUsdc.toLowerCase() === ARC_YIELD_POOL_USDC.address.toLowerCase()
}

function strategyLabel(id: number): string {
  return STRATEGIES.find((s) => s.id === id)?.label ?? `strategy ${id}`
}

/**
 * Turns a raw viem/wagmi write error into the specific, human-readable explanation the contract
 * actually gave, instead of a generic "execution reverted" / "custom error" the wallet shows. Falls
 * back gracefully to viem's own short message, then to the raw error, for anything not decodable —
 * never throws itself, always returns something displayable.
 */
export function describeArcYieldPoolError(error: unknown): string {
  if (error instanceof BaseError) {
    const revertError = error.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | undefined
    const errorName = revertError?.data?.errorName
    const args = revertError?.data?.args ?? []
    switch (errorName) {
      case 'StrategyMismatch': {
        const [activeId, requestedId] = args as [number, number]
        return `You already have an active position in ${strategyLabel(activeId)} — withdraw it before depositing into ${strategyLabel(requestedId)}.`
      }
      case 'StillLocked': {
        const [unlocksAt] = args as [bigint]
        return `This position is still locked until ${new Date(Number(unlocksAt) * 1000).toLocaleString()}.`
      }
      case 'InsufficientReserve':
        return "The pool's reward reserve can't cover the rewards owed on this withdrawal right now — it needs to be topped up before this will succeed."
      case 'InsufficientPrincipal':
        return "That amount is more than this position's available principal."
      case 'NoPosition':
        return "There's no active position here to withdraw."
      case 'InvalidStrategy':
        return 'Not a valid strategy for this pool.'
      case 'ZeroAmount':
        return 'Amount must be greater than zero.'
      default:
        return error.shortMessage
    }
  }
  return error instanceof Error ? error.message : 'Transaction failed.'
}
