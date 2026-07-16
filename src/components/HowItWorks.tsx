const STEPS = [
  {
    number: '1',
    icon: 'account_balance_wallet',
    title: 'Connect Wallet',
    description: 'Link any supported wallet across Ethereum, Arbitrum, Base, Optimism, Arc, Avalanche, or Polygon.',
  },
  {
    number: '2',
    icon: 'send',
    title: 'Move USDC',
    description: 'Transfer, bridge, or swap USDC across chains through a single, unified interface.',
  },
  {
    number: '3',
    icon: 'monitoring',
    title: 'Track Everything',
    description: 'Watch your entire multi-chain treasury update in real time from one dashboard.',
  },
]

export default function HowItWorks() {
  return (
    <section className="py-32 relative">
      <div className="section-divider"></div>
      <div className="max-w-container-max mx-auto px-margin-desktop">
        <div className="text-center mb-16">
          <p className="section-label text-primary/80 mb-4 tracking-[0.16em]">Workflow</p>
          <h2 className="font-headline-xl text-headline-xl mb-4 tracking-tight">How It Works</h2>
          <p className="text-on-surface-variant/75 font-body-md text-lg leading-relaxed">
            Three steps from wallet to treasury.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="glass-premium card-interactive p-8 rounded-2xl relative overflow-hidden"
            >
              <div className="font-headline-xl text-[56px] text-primary/15 mb-3 leading-none tracking-tighter select-none">
                {step.number}
              </div>
              <div className="icon-well mb-5 w-11 h-11">
                <span className="material-symbols-outlined text-primary text-[22px]">{step.icon}</span>
              </div>
              <h3 className="font-headline-lg text-on-surface mb-2.5 tracking-tight">{step.title}</h3>
              <p className="font-body-sm text-on-surface-variant/75 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
