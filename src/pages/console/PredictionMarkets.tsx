import CategoryRail from '../../components/console/CategoryRail'
import { RequireWallet } from '../../components/console/ConnectWalletGate'

const CATEGORIES = [
  { label: 'Crypto', icon: 'trending_up' },
  { label: 'Macro', icon: 'account_balance' },
  { label: 'Politics', icon: 'bolt' },
  { label: 'Sports', icon: 'sports_basketball' },
]

function PredictionMarketsScreen() {
  return (
    <div className="space-y-stack-lg">
      <div className="flex justify-between items-end mb-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="font-headline-xl text-headline-xl text-on-surface">Prediction Markets</h2>
            <span className="px-3 py-1 bg-white/5 border border-white/10 text-on-surface-variant/60 font-label-caps text-[10px] rounded-full uppercase tracking-widest">
              Coming Soon
            </span>
          </div>
          <p className="text-on-surface-variant max-w-lg">
            Institutional-grade binary options and forecasting tools. Deploy capital on real-world outcomes with deep
            liquidity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-gutter">
        <CategoryRail categories={CATEGORIES} />

        <div className="col-span-12 md:col-span-6 space-y-4">
          <h4 className="font-label-caps text-label-caps text-on-surface-variant/40 mb-2">Featured Markets</h4>
          <div className="glass-premium rounded-2xl p-14 empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined">query_stats</span>
            </div>
            <p className="empty-state-title">No markets live yet</p>
          </div>
        </div>

        <div className="col-span-12 md:col-span-4">
          <h4 className="font-label-caps text-label-caps text-on-surface-variant/40 mb-2">Trade Execution</h4>
          <div className="glass-premium rounded-2xl overflow-hidden">
            <div className="flex border-b border-white/5">
              <button disabled className="flex-1 py-4 text-center text-on-surface-variant/50 font-label-caps text-xs disabled:cursor-not-allowed">
                BUY
              </button>
              <button disabled className="flex-1 py-4 text-center text-on-surface-variant/50 font-label-caps text-xs disabled:cursor-not-allowed">
                SELL
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="font-label-caps text-[10px] text-on-surface-variant opacity-60">Amount</label>
                  <span className="font-mono-data text-[10px] text-on-surface-variant/50">Bal: 0.00 USDC</span>
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-white/5 flex items-center">
                  <input
                    disabled
                    className="bg-transparent border-none text-2xl font-mono-data outline-none w-full text-on-surface/40"
                    placeholder="0.00"
                    type="number"
                  />
                </div>
              </div>
              <button
                disabled
                className="w-full py-5 bg-primary/40 text-on-primary-container rounded-2xl font-headline-lg text-lg font-extrabold opacity-60 cursor-not-allowed flex items-center justify-center gap-3"
              >
                <span>Place Trade</span>
                <span className="material-symbols-outlined">bolt</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PredictionMarkets() {
  return (
    <RequireWallet noun="prediction markets">
      <PredictionMarketsScreen />
    </RequireWallet>
  )
}
