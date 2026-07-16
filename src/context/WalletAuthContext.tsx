import { createContext, useContext, type ReactNode } from 'react'
import { useWalletAuth, type WalletAuthState } from '../hooks/useWalletAuth'

const WalletAuthContext = createContext<WalletAuthState | null>(null)

/** Runs the wallet<->Firebase sign-in flow exactly once for the whole app — mount near the root. */
export function WalletAuthProvider({ children }: { children: ReactNode }) {
  const state = useWalletAuth()
  return <WalletAuthContext.Provider value={state}>{children}</WalletAuthContext.Provider>
}

export function useWalletAuthContext(): WalletAuthState {
  const ctx = useContext(WalletAuthContext)
  if (!ctx) throw new Error('useWalletAuthContext must be used within a WalletAuthProvider')
  return ctx
}
