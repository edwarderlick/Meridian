import { RequireWallet } from '../../components/console/ConnectWalletGate'

const COVERAGE_PRODUCTS = [
  {
    title: 'USDC Integrity Vault',
    category: 'Stablecoin Depeg',
    icon: 'payments',
    accent: 'text-primary',
    oracle: 'Chainlink',
  },
  {
    title: 'Curve Finance Shield',
    category: 'Protocol Risk',
    icon: 'code_off',
    accent: 'text-secondary',
    oracle: 'Chainlink',
  },
  {
    title: 'Arbitrum Uptime Guard',
    category: 'L2 Infrastructure',
    icon: 'cloud_off',
    accent: 'text-tertiary',
    oracle: 'Chainlink',
  },
]

function InsuranceScreen() {
  return (
    <div className="space-y-stack-lg">
      <div className="flex justify-between items-end mb-2">
        <div>
          <nav className="flex gap-2 mb-4">
            <span className="text-primary/60 font-label-caps text-[10px]">MERIDIAN</span>
            <span className="text-on-surface-variant/40 font-label-caps text-[10px]">—</span>
            <span className="text-on-surface-variant font-label-caps text-[10px]">PARAMETRIC COVERAGE</span>
          </nav>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              Insurance <span className="text-gradient">Marketplace</span>
            </h2>
            <span className="px-3 py-1 bg-white/5 border border-white/10 text-on-surface-variant/60 font-label-caps text-[10px] rounded-full uppercase tracking-widest">
              Coming Soon
            </span>
          </div>
          <p className="text-on-surface-variant/80 mt-4 max-w-xl leading-relaxed">
            Decentralized, oracle-triggered risk mitigation for institutional liquidity pools.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {COVERAGE_PRODUCTS.map((product) => (
            <div key={product.title} className="glass-premium p-8 rounded-2xl flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`material-symbols-outlined ${product.accent} text-xl`}>{product.icon}</span>
                    <span className={`font-label-caps text-xs ${product.accent} opacity-80`}>{product.category}</span>
                  </div>
                  <h3 className="font-headline-lg text-xl font-bold">{product.title}</h3>
                </div>
                <span className="bg-white/5 text-on-surface-variant/50 text-[10px] font-bold px-2 py-1 rounded-md border border-white/10">
                  COMING SOON
                </span>
              </div>
              <div className="flex-1 space-y-3 mb-6">
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">Max Coverage</span>
                  <span className="font-mono-data text-on-surface-variant/50">—</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">Annual Premium</span>
                  <span className="font-mono-data text-on-surface-variant/50">—</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">Oracle</span>
                  <span className="font-mono-data">{product.oracle}</span>
                </div>
              </div>
              <button disabled className="btn-secondary w-full py-4 rounded-xl text-sm">
                Notify on Launch
              </button>
            </div>
          ))}

          <div className="border-2 border-dashed border-white/5 p-8 rounded-2xl flex flex-col items-center justify-center text-center opacity-60 cursor-not-allowed">
            <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">add</span>
            </div>
            <h4 className="font-headline-lg text-lg font-bold text-on-surface-variant">Propose New Coverage</h4>
            <p className="text-on-surface-variant/40 text-sm mt-2 max-w-[200px]">
              Define parameters for a new risk vault and find liquidity. Coming soon.
            </p>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <section className="glass-premium p-8 rounded-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-headline-lg text-xl font-bold">Underwriter Pool</h3>
              <span className="material-symbols-outlined text-secondary">shield_with_heart</span>
            </div>
            <div className="p-6 bg-surface-container-highest/40 rounded-2xl mb-4 border border-white/5">
              <div className="flex justify-between items-end mb-2">
                <span className="text-on-surface-variant text-sm font-medium">Total Pool TVL</span>
                <span className="text-2xl font-extrabold font-headline-lg text-on-surface-variant/50">$0.00</span>
              </div>
              <div className="w-full h-2 rounded-full border border-dashed border-white/10 bg-white/[0.02]" />
            </div>
            <button disabled className="btn-secondary w-full py-4 rounded-2xl text-xs uppercase tracking-widest">
              Stake &amp; Earn Yield
            </button>
          </section>

          <section className="glass-premium p-8 rounded-2xl">
            <h3 className="font-headline-lg text-lg font-bold mb-6">Recent Claims</h3>
            <div className="empty-state py-6">
              <div className="empty-state-icon">
                <span className="material-symbols-outlined">fact_check</span>
              </div>
              <p className="empty-state-title">No claims filed yet</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default function Insurance() {
  return (
    <RequireWallet noun="the insurance marketplace">
      <InsuranceScreen />
    </RequireWallet>
  )
}
