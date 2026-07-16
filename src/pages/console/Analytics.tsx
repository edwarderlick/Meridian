import { useState } from 'react'
import TrajectoryChart from '../../components/console/TrajectoryChart'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import { SkeletonChart } from '../../components/console/Skeleton'
import { useSimulatedLoading } from '../../hooks/useSimulatedLoading'

const RANGES = ['1D', '1W', '1M', '1Y'] as const

const CHARTS = [
  {
    title: 'Outflow by Category',
    desc: 'Treasury spend split across spending categories',
    icon: 'category',
    accent: 'primary' as const,
    accentText: 'text-primary',
    well: 'bg-primary/10 border-primary/15',
  },
  {
    title: 'Outflow by Chain',
    desc: 'Treasury spend split across connected networks',
    icon: 'hub',
    accent: 'secondary' as const,
    accentText: 'text-secondary',
    well: 'bg-secondary/10 border-secondary/15',
  },
  {
    title: 'Outflow by Recipient',
    desc: 'Treasury spend split across top counterparties',
    icon: 'groups',
    accent: 'tertiary' as const,
    accentText: 'text-tertiary',
    well: 'bg-tertiary/10 border-tertiary/15',
  },
]

function AnalyticsScreen() {
  const [range, setRange] = useState<(typeof RANGES)[number]>('1M')
  const loading = useSimulatedLoading()

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
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="glass rounded-full p-1 flex gap-1 w-fit">
          {RANGES.map((r) => (
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
          <button type="button" className="btn-secondary px-3.5 py-2 text-xs">
            <span className="material-symbols-outlined text-[16px]">description</span>
            CSV
          </button>
          <button type="button" className="btn-secondary px-3.5 py-2 text-xs">
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
            {loading ? <SkeletonChart /> : <TrajectoryChart accent={chart.accent} labels={['—', '—', '—', '—', '—']} />}
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
