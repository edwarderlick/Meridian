import { UnifiedBalanceChain } from '@circle-fin/unified-balance-kit'
import type { ChainId } from '../assets/chains'

/**
 * Maps this app's ChainId to Unified Balance Kit's chain identifiers for the 7 EVM testnets
 * plus Solana Devnet — the same 8 chains Bridge already supports via BRIDGE_CHAIN_BY_ID.
 * Deliberately uses Gateway's own `UnifiedBalanceChain` string-literal enum rather than passing
 * bridge-kit's `ChainDefinition` objects through: `@circle-fin/bridge-kit` and
 * `@circle-fin/unified-balance-kit` each bundle their own private copy of Circle's internal
 * `Blockchain` enum, so the two packages' `ChainDefinition`/enum types are nominally distinct even
 * though the underlying string identifiers are identical — a plain string literal (which is what
 * `UnifiedBalanceChain` values actually are) is the one representation guaranteed to satisfy
 * `UnifiedBalanceChainIdentifier` regardless of which package's enum "declared" it.
 */
export const GATEWAY_CHAIN_BY_ID = {
  arc: UnifiedBalanceChain.Arc_Testnet,
  ethereum: UnifiedBalanceChain.Ethereum_Sepolia,
  arbitrum: UnifiedBalanceChain.Arbitrum_Sepolia,
  base: UnifiedBalanceChain.Base_Sepolia,
  optimism: UnifiedBalanceChain.Optimism_Sepolia,
  avalanche: UnifiedBalanceChain.Avalanche_Fuji,
  polygon: UnifiedBalanceChain.Polygon_Amoy_Testnet,
  solana: UnifiedBalanceChain.Solana_Devnet,
} satisfies Partial<Record<ChainId, UnifiedBalanceChain>>

export type GatewayChainId = keyof typeof GATEWAY_CHAIN_BY_ID

/** Every Gateway-supported chain — the full selector list for Deposit/Spend on Unified Balance. */
export const GATEWAY_SUPPORTED_CHAIN_IDS = Object.keys(GATEWAY_CHAIN_BY_ID) as GatewayChainId[]

export function isGatewayChain(id: ChainId): id is GatewayChainId {
  return id in GATEWAY_CHAIN_BY_ID
}
