import { useAccount, useBalance } from 'wagmi'

// Modest safety-net poll — see useTokenBalance for rationale.
const BALANCE_POLL_INTERVAL_MS = 20_000

/**
 * Real native gas token balance for the connected wallet on a single chain.
 * wagmi resolves decimals/symbol from each chain's own `nativeCurrency`
 * config, so Arc Testnet correctly resolves to its 18-decimal native USDC
 * gas token here — a completely separate value from the 6-decimal ERC-20
 * USDC balance in useTokenBalance. Never sum the two.
 */
export function useNativeBalance(chainId: number) {
  const { address } = useAccount()

  const { data, isLoading, isError, error, refetch } = useBalance({
    address,
    chainId,
    query: { enabled: Boolean(address), refetchInterval: BALANCE_POLL_INTERVAL_MS },
  })

  return {
    raw: data?.value,
    formatted: data?.formatted ?? '0',
    symbol: data?.symbol,
    decimals: data?.decimals,
    isLoading,
    isError,
    error,
    refetch,
  }
}
