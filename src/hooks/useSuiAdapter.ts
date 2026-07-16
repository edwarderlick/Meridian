import { useCurrentAccount, useCurrentWallet } from '@mysten/dapp-kit'

/**
 * Real Sui Wallet Standard account/wallet, exposed for whatever Sui-aware UI needs it.
 *
 * IMPORTANT: there is no Circle Bridge Kit adapter for Sui. Verified against Arc's official
 * docs (docs.arc.io/app-kit/tutorials/adapter-setups) and @circle-fin/bridge-kit's own npm
 * package metadata (keywords list "evm non-evm solana" — no "sui"): Circle currently ships
 * adapters for EVM (Viem/Ethers) and Solana only. This matches the pre-existing note in
 * config/bridgeChains.ts ("Bridge Kit's CCTPv2 testnet list has ... no Sui at all").
 *
 * So unlike useSolanaAdapter, this intentionally does NOT return a Bridge-Kit-compatible
 * adapter — there is nothing to build one from. Sui wallet connection is real (this hook), but
 * kit.bridge() with Sui as source/destination stays unimplemented until Circle ships one.
 */
export function useSuiAdapter() {
  const account = useCurrentAccount()
  const { currentWallet } = useCurrentWallet()
  return account ? { account, wallet: currentWallet } : null
}
