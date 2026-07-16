import { useMemo, useState } from 'react'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import Dropdown from '../../components/console/Dropdown'
import FieldError from '../../components/console/FieldError'
import Modal from '../../components/console/Modal'
import { SkeletonBlock, SkeletonTable } from '../../components/console/Skeleton'
import { useSimulatedLoading } from '../../hooks/useSimulatedLoading'

interface Rule {
  id: string
  type: string
  icon: string
  accent: string
  well: string
  threshold: string
  enabled: boolean
}

const RULE_TYPE_META: Record<string, { icon: string; accent: string; well: string }> = {
  'Low Balance': { icon: 'account_balance_wallet', accent: 'text-primary', well: 'bg-primary/10 border-primary/15' },
  'Large Transfer': { icon: 'send', accent: 'text-secondary', well: 'bg-secondary/10 border-secondary/15' },
  'Policy Violation': { icon: 'gavel', accent: 'text-tertiary', well: 'bg-tertiary/10 border-tertiary/15' },
  'Yield Rate Drop': { icon: 'trending_down', accent: 'text-error', well: 'bg-error/10 border-error/15' },
}

const RULE_TYPE_OPTIONS = Object.keys(RULE_TYPE_META).map((t) => ({ value: t, label: t }))

function thresholdError(value: string): string | null {
  if (!value.trim()) return 'Threshold is required'
  const parsed = Number(value)
  if (Number.isNaN(parsed) || parsed <= 0) return 'Enter a valid positive number'
  return null
}

function AlertsScreen() {
  const loading = useSimulatedLoading()
  const [rules, setRules] = useState<Rule[]>(
    Object.keys(RULE_TYPE_META).map((type) => ({
      id: type,
      type,
      ...RULE_TYPE_META[type],
      threshold: '',
      enabled: false,
    })),
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [newType, setNewType] = useState('Low Balance')
  const [newThreshold, setNewThreshold] = useState('')
  const [touched, setTouched] = useState(false)

  const newThresholdMsg = useMemo(() => thresholdError(newThreshold), [newThreshold])

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id && !thresholdError(r.threshold) ? { ...r, enabled: !r.enabled } : r)),
    )
  }

  const updateThreshold = (id: string, value: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, threshold: value, enabled: value ? r.enabled : false } : r)))
  }

  const handleCreate = () => {
    setTouched(true)
    if (newThresholdMsg) return
    const meta = RULE_TYPE_META[newType]
    setRules((prev) => [
      ...prev,
      { id: `${newType}-${Date.now()}`, type: newType, ...meta, threshold: newThreshold, enabled: true },
    ])
    setModalOpen(false)
    setNewThreshold('')
    setTouched(false)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Alerts</h2>
          <div className="mt-2.5">
            <span className="status-chip text-[10px]">
              <span className="status-chip-dot status-chip-dot-live" />
              Live
            </span>
          </div>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} className="btn-primary px-5 py-2.5 text-sm shrink-0">
          <span className="material-symbols-outlined text-[18px]">add_alert</span>
          Create Alert
        </button>
      </div>

      <div className="glass-premium rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Alert Rules</h3>
          <p className="text-on-surface-variant/60 text-body-sm mt-1">
            Get notified about balance thresholds, large transfers, policy changes, and yield drops
          </p>
        </div>

        {loading ? (
          <SkeletonTable rows={4} columns={2} />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {rules.map((rule) => {
              const msg = thresholdError(rule.threshold)
              return (
                <div key={rule.id} className="flex items-center justify-between px-6 py-5 gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`icon-well ${rule.well} shrink-0`}>
                      <span className={`material-symbols-outlined text-[18px] ${rule.accent}`}>{rule.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold tracking-tight text-sm truncate">{rule.type}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          value={rule.threshold}
                          onChange={(e) => updateThreshold(rule.id, e.target.value)}
                          placeholder="Set threshold…"
                          inputMode="decimal"
                          aria-label={`${rule.type} threshold`}
                          className="input-premium py-1.5 px-2.5 text-xs w-32 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                  <label
                    className={`relative inline-flex items-center shrink-0 ${msg ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      disabled={!!msg}
                      onChange={() => toggleRule(rule.id)}
                      aria-label={`Enable ${rule.type} alert`}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-white/10 border border-white/10 rounded-full peer transition-premium peer-checked:bg-primary/80 peer-checked:border-primary/40 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:after:translate-x-[20px]" />
                  </label>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="glass-premium rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.06]">
            <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Recent Alerts</h3>
          </div>
          <div className="p-6 space-y-4">
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
          </div>
        </div>
      ) : (
        <div className="glass-premium rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.06]">
            <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Recent Alerts</h3>
          </div>
          <div className="p-14 empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined">notifications</span>
            </div>
            <p className="empty-state-title">No alerts yet</p>
            <p className="empty-state-desc">Triggered alerts will appear here once you configure a rule above</p>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Alert"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1 py-3 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!!newThresholdMsg}
              className="btn-primary flex-1 py-3 text-sm"
            >
              Create Alert
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="block font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase mb-2">
              Alert Type
            </label>
            <Dropdown
              value={newType}
              onChange={setNewType}
              options={RULE_TYPE_OPTIONS}
              ariaLabel="Select alert type"
              triggerClassName="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-surface-container border border-white/10 text-sm transition-premium hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
              renderTrigger={(selected, open) => (
                <>
                  <span>{selected?.label}</span>
                  <span className={`material-symbols-outlined text-[18px] transition-transform ${open ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </>
              )}
            />
          </div>
          <div>
            <label htmlFor="new-alert-threshold" className="block font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase mb-2">
              Threshold
            </label>
            <input
              id="new-alert-threshold"
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              onBlur={() => setTouched(true)}
              inputMode="decimal"
              placeholder="0.00"
              className="input-premium py-3 px-4 text-sm"
            />
            {touched && <FieldError message={newThresholdMsg} />}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function Alerts() {
  return (
    <RequireWallet noun="your alerts">
      <AlertsScreen />
    </RequireWallet>
  )
}
