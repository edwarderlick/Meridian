import { useConnectModal } from '@rainbow-me/rainbowkit'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { SolanaIcon, SuiIcon } from '../../assets/chains'
import { useSolanaWallet } from '../../context/SolanaWalletContext'
import { useSuiWallet } from '../../context/SuiWalletContext'

interface EcosystemRow {
  key: string
  label: string
  connected: boolean
  connect: () => void
  disconnect: () => void
  icon: ReactNode
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * Generic multi-ecosystem wallet status — reusable anywhere the console shows
 * connection state, not just the top bar. Compact trigger + popover scales to
 * N simultaneous ecosystems without the top bar overflowing on mobile, unlike
 * one pill per ecosystem. All three ecosystems are real connections: EVM via
 * wagmi/RainbowKit, Solana via @solana/wallet-adapter-react, Sui via
 * @mysten/dapp-kit — see SolanaWalletContext / SuiWalletContext.
 */
export default function WalletStatusMenu() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()
  const solana = useSolanaWallet()
  const sui = useSuiWallet()
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; right: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const rows: EcosystemRow[] = [
    {
      key: 'evm',
      label: isConnected && address ? truncateAddress(address) : 'EVM Wallet',
      connected: isConnected,
      connect: () => openConnectModal?.(),
      disconnect: () => disconnect(),
      icon: <span className="material-symbols-outlined text-[16px] text-on-surface-variant/70">account_balance_wallet</span>,
    },
    {
      key: 'solana',
      label: solana.connected && solana.address ? truncateAddress(solana.address) : 'Solana',
      connected: solana.connected,
      connect: solana.connect,
      disconnect: solana.disconnect,
      icon: <SolanaIcon className="w-4 h-4 rounded-full shrink-0" />,
    },
    {
      key: 'sui',
      label: sui.connected && sui.address ? truncateAddress(sui.address) : 'Sui',
      connected: sui.connected,
      connect: sui.connect,
      disconnect: sui.disconnect,
      icon: <SuiIcon className="w-4 h-4 rounded-full shrink-0" />,
    },
  ]
  const connectedCount = rows.filter((r) => r.connected).length

  const updatePosition = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) setRect({ top: r.bottom + 8, right: window.innerWidth - r.right })
  }

  useEffect(() => {
    if (!open) return
    updatePosition()

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const handleReposition = () => updatePosition()

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Wallet connections — ${connectedCount} of ${rows.length} connected`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-premium text-on-surface-variant"
      >
        <span className={`status-chip-dot shrink-0 ${connectedCount > 0 ? 'status-chip-dot-live' : ''}`} />
        <span className="hidden sm:inline font-mono-data text-xs">
          {connectedCount}/{rows.length} Wallets
        </span>
        <span className="material-symbols-outlined text-[16px] opacity-50">expand_more</span>
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Wallet connections"
            className="fixed z-[90] glass-premium rounded-xl overflow-hidden shadow-glass-xl scale-in w-72"
            style={{ top: rect.top, right: rect.right }}
          >
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="font-label-caps text-[10px] uppercase tracking-[0.14em] text-on-surface-variant/45">
                Connected Wallets
              </p>
            </div>
            <div className="py-1.5">
              {rows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {row.icon}
                    <span className="text-sm text-on-surface truncate">{row.label}</span>
                    {row.connected && <span className="status-chip-dot status-chip-dot-live shrink-0" />}
                  </div>
                  <button
                    type="button"
                    onClick={row.connected ? row.disconnect : row.connect}
                    aria-label={row.connected ? `Disconnect ${row.label}` : `Connect ${row.label}`}
                    className={
                      row.connected
                        ? 'btn-ghost px-2.5 py-1.5 text-xs shrink-0 border border-white/10'
                        : 'btn-primary px-2.5 py-1.5 text-xs shrink-0'
                    }
                  >
                    {row.connected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
