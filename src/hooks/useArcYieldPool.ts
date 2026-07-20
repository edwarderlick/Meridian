import { formatUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import {
  ARC_TESTNET_EVM_CHAIN_ID,
  ARC_YIELD_POOL_ABI,
  ARC_YIELD_POOL_USDC,
  BPS_DENOMINATOR,
  STRATEGIES,
  UINT256_MAX,
  getArcYieldPoolAddress,
  isArcYieldPoolDeployed,
} from '../lib/arcYieldPoolClient'

const DECIMALS = ARC_YIELD_POOL_USDC?.decimals ?? 6
// Rewards accrue continuously — poll rather than read once, same cadence as useAaveApy.
const POLL_INTERVAL_MS = 20_000

function toNum(raw: bigint | undefined) {
  return raw !== undefined ? Number(formatUnits(raw, DECIMALS)) : 0
}

/** The connected wallet's real position in Meridian's own Arc-native pool — undefined/zeroed out
 *  entirely (never fabricated) until the contract is actually deployed, see arcYieldPoolClient.ts. */
export function useArcYieldPoolPosition() {
  const { address } = useAccount()
  const poolAddress = getArcYieldPoolAddress()

  const { data, isLoading, isError, error, refetch } = useReadContract({
    chainId: ARC_TESTNET_EVM_CHAIN_ID,
    address: poolAddress,
    abi: ARC_YIELD_POOL_ABI,
    functionName: 'getPosition',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && poolAddress), refetchInterval: POLL_INTERVAL_MS },
  })

  const [strategyId, principal, rewardsOwed, lockedUntil, active] = data ?? [0, 0n, 0n, 0n, false]

  return {
    isDeployed: isArcYieldPoolDeployed(),
    strategyId,
    principal,
    principalFormatted: toNum(principal),
    rewardsOwed,
    rewardsOwedFormatted: toNum(rewardsOwed),
    lockedUntil: Number(lockedUntil),
    active,
    isLoading,
    isError,
    error,
    refetch,
  }
}

/** Real, computed-not-fabricated pool health straight off the contract's own getPoolHealth() view —
 *  see ArcYieldPool.sol for the accounting. `reserveCoverage`/`runwayDays` are `null` when the
 *  contract reports its `type(uint256).max` "no active obligation" sentinel, not a literal number. */
export function useArcYieldPoolHealth() {
  const poolAddress = getArcYieldPoolAddress()

  const { data, isLoading, isError, error, refetch } = useReadContract({
    chainId: ARC_TESTNET_EVM_CHAIN_ID,
    address: poolAddress,
    abi: ARC_YIELD_POOL_ABI,
    functionName: 'getPoolHealth',
    query: { enabled: Boolean(poolAddress), refetchInterval: POLL_INTERVAL_MS },
  })

  const [totalDeposits, reserve, projectedAnnualObligation, reserveCoverageBps, estimatedRunwaySeconds] =
    data ?? [0n, 0n, 0n, 0n, 0n]
  const noObligation = projectedAnnualObligation === 0n || reserveCoverageBps === UINT256_MAX

  return {
    isDeployed: isArcYieldPoolDeployed(),
    totalDepositsFormatted: toNum(totalDeposits),
    reserveFormatted: toNum(reserve),
    projectedAnnualObligationFormatted: toNum(projectedAnnualObligation),
    reserveCoveragePercent: noObligation ? null : Number(reserveCoverageBps) / 100,
    runwayDays: noObligation ? null : Number(estimatedRunwaySeconds) / 86_400,
    isLoading,
    isError,
    error,
    refetch,
  }
}

export interface StrategyOverview {
  id: 0 | 1 | 2
  label: string
  lockDays: number
  aprPercent: number
  principalInStrategyFormatted: number
}

/** Live per-strategy APR + principal, fixed to exactly STRATEGIES.length (3) calls — same
 *  "unconditional set of hook calls, never a loop over a dynamic array" discipline as
 *  useAaveOverview.ts, since the strategy count is a contract-level constant, not user data. */
export function useArcYieldPoolStrategies(): { strategies: StrategyOverview[]; isLoading: boolean } {
  const poolAddress = getArcYieldPoolAddress()
  const common = {
    chainId: ARC_TESTNET_EVM_CHAIN_ID,
    address: poolAddress,
    abi: ARC_YIELD_POOL_ABI,
    functionName: 'getStrategy' as const,
    query: { enabled: Boolean(poolAddress), refetchInterval: POLL_INTERVAL_MS },
  }

  const flexible = useReadContract({ ...common, args: [0] })
  const sevenDay = useReadContract({ ...common, args: [1] })
  const thirtyDay = useReadContract({ ...common, args: [2] })
  const results = [flexible, sevenDay, thirtyDay]

  const strategies: StrategyOverview[] = STRATEGIES.map((meta, i) => {
    const data = results[i].data
    const [, aprBps, principalInStrategy] = data ?? [0, 0, 0n]
    return {
      id: meta.id,
      label: meta.label,
      lockDays: meta.lockDays,
      aprPercent: Number(aprBps) / (BPS_DENOMINATOR / 100),
      principalInStrategyFormatted: toNum(principalInStrategy),
    }
  })

  return { strategies, isLoading: results.some((r) => r.isLoading) }
}
