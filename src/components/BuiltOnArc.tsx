import { useSimulatedNetworkStatus } from '../hooks/useSimulatedNetworkStatus'

const STATUS_LABEL: Record<string, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
}

export default function BuiltOnArc() {
  const networkStatus = useSimulatedNetworkStatus()

  return (
    <section id="built-on-arc" className="py-32 relative overflow-hidden">
      <div className="section-divider"></div>
      <div className="noise-overlay"></div>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-primary/5 blur-[120px] rounded-full"></div>
      </div>
      <div className="max-w-container-max mx-auto px-margin-desktop text-center relative z-10">
        <p className="section-label text-primary mb-4 tracking-[0.16em]">Foundation</p>
        <h2 className="font-headline-xl text-headline-xl mb-8 tracking-tight">Built on Arc Foundation</h2>
        <p className="font-body-md text-on-surface-variant/75 max-w-3xl mx-auto mb-16 text-lg leading-relaxed">
          Meridian leverages the Arc App Kit and Circle&apos;s CCTP to provide the most secure, battle-tested framework
          for institutional liquidity routing. Our modular architecture is built for the multi-chain future.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          <a
            href="https://docs.arc.io/app-kit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 glass card-interactive px-6 py-3 rounded-full border-primary/20 hover:border-primary/40"
          >
            <span className="material-symbols-outlined text-primary text-xl">shield</span>
            <span className="font-mono-data text-mono-data uppercase tracking-wide">Arc App Kit</span>
          </a>
          <a
            href="https://developers.circle.com/cctp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 glass card-interactive px-6 py-3 rounded-full border-tertiary/20 hover:border-tertiary/40"
          >
            <span className="material-symbols-outlined text-tertiary text-xl">hub</span>
            <span className="font-mono-data text-mono-data uppercase tracking-wide">Circle CCTP</span>
          </a>
          <a
            href="#policy-module"
            className="flex items-center gap-3 glass card-interactive px-6 py-3 rounded-full border-secondary/20 hover:border-secondary/40"
          >
            <span className="material-symbols-outlined text-secondary text-xl">encrypted</span>
            <span className="font-mono-data text-mono-data uppercase tracking-wide">Multi-Sig Native</span>
          </a>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-16">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-dashed border-white/12 text-on-surface-variant/70"
            title="No third-party security audit has been completed yet"
          >
            <span className="material-symbols-outlined text-base opacity-70">pending</span>
            <span className="font-mono-data text-[11px] uppercase tracking-wide">Audit: Pending</span>
          </div>
          <div className="status-chip !py-2 !px-4">
            <span className="material-symbols-outlined text-base opacity-70">code</span>
            <span className="font-mono-data text-[11px] uppercase tracking-wide">Open Source</span>
          </div>
          <div className="status-chip !py-2 !px-4">
            <span className="material-symbols-outlined text-base opacity-70">key</span>
            <span className="font-mono-data text-[11px] uppercase tracking-wide">Non-Custodial</span>
          </div>
        </div>

        <div className="glass-premium rounded-3xl h-64 w-full flex items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 opacity-40 group-hover:opacity-90 transition-opacity duration-500"></div>
          <div className="relative z-10 text-center">
            <div className="flex items-center justify-center gap-2.5 mb-4">
              <span className={`status-chip-dot ${networkStatus === 'healthy' ? 'status-chip-dot-live' : ''}`} />
              <span className="font-label-caps text-label-caps tracking-[0.18em] text-on-surface/90">
                Network State: {STATUS_LABEL[networkStatus]}
              </span>
            </div>
            <div className="text-on-surface-variant/60 font-mono-data text-xs mb-4 tracking-wide">
              Live status monitoring launches with mainnet
            </div>
            <a
              href="https://testnet.arcscan.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-tertiary font-label-caps text-[10px] tracking-[0.12em] hover:gap-2.5 transition-premium"
            >
              View on Arcscan <span className="material-symbols-outlined text-xs">open_in_new</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
