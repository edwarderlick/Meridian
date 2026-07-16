import { SwapKit, type SwapEstimate, type SwapResult } from '@circle-fin/swap-kit'
import type { ViemAdapter } from '@circle-fin/adapter-viem-v2'

/**
 * Real Swap Kit execution, unlocked as of @circle-fin/swap-kit v1.4.0 (published 2026-07-15).
 * Last session concluded execution wasn't achievable: v1.3.2 shipped kit.swap() commented out as
 * "implementation pending" in its own README, and api.circle.com's CORS policy blocks the
 * X-User-Agent header the SDK attaches to every browser request. v1.4.0 finishes swap() (confirmed
 * by reading the real bundled source, not just the changelog) and makes the kit key optional, but
 * the CORS block is unchanged — still confirmed live against api.circle.com, keyless or not — so a
 * direct browser call still fails. See circleFetchProxy.ts for how this is actually resolved: the
 * SDK runs entirely unmodified (including signing, which stays client-side via the user's own
 * wallet through the adapter below), but its network calls get transparently rewritten to a
 * same-origin backend proxy first, which is not subject to CORS at all. This is the same
 * architecture a real, working Arc Testnet app (github.com/edwarderlick/PayZapp) uses in
 * production — verified by reading its source and by curling its live deployment for a real quote.
 *
 * Keyless on purpose: no kitKey is passed here. api/_lib/swapHandler.js injects the real
 * CIRCLE_API_KEY server-side on every proxied request regardless, so the browser bundle never
 * holds a credential — v1.4.0 added keyless support specifically to make this possible ("unblocking
 * client-side and browser apps that can't safely ship a secret key" — CHANGELOG.md).
 */
export const swapKit = new SwapKit()

/** Arc Testnet swap token addresses, from @circle-fin/swap-kit's built-in TokenRegistry — used for
 *  real balance reads (useTokenBalance); the SDK itself resolves 'USDC'/'EURC'/'CIRBTC' aliases to
 *  these same addresses internally for the swap/estimate calls. */
export const SWAP_TOKENS = {
  USDC: { address: '0x3600000000000000000000000000000000000000', decimals: 6, label: 'USDC' },
  EURC: { address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', decimals: 6, label: 'EURC' },
  CIRBTC: { address: '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF', decimals: 8, label: 'cirBTC' },
} as const

export type SwapToken = keyof typeof SWAP_TOKENS

interface SwapCallParams {
  adapter: ViemAdapter
  tokenIn: SwapToken
  tokenOut: SwapToken
  amountIn: string
}

/**
 * allowanceStrategy: 'approve' forces an on-chain approval instead of an EIP-712 permit signature
 * — the permit path requires reconstructing USDC's exact per-chain EIP-712 domain metadata
 * (name/version), which the SDK itself documents as security-sensitive to get wrong ("a mismatch
 * causes ecrecover to return the wrong signer, making the permit invalid"). One extra on-chain tx
 * is a smaller, safer trade-off than hand-verifying that domain metadata under time pressure.
 *
 * slippageBps: 500 (5%), matching PayZapp's real-world-tested value — their comment notes Arc
 * Testnet pool prices drift enough from Circle's quote that the default 300 (3%) trips the
 * adapter's on-chain minTokenOut check.
 *
 * KNOWN GAP (disclosed, not silently skipped — see the final report for full detail): swap-kit
 * always calls USDC's increaseAllowance for the on-chain approval (confirmed by reading
 * handleEvmTokenApproval in the bundled source — this is unconditional, not affected by
 * allowanceStrategy). PayZapp's reference implementation found this overflows on Arc Testnet's
 * USDC contract once a prior non-zero allowance already exists (e.g. after this wallet's first
 * swap) and works around it with a request-level interceptor that rewrites the call to
 * approve(spender, MaxUint256). That fix wasn't ported here: it trades away the SDK's own
 * exact-amount approval for an unlimited one, which is exactly the kind of funds-movement
 * trade-off this project treats conservatively, and it can't be verified without a live wallet in
 * this environment. Practical effect: a wallet's first swap should work; a second swap from the
 * same wallet may fail with an on-chain revert until this is addressed.
 */
const SWAP_CONFIG = {
  allowanceStrategy: 'approve' as const,
  slippageBps: 500,
}

export async function estimateSwap(params: SwapCallParams): Promise<SwapEstimate> {
  return swapKit.estimate({
    from: { adapter: params.adapter, chain: 'Arc_Testnet' },
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    config: SWAP_CONFIG,
  })
}

export async function executeSwap(params: SwapCallParams): Promise<SwapResult> {
  return swapKit.swap({
    from: { adapter: params.adapter, chain: 'Arc_Testnet' },
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    config: SWAP_CONFIG,
  })
}

/** Pattern-matched friendly messages, adapted from PayZapp's own (also unofficial) error handling
 *  — Circle's SDK doesn't expose structured error codes for most of these at the top level. */
export function friendlySwapError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  if (/user rejected|user denied|rejected the request/.test(lower)) {
    return 'Swap cancelled — the wallet request was rejected.'
  }
  if (/no route|route or resource not found/.test(lower)) {
    return 'No swap route available for this pair on Arc Testnet.'
  }
  if (/deadline|expired/.test(lower)) {
    return 'Swap request expired — try again.'
  }
  if (/insufficient funds|insufficient balance/.test(lower)) {
    return 'Insufficient balance to cover this swap (or its network fee).'
  }
  if (/simulation failed|execution reverted|transaction reverted/.test(lower)) {
    return 'Swap failed on Arc Testnet. If this is a second swap from this wallet, it may be the known allowance issue described in swapClient.ts — check the browser console for details.'
  }
  return message
}
