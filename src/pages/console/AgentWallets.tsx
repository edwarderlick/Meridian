import { useMemo, useState } from 'react'
import ActivityFeed from '../../components/console/ActivityFeed'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import Dropdown from '../../components/console/Dropdown'
import FieldError from '../../components/console/FieldError'
import MaxButton from '../../components/console/MaxButton'
import ReviewModal from '../../components/console/ReviewModal'
import { SkeletonBlock, SkeletonTable } from '../../components/console/Skeleton'
import { useSimulatedLoading } from '../../hooks/useSimulatedLoading'

const AVAILABLE_BALANCE = 0

interface AgentWallet {
  id: string
  name: string
  address: string
  fundingSource: string
  spendCap: string
  status: 'Active' | 'Paused'
}

const FUNDING_SOURCES = [
  { value: 'unified-balance', label: 'Unified Balance' },
  { value: 'main-treasury', label: 'Main Treasury' },
]

function nameError(value: string): string | null {
  if (!value.trim()) return 'Name is required'
  return null
}

function capError(value: string): string | null {
  if (!value.trim()) return 'Spending cap is required'
  const parsed = Number(value.replace(/,/g, ''))
  if (Number.isNaN(parsed) || parsed <= 0) return 'Enter a valid positive amount'
  return null
}

function AgentWalletsScreen() {
  const loading = useSimulatedLoading()
  const [wallets, setWallets] = useState<AgentWallet[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [fundingSource, setFundingSource] = useState('unified-balance')
  const [spendCap, setSpendCap] = useState('')
  const [touched, setTouched] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const nameMsg = useMemo(() => nameError(name), [name])
  const capMsg = useMemo(() => capError(spendCap), [spendCap])
  const isValid = !nameMsg && !capMsg

  const handleReview = () => {
    setTouched(true)
    if (!isValid) return
    setReviewOpen(true)
  }

  const handleConfirmCreate = () => {
    setConfirming(true)
    setTimeout(() => {
      setConfirming(false)
      setReviewOpen(false)
      setWallets((prev) => [
        ...prev,
        {
          id: `${name}-${Date.now()}`,
          name,
          address: '0x0000…0000',
          fundingSource: FUNDING_SOURCES.find((f) => f.value === fundingSource)?.label ?? fundingSource,
          spendCap,
          status: 'Active',
        },
      ])
      setShowForm(false)
      setName('')
      setSpendCap('')
      setFundingSource('unified-balance')
      setTouched(false)
    }, 900)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div className="page-header">
          <h2 className="page-title text-headline-xl">Agent Wallets</h2>
          <p className="page-subtitle mt-1">Circle Agent Wallets, funded and governed from your treasury</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-primary px-5 py-2.5 text-sm shrink-0">
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Create Agent Wallet
        </button>
      </div>

      {showForm && (
        <div className="glass-premium rounded-2xl p-8 animate-fade-in-up">
          <h3 className="font-headline-lg text-[20px] font-semibold tracking-tight mb-6">New Agent Wallet</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="agent-wallet-name" className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                Name
              </label>
              <input
                id="agent-wallet-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched(true)}
                className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface"
                placeholder="e.g. Yield Rebalancer"
                type="text"
              />
              {touched && <FieldError message={nameMsg} />}
            </div>
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                Fund From
              </label>
              <Dropdown
                value={fundingSource}
                onChange={setFundingSource}
                options={FUNDING_SOURCES}
                ariaLabel="Select funding source"
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
            <div>
              <label htmlFor="agent-wallet-cap" className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                Daily Spend Cap (USDC)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="agent-wallet-cap"
                  value={spendCap}
                  onChange={(e) => setSpendCap(e.target.value)}
                  onBlur={() => setTouched(true)}
                  inputMode="decimal"
                  className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface"
                  placeholder="0.00"
                  type="text"
                />
                <MaxButton onClick={() => setSpendCap(String(AVAILABLE_BALANCE))} />
              </div>
              {touched && <FieldError message={capMsg} />}
            </div>
          </div>
          <button
            type="button"
            onClick={handleReview}
            disabled={!isValid}
            className="btn-primary w-full py-4 rounded-xl text-sm mt-6 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Agent Wallet
          </button>
        </div>
      )}

      <div className="glass-premium rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Agent Wallets</h3>
        </div>
        {loading ? (
          <SkeletonTable rows={3} columns={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="font-label-caps text-[10px] text-on-surface-variant/40 border-b border-white/[0.06]">
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">Name</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">Address</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em]">Funding Source</th>
                  <th className="px-6 py-3.5 font-bold uppercase tracking-[0.12em] text-right">Status</th>
                </tr>
              </thead>
              {wallets.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={4} className="p-0">
                      <div className="p-14 empty-state">
                        <div className="empty-state-icon">
                          <span className="material-symbols-outlined">robot_2</span>
                        </div>
                        <p className="empty-state-title">No agent wallets yet</p>
                        <p className="empty-state-desc">
                          Create an Agent Wallet to let autonomous agents transact within a scoped, revocable policy
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-white/[0.04] font-body-sm">
                  {wallets.map((w) => (
                    <tr key={w.id} className="hover:bg-white/[0.03] transition-premium">
                      <td className="px-6 py-4 font-bold tracking-tight">{w.name}</td>
                      <td className="px-6 py-4 font-mono-data text-sm text-on-surface-variant/70">{w.address}</td>
                      <td className="px-6 py-4 text-on-surface-variant/70">{w.fundingSource}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="status-chip text-[10px]">
                          <span className="status-chip-dot status-chip-dot-live" />
                          {w.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        )}
      </div>

      {loading ? (
        <div className="glass-premium rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.06]">
            <h3 className="font-headline-lg text-[18px] font-semibold text-on-surface tracking-tight">
              Agent Wallet Activity
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
          </div>
        </div>
      ) : (
        <ActivityFeed
          title="Agent Wallet Activity"
          items={[]}
          emptyIcon="history"
          emptyTitle="No agent activity yet"
          emptyDesc="Autonomous actions taken by your agent wallets will appear here"
        />
      )}

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={handleConfirmCreate}
        confirming={confirming}
        title="Confirm Agent Wallet"
        confirmLabel="Create Agent Wallet"
        rows={[
          { label: 'Name', value: name || '—', accent: true },
          { label: 'Fund From', value: FUNDING_SOURCES.find((f) => f.value === fundingSource)?.label ?? fundingSource },
          { label: 'Daily Spend Cap', value: `${spendCap || '0.00'} USDC` },
        ]}
      />
    </div>
  )
}

export default function AgentWallets() {
  return (
    <RequireWallet noun="agent wallets">
      <AgentWalletsScreen />
    </RequireWallet>
  )
}
