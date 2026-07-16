import type { Address } from 'viem'
import { erc20Abi, formatUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { USDC_BY_CHAIN } from '../config/tokens'

// Modest safety-net poll for balance changes this app didn't itself trigger (e.g. funds received
// from elsewhere) — kept well above RPC rate-limit concerns. Explicit refetch() calls after a
// send/burn/mint (see Transfer.tsx, Bridge.tsx) still give near-immediate updates for this app's
// own transactions.
const BALANCE_POLL_INTERVAL_MS = 20_000

export interface Erc20TokenConfig {
  address: Address
  decimals: number
}

/**
 * Real ERC-20 balance for the connected wallet on a single chain. Defaults to that chain's USDC
 * contract (every chain's USDC ERC-20 uses 6 decimals — including Arc Testnet's interface
 * contract, which must not be confused with Arc's native gas token, also called USDC but 18
 * decimals, see useNativeBalance). Pass an explicit `token` to read a different ERC-20 on the
 * same chain (e.g. Swap's EURC/cirBTC balances on Arc Testnet).
 */
export function useTokenBalance(chainId: number, token?: Erc20TokenConfig) {
  const { address } = useAccount()
  const resolvedToken = token ?? USDC_BY_CHAIN[chainId]

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useReadContract({
    chainId,
    address: resolvedToken?.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && resolvedToken), refetchInterval: BALANCE_POLL_INTERVAL_MS },
  })

  const formatted = data !== undefined && resolvedToken ? formatUnits(data, resolvedToken.decimals) : '0'

  return { raw: data, formatted, decimals: resolvedToken?.decimals ?? 6, isLoading, isError, error, refetch }
}
