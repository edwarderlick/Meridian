import type { ComponentType, SVGProps } from 'react'
import { arbitrumSepolia, avalancheFuji, baseSepolia, optimismSepolia, polygonAmoy, sepolia } from 'viem/chains'
import { arcTestnet } from '../../config/chains'
import ArcIcon from './ArcIcon'
import EthereumIcon from './EthereumIcon'
import ArbitrumIcon from './ArbitrumIcon'
import BaseIcon from './BaseIcon'
import OptimismIcon from './OptimismIcon'
import AvalancheIcon from './AvalancheIcon'
import PolygonIcon from './PolygonIcon'
import SolanaIcon from './SolanaIcon'
import SuiIcon from './SuiIcon'

export { ArcIcon, EthereumIcon, ArbitrumIcon, BaseIcon, OptimismIcon, AvalancheIcon, PolygonIcon, SolanaIcon, SuiIcon }

export type ChainId =
  | 'arc'
  | 'ethereum'
  | 'arbitrum'
  | 'base'
  | 'optimism'
  | 'avalanche'
  | 'polygon'
  | 'solana'
  | 'sui'

/** Non-EVM chains each need a connection from their own wallet ecosystem, not the shared EVM one. */
export type NonEvmEcosystem = 'solana' | 'sui'

export interface ChainMeta {
  id: ChainId
  name: string
  shortLabel: string
  layer: string
  color: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  /** True for chains that aren't part of the EVM ecosystem — e.g. Solana/Sui need their own wallet connection, not an EVM one. */
  isNonEvm?: boolean
  /** Which non-EVM wallet ecosystem this chain requires a connection from. */
  nonEvmEcosystem?: NonEvmEcosystem
  /** True for chains only wired up in the Bridge chain selector so far — excluded from other screens' chain lists until they get the same wallet-gating treatment. */
  bridgeOnly?: boolean
  /** Real wagmi/viem chain ID for EVM chains — used to request a real wallet network switch. Absent for non-EVM chains. */
  evmChainId?: number
}

export const CHAINS: Record<ChainId, ChainMeta> = {
  arc: {
    id: 'arc',
    name: 'Arc Testnet',
    shortLabel: 'Arc Testnet',
    layer: 'Layer 1',
    color: '#F432F6',
    Icon: ArcIcon,
    evmChainId: arcTestnet.id,
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum Sepolia',
    shortLabel: 'Ethereum Sepolia',
    layer: 'Testnet',
    color: '#627EEA',
    Icon: EthereumIcon,
    evmChainId: sepolia.id,
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum Sepolia',
    shortLabel: 'Arbitrum Sepolia',
    layer: 'Rollup · Testnet',
    color: '#28A0F0',
    Icon: ArbitrumIcon,
    evmChainId: arbitrumSepolia.id,
  },
  base: {
    id: 'base',
    name: 'Base Sepolia',
    shortLabel: 'Base Sepolia',
    layer: 'Rollup · Testnet',
    color: '#0052FF',
    Icon: BaseIcon,
    evmChainId: baseSepolia.id,
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism Sepolia',
    shortLabel: 'Optimism Sepolia',
    layer: 'Rollup · Testnet',
    color: '#FF0420',
    Icon: OptimismIcon,
    evmChainId: optimismSepolia.id,
  },
  avalanche: {
    id: 'avalanche',
    name: 'Avalanche Fuji',
    shortLabel: 'Avalanche Fuji',
    layer: 'Testnet',
    color: '#E84142',
    Icon: AvalancheIcon,
    evmChainId: avalancheFuji.id,
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon Amoy',
    shortLabel: 'Polygon Amoy',
    layer: 'Testnet',
    color: '#8247E5',
    Icon: PolygonIcon,
    evmChainId: polygonAmoy.id,
  },
  solana: {
    id: 'solana',
    name: 'Solana Devnet',
    shortLabel: 'Solana Devnet',
    layer: 'Non-EVM · Testnet',
    color: '#9945FF',
    Icon: SolanaIcon,
    isNonEvm: true,
    nonEvmEcosystem: 'solana',
  },
  sui: {
    id: 'sui',
    name: 'Sui Testnet',
    shortLabel: 'Sui Testnet',
    layer: 'Non-EVM · Testnet',
    color: '#4DA2FF',
    Icon: SuiIcon,
    isNonEvm: true,
    nonEvmEcosystem: 'sui',
    bridgeOnly: true,
  },
}

export const CHAIN_LIST = Object.values(CHAINS)

/** Chain list for selectors outside Bridge — excludes chains not yet wired up with their own wallet-gating elsewhere. */
export const CHAIN_LIST_STANDARD = CHAIN_LIST.filter((c) => !c.bridgeOnly)

/** The 7 EVM testnet chains only — for selectors with no bridging/non-EVM concept, e.g. Transfer. */
export const EVM_CHAIN_LIST = CHAIN_LIST.filter((c) => c.evmChainId !== undefined)
