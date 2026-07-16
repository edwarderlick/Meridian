const DIFFERENTIATORS = [
  {
    icon: 'account_balance_wallet',
    iconColor: 'text-primary',
    well: 'bg-primary/10 border-primary/15',
    title: 'Unified Balance',
    description: 'One real balance across every chain, not a list of bridges you have to reconcile yourself.',
  },
  {
    icon: 'smart_toy',
    iconColor: 'text-tertiary',
    well: 'bg-tertiary/10 border-tertiary/15',
    title: 'AI Assistant',
    description: 'Ask for what you want done in plain language — Meridian plans the route, you approve the result.',
  },
  {
    icon: 'policy',
    iconColor: 'text-secondary',
    well: 'bg-secondary/10 border-secondary/15',
    title: 'Policy Layer',
    description: 'Role-based access and spend limits built in, so treasury operations stay governable at scale.',
  },
]

export default function WhyMeridian() {
  return (
    <section className="py-32 relative">
      <div className="section-divider"></div>
      <div className="max-w-container-max mx-auto px-margin-desktop">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-5">
            <p className="section-label text-primary mb-4 tracking-[0.16em]">Differentiation</p>
            <h2 className="font-headline-xl text-headline-xl mb-6 tracking-tight">Not just a bridge aggregator</h2>
            <p className="font-body-md text-on-surface-variant/80 text-lg leading-relaxed mb-4">
              Bridging is table stakes. Meridian&apos;s abstraction layer combines a genuinely unified balance, an AI
              assistant that understands treasury intent, and a policy layer for spend control — together, in one
              console.
            </p>
            <p className="font-body-sm text-on-surface-variant/65 leading-relaxed">
              That combination is what turns multi-chain USDC from an operational burden into infrastructure you
              don&apos;t have to think about.
            </p>
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-5">
            {DIFFERENTIATORS.map((item) => (
              <div key={item.title} className="glass-premium card-interactive p-7 rounded-2xl">
                <div className={`icon-well mb-5 w-11 h-11 ${item.well}`}>
                  <span className={`material-symbols-outlined ${item.iconColor} text-[22px]`}>{item.icon}</span>
                </div>
                <h3 className="font-headline-lg text-on-surface mb-2.5 text-lg tracking-tight">{item.title}</h3>
                <p className="font-body-sm text-on-surface-variant/75 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
