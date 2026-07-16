import { useMemo, useState } from 'react'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import FieldError from '../../components/console/FieldError'
import Modal from '../../components/console/Modal'

interface SubAccount {
  id: string
  name: string
  budgetLabel: string
}

function nameError(value: string): string | null {
  if (!value.trim()) return 'Name is required'
  return null
}

function SubAccountsScreen() {
  const [selected, setSelected] = useState<SubAccount | null>(null)
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [budgetLabel, setBudgetLabel] = useState('')
  const [touched, setTouched] = useState(false)

  const nameMsg = useMemo(() => nameError(name), [name])
  const isValid = !nameMsg

  const closeCreate = () => {
    setCreateOpen(false)
    setName('')
    setBudgetLabel('')
    setTouched(false)
  }

  const handleCreate = () => {
    setTouched(true)
    if (!isValid) return
    setSubAccounts((prev) => [
      ...prev,
      {
        id: `${name}-${Date.now()}`,
        name,
        budgetLabel: budgetLabel.trim() || 'No budget set',
      },
    ])
    closeCreate()
  }

  if (selected) {
    return (
      <div className="space-y-8">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="btn-ghost px-3.5 py-2 text-sm gap-1.5"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Sub-Accounts
        </button>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">{selected.name}</h2>
            <p className="text-on-surface-variant/70 mt-1.5">{selected.budgetLabel}</p>
          </div>
        </div>

        <div className="glass-premium rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.06] flex justify-between items-center">
            <h3 className="font-headline-lg text-[18px] font-semibold text-on-surface tracking-tight">
              Recent Activity
            </h3>
          </div>
          <div className="p-14 empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined">history</span>
            </div>
            <p className="empty-state-title">No activity yet</p>
            <p className="empty-state-desc">Transfers, bridges, and swaps for this sub-account will appear here</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Sub-Accounts</h2>
          <div className="mt-2.5">
            <span className="status-chip text-[10px]">
              <span className="status-chip-dot status-chip-dot-live" />
              Live
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="btn-primary px-5 py-2.5 text-sm shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Create Sub-Account
        </button>
      </div>

      {subAccounts.length === 0 ? (
        <div className="glass-premium rounded-2xl p-14 empty-state">
          <div className="empty-state-icon">
            <span className="material-symbols-outlined">layers</span>
          </div>
          <p className="empty-state-title">No sub-accounts yet</p>
          <p className="empty-state-desc">
            Create your first sub-account to segment treasury operations by team, project, or budget.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {subAccounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => setSelected(account)}
              className="glass-premium card-interactive rounded-2xl p-6 text-left"
            >
              <div className="icon-well bg-primary/10 border-primary/15 text-primary mb-4">
                <span className="material-symbols-outlined text-[18px]">layers</span>
              </div>
              <p className="font-bold tracking-tight">{account.name}</p>
              <p className="text-on-surface-variant/55 text-body-sm mt-1">{account.budgetLabel}</p>
              <p className="font-mono-data text-lg font-bold tabular-nums mt-4">$0.00</p>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Create Sub-Account"
        footer={
          <>
            <button type="button" onClick={closeCreate} className="btn-secondary flex-1 py-3 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!isValid}
              className="btn-primary flex-1 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create Sub-Account
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label
              htmlFor="sub-account-name"
              className="block font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase mb-2"
            >
              Name
            </label>
            <input
              id="sub-account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="e.g. Marketing"
              type="text"
              className="input-premium py-3 px-4 text-sm"
            />
            {touched && <FieldError message={nameMsg} />}
          </div>
          <div>
            <label
              htmlFor="sub-account-budget-label"
              className="block font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase mb-2"
            >
              Budget Label
            </label>
            <input
              id="sub-account-budget-label"
              value={budgetLabel}
              onChange={(e) => setBudgetLabel(e.target.value)}
              placeholder="e.g. $5,000/mo"
              type="text"
              className="input-premium py-3 px-4 text-sm"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function SubAccounts() {
  return (
    <RequireWallet noun="your sub-accounts">
      <SubAccountsScreen />
    </RequireWallet>
  )
}
