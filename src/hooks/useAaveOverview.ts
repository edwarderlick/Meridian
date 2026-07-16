import { CHAINS } from '../assets/chains'
import { AAVE_CHAIN_IDS, type AaveChainId } from '../lib/aaveClient'
import { useAaveApy } from './useAaveApy'
import { useAavePosition } from './useAavePosition'

export interface AaveChainOverview {
  chainId: AaveChainId
  evmChainId: number
  balance: number
  apyPercent: number | null
  isLoading: boolean
  refetchPosition: () => void
}

/**
 * Combines the connected wallet's real aToken position + live APY across both supported Aave
 * chains (Arbitrum Sepolia, Optimism Sepolia) into the numbers Liquidity's header actually
 * displays — total deposited, a balance-weighted blended APY, and how many chains have an
 * active position. Fixed to exactly AAVE_CHAIN_IDS.length calls (2) so this stays a plain,
 * unconditional set of hook calls rather than a loop over a dynamic array.
 */
export function useAaveOverview() {
  const [arbitrumId, optimismId] = AAVE_CHAIN_IDS
  const arbitrumEvmId = CHAINS[arbitrumId].evmChainId!
  const optimismEvmId = CHAINS[optimismId].evmChainId!

  const arbitrumPosition = useAavePosition(arbitrumEvmId)
  const optimismPosition = useAavePosition(optimismEvmId)
  const arbitrumApy = useAaveApy(arbitrumEvmId)
  const optimismApy = useAaveApy(optimismEvmId)

  const chains: AaveChainOverview[] = [
    {
      chainId: arbitrumId,
      evmChainId: arbitrumEvmId,
      balance: Number(arbitrumPosition.formatted),
      apyPercent: arbitrumApy.apyPercent,
      isLoading: arbitrumPosition.isLoading || arbitrumApy.isLoading,
      refetchPosition: () => void arbitrumPosition.refetch(),
    },
    {
      chainId: optimismId,
      evmChainId: optimismEvmId,
      balance: Number(optimismPosition.formatted),
      apyPercent: optimismApy.apyPercent,
      isLoading: optimismPosition.isLoading || optimismApy.isLoading,
      refetchPosition: () => void optimismPosition.refetch(),
    },
  ]

  const totalDeposited = chains.reduce((sum, c) => sum + c.balance, 0)
  const weightedApySum = chains.reduce((sum, c) => sum + c.balance * (c.apyPercent ?? 0), 0)
  const blendedApyPercent = totalDeposited > 0 ? weightedApySum / totalDeposited : null
  const activePositions = chains.filter((c) => c.balance > 0).length
  const isLoading = chains.some((c) => c.isLoading)

  return { chains, totalDeposited, blendedApyPercent, activePositions, isLoading }
}
