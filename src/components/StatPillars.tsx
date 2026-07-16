import { useGSAP } from '@gsap/react'
import { useRef, type RefObject } from 'react'
import { gsap, ScrollTrigger, prefersReducedMotion } from '../lib/gsapSetup'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll'
import { useSpotlight } from '../hooks/useSpotlight'

export default function StatPillars() {
  const { ref, visible } = useRevealOnScroll<HTMLDivElement>()
  const handleSpotlight = useSpotlight()
  const sectionRef = useRef<HTMLElement | null>(null)
  const chainsRef = useRef<HTMLSpanElement>(null)
  const balanceRef = useRef<HTMLSpanElement>(null)
  const idleRef = useRef<HTMLSpanElement>(null)

  // Scroll-triggered count-up (once per page load) — replaces the old setTimeout-based ticker.
  // Tweens a plain object and writes textContent directly in onUpdate rather than through React
  // state, so a 1.4s count doesn't trigger a re-render on every frame.
  useGSAP(
    () => {
      const counters: [RefObject<HTMLSpanElement | null>, number][] = [
        [chainsRef, 7],
        [balanceRef, 1],
        [idleRef, 0],
      ]

      if (prefersReducedMotion()) {
        counters.forEach(([elRef, target]) => {
          if (elRef.current) elRef.current.textContent = String(target)
        })
        return
      }

      const trigger = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 75%',
        once: true,
        onEnter: () => {
          counters.forEach(([elRef, target]) => {
            const el = elRef.current
            if (!el) return
            const counter = { value: 0 }
            gsap.to(counter, {
              value: target,
              duration: 1.4,
              ease: 'power2.out',
              onUpdate: () => {
                el.textContent = String(Math.ceil(counter.value))
              },
            })
          })
        },
      })

      return () => trigger.kill()
    },
    { scope: sectionRef },
  )

  return (
    <section ref={sectionRef} className="py-32 relative">
      <div className="section-divider"></div>
      <div className="noise-overlay"></div>
      <div className="max-w-container-max mx-auto px-margin-desktop relative z-10">
        <h2 className="sr-only">Meridian at a glance</h2>
        <div
          ref={ref}
          id="stat-pillars"
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 stagger-in${visible ? ' visible' : ''}`}
        >
          <div className="glass-premium card-interactive spotlight p-9 md:p-10 rounded-2xl group" onMouseMove={handleSpotlight}>
            <div className="text-primary font-label-caps text-[64px] mb-5 font-bold tracking-tighter leading-none tabular-nums">
              <span ref={chainsRef}>0</span>
            </div>
            <h3 className="font-headline-lg text-on-surface mb-2.5 tracking-tight">Chains Supported</h3>
            <p className="font-body-sm text-on-surface-variant/75 mb-7 leading-relaxed">
              Deep liquidity across Ethereum, Arbitrum, Base, Optimism, Arc, Avalanche and Polygon.
            </p>
            <a
              className="inline-flex items-center gap-2 text-primary font-label-caps text-[11px] tracking-[0.14em] hover:gap-3 transition-premium"
              href="#"
            >
              LEARN MORE <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </a>
          </div>
          <div className="glass-premium card-interactive spotlight p-9 md:p-10 rounded-2xl group" onMouseMove={handleSpotlight}>
            <div className="text-tertiary font-label-caps text-[64px] mb-5 font-bold tracking-tighter leading-none tabular-nums">
              <span ref={balanceRef}>0</span>
            </div>
            <h3 className="font-headline-lg text-on-surface mb-2.5 tracking-tight">Unified Balance</h3>
            <p className="font-body-sm text-on-surface-variant/75 mb-7 leading-relaxed">
              A singular, consolidated view of your entire multi-chain treasury through the Meridian engine.
            </p>
            <a
              className="inline-flex items-center gap-2 text-tertiary font-label-caps text-[11px] tracking-[0.14em] hover:gap-3 transition-premium"
              href="#"
            >
              LEARN MORE <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </a>
          </div>
          <div className="glass-premium card-interactive spotlight p-9 md:p-10 rounded-2xl group" onMouseMove={handleSpotlight}>
            <div className="text-secondary font-label-caps text-[64px] mb-5 font-bold tracking-tighter leading-none tabular-nums">
              <span ref={idleRef}>0</span>
            </div>
            <h3 className="font-headline-lg text-on-surface mb-2.5 tracking-tight">Idle USDC</h3>
            <p className="font-body-sm text-on-surface-variant/75 mb-7 leading-relaxed">
              Auto-optimization logic ensures your capital is always routed to the most secure, high-yield vaults.
            </p>
            <a
              className="inline-flex items-center gap-2 text-secondary font-label-caps text-[11px] tracking-[0.14em] hover:gap-3 transition-premium"
              href="#"
            >
              LEARN MORE <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
