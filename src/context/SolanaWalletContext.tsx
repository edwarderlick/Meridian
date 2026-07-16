import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react'
import { WalletModalProvider, useWalletModal } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'
import { createContext, useContext, useMemo, type ReactNode } from 'react'

interface SolanaWalletContextValue {
  connected: boolean
  address?: string
  /** The connected wallet's display name (e.g. "Phantom", "Solflare"), if any — lets callers flag
   *  wallet-specific quirks (see Bridge.tsx's Solflare compatibility notice) without importing
   *  wallet-adapter-react directly. */
  walletName?: string
  connect: () => void
  disconnect: () => void
}

const SolanaWalletContext = createContext<SolanaWalletContextValue | null>(null)

/**
 * Devnet RPC used for both this wallet connection and Bridge's Solana Devnet adapter (see
 * useSolanaAdapter's `getRpc`) — kept as one shared constant so the two never drift apart.
 * Defaults to the public api.devnet.solana.com endpoint (no signup required) but that endpoint
 * is rate-limited and unreliable under repeated testing; set VITE_SOLANA_RPC_URL to a dedicated
 * provider (Helius/QuickNode/Alchemy free tier, etc.) to avoid it.
 */
export const SOLANA_DEVNET_RPC = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

/**
 * Bridges @solana/wallet-adapter-react's real connection state onto this app's existing
 * {connected, connect, disconnect} shape, so callers (WalletStatusMenu, Bridge) don't need to
 * know about wallet-adapter-react directly. `connect` opens wallet-adapter-react-ui's real
 * multi-wallet picker modal (mirrors how EVM's WalletStatusMenu row opens RainbowKit's modal)
 * rather than connecting to a single hardcoded wallet.
 */
function SolanaWalletBridge({ children }: { children: ReactNode }) {
  const { connected, publicKey, disconnect, wallet } = useWallet()
  const { setVisible } = useWalletModal()

  const value = useMemo<SolanaWalletContextValue>(
    () => ({
      connected,
      address: publicKey?.toBase58(),
      walletName: wallet?.adapter.name,
      connect: () => setVisible(true),
      disconnect: () => void disconnect(),
    }),
    [connected, publicKey, wallet, setVisible, disconnect],
  )

  return <SolanaWalletContext.Provider value={value}>{children}</SolanaWalletContext.Provider>
}

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  // Constructed once — each adapter instance tracks its own connection lifecycle internally.
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], [])

  return (
    <ConnectionProvider endpoint={SOLANA_DEVNET_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SolanaWalletBridge>{children}</SolanaWalletBridge>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

export function useSolanaWallet() {
  const ctx = useContext(SolanaWalletContext)
  if (!ctx) throw new Error('useSolanaWallet must be used within a SolanaWalletProvider')
  return ctx
}
