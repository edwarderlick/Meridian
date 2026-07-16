import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Nav() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const menuBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        menuBtnRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <nav className="sticky top-0 z-50 w-full bg-background/65 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_8px_40px_-16px_rgba(209,188,255,0.1)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="flex justify-between items-center w-full px-margin-desktop py-3.5 max-w-container-max mx-auto">
        <div className="text-2xl font-headline-xl font-bold tracking-tighter text-on-surface select-none">
          Meridian
        </div>

        <div className="hidden md:flex items-center gap-0.5">
          <a
            className="relative px-3.5 py-2 text-primary font-bold font-label-caps text-label-caps transition-premium"
            href="#explore-meridian"
          >
            Ecosystem
            <span className="absolute left-3.5 right-3.5 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-primary/90 to-secondary/70" />
          </a>
          <a
            className="px-3.5 py-2 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.045] rounded-lg font-label-caps text-label-caps transition-premium"
            href="https://docs.arc.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Build
          </a>
          <a
            className="px-3.5 py-2 text-on-surface-variant/40 font-label-caps text-label-caps pointer-events-none cursor-not-allowed"
            title="Coming soon"
          >
            Governance
          </a>
          <a
            className="px-3.5 py-2 text-on-surface-variant/40 font-label-caps text-label-caps pointer-events-none cursor-not-allowed"
            title="Coming soon"
          >
            Community
          </a>
        </div>

        <div className="flex items-center gap-2.5">
          <button type="button" className="btn-secondary hidden lg:flex px-5 py-2 font-label-caps text-label-caps">
            View Docs
          </button>
          <button
            type="button"
            onClick={() => navigate('/console/overview')}
            className="btn-primary px-5 py-2 font-label-caps text-label-caps"
          >
            Launch Console
          </button>
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="md:hidden btn-ghost w-10 h-10 text-on-surface"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              menu
            </span>
          </button>
        </div>
      </div>

      {/* Mobile slide-in overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-background/97 backdrop-blur-2xl flex flex-col md:hidden transition-all duration-300 ease-premium ${
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
        aria-hidden={!open}
      >
        <div className="flex justify-between items-center w-full px-margin-mobile py-4 border-b border-white/[0.06]">
          <div className="text-2xl font-headline-xl font-bold tracking-tighter text-on-surface">Meridian</div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              menuBtnRef.current?.focus()
            }}
            aria-label="Close menu"
            className="btn-ghost w-10 h-10 text-on-surface"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-1 px-8">
          <a
            className="w-full text-center py-3.5 text-primary font-bold font-label-caps text-label-caps text-lg tracking-[0.12em]"
            href="#explore-meridian"
            onClick={() => setOpen(false)}
          >
            Ecosystem
          </a>
          <a
            className="w-full text-center py-3.5 text-on-surface-variant hover:text-on-surface font-label-caps text-label-caps text-lg tracking-[0.12em] transition-premium"
            href="https://docs.arc.io"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            Build
          </a>
          <a
            className="w-full text-center py-3.5 text-on-surface-variant/40 font-label-caps text-label-caps text-lg tracking-[0.12em] pointer-events-none cursor-not-allowed"
            title="Coming soon"
          >
            Governance
          </a>
          <a
            className="w-full text-center py-3.5 text-on-surface-variant/40 font-label-caps text-label-caps text-lg tracking-[0.12em] pointer-events-none cursor-not-allowed"
            title="Coming soon"
          >
            Community
          </a>
          <div className="flex flex-col w-full gap-3 mt-10 max-w-xs">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary w-full px-8 py-3.5 font-label-caps text-label-caps"
            >
              View Docs
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate('/console/overview')
              }}
              className="btn-primary w-full px-8 py-3.5 font-label-caps text-label-caps"
            >
              Launch Console
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
