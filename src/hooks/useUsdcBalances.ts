import { useQueries } from '@tanstack/react-query'
import { erc20Abi, formatUnits } from 'viem'
import { readContract } from '@wagmi/core'
import { useAccount, useConfig } from 'wagmi'
import { evmChains } from '../config/chains'
import { USDC_BY_CHAIN } from '../config/tokens'

export interface ChainBalance {
  chainId: number
  chainName: string
  formatted: string
  isLoading: boolean
  isError: boolean
}

// Modest safety-net poll — see useTokenBalance for rationale.
const BALANCE_POLL_INTERVAL_MS = 20_000

/** The exact React Query key this hook caches each chain's balance under — shared with Bridge.tsx
 *  and Transfer.tsx so a completed transaction can invalidate this hook's cache directly instead
 *  of waiting on the next poll. */
export const usdcBalanceQueryKey = (chainId: number, address: string | undefined) => ['usdc-balance', chainId, address]

/**
 * Real ERC-20 USDC balance for the connected wallet across all 7 supported
 * chains at once. wagmi's batched useReadContracts can't help here — its
 * multicall batching is scoped to a single chain, and these 7 reads each
 * hit a different chain's RPC — so this fans out via useQueries (one query
 * per chain, each independently loading/erroring) instead of calling a hook
 * in a loop.
 */
export function useUsdcBalances() {
  const { address } = useAccount()
  const config = useConfig()

  const queries = useQueries({
    queries: evmChains.map((chain) => {
      const token = USDC_BY_CHAIN[chain.id]
      return {
        queryKey: usdcBalanceQueryKey(chain.id, address),
        queryFn: () =>
          readContract(config, {
            chainId: chain.id,
            address: token.address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address as `0x${string}`],
          }),
        enabled: Boolean(address && token),
        refetchInterval: BALANCE_POLL_INTERVAL_MS,
      }
    }),
  })

  const perChain: ChainBalance[] = evmChains.map((chain, i) => {
    const query = queries[i]
    const token = USDC_BY_CHAIN[chain.id]
    return {
      chainId: chain.id,
      chainName: chain.name,
      formatted: query.data !== undefined ? formatUnits(query.data, token.decimals) : '0',
      isLoading: query.isLoading,
      // A single chain's RPC hiccup shouldn't take down the whole total — surfaced per-row instead.
      isError: query.isError,
    }
  })

  const isLoading = queries.some((q) => q.isLoading)
  const total = perChain.reduce((sum, chain) => sum + (chain.isError ? 0 : Number(chain.formatted)), 0)

  const refetchAll = () => {
    queries.forEach((q) => q.refetch())
  }

  return { perChain, total, isLoading, refetchAll }
}
