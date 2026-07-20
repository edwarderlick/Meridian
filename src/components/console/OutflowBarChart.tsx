import { useState } from 'react'
import type { OutflowBucket } from '../../hooks/useSpendingAnalytics'

type Accent = 'primary' | 'secondary' | 'tertiary'

const ACCENT: Record<Accent, { bar: string; text: string }> = {
  primary: { bar: 'bg-primary', text: 'text-primary' },
  secondary: { bar: 'bg-secondary', text: 'text-secondary' },
  tertiary: { bar: 'bg-tertiary', text: 'text-tertiary' },
}

/**
 * Real horizontal bar breakdown — replaces the old TrajectoryChart for this page, which rendered a
 * hardcoded flat line regardless of any data passed to it (it never actually accepted data points).
 * Categorical outflow breakdowns (by category/chain/recipient) are a snapshot-per-bucket shape, not
 * a time series, so a bar chart is the honest fit rather than forcing this through a line chart.
 */
export default function OutflowBarChart({ data, accent = 'primary' }: { data: OutflowBucket[]; accent?: Accent }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const { bar, text } = ACCENT[accent]
  const max = Math.max(...data.map((d) => d.amount), 0)

  if (data.length === 0) {
    return (
      <div className="h-52 w-full flex flex-col items-center justify-center gap-2 text-on-surface-variant/40">
        <span className="material-symbols-outlined text-2xl opacity-50">bar_chart</span>
        <p className="text-body-sm">No outflow in this range</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      {data.map((d) => {
        const widthPercent = max > 0 ? (d.amount / max) * 100 : 0
        return (
          <div
            key={d.label}
            className="group"
            onMouseEnter={() => setHovered(d.label)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-body-sm text-on-surface-variant/80 truncate pr-4">{d.label}</span>
              <span className={`font-mono-data text-xs font-bold shrink-0 ${hovered === d.label ? text : 'text-on-surface-variant/60'}`}>
                ${d.amount.toFixed(2)}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className={`h-full rounded-full ${bar} transition-all duration-500 ease-premium ${hovered === d.label ? 'opacity-100' : 'opacity-70'}`}
                style={{ width: `${Math.max(widthPercent, d.amount > 0 ? 1.5 : 0)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
