import { useState } from 'react'
import { RequireWallet } from '../../components/console/ConnectWalletGate'

function YieldOptimizerScreen() {
  const [enabled, setEnabled] = useState(false)

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Yield Optimizer</h2>
          <div className="mt-2.5">
            <span className="status-chip text-[10px]">
              <span className="status-chip-dot status-chip-dot-live" />
              Live
            </span>
          </div>
        </div>
      </div>

      <section className="glass-premium rounded-2xl p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h3 className="font-headline-lg text-[20px] font-semibold tracking-tight mb-2">Auto-Rebalance Idle USDC</h3>
          <p className="text-on-surface-variant/70 text-body-sm max-w-md leading-relaxed">
            Automatically move idle USDC into the highest-yielding available pool as rates change across chains.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            aria-label="Auto-rebalance idle USDC"
            className="sr-only peer"
          />
          <div
            className="w-12 h-6 bg-white/10 border border-white/10 rounded-full peer transition-premium peer-checked:bg-primary/80 peer-checked:border-primary/40 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background
            after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all after:duration-200
            peer-checked:after:translate-x-[24px]"
          />
        </label>
      </section>

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 lg:col-span-5">
          <div className="glass-premium rounded-2xl p-8 h-full">
            <span className="font-label-caps text-[11px] tracking-[0.14em] text-on-surface-variant/55 uppercase">
              Current Target Pool
            </span>
            <div className="mt-4 flex items-center gap-4">
              <div className="icon-well bg-tertiary/10 border-tertiary/15 text-tertiary w-12 h-12 rounded-2xl shrink-0">
                <span className="material-symbols-outlined">water_drop</span>
              </div>
              <div>
                <p className="font-bold tracking-tight">Not yet targeting a pool</p>
                <p className="text-on-surface-variant/55 text-body-sm mt-0.5">
                  {enabled ? 'Scanning for the best available rate…' : 'Enable auto-rebalance to begin optimizing'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-white/[0.06]">
              <div>
                <p className="font-label-caps text-[10px] text-on-surface-variant/50 uppercase tracking-[0.12em] mb-1.5">
                  Target APY
                </p>
                <p className="font-mono-data text-xl font-bold text-tertiary tabular-nums">—%</p>
              </div>
              <div>
                <p className="font-label-caps text-[10px] text-on-surface-variant/50 uppercase tracking-[0.12em] mb-1.5">
                  Idle Balance
                </p>
                <p className="font-mono-data text-xl font-bold tabular-nums">$0.00</p>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <div className="glass-premium rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/[0.06]">
              <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Rebalance History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="font-label-caps text-[10px] text-on-surface-variant/40 border-b border-white/[0.06]">
                    <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">From</th>
                    <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">To</th>
                    <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">Amount</th>
                    <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">APY Gained</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={4} className="p-0">
                      <div className="p-14 empty-state">
                        <div className="empty-state-icon">
                          <span className="material-symbols-outlined">history</span>
                        </div>
                        <p className="empty-state-title">No rebalances yet</p>
                        <p className="empty-state-desc">
                          Auto-rebalance actions will appear here once enabled and idle USDC is detected
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function YieldOptimizer() {
  return (
    <RequireWallet noun="your yield optimizer settings">
      <YieldOptimizerScreen />
    </RequireWallet>
  )
}
