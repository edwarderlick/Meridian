import { useAccount } from 'wagmi'
import OutflowBarChart from '../../components/console/OutflowBarChart'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import { SkeletonChart } from '../../components/console/Skeleton'
import { ANALYTICS_RANGES, useSpendingAnalytics, type AnalyticsRange } from '../../hooks/useSpendingAnalytics'
import { exportOutflowCsv, exportOutflowPdf } from '../../lib/analyticsExport'
import { useState } from 'react'

const CHARTS = [
  {
    key: 'byCategory' as const,
    title: 'Outflow by Category',
    desc: 'Real outflow split across transaction types — Transfer, Bridge, Swap, Yield Deposit, Gateway',
    icon: 'category',
    accent: 'primary' as const,
    accentText: 'text-primary',
    well: 'bg-primary/10 border-primary/15',
  },
  {
    key: 'byChain' as const,
    title: 'Outflow by Chain',
    desc: 'Real outflow split across the chain it left from',
    icon: 'hub',
    accent: 'secondary' as const,
    accentText: 'text-secondary',
    well: 'bg-secondary/10 border-secondary/15',
  },
  {
    key: 'byRecipient' as const,
    title: 'Outflow by Recipient',
    desc: 'Real Transfer outflow split across top counterparties',
    icon: 'groups',
    accent: 'tertiary' as const,
    accentText: 'text-tertiary',
    well: 'bg-tertiary/10 border-tertiary/15',
  },
]

function AnalyticsScreen() {
  const [range, setRange] = useState<AnalyticsRange>('1M')
  const { address } = useAccount()
  const analytics = useSpendingAnalytics(address, range)

  const hasRows = analytics.rows.length > 0

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Spending Analytics</h2>
          <div className="mt-2.5">
            <span className="status-chip text-[10px]">
              <span className="status-chip-dot status-chip-dot-live" />
              Live
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-label-caps text-[10px] text-on-surface-variant/45 uppercase tracking-[0.14em]">Total Outflow ({range})</p>
          <p className="font-mono-data text-2xl font-bold tabular-nums">${analytics.totalOutflow.toFixed(2)}</p>
        </div>
      </div>

      <div className="glass rounded-2xl px-5 py-4 border-white/[0.06]">
        <p className="text-[11px] text-on-surface-variant/60 leading-relaxed">
          <span className="font-semibold text-on-surface-variant/80">Methodology:</span> built from this wallet's real
          activity log — every Transfer, successful Bridge, Swap, Gateway deposit/spend, and Aave/Uniswap deposit.
          "Outflow" means capital leaving its current chain or liquid-USDC state, for any reason — it does not mean
          money left your control, so bridges, swaps, and yield deposits count even though you still hold the value
          elsewhere. Aave/Uniswap withdrawals are excluded (they're capital coming back, not outflow).
          {analytics.hasUnpricedLegs && (
            <>
              {' '}
              Dollar amounts reflect only each transaction's USDC-denominated leg — non-USDC legs (e.g. WETH in a
              Uniswap LP deposit, or a Swap paid for in EURC/cirBTC) aren't converted to dollars, since there's no
              reliable USD price for those assets on testnet.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="glass rounded-full p-1 flex gap-1 w-fit">
          {ANALYTICS_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-full text-xs font-mono-data font-bold transition-premium border ${
                range === r
                  ? 'bg-primary/15 text-primary border-primary/20'
                  : 'text-on-surface-variant hover:text-on-surface border-transparent'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-label-caps text-[10px] text-on-surface-variant/45 uppercase tracking-[0.14em] mr-1">
            Export Report
          </span>
          <button
            type="button"
            onClick={() => address && exportOutflowCsv(analytics.rows, range, address)}
            disabled={!hasRows || !address}
            className="btn-secondary px-3.5 py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            CSV
          </button>
          <button
            type="button"
            onClick={() =>
              address &&
              exportOutflowPdf(analytics.rows, analytics.byCategory, analytics.byChain, analytics.byRecipient, analytics.totalOutflow, range, address)
            }
            disabled={!hasRows || !address}
            className="btn-secondary px-3.5 py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
            PDF
          </button>
        </div>
      </div>

      <div className="space-y-gutter">
        {CHARTS.map((chart) => (
          <div key={chart.title} className="glass-premium rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-10">
              <div className={`icon-well ${chart.well}`}>
                <span className={`material-symbols-outlined text-[18px] ${chart.accentText}`}>{chart.icon}</span>
              </div>
              <div>
                <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">{chart.title}</h3>
                <p className="text-on-surface-variant/60 text-body-sm mt-0.5">{chart.desc}</p>
              </div>
            </div>
            {analytics.isLoading ? <SkeletonChart /> : <OutflowBarChart data={analytics[chart.key]} accent={chart.accent} />}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Analytics() {
  return (
    <RequireWallet noun="spending analytics">
      <AnalyticsScreen />
    </RequireWallet>
  )
}
