import { useGSAP } from '@gsap/react'
import { useRef } from 'react'
import { ScrollTrigger, prefersReducedMotion } from '../lib/gsapSetup'

const MILESTONES = [
  {
    align: 'left' as const,
    dot: 'bg-primary shadow-[0_0_16px_rgba(255,170,246,0.55)]',
    badge: 'bg-primary/10 text-primary border-primary/20',
    label: 'LIVE',
    title: 'Transfer & Bridge',
    description: 'Live on Arc Testnet for institutional USDC movement across 7 chains.',
    muted: false,
  },
  {
    align: 'right' as const,
    dot: 'bg-primary shadow-[0_0_16px_rgba(255,170,246,0.55)]',
    badge: 'bg-primary/10 text-primary border-primary/20',
    label: 'LIVE',
    title: 'Unified Balance',
    description: 'Real-time asset aggregation and reporting dashboard.',
    muted: false,
  },
  {
    align: 'left' as const,
    dot: 'bg-tertiary shadow-[0_0_16px_rgba(76,214,255,0.4)]',
    badge: 'bg-tertiary/10 text-tertiary border-tertiary/20',
    label: 'ARC TESTNET',
    title: 'Swap Aggregator',
    description: 'Intelligent routing for asset exchanges with minimal slippage.',
    muted: false,
  },
  {
    align: 'right' as const,
    dot: 'bg-secondary shadow-[0_0_16px_rgba(209,188,255,0.4)]',
    badge: 'bg-secondary/10 text-secondary border-secondary/20',
    label: 'IN PROGRESS',
    title: 'Policy Management',
    description: 'Role-based access control and multi-sig permissioning for enterprise teams.',
    muted: false,
  },
  {
    align: 'left' as const,
    dot: 'border-2 border-white/20 bg-background',
    badge: 'bg-white/[0.04] text-on-surface-variant/70 border-white/10',
    label: 'PLANNED',
    title: 'Insurance & Markets',
    description: 'Permissionless hedging and high-yield vault participation.',
    muted: true,
  },
]

export default function RoadmapTimeline() {
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const fillRef = useRef<HTMLDivElement | null>(null)

  useGSAP(
    () => {
      const fillEl = fillRef.current
      if (!fillEl) return

      if (prefersReducedMotion()) {
        fillEl.style.height = '100%'
        return
      }

      const trigger = ScrollTrigger.create({
        trigger: timelineRef.current,
        start: 'top center',
        end: 'bottom center',
        scrub: 0.4,
        onUpdate: (self) => {
          fillEl.style.height = `${self.progress * 100}%`
        },
      })

      return () => trigger.kill()
    },
    { scope: timelineRef },
  )

  return (
    <section className="py-32 relative bg-surface-container-lowest">
      <div className="section-divider"></div>
      <div className="noise-overlay"></div>
      <div className="max-w-4xl mx-auto px-margin-mobile relative z-10">
        <div className="text-center mb-24">
          <p className="section-label text-primary/80 mb-4 tracking-[0.16em]">Roadmap</p>
          <h2 className="font-headline-xl text-headline-xl tracking-tight">Our Journey Ahead</h2>
        </div>
        <div ref={timelineRef} className="relative ml-4 md:ml-0">
          <div className="absolute left-0 md:left-1/2 top-0 bottom-0 w-[2px] gradient-line -translate-x-1/2 opacity-20"></div>
          <div ref={fillRef} className="absolute left-0 md:left-1/2 top-0 w-[2px] gradient-line -translate-x-1/2" style={{ height: '0%' }}></div>

          {MILESTONES.map((m) => (
            <div
              key={m.title}
              className={`mb-20 last:mb-0 relative md:w-1/2 ml-10 ${
                m.align === 'left'
                  ? 'md:pr-12 md:text-right md:ml-0'
                  : 'md:pl-12 md:ml-auto'
              } ${m.muted ? 'opacity-55' : ''}`}
            >
              <div
                className={`absolute left-[-40px] top-1 w-5 h-5 rounded-full z-10 ${m.dot} ${
                  m.align === 'left' ? 'md:left-auto md:right-[-10px]' : 'md:left-[-11px]'
                }`}
              />
              <div className="glass-premium card-interactive p-6 rounded-2xl text-left md:text-inherit">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wider mb-3 ${m.badge}`}
                >
                  {m.label}
                </span>
                <h4 className="font-headline-lg text-on-surface mb-2 tracking-tight">{m.title}</h4>
                <p className="font-body-sm text-on-surface-variant/75 leading-relaxed">{m.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
