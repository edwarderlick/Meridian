import { evmChains } from '../config/chains'

const EXPLORER_BASE_BY_CHAIN_ID: Record<number, string> = Object.fromEntries(
  evmChains.map((chain) => [chain.id, chain.blockExplorers?.default.url ?? '']),
)

/** Real per-chain block explorer tx URL (e.g. Arcscan, Sepolia Etherscan) — undefined if unknown. */
export function getExplorerTxUrl(evmChainId: number, txHash: string): string | undefined {
  const base = EXPLORER_BASE_BY_CHAIN_ID[evmChainId]
  return base ? `${base}/tx/${txHash}` : undefined
}
