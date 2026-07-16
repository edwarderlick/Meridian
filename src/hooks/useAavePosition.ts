import { erc20Abi, formatUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { getAaveMarket } from '../lib/aaveClient'

// Same poll cadence as useTokenBalance — a modest safety-net for interest accruing/position
// changes this app didn't itself trigger; explicit refetch() after supply/withdraw still gives
// near-immediate updates for this app's own transactions.
const POSITION_POLL_INTERVAL_MS = 20_000

/**
 * Real aToken balance for the connected wallet on a given Aave-supported chain — same rebasing
 * balance pattern as useTokenBalance, just reading the interest-bearing aToken instead of USDC
 * itself. aTokens sit directly in the user's own wallet (Aave's `onBehalfOf`/`to` params are
 * always the connected address, never a Meridian contract), so this is a plain ERC-20 balance
 * read, not a position Meridian tracks itself.
 */
export function useAavePosition(evmChainId: number) {
  const { address } = useAccount()
  const market = getAaveMarket(evmChainId)

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useReadContract({
    chainId: evmChainId,
    address: market?.aToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && market), refetchInterval: POSITION_POLL_INTERVAL_MS },
  })

  // Aave's USDC aToken is 6 decimals on both supported chains, matching the underlying USDC.
  const formatted = data !== undefined ? formatUnits(data, 6) : '0'

  return { raw: data, formatted, isLoading, isError, error, refetch }
}
