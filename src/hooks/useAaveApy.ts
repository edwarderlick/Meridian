import { useReadContract } from 'wagmi'
import { AAVE_POOL_ABI, getAaveMarket, liquidityRateToApyPercent } from '../lib/aaveClient'

// Supply rates drift continuously with pool utilization — poll rather than read once.
const APY_POLL_INTERVAL_MS = 30_000

/** Real, live supply APY read straight off Aave's Pool contract — never a static/cached number. */
export function useAaveApy(evmChainId: number) {
  const market = getAaveMarket(evmChainId)

  const { data, isLoading, isError, error, refetch } = useReadContract({
    chainId: evmChainId,
    address: market?.pool,
    abi: AAVE_POOL_ABI,
    functionName: 'getReserveData',
    args: market ? [market.usdc] : undefined,
    query: { enabled: Boolean(market), refetchInterval: APY_POLL_INTERVAL_MS },
  })

  const apyPercent = data ? liquidityRateToApyPercent(data.currentLiquidityRate) : null

  return { apyPercent, isLoading, isError, error, refetch }
}
