import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import FieldError from '../../components/console/FieldError'
import MaxButton from '../../components/console/MaxButton'
import ReviewModal from '../../components/console/ReviewModal'
import { SkeletonTable } from '../../components/console/Skeleton'
import { useSimulatedLoading } from '../../hooks/useSimulatedLoading'
import { addressError, amountError } from '../../lib/validation'

const AVAILABLE_BALANCE = 0
const PAGE_SIZE = 10

interface Nanopayment {
  id: string
  timestamp: string
  recipient: string
  amount: string
}

function NanopaymentsScreen() {
  const location = useLocation() as { state?: { prefillRecipient?: string; prefillAmount?: string } }
  const loading = useSimulatedLoading()
  const [payments, setPayments] = useState<Nanopayment[]>([])
  const [recipient, setRecipient] = useState(location.state?.prefillRecipient ?? '')
  const [amount, setAmount] = useState(location.state?.prefillAmount ?? '')
  const [touched, setTouched] = useState(false)
  const [sending, setSending] = useState(false)
  const [page, setPage] = useState(0)
  const [reviewOpen, setReviewOpen] = useState(false)

  const recipientMsg = useMemo(() => addressError(recipient), [recipient])
  const amountMsg = useMemo(() => amountError(amount, AVAILABLE_BALANCE), [amount])
  const isValid = !recipientMsg && !amountMsg

  const pageCount = Math.max(1, Math.ceil(payments.length / PAGE_SIZE))
  const pageStart = payments.length === 0 ? 0 : page * PAGE_SIZE + 1
  const pageEnd = Math.min(payments.length, (page + 1) * PAGE_SIZE)
  const pageRows = payments.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const handleReview = () => {
    setTouched(true)
    if (!isValid) return
    setReviewOpen(true)
  }

  const handleConfirmSend = () => {
    setSending(true)
    setTimeout(() => {
      setSending(false)
      setReviewOpen(false)
      setPayments((prev) => [
        { id: `nano-${Date.now()}`, timestamp: new Date().toLocaleTimeString(), recipient, amount },
        ...prev,
      ])
      setRecipient('')
      setAmount('')
      setTouched(false)
      setPage(0)
    }, 500)
  }

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h2 className="page-title text-headline-xl">Nanopayments</h2>
        <p className="page-subtitle mt-1">Gas-free, sub-cent USDC transfers via Circle Gateway and x402</p>
      </div>

      <div className="glass-premium rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="icon-well bg-tertiary/10 border-tertiary/15">
            <span className="material-symbols-outlined text-tertiary text-[18px]">bolt</span>
          </div>
          <h3 className="font-headline-lg text-[16px] font-semibold tracking-tight">How Nanopayments Work</h3>
        </div>
        <p className="text-body-sm text-on-surface-variant/75 leading-relaxed">
          Nanopayments route through Circle's Gateway using the x402 payment protocol, enabling gas-free, sub-cent USDC
          transfers suited for high-frequency, agent-to-agent settlement — down to fractional-cent amounts per call.
        </p>
      </div>

      <div className="max-w-xl glass-premium p-6 sm:p-7 rounded-2xl">
        <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight mb-6">Send Nanopayment</h3>
        <div className="space-y-5">
          <div>
            <label htmlFor="nano-recipient" className="field-label block mb-2">
              Recipient
            </label>
            <input
              id="nano-recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              onBlur={() => setTouched(true)}
              className="input-premium py-3 px-4 text-sm"
              placeholder="0x... or ENS"
              type="text"
            />
            {touched && <FieldError message={recipientMsg} />}
          </div>
          <div>
            <label htmlFor="nano-amount" className="field-label block mb-2">
              Amount (USDC)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="nano-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => setTouched(true)}
                inputMode="decimal"
                className="input-premium py-3 px-4 text-sm font-mono-data flex-1"
                placeholder="0.0001"
                type="text"
              />
              <MaxButton onClick={() => setAmount(String(AVAILABLE_BALANCE))} />
            </div>
            {touched && <FieldError message={amountMsg} />}
          </div>
          <button
            type="button"
            onClick={handleReview}
            disabled={!isValid}
            className="btn-primary w-full py-4 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            Send Nanopayment
          </button>
        </div>
      </div>

      <div className="glass-premium rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Payment History</h3>
        </div>
        {loading ? (
          <SkeletonTable rows={5} columns={3} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="table-head border-b border-white/[0.06]">
                  <th className="px-6 py-2.5">Timestamp</th>
                  <th className="px-6 py-2.5">Recipient</th>
                  <th className="px-6 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              {payments.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={3} className="p-0">
                      <div className="p-14 empty-state">
                        <div className="empty-state-icon">
                          <span className="material-symbols-outlined">bolt</span>
                        </div>
                        <p className="empty-state-title">No nanopayments sent yet</p>
                        <p className="empty-state-desc">High-frequency micro-transfers will appear here as a dense, paginated log</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="font-body-sm divide-y divide-white/[0.04]">
                  {pageRows.map((p) => (
                    <tr key={p.id} className="table-row">
                      <td className="px-6 py-2.5 font-mono-data text-xs data-muted">{p.timestamp}</td>
                      <td className="px-6 py-2.5 font-mono-data text-xs truncate max-w-[220px]">{p.recipient}</td>
                      <td className="px-6 py-2.5 text-right font-mono-data text-xs">{p.amount} USDC</td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        )}
        <div className="px-6 py-3.5 border-t border-white/[0.06] flex items-center justify-between">
          <span className="font-mono-data text-[11px] data-muted">
            {pageStart}–{pageEnd} of {payments.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="btn-ghost w-8 h-8 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="btn-ghost w-8 h-8 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={handleConfirmSend}
        confirming={sending}
        title="Confirm Nanopayment"
        confirmLabel="Send Nanopayment"
        rows={[
          { label: 'Amount', value: `${amount || '0.00'} USDC`, accent: true },
          { label: 'Recipient', value: recipient || '—' },
        ]}
      />
    </div>
  )
}

export default function Nanopayments() {
  return (
    <RequireWallet noun="nanopayments">
      <NanopaymentsScreen />
    </RequireWallet>
  )
}
