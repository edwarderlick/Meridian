import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { AAVE_CHAIN_IDS } from '../../lib/aaveClient'
import { CHAINS, EVM_CHAIN_LIST, type ChainId } from '../../assets/chains'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import Dropdown from '../../components/console/Dropdown'
import FieldError from '../../components/console/FieldError'
import Modal from '../../components/console/Modal'
import { SkeletonBlock, SkeletonTable } from '../../components/console/Skeleton'
import { useAaveApy } from '../../hooks/useAaveApy'
import { useArcYieldPoolHealth } from '../../hooks/useArcYieldPool'
import { isArcYieldPoolDeployed } from '../../lib/arcYieldPoolClient'
import { useAlertEvents } from '../../hooks/useAlertEvents'
import {
  createAlertRule,
  deleteAlertRule,
  setAlertRuleEnabled,
  updateAlertRuleThreshold,
  useAlertRules,
  type AlertRule,
  type AlertRuleType,
} from '../../hooks/useAlertRules'
import { useTokenBalance } from '../../hooks/useTokenBalance'

const RULE_TYPE_META: Record<AlertRuleType, { label: string; icon: string; accent: string; well: string; unit: string; needsChain: boolean }> = {
  low_balance: { label: 'Low Balance', icon: 'account_balance_wallet', accent: 'text-primary', well: 'bg-primary/10 border-primary/15', unit: '$', needsChain: true },
  large_transfer: { label: 'Large Transfer', icon: 'send', accent: 'text-secondary', well: 'bg-secondary/10 border-secondary/15', unit: '$', needsChain: false },
  yield_rate_drop: { label: 'Yield Rate Drop', icon: 'trending_down', accent: 'text-error', well: 'bg-error/10 border-error/15', unit: '%', needsChain: true },
  pool_health_drop: { label: 'ArcYieldPool Health', icon: 'health_and_safety', accent: 'text-tertiary', well: 'bg-tertiary/10 border-tertiary/15', unit: '%', needsChain: false },
}
const RULE_TYPE_OPTIONS = (Object.keys(RULE_TYPE_META) as AlertRuleType[]).map((t) => ({ value: t, label: RULE_TYPE_META[t].label }))

// Yield Rate Drop is only meaningful on chains with a real Aave APY figure — Uniswap deliberately
// has no yield % (see Liquidity module), so it isn't offered here.
const AAVE_CHAIN_OPTIONS = AAVE_CHAIN_IDS.map((id) => ({ value: id, label: CHAINS[id].name }))
const EVM_CHAIN_OPTIONS = EVM_CHAIN_LIST.map((c) => ({ value: c.id, label: c.name }))

function thresholdError(value: string): string | null {
  if (!value.trim()) return 'Threshold is required'
  const parsed = Number(value)
  if (Number.isNaN(parsed) || parsed <= 0) return 'Enter a valid positive number'
  return null
}

/** Live current-value preview for a rule — its own component so each row can call the live hook
 *  its rule type actually needs (a dynamic list can't call a fixed set of hooks at the parent level). */
function RuleLiveValue({ rule }: { rule: AlertRule }) {
  const balance = useTokenBalance(rule.type === 'low_balance' ? rule.chainId ?? 0 : 0)
  const apy = useAaveApy(rule.type === 'yield_rate_drop' ? rule.chainId ?? 0 : 0)
  const poolHealth = useArcYieldPoolHealth()

  if (rule.type === 'low_balance') {
    return <span className="font-mono-data text-[11px] text-on-surface-variant/60">Current: ${Number(balance.formatted).toFixed(2)}</span>
  }
  if (rule.type === 'yield_rate_drop') {
    return <span className="font-mono-data text-[11px] text-on-surface-variant/60">Current: {apy.apyPercent !== null ? `${apy.apyPercent.toFixed(2)}%` : '—'}</span>
  }
  if (rule.type === 'pool_health_drop') {
    if (!isArcYieldPoolDeployed()) return <span className="font-mono-data text-[11px] text-on-surface-variant/60">ArcYieldPool not deployed yet</span>
    return (
      <span className="font-mono-data text-[11px] text-on-surface-variant/60">
        Current: {poolHealth.reserveCoveragePercent !== null ? `${poolHealth.reserveCoveragePercent.toFixed(0)}%` : 'No obligation'}
      </span>
    )
  }
  return <span className="font-mono-data text-[11px] text-on-surface-variant/60">Across all chains</span>
}

