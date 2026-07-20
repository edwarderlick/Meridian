import { CHAINS } from '../assets/chains'
import { UNISWAP_CHAIN_IDS, type UniswapChainId } from '../lib/uniswapClient'
import { useUniswapPool } from './useUniswapPool'
import { useUniswapPosition } from './useUniswapPosition'

/**
 * Combines both live Uniswap V3 chains (Ethereum Sepolia, Base Sepolia) into the summary numbers
 * the Liquidity page's Available Pools table and Your Positions section need — same blending
 * pattern as useAaveOverview, fixed to exactly UNISWAP_CHAIN_IDS.length hook calls rather than a
 * loop over a dynamic array.
 */
export function useUniswapOverview() {
  const [ethId, baseId] = UNISWAP_CHAIN_IDS as [UniswapChainId, UniswapChainId]
  const ethEvmId = CHAINS[ethId].evmChainId!
  const baseEvmId = CHAINS[baseId].evmChainId!

  const ethPool = useUniswapPool(ethEvmId)
  const basePool = useUniswapPool(baseEvmId)
  const ethPosition = useUniswapPosition(ethEvmId)
  const basePosition = useUniswapPosition(baseEvmId)

  const chains = [
    { chainId: ethId, evmChainId: ethEvmId, name: CHAINS[ethId].name, pool: ethPool, position: ethPosition },
    { chainId: baseId, evmChainId: baseEvmId, name: CHAINS[baseId].name, pool: basePool, position: basePosition },
  ]

  const activePositions = chains.filter((c) => c.position.hasPosition).length
  const isLoading = chains.some((c) => c.pool.isLoading || c.position.isLoading)

  return { chains, activePositions, isLoading }
}
