import { useSimulatedNetworkStatus } from '../hooks/useSimulatedNetworkStatus'
import arcLogo from '../assets/chains/arc-logo.jpg'

interface FooterLink {
  label: string
  href?: string
  external?: boolean
}

const BUILD_LINKS: FooterLink[] = [
  { label: 'Documentation', href: 'https://docs.arc.io', external: true },
  { label: 'API Reference' },
  { label: 'SDKs' },
  { label: 'Brand Kit' },
]

const EXPLORE_LINKS: FooterLink[] = [
  { label: 'Ecosystem', href: '#explore-meridian' },
  { label: 'Proving Ground' },
  { label: 'Governance DAO' },
  { label: 'Status', href: '#built-on-arc' },
]

const COMPANY_LINKS: FooterLink[] = [
  { label: 'About' },
  { label: 'Privacy Policy' },
  { label: 'Terms of Service' },
  { label: 'Contact' },
]

function FooterLinkItem({ link }: { link: FooterLink }) {
  if (!link.href) {
    return (
      <span className="text-on-surface-variant/35 font-body-sm cursor-not-allowed" title="Coming soon">
        {link.label}
      </span>
    )
  }
  return (
    <a
      className="text-on-surface-variant/80 hover:text-on-surface transition-premium font-body-sm"
      href={link.href}
      {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {link.label}
    </a>
  )
}

export default function Footer() {
  const networkStatus = useSimulatedNetworkStatus()

  return (
    <footer className="relative bg-surface-container-lowest border-t border-white/[0.05] pt-24 pb-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      <div className="grid grid-cols-1 md:grid-cols-12 gap-stack-lg px-margin-desktop max-w-container-max mx-auto mb-20">
        <div className="md:col-span-4 space-y-7">
          <div className="font-headline-lg text-headline-xl text-on-surface tracking-tighter">Meridian</div>
          <p className="font-body-sm text-on-surface-variant/75 max-w-xs leading-relaxed">
            The institutional flight deck for multi-chain liquidity management. Sovereignty at your fingertips.
          </p>
          <div className="flex items-center gap-3">
            {(
              [
                { icon: 'public', label: 'Website' },
                { icon: 'code', label: 'GitHub' },
                { icon: 'chat', label: 'Community chat' },
              ] as const
            ).map(({ icon, label }) => (
              <a
                key={icon}
                className="btn-ghost w-10 h-10 text-on-surface-variant hover:text-primary"
                href="#"
                aria-label={label}
              >
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                  {icon}
                </span>
              </a>
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <h3 className="font-label-caps text-label-caps text-primary mb-7 tracking-[0.14em]">BUILD</h3>
          <ul className="space-y-3.5">
            {BUILD_LINKS.map((link) => (
              <li key={link.label}>
                <FooterLinkItem link={link} />
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2">
          <h3 className="font-label-caps text-label-caps text-tertiary mb-7 tracking-[0.14em]">EXPLORE</h3>
          <ul className="space-y-3.5">
            {EXPLORE_LINKS.map((link) => (
              <li key={link.label}>
                <FooterLinkItem link={link} />
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2">
          <h3 className="font-label-caps text-label-caps text-secondary mb-7 tracking-[0.14em]">COMPANY</h3>
          <ul className="space-y-3.5">
            {COMPANY_LINKS.map((link) => (
              <li key={link.label}>
                <FooterLinkItem link={link} />
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2 flex flex-col items-start md:items-end">
          <div className="status-chip mb-4">
            <span className={`status-chip-dot ${networkStatus === 'healthy' ? 'status-chip-dot-live' : ''}`} />
            <span className="font-label-caps text-[9px] text-primary tracking-wider">{networkStatus.toUpperCase()}</span>
          </div>
        </div>
      </div>
      <div className="px-margin-desktop max-w-container-max mx-auto pt-8 border-t border-white/[0.05] flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="font-body-sm text-xs text-on-surface-variant/45 flex items-center gap-2">
          <img src={arcLogo} alt="Arc" className="w-4 h-4 rounded-full shrink-0" />
          © 2024 Meridian Labs. Built on Arc.
        </div>
        <a
          href="https://testnet.arcscan.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-mono-data text-xs px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-on-surface-variant/60 hover:border-tertiary/35 hover:text-tertiary transition-premium"
        >
          0x8a72...92f1
          <span className="material-symbols-outlined text-xs">open_in_new</span>
        </a>
      </div>
    </footer>
  )
}
