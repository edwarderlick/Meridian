import { useMemo, useState } from 'react'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import FieldError from '../../components/console/FieldError'
import { SkeletonTable } from '../../components/console/Skeleton'
import { useSimulatedLoading } from '../../hooks/useSimulatedLoading'

function amountRequiredError(value: string): string | null {
  if (!value.trim()) return 'Amount is required'
  const parsed = Number(value.replace(/,/g, ''))
  if (Number.isNaN(parsed) || parsed <= 0) return 'Enter a valid amount'
  return null
}

function InvoicingScreen() {
  const loading = useSimulatedLoading()
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [touched, setTouched] = useState(false)
  const [created, setCreated] = useState(false)

  const amountMsg = useMemo(() => amountRequiredError(amount), [amount])
  const isValid = !amountMsg

  const handleGenerate = () => {
    setTouched(true)
    if (!isValid) return
    setCreated(true)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Invoicing</h2>
          <div className="mt-2.5">
            <span className="status-chip text-[10px]">
              <span className="status-chip-dot status-chip-dot-live" />
              Live
            </span>
          </div>
        </div>
      </div>

      {created && (
        <div className="glass rounded-xl px-5 py-3.5 flex items-center gap-3 border-green-500/20 bg-green-500/5 animate-fade-in-up">
          <span className="material-symbols-outlined text-green-400 text-[20px] shrink-0">check_circle</span>
          <p className="text-body-sm text-green-400 font-medium">Payment request created.</p>
        </div>
      )}

      <div className="grid grid-cols-12 gap-gutter items-start">
        <div className="col-span-12 lg:col-span-6">
          <div className="glass-premium rounded-2xl p-8">
            <h3 className="font-headline-lg text-[20px] font-semibold tracking-tight mb-6">Create Payment Request</h3>
            <div className="space-y-5">
              <div>
                <label htmlFor="invoice-amount" className="block font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase mb-2">
                  Amount
                </label>
                <div className="flex items-center gap-3 panel rounded-xl px-4 py-3.5">
                  <input
                    id="invoice-amount"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value)
                      setCreated(false)
                    }}
                    onBlur={() => setTouched(true)}
                    inputMode="decimal"
                    className="bg-transparent border-none p-0 text-xl font-mono-data text-on-surface focus:ring-0 w-full placeholder:text-on-surface/20 tabular-nums"
                    placeholder="0.00"
                    type="text"
                  />
                  <span className="font-bold text-on-surface-variant/60 text-sm shrink-0">USDC</span>
                </div>
                {touched && <FieldError message={amountMsg} />}
              </div>
              <div>
                <label htmlFor="invoice-memo" className="block font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase mb-2">
                  Memo (optional)
                </label>
                <textarea
                  id="invoice-memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={3}
                  className="input-premium py-3 px-4 text-sm resize-none"
                  placeholder="Invoice for services rendered…"
                />
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={touched && !isValid}
                className="btn-primary w-full py-4 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                Generate Request
              </button>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <div className="glass-premium rounded-2xl p-8 flex flex-col items-center text-center">
            <div
              className="w-40 h-40 rounded-2xl border border-white/10 shrink-0"
              style={{
                backgroundImage:
                  'repeating-conic-gradient(rgba(255,255,255,0.08) 0% 25%, transparent 0% 50%)',
                backgroundSize: '16px 16px',
              }}
              aria-hidden
            />
            <p className="font-label-caps text-[10px] text-on-surface-variant/45 uppercase tracking-[0.12em] mt-4">
              {created ? 'QR preview — share to receive payment' : 'QR preview — link not yet generated'}
            </p>

            <div className="w-full mt-6">
              <label htmlFor="invoice-link" className="block font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase mb-2 text-left">
                Shareable Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="invoice-link"
                  disabled
                  readOnly
                  value="https://pay.meridian.io/req/—"
                  className="input-premium py-3 px-4 text-sm font-mono-data text-on-surface-variant/45"
                  type="text"
                />
                <button
                  type="button"
                  disabled={!created}
                  aria-label="Copy shareable link"
                  className="btn-secondary w-11 h-11 shrink-0 p-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-premium rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Past Payment Requests</h3>
        </div>
        {loading ? (
          <SkeletonTable rows={3} columns={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="font-label-caps text-[10px] text-on-surface-variant/40 border-b border-white/[0.06]">
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">Amount</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">Memo</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">Date</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="p-0">
                    <div className="p-14 empty-state">
                      <div className="empty-state-icon">
                        <span className="material-symbols-outlined">receipt_long</span>
                      </div>
                      <p className="empty-state-title">No payment requests yet</p>
                      <p className="empty-state-desc">Generated requests and their payment status will appear here</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Invoicing() {
  return (
    <RequireWallet noun="invoicing">
      <InvoicingScreen />
    </RequireWallet>
  )
}
