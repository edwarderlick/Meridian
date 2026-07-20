import { erc20Abi, formatUnits } from 'viem'
import { useReadContract, useReadContracts } from 'wagmi'
import { USDC_BY_CHAIN } from '../config/tokens'
import { UNISWAP_FACTORY_ABI, UNISWAP_POOL_ABI, getUniswapMarket, sortTokens } from '../lib/uniswapClient'

const POOL_POLL_INTERVAL_MS = 30_000

/**
 * Live Uniswap V3 pool state for a chain — real fee tier and real reserves read straight off
 * chain, never a cached/estimated number. Deliberately does NOT compute or display any kind of
 * "APY" for this pool: unlike Aave's protocol-computed lending rate, a real fee-based yield
 * estimate would need real trading volume history, which doesn't meaningfully exist on a testnet
 * — showing one anyway would be exactly the kind of fabricated number this app refuses to show.
 */
export function useUniswapPool(evmChainId: number) {
  const market = getUniswapMarket(evmChainId)
  const usdc = USDC_BY_CHAIN[evmChainId]
  const [token0, token1] = market && usdc ? sortTokens(usdc.address, market.weth) : [undefined, undefined]

  const { data: poolAddress, isLoading: poolLoading } = useReadContract({
    chainId: evmChainId,
    address: market?.factory,
    abi: UNISWAP_FACTORY_ABI,
    functionName: 'getPool',
    args: token0 && token1 && market ? [token0, token1, market.fee] : undefined,
    query: { enabled: Boolean(market && token0 && token1) },
  })

  const poolIsLive = Boolean(poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000')

  const { data, isLoading: stateLoading, refetch } = useReadContracts({
    contracts: [
      { chainId: evmChainId, address: poolAddress, abi: UNISWAP_POOL_ABI, functionName: 'slot0' },
      { chainId: evmChainId, address: poolAddress, abi: UNISWAP_POOL_ABI, functionName: 'liquidity' },
      { chainId: evmChainId, address: usdc?.address, abi: erc20Abi, functionName: 'balanceOf', args: poolAddress ? [poolAddress] : undefined },
      { chainId: evmChainId, address: market?.weth, abi: erc20Abi, functionName: 'balanceOf', args: poolAddress ? [poolAddress] : undefined },
    ],
    query: { enabled: poolIsLive, refetchInterval: POOL_POLL_INTERVAL_MS },
  })

  const slot0 = data?.[0]?.result
  const liquidity = data?.[1]?.result
  const usdcReserve = data?.[2]?.result
  const wethReserve = data?.[3]?.result

  return {
    market,
    poolAddress: poolIsLive ? poolAddress : undefined,
    isLive: poolIsLive,
    isLoading: poolLoading || stateLoading,
    tick: slot0 ? slot0[1] : null,
    sqrtPriceX96: slot0 ? slot0[0] : null,
    liquidity: liquidity ?? null,
    /** Real USDC/WETH sitting in the pool right now — shown decomposed, never blended into a single
     *  USD figure, since there's no reliable USD price for testnet WETH (see Liquidity.tsx's disclosure). */
    usdcReserveFormatted: usdcReserve !== undefined ? formatUnits(usdcReserve, usdc?.decimals ?? 6) : null,
    wethReserveFormatted: wethReserve !== undefined ? formatUnits(wethReserve, 18) : null,
    refetch,
  }
}
