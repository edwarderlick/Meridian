import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAccount } from 'wagmi'
import WalletStatusMenu from './WalletStatusMenu'

type BadgeStatus = 'live' | 'in-progress' | 'coming-soon'

type NavBadge =
  | { kind: 'status'; status: BadgeStatus }
  | { kind: 'value'; text: string }
  | { kind: 'institutional' }

interface NavItem {
  label: string
  path: string
  icon: string
  badge: NavBadge
  title?: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Rewards',
    items: [
      { label: 'Points', path: '/console/points', icon: 'stars', badge: { kind: 'value', text: '0 PTS' } },
    ],
  },
  {
    label: 'Core',
    items: [
      { label: 'Overview', path: '/console/overview', icon: 'grid_view', badge: { kind: 'status', status: 'live' } },
      { label: 'Transfer', path: '/console/transfer', icon: 'send', badge: { kind: 'status', status: 'live' } },
      { label: 'Bridge', path: '/console/bridge', icon: 'alt_route', badge: { kind: 'status', status: 'live' } },
      {
        label: 'Unified Balance',
        path: '/console/unified-balance',
        icon: 'account_balance_wallet',
        badge: { kind: 'status', status: 'live' },
      },
      { label: 'Swap', path: '/console/swap', icon: 'swap_horiz', badge: { kind: 'status', status: 'live' } },
      { label: 'Liquidity', path: '/console/liquidity', icon: 'water_drop', badge: { kind: 'status', status: 'live' } },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Spending Analytics', path: '/console/analytics', icon: 'bar_chart', badge: { kind: 'status', status: 'live' } },
      {
        label: 'Yield Optimizer',
        path: '/console/yield-optimizer',
        icon: 'trending_up',
        badge: { kind: 'status', status: 'live' },
      },
      { label: 'Sub-Accounts', path: '/console/sub-accounts', icon: 'layers', badge: { kind: 'status', status: 'live' } },
      { label: 'Invoicing', path: '/console/invoicing', icon: 'receipt_long', badge: { kind: 'status', status: 'live' } },
      {
        label: 'StableFX',
        path: '/console/stablefx',
        icon: 'currency_exchange',
        badge: { kind: 'institutional' },
        title: 'Institutional — Request Access',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Alerts', path: '/console/alerts', icon: 'notifications', badge: { kind: 'status', status: 'live' } },
      { label: 'Simulation', path: '/console/simulation', icon: 'science', badge: { kind: 'status', status: 'live' } },
      {
        label: 'Delegate Permissions',
        path: '/console/delegates',
        icon: 'admin_panel_settings',
        badge: { kind: 'status', status: 'in-progress' },
      },
    ],
  },
  {
    label: 'Automation',
    items: [
      {
        label: 'Recurring Payments',
        path: '/console/recurring-payments',
        icon: 'event_repeat',
        badge: { kind: 'status', status: 'coming-soon' },
      },
      { label: 'Policy', path: '/console/policy', icon: 'gavel', badge: { kind: 'status', status: 'in-progress' } },
      { label: 'Agent Wallets', path: '/console/agent-wallets', icon: 'robot_2', badge: { kind: 'status', status: 'live' } },
      { label: 'Agentic Jobs', path: '/console/agentic-jobs', icon: 'work', badge: { kind: 'status', status: 'live' } },
    ],
  },
  {
    label: 'Risk & Markets',
    items: [
      { label: 'Insurance', path: '/console/insurance', icon: 'shield', badge: { kind: 'status', status: 'coming-soon' } },
      {
        label: 'Prediction Markets',
        path: '/console/prediction-markets',
        icon: 'insights',
        badge: { kind: 'status', status: 'coming-soon' },
      },
      {
        label: 'Agent Identity & Reputation',
        path: '/console/agent-identity',
        icon: 'verified_user',
        badge: { kind: 'status', status: 'live' },
      },
      { label: 'Nanopayments', path: '/console/nanopayments', icon: 'bolt', badge: { kind: 'status', status: 'live' } },
      {
        label: 'Agent Marketplace',
        path: '/console/agent-marketplace',
        icon: 'storefront',
        badge: { kind: 'status', status: 'live' },
      },
    ],
  },
]

