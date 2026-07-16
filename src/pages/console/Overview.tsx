import { useAccount } from 'wagmi'
import ActivityFeed from '../../components/console/ActivityFeed'
import AuthStatusBanner from '../../components/console/AuthStatusBanner'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import { SkeletonBlock, SkeletonChart, SkeletonStat } from '../../components/console/Skeleton'
import TrajectoryChart from '../../components/console/TrajectoryChart'
import { useWalletAuthContext } from '../../context/WalletAuthContext'
import { toActivityItem, useActivityLog } from '../../hooks/useActivityLog'
import { useCountUp } from '../../hooks/useCountUp'
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll'
import { useSimulatedLoading } from '../../hooks/useSimulatedLoading'
import { useUsdcBalances } from '../../hooks/useUsdcBalances'

function MiniCounter({ target, active, suffix = '' }: { target: number; active: boolean; suffix?: string }) {
  const value = useCountUp(target, active)
  return (
    <span className="font-label-caps text-[1.1rem] font-bold tabular-nums text-on-surface">
      {value}
      {suffix}
    </span>
  )
}

const STATS = [
  {
    label: '24H Activity',
    value: '0 TX',
    icon: 'swap_horiz',
    accent: 'text-secondary',
    glow: 'bg-secondary/10',
    well: 'bg-secondary/10 border-secondary/15',
  },
  {
    label: 'Active Modules',
    value: '5 / 9',
    icon: 'dashboard_customize',
    accent: 'text-tertiary',
    glow: 'bg-tertiary/10',
    well: 'bg-tertiary/10 border-tertiary/15',
  },
]

function OverviewScreen() {
  const loading = useSimulatedLoading()
  const { ref: statsRef, visible: statsVisible } = useRevealOnScroll<HTMLDivElement>()
  const { total, isLoading: balancesLoading, refetchAll } = useUsdcBalances()
  const { address } = useAccount()
  const { isAuthenticated } = useWalletAuthContext()
  const { entries: activityEntries, isLoading: activityLoading, error: activityError } = useActivityLog(
    isAuthenticated ? address : undefined,
  )

  if (activityError) {
    console.error('[Overview] useActivityLog returned an error:', activityError)
  }
  const totalDisplayTarget = Math.round(total * 100) / 100
  const animatedTotal = useCountUp(totalDisplayTarget, statsVisible && !balancesLoading)

  return (
    <div className="space-y-8">
      <AuthStatusBanner />

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div className="page-header">
          <h2 className="page-title text-headline-xl">Overview</h2>
          <div className="mt-1">
            <span className="status-chip text-[10px]">
              <span className="status-chip-dot status-chip-dot-live" />
              Wallet Connected
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={refetchAll}
          aria-label="Refresh balances"
          className="btn-icon w-10 h-10 glass shrink-0 hover:text-primary"
        >
          <span className={`material-symbols-outlined ${balancesLoading ? 'animate-spin' : ''}`}>refresh</span>
        </button>
      </div>

      <div
        ref={statsRef}
        className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-gutter stagger-in${statsVisible ? ' visible' : ''}`}
      >
        {balancesLoading ? (
          <SkeletonStat />
        ) : (
          <div className="glass-premium card-interactive p-6 rounded-2xl flex flex-col justify-between min-h-[152px] relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10">
              <span className="field-label opacity-90">Total Balance (USD)</span>
              <div className="icon-well bg-primary/10 border-primary/15">
                <span className="material-symbols-outlined text-[18px] text-primary">account_balance</span>
              </div>
            </div>
            <div className="mt-5 relative z-10">
              <div className="font-mono-data text-[1.85rem] font-semibold tracking-tight text-on-surface tabular-nums">
                ${animatedTotal.toFixed(2)}
              </div>
            </div>
            <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-primary/10 blur-3xl rounded-full opacity-80" />
          </div>
        )}

        {loading ? (
          <>
            {STATS.map((stat) => (
              <SkeletonStat key={stat.label} />
            ))}
            <SkeletonStat />
          </>
        ) : (
          <>
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="glass-premium card-interactive p-6 rounded-2xl flex flex-col justify-between min-h-[152px] relative overflow-hidden"
              >
                <div className="flex justify-between items-start relative z-10">
                  <span className="field-label opacity-90">{stat.label}</span>
                  <div className={`icon-well ${stat.well}`}>
                    <span className={`material-symbols-outlined text-[18px] ${stat.accent}`}>{stat.icon}</span>
                  </div>
                </div>
                <div className="mt-5 relative z-10">
                  <div className="font-mono-data text-[1.85rem] font-semibold tracking-tight text-on-surface tabular-nums">
                    {stat.value}
                  </div>
                </div>
                <div className={`absolute -right-6 -bottom-6 w-36 h-36 ${stat.glow} blur-3xl rounded-full opacity-80`} />
              </div>
            ))}

            <div className="glass-premium card-interactive p-6 rounded-2xl flex flex-col justify-between min-h-[152px] relative overflow-hidden">
              <div className="flex justify-between items-start relative z-10">
                <span className="field-label opacity-90">Agentic Health</span>
                <div className="icon-well bg-secondary/10 border-secondary/15">
                  <span className="material-symbols-outlined text-[18px] text-secondary">robot_2</span>
                </div>
              </div>
              <div className="mt-5 relative z-10 grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <MiniCounter target={0} active={statsVisible} suffix="%" />
                  <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-wide">In Agents</span>
                </div>
                <div className="flex flex-col gap-1">
                  <MiniCounter target={0} active={statsVisible} />
                  <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-wide">Active Jobs</span>
                </div>
                <div className="flex flex-col gap-1">
                  <MiniCounter target={0} active={statsVisible} suffix=" USDC" />
                  <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-wide">Nano Volume</span>
                </div>
              </div>
              <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-secondary/10 blur-3xl rounded-full opacity-80" />
            </div>
          </>
        )}
      </div>

      <div className="glass-premium rounded-2xl p-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-8">
          <div>
            <h3 className="font-headline-lg text-[22px] font-semibold text-on-surface tracking-tight">
              Portfolio Trajectory
            </h3>
            <p className="page-subtitle mt-1.5 text-[14px]">Aggregated performance across connected vaults</p>
          </div>
        </div>
        {loading ? (
          <SkeletonChart height="h-64" />
        ) : (
          <div className="pb-6">
            <TrajectoryChart accent="primary" />
          </div>
        )}
      </div>

      {activityError && (
        <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-error/20 bg-error/5 animate-fade-in-up">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
          <p className="text-body-sm text-error font-medium">
            Couldn't load activity: {activityError.message} (see console for the full error)
          </p>
        </div>
      )}

      {loading || activityLoading ? (
        <div className="glass-premium rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.06] flex justify-between items-center">
            <h3 className="font-headline-lg text-[18px] font-semibold text-on-surface tracking-tight">
              Recent Activity
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
          </div>
        </div>
      ) : (
        <ActivityFeed
          title="Recent Activity"
          items={activityEntries.map(toActivityItem)}
          emptyIcon="history"
          emptyTitle="No recent activity"
          emptyDesc="Transfers, bridges, and swaps will appear here once you connect"
        />
      )}
    </div>
  )
}

export default function Overview() {
  return (
    <RequireWallet noun="your treasury overview">
      <OverviewScreen />
    </RequireWallet>
  )
}
