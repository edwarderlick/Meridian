import { RequireWallet } from '../../components/console/ConnectWalletGate'

const UPCOMING_FEATURES = [
  {
    title: 'Conditional Flows',
    desc: 'Trigger payments based on chain events, gas price floors, or oracle price feeds.',
    icon: 'dynamic_form',
    accent: 'text-primary',
    glow: 'bg-primary/10',
  },
  {
    title: 'Multi-Sig Integration',
    desc: 'Require m-of-n approvals for rule creation or high-value recurring executions.',
    icon: 'groups',
    accent: 'text-secondary',
    glow: 'bg-secondary/10',
  },
  {
    title: 'Budget Guardrails',
    desc: 'Set daily, weekly, or monthly hard caps on automated outflows per rule.',
    icon: 'data_thresholding',
    accent: 'text-tertiary',
    glow: 'bg-tertiary/10',
  },
]

function RecurringPaymentsScreen() {
  return (
    <div className="space-y-stack-lg">
      <header className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="font-headline-xl text-headline-xl text-on-surface">Recurring Payments</h2>
            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-label-caps text-on-surface-variant/60 tracking-widest uppercase">
              Coming Soon
            </span>
          </div>
          <p className="text-on-surface-variant max-w-xl">
            Automate treasury flows with conditional logic: payroll, subscriptions, and yield-rebalancing rules on a
            programmable schedule.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-gutter">
        <section className="col-span-12 lg:col-span-5">
          <div className="glass-premium p-8 rounded-2xl h-full">
            <h3 className="font-headline-lg text-[20px] mb-6 flex items-center">
              <span className="material-symbols-outlined mr-3 text-primary">add_circle</span>
              Create New Rule
            </h3>
            <form className="space-y-6">
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                  Recipient Address
                </label>
                <input
                  disabled
                  className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none disabled:cursor-not-allowed text-on-surface-variant/50"
                  placeholder="0x... or ENS"
                  type="text"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                    Amount
                  </label>
                  <input
                    disabled
                    className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none disabled:cursor-not-allowed text-on-surface-variant/50"
                    placeholder="0.00"
                    type="text"
                  />
                </div>
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                    Frequency
                  </label>
                  <select
                    disabled
                    className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none disabled:cursor-not-allowed text-on-surface-variant/50 appearance-none"
                  >
                    <option>Monthly</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 border-t border-white/5">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-body-sm text-on-surface-variant">Estimated Gas Cost</span>
                  <span className="font-mono-data text-body-sm text-on-surface-variant/50">—</span>
                </div>
                <button disabled type="button" className="btn-primary w-full py-4 rounded-xl text-body-md">
                  Initialize Smart Rule
                </button>
              </div>
            </form>
          </div>
        </section>

        <div className="col-span-12 lg:col-span-7 space-y-gutter">
          <section className="glass-premium rounded-2xl overflow-hidden">
            <div className="px-8 py-5 border-b border-white/5">
              <h3 className="font-headline-lg text-[18px]">Active Rules</h3>
            </div>
            <div className="p-14 empty-state">
              <div className="empty-state-icon">
                <span className="material-symbols-outlined">rule</span>
              </div>
              <p className="empty-state-title">No rules configured yet</p>
            </div>
          </section>

          <section className="glass-premium rounded-2xl overflow-hidden">
            <div className="px-8 py-5 border-b border-white/5">
              <h3 className="font-headline-lg text-[18px]">Run History</h3>
            </div>
            <div className="p-14 empty-state">
              <div className="empty-state-icon">
                <span className="material-symbols-outlined">history</span>
              </div>
              <p className="empty-state-title">No runs yet</p>
            </div>
          </section>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div className="col-span-full">
          <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-6 uppercase text-center opacity-40">
            Coming Soon to Console v2.0
          </h4>
        </div>
        {UPCOMING_FEATURES.map((feature) => (
          <div key={feature.title} className="glass-premium p-6 rounded-2xl group hover:border-primary/40 transition-premium">
            <div className={`w-12 h-12 ${feature.glow} rounded-xl flex items-center justify-center mb-4`}>
              <span className={`material-symbols-outlined ${feature.accent}`}>{feature.icon}</span>
            </div>
            <h5 className="font-headline-lg text-[16px] mb-2">{feature.title}</h5>
            <p className="text-body-sm text-on-surface-variant leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

export default function RecurringPayments() {
  return (
    <RequireWallet noun="recurring payments">
      <RecurringPaymentsScreen />
    </RequireWallet>
  )
}
