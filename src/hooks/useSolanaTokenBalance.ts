import { SolanaDevnet } from '@circle-fin/bridge-kit/chains'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { useQuery } from '@tanstack/react-query'
import { SOLANA_DEVNET_RPC } from '../context/SolanaWalletContext'

// Modest safety-net poll for balance changes this app didn't itself trigger (e.g. funds received
// from elsewhere) — kept well above Helius/RPC rate-limit concerns. Explicit refetch() calls after
// a burn/mint (see Bridge.tsx) still give near-immediate updates for this app's own transactions.
const BALANCE_POLL_INTERVAL_MS = 20_000

// One shared connection — same endpoint every other Solana Devnet read/write in this app uses
// (see useSolanaAdapter, SolanaWalletContext).
const connection = new Connection(SOLANA_DEVNET_RPC, 'confirmed')
// Circle's own official Solana Devnet USDC mint (`@circle-fin/bridge-kit/chains`'s `SolanaDevnet.usdcAddress`)
// — an SPL token mint address, not an EVM contract address, so it can't be reused/pattern-matched
// from the EVM `USDC_BY_CHAIN` config. Read from Circle's SDK rather than duplicating the literal
// here, so it can never drift from what Bridge's own CCTP routing already uses.
const USDC_MINT = new PublicKey(SolanaDevnet.usdcAddress)

/**
 * One-off native SOL balance check (not a hook — Bridge only needs this as a submit-time
 * preflight, not a continuously displayed value). CCTP's Solana burn needs real SOL regardless of
 * the USDC amount: the base tx fee plus rent to fund the ephemeral "message account" the
 * depositForBurn instruction creates (`MESSAGE_ACCOUNT_RENT_LAMPORTS = 3_900_000` in
 * @circle-fin/adapter-solana-kit/next — confirmed by reading its bundled source), ~0.0039 SOL.
 */
export async function fetchSolanaSolBalance(address: string): Promise<number> {
  const lamports = await connection.getBalance(new PublicKey(address))
  return lamports / LAMPORTS_PER_SOL
}

/**
 * Real SPL USDC balance for the connected Solana wallet on Devnet.
 * Returns the same {raw, formatted, decimals, isLoading, isError, error, refetch} shape as the
 * EVM balance hooks (useTokenBalance/useNativeBalance) so Bridge can pick between them without
 * different consuming logic.
 */
export function useSolanaTokenBalance() {
  const { publicKey } = useWallet()
  const address = publicKey?.toString()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['solana-usdc-balance', address],
    queryFn: async () => {
      const { value } = await connection.getParsedTokenAccountsByOwner(publicKey!, { mint: USDC_MINT })
      // A wallet that has never received USDC on Solana has no associated token account at
      // all — that's a real 0 balance, not an error, so an empty result is the success path.
      const uiAmount = value[0]?.account.data.parsed.info.tokenAmount.uiAmount ?? 0
      return String(uiAmount)
    },
    enabled: Boolean(address),
    refetchInterval: BALANCE_POLL_INTERVAL_MS,
  })

  return { raw: undefined, formatted: address ? (data ?? '0') : '0', decimals: 6, isLoading, isError, error, refetch }
}
