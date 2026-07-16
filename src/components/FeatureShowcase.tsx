import { useState } from 'react'
import { useSpotlight } from '../hooks/useSpotlight'

type BadgeStyle = 'live' | 'muted' | 'progress'

interface Module {
  id?: string
  span: string
  extraClass?: string
  badgeStyle: BadgeStyle
  badge: string
  badgeGlow?: boolean
  iconColor: string
  icon: string
  title: string
  description: string
  details: string[]
}

const MODULES: Module[] = [
  {
    span: 'col-span-12 lg:col-span-4',
    extraClass: ' stagger-in visible',
    badgeStyle: 'live',
    badge: 'Live',
    badgeGlow: true,
    iconColor: 'text-primary',
    icon: 'send',
    title: 'Transfer',
    description: 'Global institutional-grade transfers with instant finality.',
    details: [
      'Sub-cent gas fees across all supported chains',
      'Instant finality — no waiting for confirmations',
      'Programmatic transfers via API or SDK',
    ],
  },
  {
    span: 'col-span-12 lg:col-span-4',
    badgeStyle: 'live',
    badge: 'Live',
    iconColor: 'text-tertiary',
    icon: 'swap_calls',
    title: 'Bridge',
    description: 'Sovereign liquidity movement powered by Circle CCTP.',
    details: [
      'Native USDC burn-and-mint via Circle CCTP',
      'No wrapped assets or synthetic bridging risk',
      'Typically settles in under a minute',
    ],
  },
  {
    span: 'col-span-12 lg:col-span-4',
    badgeStyle: 'live',
    badge: 'Live',
    iconColor: 'text-secondary',
    icon: 'account_balance_wallet',
    title: 'Unified Balance',
    description: 'Aggregated view of assets across all supported networks.',
    details: [
      'Real-time aggregation across every connected chain',
      'Single dashboard — no more explorer hopping',
      'Historical balance snapshots and CSV export',
    ],
  },
  {
    span: 'col-span-12 lg:col-span-6',
    badgeStyle: 'live',
    badge: 'Live (Beta)',
    iconColor: 'text-primary',
    icon: 'swap_horiz',
    title: 'Swap',
    description: 'Best-execution swaps via the Arc testnet aggregator.',
    details: [
      'Best-execution routing across the Arc testnet aggregator',
      'Slippage protection on every quote',
      'Currently in beta — mainnet routing coming soon',
    ],
  },
  {
    span: 'col-span-12 lg:col-span-6',
    badgeStyle: 'live',
    badge: 'Live',
    iconColor: 'text-tertiary',
    icon: 'smart_toy',
    title: 'AI Assistant',
    description: 'Natural language interface for executing complex on-chain logic.',
    details: [
      'Natural-language commands for transfers and swaps',
      'Context-aware treasury insights on demand',
      'Human-in-the-loop confirmation before any on-chain action',
    ],
  },
  {
    span: 'col-span-12 lg:col-span-4',
    badgeStyle: 'muted',
    badge: 'Coming Soon',
    iconColor: 'text-on-surface-variant',
    icon: 'security',
    title: 'Insurance',
    description: 'Parametric coverage for treasury risk, powered by real-world trigger data.',
    details: [
      'Parametric triggers tied to verified real-world data feeds',
      'No claims process — payouts execute automatically',
      'Currently in design — timeline TBA',
    ],
  },
  {
    span: 'col-span-12 lg:col-span-4',
    badgeStyle: 'muted',
    badge: 'Coming Soon',
    iconColor: 'text-on-surface-variant',
    icon: 'insights',
    title: 'Markets',
    description: 'Prediction markets for treasury and liquidity risk hedging.',
    details: [
      'Hedge treasury exposure to liquidity and depeg risk',
      'Peer-to-peer market creation on Arc',
      'Currently in design — timeline TBA',
    ],
  },
  {
    span: 'col-span-12 lg:col-span-4',
    badgeStyle: 'muted',
    badge: 'Coming Soon',
    iconColor: 'text-on-surface-variant',
    icon: 'event_repeat',
    title: 'Recurring Payments',
    description: 'Scheduled, automated USDC disbursements.',
    details: [
      'Schedule USDC disbursements on any cadence',
      'Payroll, vendor, and grant disbursement support',
      'Currently in design — timeline TBA',
    ],
  },
  {
    id: 'policy-module',
    span: 'col-span-12 lg:col-span-4',
    badgeStyle: 'progress',
    badge: 'IN PROGRESS',
    iconColor: 'text-secondary',
    icon: 'policy',
    title: 'Policy',
    description: 'Role-based access control and multi-sig spend limits for teams.',
    details: [
      'Role-based access control for treasury operators',
      'Configurable multi-sig spend thresholds',
      'In active development — testnet preview coming soon',
    ],
  },
]

