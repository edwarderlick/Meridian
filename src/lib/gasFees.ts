import { getBlock } from '@wagmi/core'
import type { Config } from 'wagmi'

/**
 * Root cause (confirmed by reading viem's own source, not guessed): for a browser-wallet
 * ("json-rpc") account — which is what every wallet connection in this app is — viem's
 * `sendTransaction` NEVER calls `prepareTransactionRequest` at all (see the
 * `account?.type === 'json-rpc'` branch in viem/actions/wallet/sendTransaction.js). It builds the
 * raw request straight from whatever `maxFeePerGas`/`maxPriorityFeePerGas` were explicitly passed
 * in — undefined if not given — and forwards it directly to `eth_sendTransaction`. So when nobody
 * passes an explicit fee, viem does NOT estimate one client-side; the connected wallet's own
 * internal suggestion is what actually gets used, with zero input from this app or from wagmi's/
 * viem's own (otherwise 20%-buffered) `estimateFeesPerGas`.
 *
 * On most of these testnets that's harmless because base fees barely move. Arbitrum Sepolia's
 * base fee moves in small, frequent increments, and a wallet's cached fee suggestion can already
 * be a few seconds (and a few percent) stale by the time the user confirms — confirmed live:
 * maxFeePerGas 20,000,000 vs. an inclusion-time baseFee of 20,304,000 wei, only ~1.5% apart, is
 * exactly that kind of narrow miss, not a wild misconfiguration.
 *
 * The fix mirrors PayZapp's own approach for Arc-family chains (noted but not ported during the
 * Swap work — this is the failure mode it exists to prevent): compute a real, live-fetched
 * maxFeePerGas explicitly, buffered well above the current base fee, and pass it into the write
 * call so the wallet uses OUR number instead of its own possibly-stale one.
 */
const BASE_FEE_MULTIPLIER_NUMERATOR = 3n // 1.5x current base fee ...
const BASE_FEE_MULTIPLIER_DENOMINATOR = 2n
const MIN_PRIORITY_FEE_WEI = 1_000_000_000n // 1 gwei floor — comfortably safe on any of these testnets' cheap L2 gas

export interface BufferedFees {
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

/** Pure buffer math, shared by every call site — see the module comment for why the 1.5x multiplier exists. */
export function computeBufferedFees(baseFeePerGas: bigint): BufferedFees {
  const maxPriorityFeePerGas = MIN_PRIORITY_FEE_WEI
  const maxFeePerGas = (baseFeePerGas * BASE_FEE_MULTIPLIER_NUMERATOR) / BASE_FEE_MULTIPLIER_DENOMINATOR + maxPriorityFeePerGas
  return { maxFeePerGas, maxPriorityFeePerGas }
}

/**
 * Live-fetches the target chain's current base fee and returns an explicit, buffered
 * maxFeePerGas/maxPriorityFeePerGas pair to attach to a write call — undefined if the chain
 * doesn't report an EIP-1559 base fee at all (nothing to buffer; let the wallet handle legacy
 * gas pricing as it already does).
 */
export async function getBufferedFees(config: Config, chainId: number): Promise<BufferedFees | undefined> {
  const block = await getBlock(config, { chainId })
  if (block.baseFeePerGas === null) return undefined
  return computeBufferedFees(block.baseFeePerGas)
}
