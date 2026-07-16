import { useMemo, useState } from 'react'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import FieldError from '../../components/console/FieldError'

const TABS = [
  { id: 'human', label: 'Human Signers', icon: 'group' },
  { id: 'agent', label: 'Agent Policies', icon: 'robot_2' },
] as const

type TabId = (typeof TABS)[number]['id']

interface Signer {
  id: string
  label: string
}

interface SpendRule {
  id: string
  label: string
  limit: string
}

interface PendingRule extends SpendRule {
  approvals: number
}

interface LogEntry {
  id: string
  text: string
  ts: string
}

interface AgentWalletRow {
  id: string
  name: string
  cap: string
  active: boolean
}

interface CategoryRule {
  id: string
  label: string
}

function requiredError(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required`
  return null
}

function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function logEntry(text: string): LogEntry {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, ts: nowLabel() }
}

function PolicyScreen() {
  const [tab, setTab] = useState<TabId>('human')

  // ── Human signers ──────────────────────────────────────────────────────
  const [signers, setSigners] = useState<Signer[]>([])
  const [threshold, setThreshold] = useState(1)
  const [rules, setRules] = useState<SpendRule[]>([])
  const [pendingRules, setPendingRules] = useState<PendingRule[]>([])
  const [humanLog, setHumanLog] = useState<LogEntry[]>([])

  const [showSignerForm, setShowSignerForm] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signerTouched, setSignerTouched] = useState(false)
  const signerMsg = useMemo(() => requiredError(signerName, 'Signer name'), [signerName])

  const [showRuleForm, setShowRuleForm] = useState(false)
  const [ruleName, setRuleName] = useState('')
  const [ruleLimit, setRuleLimit] = useState('')
  const [ruleTouched, setRuleTouched] = useState(false)
  const ruleNameMsg = useMemo(() => requiredError(ruleName, 'Rule name'), [ruleName])
  const ruleLimitMsg = useMemo(() => requiredError(ruleLimit, 'Daily limit'), [ruleLimit])

  const addSigner = () => {
    setSignerTouched(true)
    if (signerMsg) return
    setSigners((prev) => [...prev, { id: `${Date.now()}`, label: signerName.trim() }])
    setHumanLog((prev) => [logEntry(`${signerName.trim()} added as signer`), ...prev])
    setSignerName('')
    setSignerTouched(false)
    setShowSignerForm(false)
  }

  const removeSigner = (id: string) => {
    const signer = signers.find((s) => s.id === id)
    const next = signers.filter((s) => s.id !== id)
    setSigners(next)
    setThreshold((t) => Math.max(1, Math.min(t, next.length || 1)))
    if (signer) setHumanLog((prev) => [logEntry(`${signer.label} removed as signer`), ...prev])
  }

  const requiresApproval = signers.length > 1 && threshold > 1

  const addRule = () => {
    setRuleTouched(true)
    if (ruleNameMsg || ruleLimitMsg) return
    const label = ruleName.trim()
    const limit = ruleLimit.trim()
    if (requiresApproval) {
      setPendingRules((prev) => [...prev, { id: `${Date.now()}`, label, limit, approvals: 0 }])
      setHumanLog((prev) => [logEntry(`Rule "${label}" proposed — awaiting ${threshold} approval(s)`), ...prev])
    } else {
      setRules((prev) => [...prev, { id: `${Date.now()}`, label, limit }])
      setHumanLog((prev) => [logEntry(`Rule "${label}" added`), ...prev])
    }
    setRuleName('')
    setRuleLimit('')
    setRuleTouched(false)
    setShowRuleForm(false)
  }

  const approveRule = (id: string) => {
    const pending = pendingRules.find((r) => r.id === id)
    if (!pending) return
    const nextApprovals = pending.approvals + 1
    if (nextApprovals >= threshold) {
      setPendingRules((prev) => prev.filter((r) => r.id !== id))
      setRules((prev) => [...prev, { id: pending.id, label: pending.label, limit: pending.limit }])
      setHumanLog((prev) => [logEntry(`Rule "${pending.label}" reached ${threshold}/${threshold} approvals — activated`), ...prev])
    } else {
      setPendingRules((prev) => prev.map((r) => (r.id === id ? { ...r, approvals: nextApprovals } : r)))
      setHumanLog((prev) => [logEntry(`Rule "${pending.label}" approved (${nextApprovals}/${threshold})`), ...prev])
    }
  }

  const rejectRule = (id: string) => {
    const pending = pendingRules.find((r) => r.id === id)
    if (!pending) return
    setPendingRules((prev) => prev.filter((r) => r.id !== id))
    setHumanLog((prev) => [logEntry(`Rule "${pending.label}" rejected`), ...prev])
  }

  // ── Agent policies ──────────────────────────────────────────────────────
  const [agentWallets, setAgentWallets] = useState<AgentWalletRow[]>([])
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([])
  const [agentLog, setAgentLog] = useState<LogEntry[]>([])

  const [showAgentForm, setShowAgentForm] = useState(false)
  const [agentName, setAgentName] = useState('')
  const [agentCap, setAgentCap] = useState('')
  const [agentTouched, setAgentTouched] = useState(false)
  const agentNameMsg = useMemo(() => requiredError(agentName, 'Agent name'), [agentName])
  const agentCapMsg = useMemo(() => requiredError(agentCap, 'Daily cap'), [agentCap])

  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryTouched, setCategoryTouched] = useState(false)
  const categoryMsg = useMemo(() => requiredError(categoryName, 'Category name'), [categoryName])

  const addAgentWallet = () => {
    setAgentTouched(true)
    if (agentNameMsg || agentCapMsg) return
    const name = agentName.trim()
    setAgentWallets((prev) => [...prev, { id: `${Date.now()}`, name, cap: agentCap.trim(), active: true }])
    setAgentLog((prev) => [logEntry(`Agent wallet "${name}" added with ${agentCap.trim()} USDC daily cap`), ...prev])
    setAgentName('')
    setAgentCap('')
    setAgentTouched(false)
    setShowAgentForm(false)
  }

  const toggleAgentWallet = (id: string) => {
    setAgentWallets((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w
        setAgentLog((log) => [logEntry(`Agent wallet "${w.name}" ${w.active ? 'disabled' : 're-enabled'}`), ...log])
        return { ...w, active: !w.active }
      }),
    )
  }

  const addCategoryRule = () => {
    setCategoryTouched(true)
    if (categoryMsg) return
    const label = categoryName.trim()
    setCategoryRules((prev) => [...prev, { id: `${Date.now()}`, label }])
    setAgentLog((prev) => [logEntry(`Job category "${label}" restricted`), ...prev])
    setCategoryName('')
    setCategoryTouched(false)
    setShowCategoryForm(false)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <nav className="flex items-center space-x-2 text-label-caps text-on-surface-variant/60 mb-2">
            <span>COMPLIANCE</span>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span className="text-primary">TREASURY SPENDING POLICY</span>
          </nav>
          <h2 className="font-headline-xl text-headline-xl">Treasury Spending Policy</h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="status-chip border-primary/30 bg-primary/10 text-primary">
            <span className="status-chip-dot status-chip-dot-live" />
            <span className="text-label-caps text-primary">In Progress</span>
          </div>
          <button
            disabled
            title="On-chain enforcement isn't wired to a real contract yet"
            className="btn-secondary px-6 py-2.5 font-bold"
          >
            <span className="material-symbols-outlined">edit</span>
            <span>Modify Policy</span>
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-1.5 flex gap-1 w-fit">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-5 py-2.5 font-semibold rounded-xl transition-premium text-sm flex items-center justify-center gap-2 ${
              tab === item.id
                ? 'bg-primary/15 text-primary border border-primary/20 shadow-[0_0_20px_-8px_rgba(255,170,246,0.3)]'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03] border border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'human' ? (
        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 lg:col-span-4 flex flex-col space-y-gutter">
            <div className="glass-premium rounded-2xl p-8 flex flex-col h-full">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-headline-lg text-2xl">Signer List</h3>
                <span className="text-mono-data text-on-surface-variant/50">{signers.length} Total</span>
              </div>

              {signers.length === 0 ? (
                <div className="flex-1 empty-state py-8">
                  <div className="empty-state-icon">
                    <span className="material-symbols-outlined">group</span>
                  </div>
                  <p className="empty-state-title">No signers configured</p>
                  <p className="empty-state-desc">Add team members to establish multi-sig control</p>
                </div>
              ) : (
                <div className="flex-1 space-y-2">
                  {signers.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                    >
                      <span className="font-medium text-sm truncate">{s.label}</span>
                      <button
                        type="button"
                        onClick={() => removeSigner(s.id)}
                        aria-label={`Remove signer ${s.label}`}
                        className="btn-ghost w-7 h-7 shrink-0"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showSignerForm ? (
                <div className="mt-6 space-y-3 animate-fade-in-up">
                  <div>
                    <input
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      onBlur={() => setSignerTouched(true)}
                      placeholder="e.g. Priya (Treasury Lead)"
                      className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface"
                      type="text"
                    />
                    {signerTouched && <FieldError message={signerMsg} />}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSignerForm(false)
                        setSignerName('')
                        setSignerTouched(false)
                      }}
                      className="btn-secondary flex-1 py-2.5 text-sm"
                    >
                      Cancel
                    </button>
                    <button type="button" onClick={addSigner} className="btn-primary flex-1 py-2.5 text-sm">
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSignerForm(true)}
                  className="mt-8 w-full py-4 rounded-2xl border-2 border-dashed border-white/10 text-on-surface-variant font-bold flex items-center justify-center space-x-2 hover:border-white/20 hover:text-on-surface transition-premium"
                >
                  <span className="material-symbols-outlined">person_add</span>
                  <span>Add Signer</span>
                </button>
              )}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-gutter">
            <div className="glass-premium rounded-2xl p-8">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="font-headline-lg text-2xl">Signature Threshold</h3>
                  <p className="text-on-surface-variant/70 text-body-sm">
                    Minimum approvals required to execute treasury operations.
                  </p>
                </div>
                <div className="flex items-baseline space-x-1">
                  <span className="text-headline-xl text-on-surface tabular-nums">
                    {signers.length === 0 ? '—' : threshold}
                  </span>
                  {signers.length > 0 && (
                    <span className="text-on-surface-variant/50 text-lg">/ {signers.length}</span>
                  )}
                </div>
              </div>
              {signers.length === 0 ? (
                <div className="relative pt-6 pb-2">
                  <div className="h-2 rounded-full border border-dashed border-white/10 bg-white/[0.02]" />
                  <p className="mt-6 text-center text-on-surface-variant/50 text-sm">
                    Add signers to configure an approval threshold
                  </p>
                </div>
              ) : (
                <div className="pt-2 pb-2">
                  <input
                    type="range"
                    min={1}
                    max={signers.length}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    aria-label="Signature threshold"
                    className="w-full accent-primary"
                  />
                  <p className="mt-4 text-center text-on-surface-variant/50 text-sm">
                    {threshold === 1
                      ? 'Any single signer can approve spending rules'
                      : `Requires ${threshold} of ${signers.length} signers to approve a new spending rule`}
                  </p>
                </div>
              )}
            </div>

            <div className="glass-premium rounded-2xl overflow-hidden">
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <h3 className="font-headline-lg text-2xl">Spending Rules</h3>
                <button
                  type="button"
                  onClick={() => setShowRuleForm((v) => !v)}
                  className="text-primary font-bold text-body-sm flex items-center hover:opacity-80 transition-premium"
                >
                  <span className="material-symbols-outlined text-sm mr-1">add</span>
                  Add Rule
                </button>
              </div>

              {showRuleForm && (
                <div className="p-6 border-b border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in-up">
                  <div>
                    <input
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                      onBlur={() => setRuleTouched(true)}
                      placeholder="Rule name, e.g. Vendor Payouts"
                      className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface"
                      type="text"
                    />
                    {ruleTouched && <FieldError message={ruleNameMsg} />}
                  </div>
                  <div>
                    <input
                      value={ruleLimit}
                      onChange={(e) => setRuleLimit(e.target.value)}
                      onBlur={() => setRuleTouched(true)}
                      inputMode="decimal"
                      placeholder="Daily limit, e.g. 10,000 USDC"
                      className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface"
                      type="text"
                    />
                    {ruleTouched && <FieldError message={ruleLimitMsg} />}
                  </div>
                  <div className="sm:col-span-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRuleForm(false)
                        setRuleName('')
                        setRuleLimit('')
                        setRuleTouched(false)
                      }}
                      className="btn-secondary flex-1 py-2.5 text-sm"
                    >
                      Cancel
                    </button>
                    <button type="button" onClick={addRule} className="btn-primary flex-1 py-2.5 text-sm">
                      {requiresApproval ? 'Propose Rule' : 'Add Rule'}
                    </button>
                  </div>
                </div>
              )}

              {rules.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3 text-on-surface-variant/50">
                  <span className="material-symbols-outlined text-4xl opacity-50">rule_settings</span>
                  <p className="text-sm">No spending rules defined</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {rules.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-8 py-4">
                      <span className="font-medium text-sm">{r.label}</span>
                      <span className="font-mono-data text-sm text-on-surface-variant/60">{r.limit} USDC / day</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-gutter">
              <div className="glass-premium rounded-2xl p-8">
                <div className="flex items-center space-x-2 mb-8">
                  <span className="material-symbols-outlined text-primary">history_edu</span>
                  <h3 className="font-headline-lg text-2xl">Pending Approvals</h3>
                </div>
                {pendingRules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-on-surface-variant/50 py-6">
                    <span className="material-symbols-outlined text-3xl opacity-50">task_alt</span>
                    <p className="text-sm">Nothing pending approval</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRules.map((r) => (
                      <div key={r.id} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-medium text-sm">{r.label}</p>
                            <p className="text-xs text-on-surface-variant/50 font-mono-data mt-0.5">
                              {r.limit} USDC / day &middot; {r.approvals}/{threshold} approvals
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => rejectRule(r.id)}
                            className="flex-1 py-2 rounded-lg text-xs font-bold bg-error/15 text-error border border-error/30 hover:bg-error/20 transition-premium"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => approveRule(r.id)}
                            className="flex-1 py-2 rounded-lg text-xs font-bold btn-primary"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-premium rounded-2xl p-8">
                <div className="flex items-center space-x-2 mb-8">
                  <span className="material-symbols-outlined text-on-surface-variant">list_alt</span>
                  <h3 className="font-headline-lg text-2xl">Audit Log</h3>
                </div>
                {humanLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-on-surface-variant/50 py-6">
                    <span className="material-symbols-outlined text-3xl opacity-50">history</span>
                    <p className="text-sm">No policy activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {humanLog.map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between gap-3 text-sm">
                        <span className="text-on-surface-variant/80">{entry.text}</span>
                        <span className="font-mono-data text-[11px] text-on-surface-variant/40 shrink-0">{entry.ts}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 lg:col-span-4 flex flex-col space-y-gutter">
            <div className="glass-premium rounded-2xl p-8 flex flex-col h-full">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-headline-lg text-2xl">Agent Wallets</h3>
                <span className="text-mono-data text-on-surface-variant/50">{agentWallets.length} Total</span>
              </div>

              {agentWallets.length === 0 ? (
                <div className="flex-1 empty-state py-8">
                  <div className="empty-state-icon">
                    <span className="material-symbols-outlined">robot_2</span>
                  </div>
                  <p className="empty-state-title">No agent wallets configured</p>
                  <p className="empty-state-desc">Create an Agent Wallet to set spend caps and job-category guardrails</p>
                </div>
              ) : (
                <div className="flex-1 space-y-2">
                  {agentWallets.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{w.name}</p>
                        <p className="text-[11px] text-on-surface-variant/50 font-mono-data">{w.cap} USDC / day</p>
                      </div>
                      <span className={`status-chip text-[9px] shrink-0 ${w.active ? '' : 'opacity-50'}`}>
                        <span className={`status-chip-dot ${w.active ? 'status-chip-dot-live' : ''}`} />
                        {w.active ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {showAgentForm ? (
                <div className="mt-6 space-y-3 animate-fade-in-up">
                  <div>
                    <input
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      onBlur={() => setAgentTouched(true)}
                      placeholder="e.g. Yield Rebalancer"
                      className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface"
                      type="text"
                    />
                    {agentTouched && <FieldError message={agentNameMsg} />}
                  </div>
                  <div>
                    <input
                      value={agentCap}
                      onChange={(e) => setAgentCap(e.target.value)}
                      onBlur={() => setAgentTouched(true)}
                      inputMode="decimal"
                      placeholder="Daily cap, e.g. 500"
                      className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface"
                      type="text"
                    />
                    {agentTouched && <FieldError message={agentCapMsg} />}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAgentForm(false)
                        setAgentName('')
                        setAgentCap('')
                        setAgentTouched(false)
                      }}
                      className="btn-secondary flex-1 py-2.5 text-sm"
                    >
                      Cancel
                    </button>
                    <button type="button" onClick={addAgentWallet} className="btn-primary flex-1 py-2.5 text-sm">
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAgentForm(true)}
                  className="mt-8 w-full py-4 rounded-2xl border-2 border-dashed border-white/10 text-on-surface-variant font-bold flex items-center justify-center space-x-2 hover:border-white/20 hover:text-on-surface transition-premium"
                >
                  <span className="material-symbols-outlined">add_circle</span>
                  <span>Configure Agent Policy</span>
                </button>
              )}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-gutter">
            <div className="glass-premium rounded-2xl p-8">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="font-headline-lg text-2xl">Per-Agent Spend Caps</h3>
                  <p className="text-on-surface-variant/70 text-body-sm">Daily USDC spending limit enforced per agent wallet.</p>
                </div>
              </div>
              {agentWallets.length === 0 ? (
                <div className="relative pt-6 pb-2">
                  <div className="h-2 rounded-full border border-dashed border-white/10 bg-white/[0.02]" />
                  <p className="mt-6 text-center text-on-surface-variant/50 text-sm">
                    Add agent wallets to configure spend caps
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agentWallets.map((w) => (
                    <div key={w.id} className="flex items-center justify-between text-sm">
                      <span className="text-on-surface-variant/80">{w.name}</span>
                      <span className="font-mono-data text-on-surface">{w.cap} USDC / day</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-premium rounded-2xl overflow-hidden">
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <h3 className="font-headline-lg text-2xl">Allowed Job Categories</h3>
                <button
                  type="button"
                  onClick={() => setShowCategoryForm((v) => !v)}
                  className="text-primary font-bold text-body-sm flex items-center hover:opacity-80 transition-premium"
                >
                  <span className="material-symbols-outlined text-sm mr-1">add</span>
                  Add Category Rule
                </button>
              </div>

              {showCategoryForm && (
                <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row gap-3 animate-fade-in-up">
                  <div className="flex-1">
                    <input
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      onBlur={() => setCategoryTouched(true)}
                      placeholder="e.g. On-chain trading"
                      className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 text-on-surface"
                      type="text"
                    />
                    {categoryTouched && <FieldError message={categoryMsg} />}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryForm(false)
                        setCategoryName('')
                        setCategoryTouched(false)
                      }}
                      className="btn-secondary px-4 py-2.5 text-sm"
                    >
                      Cancel
                    </button>
                    <button type="button" onClick={addCategoryRule} className="btn-primary px-4 py-2.5 text-sm">
                      Add
                    </button>
                  </div>
                </div>
              )}

              {categoryRules.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3 text-on-surface-variant/50">
                  <span className="material-symbols-outlined text-4xl opacity-50">rule_settings</span>
                  <p className="text-sm">No category restrictions defined</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {categoryRules.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-8 py-4">
                      <span className="font-medium text-sm">{c.label}</span>
                      <span className="status-chip text-[9px]">Restricted</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-gutter">
              <div className="glass-premium rounded-2xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-2">
                    <span className="material-symbols-outlined text-error">power_settings_new</span>
                    <h3 className="font-headline-lg text-2xl">Kill Switches</h3>
                  </div>
                </div>
                {agentWallets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-on-surface-variant/50 py-6">
                    <span className="material-symbols-outlined text-3xl opacity-50">robot_2</span>
                    <p className="text-sm">No agent wallets to disable</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agentWallets.map((w) => (
                      <div key={w.id} className="flex items-center justify-between text-sm">
                        <span className="text-on-surface-variant/80 truncate">{w.name}</span>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={w.active}
                            onChange={() => toggleAgentWallet(w.id)}
                            aria-label={`${w.active ? 'Disable' : 'Enable'} agent wallet ${w.name}`}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/10 border border-white/10 rounded-full peer transition-premium peer-checked:bg-primary/80 peer-checked:border-primary/40 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all after:duration-200 peer-checked:after:translate-x-[20px]" />
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-premium rounded-2xl p-8">
                <div className="flex items-center space-x-2 mb-8">
                  <span className="material-symbols-outlined text-on-surface-variant">list_alt</span>
                  <h3 className="font-headline-lg text-2xl">Agent Policy Audit Log</h3>
                </div>
                {agentLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-on-surface-variant/50 py-6">
                    <span className="material-symbols-outlined text-3xl opacity-50">history</span>
                    <p className="text-sm">No agent policy activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {agentLog.map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between gap-3 text-sm">
                        <span className="text-on-surface-variant/80">{entry.text}</span>
                        <span className="font-mono-data text-[11px] text-on-surface-variant/40 shrink-0">{entry.ts}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Policy() {
  return (
    <RequireWallet noun="your treasury policy">
      <PolicyScreen />
    </RequireWallet>
  )
}
