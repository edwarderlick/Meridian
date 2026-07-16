const QUOTES = [
  {
    quote:
      'We used to reconcile balances across five block explorers every morning. Meridian collapsed that into one screen.',
    attribution: '— Early Access Partner',
    role: 'Treasury Lead, Early Access Program',
  },
  {
    quote:
      'The policy layer was the deciding factor for us — we needed spend limits and role-based approval before we could move real volume.',
    attribution: '— Early Access Partner',
    role: 'Operations, Early Access Program',
  },
]

export default function Testimonials() {
  return (
    <section className="py-32 relative">
      <div className="section-divider"></div>
      <div className="max-w-container-max mx-auto px-margin-desktop">
        <div className="text-center mb-16">
          <p className="section-label text-primary/80 mb-4 tracking-[0.16em]">Early Access</p>
          <h2 className="font-headline-xl text-headline-xl mb-4 tracking-tight">From the Early Access Program</h2>
          <p className="text-on-surface-variant/70 font-body-md text-lg leading-relaxed max-w-2xl mx-auto">
            Meridian is in testnet — these are placeholder reflections, not published customer quotes.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {QUOTES.map((item) => (
            <div
              key={item.attribution + item.role}
              className="glass-premium card-interactive p-8 rounded-2xl relative overflow-hidden"
            >
              <span className="material-symbols-outlined text-primary/10 text-[72px] absolute -top-2 -left-2 select-none">
                format_quote
              </span>
              <p className="font-body-md text-on-surface/95 relative z-10 mb-7 leading-relaxed text-[17px]">
                {item.quote}
              </p>
              <div className="relative z-10">
                <div className="font-label-caps text-label-caps text-primary tracking-[0.1em]">{item.attribution}</div>
                <div className="font-body-sm text-on-surface-variant/65 mt-1">{item.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
