import {
  ArbitrumSepolia,
  ArcTestnet,
  AvalancheFuji,
  BaseSepolia,
  EthereumSepolia,
  OptimismSepolia,
  PolygonAmoy,
  SolanaDevnet,
} from '@circle-fin/bridge-kit/chains'
import type { ChainId } from '../assets/chains'

/**
 * Maps this app's ChainId to Bridge Kit's chain definitions for the 7 EVM
 * testnets plus Solana Devnet (via @circle-fin/adapter-solana-kit — see
 * useSolanaAdapter). Sui isn't included: Circle has no Bridge Kit adapter
 * for Sui at all (verified against docs.arc.io and bridge-kit's own npm
 * metadata), so non-EVM-non-Solana bridging stays unimplemented here
 * rather than faked.
 */
export const BRIDGE_CHAIN_BY_ID = {
  arc: ArcTestnet,
  ethereum: EthereumSepolia,
  arbitrum: ArbitrumSepolia,
  base: BaseSepolia,
  optimism: OptimismSepolia,
  avalanche: AvalancheFuji,
  polygon: PolygonAmoy,
  solana: SolanaDevnet,
} satisfies Partial<Record<ChainId, unknown>>

export type BridgeableChainId = keyof typeof BRIDGE_CHAIN_BY_ID

/** Every bridgeable chain (EVM + Solana) — for contexts that aren't adapter-specific, like Bridge's own chain resolution. */
export const BRIDGE_SUPPORTED_CHAINS = Object.values(BRIDGE_CHAIN_BY_ID)

/** EVM-only subset — ViemAdapter's `supportedChains` capability rejects non-EVM chain definitions like SolanaDevnet. */
export const BRIDGE_SUPPORTED_EVM_CHAINS = Object.values(BRIDGE_CHAIN_BY_ID).filter((chain) => chain.type === 'evm')

export function isBridgeableChain(id: ChainId): id is BridgeableChainId {
  return id in BRIDGE_CHAIN_BY_ID
}
