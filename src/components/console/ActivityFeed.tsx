import { useState } from 'react'
import type { ActivityType } from '../../hooks/useActivityLog'

export interface ActivityItem {
  id: string
  /** Drives the row's icon/color — falls back to a generic icon for unrecognized types. */
  type: ActivityType
  label: string
  amount?: number | string
  token?: string
  /** Recipient/counterparty address (Transfer). Mutually exclusive with `route` in practice. */
  counterparty?: string
  /** Cross-chain route (Bridge), e.g. "Ethereum Sepolia → Arc Testnet". */
  route?: string
  /** Raw status value, e.g. 'success' | 'pending_attestation' | 'error' — drives the status dot color. */
  status?: string
  /** Human-readable status label already resolved by the caller, e.g. "Pending". */
  statusLabel?: string
  timestamp: string
}

interface ActivityFeedProps {
  title: string
  items: ActivityItem[]
  emptyIcon: string
  emptyTitle: string
  emptyDesc: string
}

/** Same icon assignments already used for these modules in the sidebar nav (AppShell) and their own screens. */
const TYPE_STYLE: Record<ActivityType, { icon: string; well: string; accent: string }> = {
  transfer: { icon: 'send', well: 'bg-primary/10 border-primary/15', accent: 'text-primary' },
  bridge: { icon: 'alt_route', well: 'bg-tertiary/10 border-tertiary/15', accent: 'text-tertiary' },
  swap: { icon: 'swap_horiz', well: 'bg-secondary/10 border-secondary/15', accent: 'text-secondary' },
  gateway_deposit: { icon: 'add_circle', well: 'bg-primary/10 border-primary/15', accent: 'text-primary' },
  gateway_withdraw: {
    icon: 'account_balance_wallet',
    well: 'bg-tertiary/10 border-tertiary/15',
    accent: 'text-tertiary',
  },
  aave_deposit: { icon: 'savings', well: 'bg-primary/10 border-primary/15', accent: 'text-primary' },
  aave_withdraw: { icon: 'savings', well: 'bg-tertiary/10 border-tertiary/15', accent: 'text-tertiary' },
}
const FALLBACK_STYLE = { icon: 'history', well: 'bg-white/[0.04] border-white/[0.08]', accent: 'text-on-surface-variant' }

const STATUS_DOT: Record<string, string> = {
  success: 'status-chip-dot-live',
  pending_attestation: 'status-chip-dot-pending',
  error: 'status-chip-dot-error',
}

/** Matches WalletStatusMenu's truncation exactly — same 6-head/4-tail convention everywhere an address is shortened. */
function truncateAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function formatAmount(amount: number | string | undefined, token: string | undefined): string | null {
  if (amount === undefined) return null
  const numeric = typeof amount === 'number' ? amount : Number(amount)
  const formatted = Number.isFinite(numeric) ? numeric.toFixed(2) : String(amount)
  return `$${formatted}${token ? ` ${token}` : ''}`
}

function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation()
        await navigator.clipboard.writeText(address)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      aria-label="Copy address"
      className="btn-ghost w-6 h-6 shrink-0 p-0"
    >
      <span className="material-symbols-outlined text-[13px]">{copied ? 'check' : 'content_copy'}</span>
    </button>
  )
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const style = TYPE_STYLE[item.type] ?? FALLBACK_STYLE
  const amountLabel = formatAmount(item.amount, item.token)
  const dotClass = item.status ? STATUS_DOT[item.status] : undefined

  return (
    <div className="table-row flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className={`icon-well shrink-0 ${style.well}`}>
          <span className={`material-symbols-outlined text-[18px] ${style.accent}`}>{style.icon}</span>
        </div>
        <div className="min-w-0">
          <p className="font-body-sm font-semibold text-sm text-on-surface tracking-tight truncate">{item.label}</p>
          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
            {amountLabel && (
              <span className="font-mono-data text-[12px] text-on-surface-variant/70 shrink-0">{amountLabel}</span>
            )}
            {amountLabel && (item.counterparty || item.route) && (
              <span className="text-on-surface-variant/30 shrink-0">·</span>
            )}
            {item.counterparty ? (
              <span className="flex items-center gap-1 min-w-0">
                <span className="font-mono-data text-[12px] text-on-surface-variant/55 truncate">
                  {truncateAddress(item.counterparty)}
                </span>
                <CopyAddressButton address={item.counterparty} />
              </span>
            ) : item.route ? (
              <span className="font-mono-data text-[12px] text-on-surface-variant/55 truncate">{item.route}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {item.statusLabel && (
          <span className="status-chip !py-[0.2rem] !px-2 text-[9px]">
            {dotClass && <span className={`status-chip-dot ${dotClass}`} />}
            {item.statusLabel}
          </span>
        )}
        <span className="font-mono-data text-[11px] data-muted">{item.timestamp}</span>
      </div>
    </div>
  )
}

export default function ActivityFeed({ title, items, emptyIcon, emptyTitle, emptyDesc }: ActivityFeedProps) {
  return (
    <div className="glass-premium rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-white/[0.06] flex justify-between items-center">
        <h3 className="font-headline-lg text-[18px] font-semibold text-on-surface tracking-tight">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="p-16 empty-state animate-fade-in">
          <div className="empty-state-icon w-16 h-16">
            <span className="material-symbols-outlined text-[26px]">{emptyIcon}</span>
          </div>
          <p className="empty-state-title">{emptyTitle}</p>
          <p className="empty-state-desc">{emptyDesc}</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
