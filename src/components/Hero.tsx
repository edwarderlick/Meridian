import { useGSAP } from '@gsap/react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap, prefersReducedMotion } from '../lib/gsapSetup'
import ShaderBackground from './ShaderBackground'
import { useScrollFadeOut } from '../hooks/useScrollFadeOut'
import { useMagnetic } from '../hooks/useMagnetic'

const CHAINS = [
  {
    label: 'ETH',
    network: 'Ethereum Sepolia',
    delay: '0s',
    hoverBg: 'hover:bg-primary/20',
    hoverBorder: 'hover:border-primary/50',
    text: '',
  },
  {
    label: 'ARB',
    network: 'Arbitrum Sepolia',
    delay: '0.5s',
    hoverBg: 'hover:bg-primary/20',
    hoverBorder: 'hover:border-primary/50',
    text: '',
  },
  {
    label: 'BASE',
    network: 'Base Sepolia',
    delay: '1.2s',
    hoverBg: 'hover:bg-tertiary/20',
    hoverBorder: 'hover:border-tertiary/50',
    text: '',
  },
  {
    label: 'OPT',
    network: 'OP Sepolia',
    delay: '0.8s',
    hoverBg: 'hover:bg-error/20',
    hoverBorder: 'hover:border-error/50',
    text: 'text-error',
  },
  {
    label: 'ARC',
    network: 'Arc Testnet',
    delay: '1.5s',
    hoverBg: 'hover:bg-primary/20',
    hoverBorder: 'hover:border-primary/50',
    text: 'text-primary',
  },
  {
    label: 'AVA',
    network: 'Avalanche Fuji',
    delay: '0.3s',
    hoverBg: 'hover:bg-white/20',
    hoverBorder: '',
    text: '',
  },
  {
    label: 'POL',
    network: 'Polygon Amoy',
    delay: '2.1s',
    hoverBg: 'hover:bg-secondary/20',
    hoverBorder: 'hover:border-secondary/50',
    text: '',
  },
]

function ChainBadge({ chain }: { chain: (typeof CHAINS)[number] }) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [shift, setShift] = useState(0)

  const handleEnter = () => {
    const el = tooltipRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const margin = 12
    if (rect.left < margin) setShift(margin - rect.left)
    else if (rect.right > window.innerWidth - margin) setShift(window.innerWidth - margin - rect.right)
    else setShift(0)
  }

  return (
    <div
      className={`group relative w-12 h-12 rounded-full border border-white/10 flex items-center justify-center drift bg-white/[0.04] ${chain.hoverBg} ${chain.hoverBorder} hover:-translate-y-1.5 hover:shadow-[0_0_28px_rgba(255,170,246,0.18)] hover:border-white/25 transition-premium cursor-pointer`}
      style={{ animationDelay: chain.delay }}
      title={chain.network}
      aria-label={chain.network}
      onMouseEnter={handleEnter}
    >
      <span className={`font-mono-data text-xs font-bold tracking-wide ${chain.text}`} aria-hidden="true">
        {chain.label}
      </span>
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute -top-11 left-1/2 whitespace-nowrap rounded-lg glass px-2.5 py-1.5 text-[10px] font-mono-data text-on-surface opacity-0 scale-95 transition-all duration-200 ease-premium group-hover:opacity-100 group-hover:scale-100 z-20 shadow-glass"
        style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
        aria-hidden="true"
      >
        {chain.network}
      </div>
    </div>
  )
}

export default function Hero() {
  const navigate = useNavigate()
  const sectionRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const shaderFade = useScrollFadeOut(sectionRef)
  const launchBtnRef = useMagnetic<HTMLButtonElement>(70, 8)
  const docsBtnRef = useMagnetic<HTMLButtonElement>(70, 8)

  // Entrance choreography plays once on mount, not on scroll — matches the shader's own
  // instant-visible-on-load feel. Chain badges are excluded from the stagger (see .drift in
  // index.css): a running CSS keyframe animation on `transform` on the same element would fight
  // a GSAP tween of the same property, so only their shared row container is animated.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from('.hero-badge', { opacity: 0, y: -12, duration: 0.6 })
        .from('.hero-headline', { opacity: 0, y: 28, duration: 0.8 }, '-=0.35')
        .from('.hero-subtext', { opacity: 0, y: 20, duration: 0.7 }, '-=0.5')
        .from('.hero-actions', { opacity: 0, y: 16, duration: 0.6 }, '-=0.45')
        .from('.hero-chain-row', { opacity: 0, y: 12, duration: 0.6 }, '-=0.35')
    },
    { scope: contentRef },
  )

  return (
    <section ref={sectionRef} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      <ShaderBackground fade={shaderFade} />

      <div ref={contentRef} className="relative z-10 max-w-5xl mx-auto px-margin-mobile text-center">
        {/* Live badge */}
        <div className="hero-badge inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full glass border-white/10 mb-10 shadow-glow-sm">
          <span className="status-chip-dot status-chip-dot-live" />
          <span className="font-label-caps text-label-caps text-primary uppercase tracking-[0.16em]">
            Arc Testnet Live
          </span>
        </div>

        <h1 className="hero-headline font-headline-xl text-headline-xl md:text-[84px] leading-[0.92] mb-8 tracking-tighter text-gradient text-balance">
          USDC, everywhere.
          <br />
          One console.
        </h1>

        <p className="hero-subtext font-body-md text-on-surface-variant/80 max-w-2xl mx-auto mb-12 text-lg md:text-xl leading-[1.7] tracking-[-0.015em] text-pretty">
          The institutional flight deck for multi-chain liquidity. Manage your entire treasury through a single,
          unified interface powered by Meridian&apos;s abstraction layer.
        </p>

        <div className="hero-actions flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            ref={launchBtnRef}
            type="button"
            onClick={() => navigate('/console/overview')}
            className="magnetic-btn btn-primary w-full sm:w-auto px-10 py-4 text-lg"
          >
            Launch Console
          </button>
          <button
            ref={docsBtnRef}
            type="button"
            className="magnetic-btn btn-secondary w-full sm:w-auto px-10 py-4 text-lg"
          >
            View Docs
          </button>
        </div>

        <div className="hero-chain-row mt-28 flex flex-wrap justify-center gap-6 md:gap-10 opacity-50 hover:opacity-100 transition-opacity duration-500">
          {CHAINS.map((chain) => (
            <ChainBadge key={chain.label} chain={chain} />
          ))}
        </div>
      </div>
    </section>
  )
}
