import {
  ConnectModal,
  SuiClientProvider,
  useCurrentAccount,
  useDisconnectWallet,
  WalletProvider as SuiDappKitWalletProvider,
} from '@mysten/dapp-kit'
import { getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc'
import '@mysten/dapp-kit/dist/index.css'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface SuiWalletContextValue {
  connected: boolean
  address?: string
  connect: () => void
  disconnect: () => void
}

const SuiWalletContext = createContext<SuiWalletContextValue | null>(null)

const SUI_NETWORKS = { testnet: { url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' as const } }

/**
 * Bridges @mysten/dapp-kit's real wallet-standard connection state onto this app's existing
 * {connected, connect, disconnect} shape. dapp-kit auto-detects installed Wallet Standard
 * wallets (Sui Wallet, Suiet, etc.) with no manual per-wallet registration — `ConnectModal` is
 * dapp-kit's real picker UI, rendered here in fully controlled mode (invisible trigger, open
 * state driven by `connect()`) so it can be launched from the existing WalletStatusMenu button
 * rather than dapp-kit's own trigger element.
 */
function SuiWalletBridge({ children }: { children: ReactNode }) {
  const account = useCurrentAccount()
  const { mutate: disconnectWallet } = useDisconnectWallet()
  const [modalOpen, setModalOpen] = useState(false)

  const value = useMemo<SuiWalletContextValue>(
    () => ({
      connected: Boolean(account),
      address: account?.address,
      connect: () => setModalOpen(true),
      disconnect: () => disconnectWallet(),
    }),
    [account, disconnectWallet],
  )

  return (
    <SuiWalletContext.Provider value={value}>
      {children}
      <ConnectModal trigger={<span className="hidden" />} open={modalOpen} onOpenChange={setModalOpen} />
    </SuiWalletContext.Provider>
  )
}

export function SuiWalletProvider({ children }: { children: ReactNode }) {
  return (
    <SuiClientProvider networks={SUI_NETWORKS} defaultNetwork="testnet">
      <SuiDappKitWalletProvider autoConnect>
        <SuiWalletBridge>{children}</SuiWalletBridge>
      </SuiDappKitWalletProvider>
    </SuiClientProvider>
  )
}

export function useSuiWallet() {
  const ctx = useContext(SuiWalletContext)
  if (!ctx) throw new Error('useSuiWallet must be used within a SuiWalletProvider')
  return ctx
}
