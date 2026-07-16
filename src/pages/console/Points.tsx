import { RequireWallet } from '../../components/console/ConnectWalletGate'
import { SkeletonBlock, SkeletonTable } from '../../components/console/Skeleton'
import { useSimulatedLoading } from '../../hooks/useSimulatedLoading'

const EARN_ACTIONS = [
  { label: 'Transfer', desc: 'Points per completed transfer', icon: 'send', accent: 'text-primary', well: 'bg-primary/10 border-primary/15' },
  { label: 'Bridge', desc: 'Points per cross-chain bridge', icon: 'alt_route', accent: 'text-secondary', well: 'bg-secondary/10 border-secondary/15' },
  {
    label: 'Liquidity Deposit',
    desc: 'Points per pool deposit',
    icon: 'water_drop',
    accent: 'text-tertiary',
    well: 'bg-tertiary/10 border-tertiary/15',
  },
  { label: 'Swap', desc: 'Points per completed swap', icon: 'swap_horiz', accent: 'text-primary', well: 'bg-primary/10 border-primary/15' },
  {
    label: 'Created first Agent Wallet',
    desc: 'One-time bonus for creating your first Agent Wallet',
    icon: 'robot_2',
    accent: 'text-secondary',
    well: 'bg-secondary/10 border-secondary/15',
  },
  {
    label: 'Posted first Agentic Job',
    desc: 'One-time bonus for posting your first ERC-8183 job',
    icon: 'work',
    accent: 'text-tertiary',
    well: 'bg-tertiary/10 border-tertiary/15',
  },
]

function PointsScreen() {
  const loading = useSimulatedLoading()

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Points</h2>
          <div className="mt-2.5">
            <span className="status-chip">
              <span className="status-chip-dot status-chip-dot-live" />
              Wallet Connected
            </span>
          </div>
        </div>
      </div>

      <section className="glass-premium rounded-[32px] p-10 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary/5 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-end md:items-center gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="font-label-caps text-on-surface-variant/55 tracking-[0.14em] uppercase text-[11px]">
                Total Points
              </span>
            </div>
            {loading ? (
              <SkeletonBlock className="h-14 w-40" />
            ) : (
              <h2 className="font-headline-xl text-on-surface tracking-tighter flex items-baseline gap-2">
                <span className="text-[56px] font-extrabold tabular-nums">0</span>
                <span className="opacity-40 text-[22px] font-semibold">PTS</span>
              </h2>
            )}
          </div>
          <div className="icon-well bg-primary/10 border-primary/15 text-primary w-16 h-16 rounded-2xl">
            <span className="material-symbols-outlined text-[28px]">stars</span>
          </div>
        </div>
      </section>

      <div className="glass-premium rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <h3 className="font-headline-lg text-[18px] font-semibold text-on-surface tracking-tight">
            Points Breakdown
          </h3>
          <p className="text-on-surface-variant/70 font-body-sm mt-1.5 leading-relaxed">
            How points are earned across console activity
          </p>
        </div>
        {loading ? (
          <SkeletonTable rows={6} columns={3} />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {EARN_ACTIONS.map((action) => (
              <div key={action.label} className="flex items-center justify-between px-6 py-5 hover:bg-white/[0.03] transition-premium">
                <div className="flex items-center gap-4">
                  <div className={`icon-well ${action.well}`}>
                    <span className={`material-symbols-outlined text-[18px] ${action.accent}`}>{action.icon}</span>
                  </div>
                  <div>
                    <p className="font-bold tracking-tight text-sm">{action.label}</p>
                    <p className="text-[12px] text-on-surface-variant/55 mt-0.5">{action.desc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono-data text-sm text-on-surface-variant/45">— pts</p>
                  <p className="text-[11px] text-on-surface-variant/40 mt-0.5">0 times earned</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-premium rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <h3 className="font-headline-lg text-[18px] font-semibold text-on-surface tracking-tight">
            Points History
          </h3>
        </div>
        {loading ? (
          <div className="p-6 space-y-4">
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
          </div>
        ) : (
          <div className="p-14 empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined">history</span>
            </div>
            <p className="empty-state-title">No points activity yet</p>
            <p className="empty-state-desc">Start using the console to begin earning points</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Points() {
  return (
    <RequireWallet noun="your points balance">
      <PointsScreen />
    </RequireWallet>
  )
}