const BADGE_STYLE: Record<BadgeStatus, string> = {
  live: 'bg-primary/10 text-primary border-primary/20',
  'in-progress': 'bg-secondary/10 text-secondary border-secondary/25',
  'coming-soon': 'bg-white/[0.03] text-on-surface-variant/45 border-white/[0.08]',
}

const BADGE_LABEL: Record<BadgeStatus, string> = {
  live: 'Live',
  'in-progress': 'In Progress',
  'coming-soon': 'Coming Soon',
}

function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded-full border font-label-caps text-[9px] uppercase tracking-wider ${BADGE_STYLE[status]} ${
        status === 'in-progress' ? 'animate-pulse' : ''
      }`}
    >
      {BADGE_LABEL[status]}
    </span>
  )
}

function ValueBadge({ text }: { text: string }) {
  return (
    <span className="shrink-0 px-2 py-0.5 rounded-full border font-label-caps text-[9px] uppercase tracking-wider bg-primary/10 text-primary border-primary/25">
      {text}
    </span>
  )
}

function InstitutionalBadge() {
  return (
    <span className="shrink-0 px-2 py-0.5 rounded-full border font-label-caps text-[9px] uppercase tracking-wider bg-white/[0.03] text-on-surface-variant/45 border-white/[0.08]">
      Request Access
    </span>
  )
}

function NavBadgeView({ badge }: { badge: NavBadge }) {
  if (badge.kind === 'status') return <StatusBadge status={badge.status} />
  if (badge.kind === 'value') return <ValueBadge text={badge.text} />
  return <InstitutionalBadge />
}

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const location = useLocation()

  return (
    <aside
      className={`fixed h-full w-72 left-0 top-0 z-50 flex flex-col py-7 bg-surface/75 backdrop-blur-2xl border-r border-white/[0.06] shadow-[1px_0_24px_-8px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-premium lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

      <div className="flex items-center justify-between px-6 mb-6">
        <Link to="/" className="block group" onClick={onNavigate}>
          <h1 className="font-headline-lg text-[22px] font-bold text-on-surface tracking-tighter transition-premium group-hover:text-white">
            Meridian
          </h1>
          <p className="font-label-caps text-[10px] text-primary uppercase tracking-[0.16em] opacity-80 mt-1.5">
            Institutional Console
          </p>
        </Link>
        <button
          type="button"
          onClick={onNavigate}
          aria-label="Close navigation menu"
          className="btn-ghost w-9 h-9 lg:hidden shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <div className="px-5 mb-6">
        <Link
          to="/console/points"
          onClick={onNavigate}
          className="glass-premium card-interactive rounded-2xl px-4 py-3.5 flex items-center justify-between"
        >
          <div>
            <p className="font-mono-data text-[26px] font-bold text-on-surface tabular-nums tracking-tight leading-none">
              0
            </p>
            <p className="font-label-caps text-[10px] text-on-surface-variant/50 uppercase tracking-[0.14em] mt-1.5">
              Points
            </p>
          </div>
          <div className="icon-well bg-primary/10 border-primary/15 text-primary shrink-0">
            <span className="material-symbols-outlined text-[18px]">stars</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-7 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-4 mb-2.5 font-label-caps text-[10px] text-on-surface-variant/35 uppercase tracking-[0.16em]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onNavigate}
                    title={item.title}
                    className={`nav-item px-3.5 py-2.5 ${active ? 'nav-item-active' : ''}`}
                  >
                    <span
                      className={`material-symbols-outlined text-[20px] shrink-0 transition-premium ${
                        active ? 'text-primary' : 'text-on-surface-variant/65'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1 leading-snug tracking-tight">{item.label}</span>
                    <NavBadgeView badge={item.badge} />
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 mt-3 pt-4 border-t border-white/[0.06] space-y-0.5">
        <Link to="/console/overview" onClick={onNavigate} className="nav-item px-3.5 py-2.5">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant/65">settings</span>
          <span>Settings</span>
        </Link>
        <div className="nav-item px-3.5 py-2.5 opacity-50 cursor-not-allowed">
          <span className="material-symbols-outlined text-[20px]">smart_toy</span>
          <span className="flex-1">AI Assistant</span>
          <span className="font-label-caps text-[9px] text-on-surface-variant/40 tracking-wider">Dock</span>
        </div>
      </div>
    </aside>
  )
}

function TopBar({ pageTitle, onMenuClick }: { pageTitle: string; onMenuClick: () => void }) {
  const { chain, isConnected } = useAccount()
  const networkLabel = isConnected ? (chain?.name ?? 'Unsupported Network') : 'Not Connected'

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-72 h-16 z-40 flex justify-between items-center px-margin-mobile lg:px-margin-desktop bg-background/70 backdrop-blur-2xl border-b border-white/[0.06]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="btn-ghost w-9 h-9 lg:hidden shrink-0 -ml-1.5"
        >
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>
        <div className="hidden sm:flex items-center gap-2 font-label-caps text-[10px] uppercase tracking-[0.14em] text-on-surface-variant/45 min-w-0">
          <span className="shrink-0">Console</span>
          <span className="material-symbols-outlined text-[14px] opacity-50 shrink-0">chevron_right</span>
          <span className="text-on-surface normal-case font-body-md text-[15px] font-medium tracking-tight truncate">
            {pageTitle}
          </span>
        </div>
        <span className="sm:hidden text-on-surface font-body-md text-[15px] font-medium tracking-tight truncate">
          {pageTitle}
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <div
          aria-label={`Connected network: ${networkLabel}`}
          className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-on-surface-variant text-xs font-mono-data"
        >
          <span className={`status-chip-dot shrink-0 ${isConnected && chain ? 'status-chip-dot-live' : ''}`} />
          {networkLabel}
        </div>

        <Link to="/console/alerts" aria-label="Notifications" className="btn-ghost w-9 h-9 text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
        </Link>

        <WalletStatusMenu />
      </div>
    </header>
  )
}

function AiAssistantDock({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <aside
      className={`fixed h-full w-full sm:w-80 right-0 top-0 z-[70] flex flex-col p-6 bg-surface-container-low/85 backdrop-blur-2xl border-l border-white/[0.08] shadow-[-16px_0_48px_-16px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-premium ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5">
          <div className="icon-well w-8 h-8 bg-tertiary/10 border-tertiary/15">
            <span className="material-symbols-outlined text-tertiary text-[18px]">smart_toy</span>
          </div>
          <h4 className="font-label-caps text-[11px] text-tertiary uppercase tracking-[0.14em]">AI Assistant</h4>
        </div>
        <button type="button" onClick={onClose} aria-label="Close AI Assistant" className="btn-ghost w-8 h-8">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div className="flex-1 empty-state px-2">
        <div className="empty-state-icon">
          <span className="material-symbols-outlined text-tertiary">smart_toy</span>
        </div>
        <p className="empty-state-title">Assistant ready</p>
        <p className="empty-state-desc">
          Ask about your treasury, transfers, or protocol status. Not connected yet — layout placeholder for the
          console.
        </p>
      </div>

      <div className="mt-auto pt-6 border-t border-white/[0.06] space-y-4">
        <div className="flex flex-wrap gap-2" aria-hidden="true">
          {['Show my USDC balance', 'Bridge to Arc Testnet', 'Recent transfer activity'].map((prompt) => (
            <span
              key={prompt}
              className="px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] text-on-surface-variant/55 cursor-default select-none"
            >
              {prompt}
            </span>
          ))}
        </div>
        <div className="relative">
          <input
            disabled
            className="input-premium py-3 pl-4 pr-11 text-sm font-mono-data"
            placeholder="Ask Meridian AI..."
            type="text"
          />
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-tertiary/45 text-[18px]">
            send
          </span>
        </div>
      </div>
    </aside>
  )
}

export default function AppShell({ pageTitle, children }: { pageTitle: string; children: ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-on-surface relative">
      <div className="console-ambient" aria-hidden />

      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-[2px] z-40 lg:hidden fade-in"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar open={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
      <TopBar pageTitle={pageTitle} onMenuClick={() => setMobileNavOpen(true)} />

      <main className="relative z-[1] ml-0 lg:ml-72 pt-16 min-h-screen">
        <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop pt-8 pb-32 animate-fade-in-up">
          {children}
        </div>
      </main>

      <AiAssistantDock open={aiOpen} onClose={() => setAiOpen(false)} />

      {!aiOpen && (
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          aria-label="Open AI Assistant"
          className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow-primary hover:scale-105 hover:shadow-glow-md active:scale-95 transition-premium z-[60]"
        >
          <span className="material-symbols-outlined text-on-primary-container text-2xl">smart_toy</span>
        </button>
      )}
    </div>
  )
}