const COMING_SOON = ['Yield Markets']

function ModuleBadge({ style, label, glow }: { style: BadgeStyle; label: string; glow?: boolean }) {
  if (style === 'live') {
    return (
      <div
        className={`px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-[0.12em] border border-primary/20 flex items-center gap-1.5${glow ? ' shadow-glow-sm' : ''}`}
      >
        <span className="status-chip-dot status-chip-dot-live !w-1.5 !h-1.5" /> {label}
      </div>
    )
  }
  if (style === 'progress') {
    return (
      <span className="px-2.5 py-1 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-[0.1em] border border-secondary/20">
        {label}
      </span>
    )
  }
  return (
    <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/60">
      {label}
    </span>
  )
}

function ModuleCard({ mod }: { mod: Module }) {
  const [expanded, setExpanded] = useState(false)
  const handleSpotlight = useSpotlight()

  const toggle = () => setExpanded((v) => !v)

  return (
    <div
      id={mod.id}
      role="button"
      tabIndex={0}
      onClick={toggle}
      onMouseMove={handleSpotlight}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggle()
        }
      }}
      className={`${mod.span} glass-premium card-interactive spotlight p-8 rounded-2xl${mod.extraClass ?? ''} cursor-pointer`}
    >
      <div className="flex justify-between items-start mb-8">
        <ModuleBadge style={mod.badgeStyle} label={mod.badge} glow={mod.badgeGlow} />
        <div className="icon-well">
          <span className={`material-symbols-outlined ${mod.iconColor} text-[22px]`}>{mod.icon}</span>
        </div>
      </div>
      <h3 className="font-headline-lg text-on-surface mb-2.5 tracking-tight">{mod.title}</h3>
      <p className="font-body-sm text-on-surface-variant/75 leading-relaxed">{mod.description}</p>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          toggle()
        }}
        className="mt-5 inline-flex items-center gap-1.5 text-on-surface-variant/80 hover:text-primary font-label-caps text-[11px] tracking-[0.12em] transition-premium"
      >
        {expanded ? 'Close' : 'Explore'}
        <span
          className={`material-symbols-outlined text-sm transition-transform duration-200 ease-premium ${expanded ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>

      <div className={`card-details${expanded ? ' expanded' : ''}`}>
        <div>
          <ul className="mt-4 pt-4 border-t border-white/[0.06] space-y-2.5">
            {mod.details.map((detail) => (
              <li key={detail} className="flex items-start gap-2.5 font-body-sm text-on-surface-variant/80">
                <span className="material-symbols-outlined text-primary text-[14px] mt-0.5 shrink-0">check_circle</span>
                <span className="leading-relaxed">{detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function FeatureShowcase() {
  return (
    <section id="explore-meridian" className="py-32 relative overflow-hidden bg-surface-container-lowest/30">
      <div className="section-divider"></div>
      <div className="noise-overlay"></div>
      <div className="max-w-container-max mx-auto px-margin-desktop relative z-10">
        <div className="text-center mb-24">
          <p className="section-label text-primary/80 mb-4 tracking-[0.16em]">Modules</p>
          <h2 className="font-headline-xl text-headline-xl mb-4 tracking-tight">Explore Meridian</h2>
          <p className="text-on-surface-variant/75 font-body-md text-lg">One console, every chain.</p>
        </div>
        <div className="grid grid-cols-12 gap-6 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none flex items-center justify-center opacity-20">
            <div className="orbit-pulse w-[500px] h-[500px] flex items-center justify-center">
              <div className="w-64 h-64 rounded-full bg-primary/5 blur-[80px]"></div>
            </div>
          </div>

          {MODULES.map((mod) => (
            <ModuleCard key={mod.title} mod={mod} />
          ))}

          {/* Reserved-for-future placeholder — not a real module, styled to read as such */}
          <div className="col-span-12 lg:col-span-4 p-8 rounded-2xl border border-dashed border-white/[0.1] flex flex-col items-center justify-center text-center bg-white/[0.015] hover:border-primary/25 hover:bg-white/[0.03] transition-premium group">
            <div className="empty-state-icon mb-5 group-hover:border-primary/20 transition-premium">
              <span className="material-symbols-outlined text-on-surface-variant/70">add_circle</span>
            </div>
            <h3 className="font-headline-lg text-on-surface/85 mb-2.5 tracking-tight">More Modules Coming</h3>
            <p className="font-body-sm text-on-surface-variant/55 leading-relaxed max-w-xs">
              We&apos;re actively expanding Meridian&apos;s capabilities — future additions may include a trading terminal and
              other treasury tools.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-12 border-t border-white/[0.05]">
          <div className="flex flex-wrap gap-5 opacity-70">
            {COMING_SOON.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/55">
                  Soon
                </span>
                <span className="font-body-sm text-on-surface-variant/80">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
