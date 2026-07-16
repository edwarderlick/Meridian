import { defineChain, type Chain } from 'viem'
import { arbitrumSepolia, avalancheFuji, baseSepolia, optimismSepolia, polygonAmoy, sepolia } from 'viem/chains'

/**
 * Every EVM testnet's default public RPC endpoint (viem's built-in ones, and Arc's own
 * rpc.testnet.arc.network) is shared, rate-limited infrastructure — the same class of problem
 * that made Solana Devnet's public endpoint unreliable under repeated bridge testing (see
 * VITE_SOLANA_RPC_URL in SolanaWalletContext.tsx). Set the matching env var to a dedicated
 * free-tier endpoint (Alchemy/Infura/etc.) to override any of them; unset falls back to the
 * public default exactly as before.
 */
function withRpcOverride<T extends Chain>(chain: T, url: string | undefined): T {
  if (!url) return chain
  return { ...chain, rpcUrls: { ...chain.rpcUrls, default: { http: [url] } } }
}

/**
 * Arc Testnet isn't in viem's built-in chain list, so it's defined manually.
 * Native currency here is Arc's native gas token (18 decimals) — NOT the
 * ERC-20 USDC interface, which lives at a separate contract address with 6
 * decimals (see src/config/tokens.ts).
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
})

/** All 7 EVM testnet chains the console supports, in the order shown in the chain selector. */
export const evmChains = [
  arcTestnet,
  withRpcOverride(sepolia, import.meta.env.VITE_ETHEREUM_SEPOLIA_RPC_URL),
  withRpcOverride(arbitrumSepolia, import.meta.env.VITE_ARBITRUM_SEPOLIA_RPC_URL),
  withRpcOverride(baseSepolia, import.meta.env.VITE_BASE_SEPOLIA_RPC_URL),
  withRpcOverride(optimismSepolia, import.meta.env.VITE_OPTIMISM_SEPOLIA_RPC_URL),
  withRpcOverride(avalancheFuji, import.meta.env.VITE_AVALANCHE_FUJI_RPC_URL),
  withRpcOverride(polygonAmoy, import.meta.env.VITE_POLYGON_AMOY_RPC_URL),
] as const

/**
 * Chain id -> the RPC URL this app resolved for it (override if set, else the same public
 * default `evmChains` would otherwise carry). Keyed by numeric chain id rather than exposing the
 * `evmChains` objects themselves, because `@circle-fin/adapter-viem-v2`'s `ViemAdapter` does NOT
 * use these chain objects for bridge transactions — it resolves its own internal viem chain
 * definitions (`getViemChainByEnum`, straight off `viem/chains`) and hands *those* to
 * `getPublicClient`/`getWalletClient`, by chain id only. So overriding `evmChains` alone fixes
 * wagmi's own reads (balances, network switching) but silently does NOT reach the actual
 * approve/burn/mint public-client calls Bridge Kit makes — those still hit the public default RPC
 * regardless. useEvmAdapter.ts uses this map to pass an explicit transport URL keyed by the same
 * chain id the SDK's internal chain object carries, closing that gap.
 */
export const RPC_URL_BY_CHAIN_ID: Record<number, string> = Object.fromEntries(
  evmChains.map((chain) => [chain.id, chain.rpcUrls.default.http[0]]),
)