function AlertsScreen() {
  const { address: walletAddress } = useAccount()
  const { rules, isLoading: rulesLoading } = useAlertRules(walletAddress)
  const { events, isLoading: eventsLoading } = useAlertEvents(walletAddress)

  const [modalOpen, setModalOpen] = useState(false)
  const [newType, setNewType] = useState<AlertRuleType>('low_balance')
  const [newChainId, setNewChainId] = useState<ChainId>('arbitrum')
  const [newThreshold, setNewThreshold] = useState('')
  const [touched, setTouched] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const newThresholdMsg = useMemo(() => thresholdError(newThreshold), [newThreshold])
  const chainOptionsForType = newType === 'yield_rate_drop' ? AAVE_CHAIN_OPTIONS : EVM_CHAIN_OPTIONS

  const handleCreate = async () => {
    setTouched(true)
    if (newThresholdMsg || !walletAddress) return
    setCreating(true)
    setCreateError(null)
    try {
      const meta = RULE_TYPE_META[newType]
      await createAlertRule(walletAddress, {
        type: newType,
        threshold: Number(newThreshold),
        chainId: meta.needsChain ? CHAINS[newChainId].evmChainId : undefined,
      })
      setModalOpen(false)
      setNewThreshold('')
      setTouched(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create rule.')
    } finally {
      setCreating(false)
    }
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

      <div className="glass rounded-2xl px-5 py-4 border-white/[0.06]">
        <p className="text-[11px] text-on-surface-variant/60 leading-relaxed">
          <span className="font-semibold text-on-surface-variant/80">How this works:</span> rules are checked against
          real on-chain balances, real APY, ArcYieldPool's own on-chain reserve accounting, and your real activity log
          by a server job that runs periodically — not just while this page is open. "Policy Violation" isn't offered
          yet: the Policy module has no real enforced rules to check against, so there's nothing true to alert on.
        </p>
      </div>

      <div className="glass-premium rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Alert Rules</h3>
          <p className="text-on-surface-variant/60 text-body-sm mt-1">
            Get notified about balance thresholds, large transfers, and yield drops
          </p>
        </div>

        {rulesLoading ? (
          <SkeletonTable rows={4} columns={2} />
        ) : rules.length === 0 ? (
          <div className="p-14 empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined">tune</span>
            </div>
            <p className="empty-state-title">No rules configured yet</p>
            <p className="empty-state-desc">Create one above to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {rules.map((rule) => {
              const meta = RULE_TYPE_META[rule.type]
              const chainMeta = rule.chainId ? Object.values(CHAINS).find((c) => c.evmChainId === rule.chainId) : undefined
              return (
                <div key={rule.id} className="flex items-center justify-between px-6 py-5 gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`icon-well ${meta.well} shrink-0`}>
                      <span className={`material-symbols-outlined text-[18px] ${meta.accent}`}>{meta.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold tracking-tight text-sm truncate">
                        {meta.label}
                        {chainMeta && <span className="text-on-surface-variant/50 font-normal"> · {chainMeta.name}</span>}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-on-surface-variant/50">{meta.unit === '$' ? '$' : ''}</span>
                          <input
                            defaultValue={rule.threshold}
                            onBlur={(e) => {
                              const msg = thresholdError(e.target.value)
                              if (!msg && walletAddress) void updateAlertRuleThreshold(walletAddress, rule.id, Number(e.target.value))
                            }}
                            aria-label={`${meta.label} threshold`}
                            className="input-premium py-1.5 px-2.5 text-xs w-24 rounded-md"
                          />
                          <span className="text-on-surface-variant/50">{meta.unit === '%' ? '%' : ''}</span>
                        </div>
                        <RuleLiveValue rule={rule} />
                        {rule.lastTriggeredAt && (
                          <span className="text-[10px] text-tertiary">Last triggered {rule.lastTriggeredAt.toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => walletAddress && void setAlertRuleEnabled(walletAddress, rule.id, !rule.enabled)}
                        aria-label={`Enable ${meta.label} alert`}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/10 border border-white/10 rounded-full peer transition-premium peer-checked:bg-primary/80 peer-checked:border-primary/40 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:after:translate-x-[20px]" />
                    </label>
                    <button
                      type="button"
                      onClick={() => walletAddress && void deleteAlertRule(walletAddress, rule.id)}
                      title="Delete rule"
                      className="icon-well w-9 h-9 bg-error/10 border-error/15"
                    >
                      <span className="material-symbols-outlined text-[16px] text-error">delete</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {eventsLoading ? (
        <div className="glass-premium rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.06]">
            <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Recent Alerts</h3>
          </div>
          <div className="p-6 space-y-4">
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
          </div>
        </div>
      ) : (
        <div className="glass-premium rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.06]">
            <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Recent Alerts</h3>
          </div>
          {events.length === 0 ? (
            <div className="p-14 empty-state">
              <div className="empty-state-icon">
                <span className="material-symbols-outlined">notifications</span>
              </div>
              <p className="empty-state-title">No alerts yet</p>
              <p className="empty-state-desc">Triggered alerts will appear here once a rule's condition is actually met</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between px-6 py-4 gap-4">
                  <div className="min-w-0">
                    <p className="text-body-sm font-bold truncate">{event.message}</p>
                    <p className="text-[11px] text-on-surface-variant/50 mt-0.5">{event.timestamp?.toLocaleString() ?? '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
            <button type="button" onClick={() => void handleCreate()} disabled={!!newThresholdMsg || creating} className="btn-primary flex-1 py-3 text-sm">
              {creating ? 'Creating…' : 'Create Alert'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {createError && <FieldError message={createError} />}
          <div>
            <label className="block font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase mb-2">
              Alert Type
            </label>
            <Dropdown
              value={newType}
              onChange={(v) => {
                setNewType(v as AlertRuleType)
                if (v === 'yield_rate_drop') setNewChainId(AAVE_CHAIN_IDS[0])
              }}
              options={RULE_TYPE_OPTIONS}
              ariaLabel="Select alert type"
              triggerClassName="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-surface-container border border-white/10 text-sm transition-premium hover:border-white/20"
              renderTrigger={(selected, open) => (
                <>
                  <span>{selected?.label}</span>
                  <span className={`material-symbols-outlined text-[18px] transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
                </>
              )}
            />
          </div>
          {RULE_TYPE_META[newType].needsChain && (
            <div>
              <label className="block font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase mb-2">Chain</label>
              <Dropdown
                value={newChainId}
                onChange={(v) => setNewChainId(v as ChainId)}
                options={chainOptionsForType}
                ariaLabel="Select chain"
                triggerClassName="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-surface-container border border-white/10 text-sm transition-premium hover:border-white/20"
                renderTrigger={(selected, open) => (
                  <>
                    <span>{selected?.label}</span>
                    <span className={`material-symbols-outlined text-[18px] transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
                  </>
                )}
              />
            </div>
          )}
          <div>
            <label htmlFor="new-alert-threshold" className="block font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase mb-2">
              Threshold {RULE_TYPE_META[newType].unit === '%' ? '(%)' : '($)'}
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
