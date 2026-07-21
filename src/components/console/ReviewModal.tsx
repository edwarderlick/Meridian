import Modal from './Modal'

export interface ReviewRow {
  label: string
  value: string
  accent?: boolean
}

interface ReviewModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  rows: ReviewRow[]
  confirmLabel?: string
  destructive?: boolean
  confirming?: boolean
  /** Shown inline inside the modal on a failed confirm — without this, an error set by the caller
   *  renders wherever that page happens to put its error banner, which is easy to end up completely
   *  hidden behind this still-open modal (confirmed real: RecurringPayments' executeError banner
   *  rendered at the bottom of the whole page, invisible while this modal sat open on top of it). */
  error?: string | null
}

export default function ReviewModal({
  open,
  onClose,
  onConfirm,
  title,
  rows,
  confirmLabel = 'Confirm',
  destructive = false,
  confirming = false,
  error,
}: ReviewModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={`flex-1 py-3 text-sm rounded-full font-bold inline-flex items-center justify-center gap-2 transition-premium disabled:opacity-60 disabled:cursor-not-allowed ${
              destructive
                ? 'bg-error/15 text-error border border-error/30 hover:bg-error/20'
                : 'btn-primary'
            }`}
          >
            {confirming ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Confirming…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </>
      }
    >
      <div className="space-y-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between items-center text-body-sm py-2.5 border-b border-white/[0.04] last:border-0"
          >
            <span className="text-on-surface-variant/65">{row.label}</span>
            <span
              className={`font-mono-data tracking-tight tabular-nums ${row.accent ? 'text-primary font-semibold' : 'text-on-surface'}`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-on-surface-variant/40 mt-5 leading-relaxed">
        Review the details above carefully. This action cannot be undone once submitted on-chain.
      </p>
      {error && (
        <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3 border-error/20 bg-error/5 mt-4">
          <span className="material-symbols-outlined text-error text-[18px] shrink-0">error</span>
          <p className="text-body-sm text-error font-medium">{error}</p>
        </div>
      )}
    </Modal>
  )
}
