import { useAccount } from 'wagmi'
import { useWalletAuthContext } from '../../context/WalletAuthContext'

/**
 * Non-blocking notice shown when a wallet is connected but not yet Firebase-authenticated —
 * the rest of the page stays usable; Firestore-backed widgets simply show their normal
 * loading/empty state until the sign-in flow finishes (see gating in Overview/Transfer/Bridge).
 */
export default function AuthStatusBanner() {
  const { isConnected } = useAccount()
  const { status, error, isAuthenticated } = useWalletAuthContext()

  if (!isConnected || isAuthenticated) return null

  if (status === 'error') {
    return (
      <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-error/20 bg-error/5 animate-fade-in-up">
        <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
        <p className="text-body-sm text-error font-medium">{error ?? 'Sign-in failed.'}</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-tertiary/20 bg-tertiary/5 animate-fade-in-up">
      <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0 animate-pulse">fingerprint</span>
      <p className="text-body-sm text-tertiary font-medium">
        {status === 'verifying'
          ? 'Verifying your signature…'
          : "Sign the message in your wallet to sync your activity history — this won't cost gas or trigger a transaction."}
      </p>
    </div>
  )
}
