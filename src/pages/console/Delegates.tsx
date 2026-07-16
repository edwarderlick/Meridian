import { useMemo, useState } from 'react'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import Dropdown from '../../components/console/Dropdown'
import FieldError from '../../components/console/FieldError'
import ReviewModal from '../../components/console/ReviewModal'
import { SkeletonTable } from '../../components/console/Skeleton'
import { useSimulatedLoading } from '../../hooks/useSimulatedLoading'
import { addressError } from '../../lib/validation'

interface Delegate {
  id: string
  address: string
  spendCap: string
  timeLimit: string
}

const TIME_LIMIT_OPTIONS = [
  { value: '7 Days', label: '7 Days' },
  { value: '30 Days', label: '30 Days' },
  { value: '90 Days', label: '90 Days' },
]

function spendCapError(value: string): string | null {
  if (!value.trim()) return 'Spend cap is required'
  const parsed = Number(value.replace(/,/g, ''))
  if (Number.isNaN(parsed) || parsed <= 0) return 'Enter a valid amount'
  return null
}

function DelegatesScreen() {
  const loading = useSimulatedLoading()
  const [showForm, setShowForm] = useState(false)
  const [address, setAddress] = useState('')
  const [spendCap, setSpendCap] = useState('')
  const [timeLimit, setTimeLimit] = useState('30 Days')
  const [touched, setTouched] = useState(false)
  const [delegates, setDelegates] = useState<Delegate[]>([])
  const [revokeTarget, setRevokeTarget] = useState<Delegate | null>(null)

  const addressMsg = useMemo(() => addressError(address), [address])
  const spendCapMsg = useMemo(() => spendCapError(spendCap), [spendCap])
  const isValid = !addressMsg && !spendCapMsg

  const handleGrant = () => {
    setTouched(true)
    if (!isValid) return
    setDelegates((prev) => [...prev, { id: `${address}-${Date.now()}`, address, spendCap, timeLimit }])
    setShowForm(false)
    setAddress('')
    setSpendCap('')
    setTimeLimit('30 Days')
    setTouched(false)
  }

  const handleRevoke = () => {
    if (!revokeTarget) return
    setDelegates((prev) => prev.filter((d) => d.id !== revokeTarget.id))
    setRevokeTarget(null)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <nav className="flex items-center space-x-2 text-label-caps text-on-surface-variant/60 mb-2">
            <span>COMPLIANCE</span>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span className="text-primary">DELEGATE PERMISSIONS</span>
          </nav>
          <h2 className="font-headline-xl text-headline-xl">Delegate Permissions</h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="status-chip border-primary/30 bg-primary/10 text-primary">
            <span className="status-chip-dot status-chip-dot-live" />
            <span className="text-label-caps text-primary">In Progress</span>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Add Delegate
          </button>
        </div>
      </div>

      {showForm && (
        <div className="glass-premium rounded-2xl p-8 animate-fade-in-up">
          <h3 className="font-headline-lg text-[20px] font-semibold tracking-tight mb-6">Grant Delegate Access</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label htmlFor="delegate-address" className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                Address
              </label>
              <input
                id="delegate-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={() => setTouched(true)}
                className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface"
                placeholder="0x... or ENS"
                type="text"
              />
              {touched && <FieldError message={addressMsg} />}
            </div>
            <div>
              <label htmlFor="delegate-cap" className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                Spend Cap
              </label>
              <input
                id="delegate-cap"
                value={spendCap}
                onChange={(e) => setSpendCap(e.target.value)}
                onBlur={() => setTouched(true)}
                inputMode="decimal"
                className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface"
                placeholder="0.00 USDC"
                type="text"
              />
              {touched && <FieldError message={spendCapMsg} />}
            </div>
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                Time Limit
              </label>
              <Dropdown
                value={timeLimit}
                onChange={setTimeLimit}
                options={TIME_LIMIT_OPTIONS}
                ariaLabel="Select time limit"
                triggerClassName="w-full flex items-center justify-between bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm text-on-surface transition-premium hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
                renderTrigger={(selected, open) => (
                  <>
                    <span>{selected?.label}</span>
                    <span className={`material-symbols-outlined text-[18px] opacity-40 transition-transform ${open ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </>
                )}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleGrant}
            disabled={!isValid}
            className="btn-primary w-full py-4 rounded-xl text-sm mt-6"
          >
            Grant Access
          </button>
        </div>
      )}

      <div className="glass-premium rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Delegates</h3>
        </div>
        {loading ? (
          <SkeletonTable rows={3} columns={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="font-label-caps text-[10px] text-on-surface-variant/40 border-b border-white/[0.06]">
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">Address</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">Expires</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">Spend Cap</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">Action</th>
                </tr>
              </thead>
              {delegates.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={4} className="p-0">
                      <div className="p-14 empty-state">
                        <div className="empty-state-icon">
                          <span className="material-symbols-outlined">admin_panel_settings</span>
                        </div>
                        <p className="empty-state-title">No delegates added</p>
                        <p className="empty-state-desc">
                          Grant scoped, time-limited access to team members without sharing full treasury control
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-white/[0.04] font-body-sm">
                  {delegates.map((d) => (
                    <tr key={d.id} className="hover:bg-white/[0.03] transition-premium">
                      <td className="px-6 py-4 font-mono-data text-sm">{d.address}</td>
                      <td className="px-6 py-4 text-on-surface-variant/70">{d.timeLimit}</td>
                      <td className="px-6 py-4 text-right font-mono-data">{d.spendCap} USDC</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setRevokeTarget(d)}
                          className="text-error/80 hover:text-error text-xs font-bold transition-premium"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        )}
      </div>

      <ReviewModal
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="Revoke Delegate Access"
        confirmLabel="Revoke Access"
        destructive
        rows={[
          { label: 'Address', value: revokeTarget?.address ?? '—' },
          { label: 'Spend Cap', value: revokeTarget ? `${revokeTarget.spendCap} USDC` : '—' },
          { label: 'Expires', value: revokeTarget?.timeLimit ?? '—' },
        ]}
      />
    </div>
  )
}

export default function Delegates() {
  return (
    <RequireWallet noun="delegate permissions">
      <DelegatesScreen />
    </RequireWallet>
  )
}
