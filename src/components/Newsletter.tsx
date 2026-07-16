import { useState } from 'react'
import type { FormEvent } from 'react'

export default function Newsletter() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    // Placeholder only — no backend wired up yet.
    console.log('Waitlist signup:', email)
    setSubmitted(true)
  }

  return (
    <section className="py-24 relative">
      <div className="section-divider"></div>
      <div className="max-w-container-max mx-auto px-margin-desktop">
        <div className="glass-premium rounded-3xl p-12 md:p-16 text-center max-w-3xl mx-auto relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-primary/10 blur-[100px] rounded-full" />
          <div className="relative z-10">
            <p className="section-label text-primary/80 mb-4 tracking-[0.16em]">Waitlist</p>
            <h2 className="font-headline-xl text-headline-xl mb-4 tracking-tight">Get notified about mainnet</h2>
            <p className="font-body-md text-on-surface-variant/75 mb-9 leading-relaxed max-w-lg mx-auto">
              Join the waitlist for early access as Meridian moves from Arc Testnet toward mainnet.
            </p>
            {submitted ? (
              <div
                className="inline-flex items-center gap-2 font-label-caps text-label-caps text-primary tracking-[0.1em]"
                role="status"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Thanks! We&apos;ll be in touch.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  aria-label="Email address"
                  className="input-premium w-full sm:w-auto flex-1 max-w-sm px-6 py-3.5 rounded-full text-sm"
                />
                <button type="submit" className="btn-primary w-full sm:w-auto px-8 py-3.5">
                  Join Waitlist
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
