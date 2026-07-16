import { createPortal } from 'react-dom'
import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement
    const panel = panelRef.current
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    focusables?.[0]?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return

      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
      previouslyFocused.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 modal-backdrop fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative modal-surface rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col scale-in"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] shrink-0 relative z-10">
          <h3 id="modal-title" className="font-headline-lg text-[18px] font-semibold tracking-tight">
            {title}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="btn-ghost w-8 h-8">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto relative z-10">{children}</div>

        {footer && (
          <div className="px-6 py-5 border-t border-white/[0.06] shrink-0 flex gap-3 relative z-10">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
