import { useConnectModal } from '@rainbow-me/rainbowkit'
import type { ReactNode } from 'react'
import { useAccount } from 'wagmi'

export function ConnectWalletGate({ noun = 'this screen' }: { noun?: string }) {
  const { openConnectModal } = useConnectModal()

  return (
    <div className="glass-premium rounded-2xl p-14 empty-state min-h-[380px]">
      <div className="empty-state-icon w-16 h-16 rounded-2xl mb-1">
        <span className="material-symbols-outlined text-[26px] text-primary/80">account_balance_wallet</span>
      </div>
      <p className="empty-state-title text-base tracking-tight">Connect your wallet</p>
      <p className="empty-state-desc">Connect a wallet to view {noun} and start using the console.</p>
      <button type="button" onClick={openConnectModal} className="btn-primary px-6 py-2.5 text-sm mt-7">
        <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
        Connect Wallet
      </button>
    </div>
  )
}

export function RequireWallet({ noun, children }: { noun?: string; children: ReactNode }) {
  const { isConnected } = useAccount()
  if (!isConnected) return <ConnectWalletGate noun={noun} />
  return <>{children}</>
}
