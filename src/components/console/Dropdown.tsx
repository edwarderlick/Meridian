import { createPortal } from 'react-dom'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'

export interface DropdownOption {
  value: string
  label: string
  sublabel?: string
  icon?: ReactNode
  /** Renders a small section label above this option — for visually separating groups (e.g. "Other Ecosystems"). */
  groupLabel?: string
}

interface DropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  renderTrigger: (selected: DropdownOption | undefined, open: boolean) => ReactNode
  ariaLabel: string
  triggerClassName?: string
  panelClassName?: string
}

export default function Dropdown({
  options,
  value,
  onChange,
  renderTrigger,
  ariaLabel,
  triggerClassName = '',
  panelClassName = '',
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchable = options.length >= 5

  const updatePosition = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) setRect({ top: r.bottom + 8, left: r.left, width: r.width })
  }

  useEffect(() => {
    if (!open) return
    updatePosition()

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const handleReposition = () => updatePosition()

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const selected = options.find((o) => o.value === value)
  const filtered = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {renderTrigger(selected, open)}
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            className={`fixed z-[90] glass-premium rounded-xl overflow-hidden shadow-glass-xl scale-in ${panelClassName}`}
            style={{ top: rect.top, left: rect.left, width: Math.max(rect.width, 220) }}
          >
            {searchable && (
              <div className="p-2.5 border-b border-white/[0.06]">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="input-premium py-2 px-3 text-sm rounded-lg"
                />
              </div>
            )}
            <div className="max-h-64 overflow-y-auto py-1.5">
              {filtered.length === 0 ? (
                <p className="px-4 py-3 text-sm text-on-surface-variant/50">No matches</p>
              ) : (
                filtered.map((option) => (
                  <Fragment key={option.value}>
                    {option.groupLabel && (
                      <div className="px-4 pt-3 pb-1.5 mt-1 border-t border-white/[0.06] first:mt-0 first:border-t-0 first:pt-1.5">
                        <span className="font-label-caps text-[9px] uppercase tracking-[0.14em] text-on-surface-variant/40">
                          {option.groupLabel}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      onClick={() => {
                        onChange(option.value)
                        setOpen(false)
                        triggerRef.current?.focus()
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-premium ${
                        option.value === value
                          ? 'bg-primary/12 text-primary'
                          : 'text-on-surface-variant hover:bg-white/[0.05] hover:text-on-surface'
                      }`}
                    >
                      {option.icon}
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium tracking-tight">{option.label}</span>
                        {option.sublabel && (
                          <span className="block text-[11px] text-on-surface-variant/45 mt-0.5">{option.sublabel}</span>
                        )}
                      </span>
                      {option.value === value && (
                        <span className="material-symbols-outlined text-[16px] shrink-0">check</span>
                      )}
                    </button>
                  </Fragment>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
