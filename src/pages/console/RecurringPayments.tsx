import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BaseError, erc20Abi, isAddress, parseUnits } from 'viem'
import { readContract, waitForTransactionReceipt } from '@wagmi/core'
import { useAccount, useConfig, useWriteContract } from 'wagmi'
import { CHAINS, EVM_CHAIN_LIST, type ChainId } from '../../assets/chains'
import AuthStatusBanner from '../../components/console/AuthStatusBanner'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import Dropdown from '../../components/console/Dropdown'
import FieldError from '../../components/console/FieldError'
import ReviewModal from '../../components/console/ReviewModal'
import { SkeletonBlock } from '../../components/console/Skeleton'
import { USDC_BY_CHAIN } from '../../config/tokens'
import { useWalletAuthContext } from '../../context/WalletAuthContext'
import { useActivityLog } from '../../hooks/useActivityLog'
import { useEvmChainSwitch } from '../../hooks/useEvmChainSwitch'
import {
  createRecurringRule,
  deleteRecurringRule,
  markRecurringRuleExecuted,
  setRecurringRuleActive,
  useRecurringRules,
  type RecurringRule,
  type RecurringRuleKind,
} from '../../hooks/useRecurringRules'
import { usdcBalanceQueryKey } from '../../hooks/useUsdcBalances'
import { logArcPoolDeposit, logTransfer } from '../../lib/activityLogWrites'
import {
  ARC_TESTNET_EVM_CHAIN_ID,
  ARC_YIELD_POOL_ABI,
  ARC_YIELD_POOL_USDC,
  STRATEGIES,
  getArcYieldPoolAddress,
  isArcYieldPoolDeployed,
  verifyArcYieldPoolUsdc,
} from '../../lib/arcYieldPoolClient'
import { getExplorerTxUrl } from '../../lib/explorer'
import { getBufferedFees } from '../../lib/gasFees'
import { daysOverdue, isDue, FREQUENCIES, type Frequency } from '../../lib/recurringSchedule'
import { addressError, amountError } from '../../lib/validation'

const CHAIN_OPTIONS = EVM_CHAIN_LIST.map((c) => ({
  value: c.id,
  label: c.name,
  sublabel: c.layer,
  icon: <c.Icon className="w-6 h-6 shrink-0" />,
}))
const FREQUENCY_OPTIONS = FREQUENCIES.map((f) => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) }))

const UPCOMING_FEATURES = [
  {
    title: 'Conditional Flows',
    desc: 'Trigger payments based on chain events, gas price floors, or oracle price feeds.',
    icon: 'dynamic_form',
    accent: 'text-primary',
    glow: 'bg-primary/10',
  },
  {
    title: 'Fully Automatic Execution',
    desc: 'Zero-click execution via a user-granted allowance and relayer — a real custody-adjacent decision this app hasn’t made yet, so today every execution still goes through your own wallet.',
    icon: 'bolt',
    accent: 'text-secondary',
    glow: 'bg-secondary/10',
  },
  {
    title: 'Budget Guardrails',
    desc: 'Set daily, weekly, or monthly hard caps on automated outflows per rule.',
    icon: 'data_thresholding',
    accent: 'text-tertiary',
    glow: 'bg-tertiary/10',
  },
]

function executeReviewRows(rule: RecurringRule) {
  const chainName = Object.values(CHAINS).find((c) => c.evmChainId === rule.chainId)?.name ?? 'Unknown chain'
  if (rule.kind === 'pool_deposit') {
    const strategy = STRATEGIES.find((s) => s.id === rule.strategyId)
    return [
      { label: 'Deposit into', value: `ArcYieldPool (${strategy?.label ?? 'Flexible'})` },
      { label: 'Amount', value: `${rule.amount} USDC`, accent: true },
      { label: 'Chain', value: chainName },
    ]
  }
  return [
    { label: 'Recipient', value: `${rule.recipient!.slice(0, 6)}…${rule.recipient!.slice(-4)}` },
    { label: 'Amount', value: `${rule.amount} USDC`, accent: true },
    { label: 'Chain', value: chainName },
  ]
}

function RecurringPaymentsScreen() {
  const { address: walletAddress } = useAccount()
  const { isAuthenticated } = useWalletAuthContext()
  const { isOnChain, ensureChain, isPending: switchPending } = useEvmChainSwitch()
  const { writeContractAsync } = useWriteContract()
  const wagmiConfig = useConfig()
  const queryClient = useQueryClient()

  const { rules, isLoading: rulesLoading } = useRecurringRules(walletAddress)
  const { entries: history, isLoading: historyLoading } = useActivityLog(walletAddress, ['transfer', 'arc_pool_deposit'])
  const runHistory = history.filter((h) => h.recurringRuleId)

  // ---- Create form ----
  const [kind, setKind] = useState<RecurringRuleKind>('transfer')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [chainId, setChainId] = useState<ChainId>('ethereum')
  const [strategyId, setStrategyId] = useState<0 | 1 | 2>(0)
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  // JSX tag names can't be computed member expressions (CHAINS[chainId].Icon) — bind to a local first.
  const SelectedChainIcon = CHAINS[chainId].Icon
  const [touched, setTouched] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const recipientMsg = useMemo(() => {
    const baseMsg = addressError(recipient)
    if (baseMsg) return baseMsg
    if (!isAddress(recipient)) return 'ENS resolution is not supported on these testnets — enter a 0x address.'
    return null
  }, [recipient])
  const amountMsg = useMemo(() => amountError(amount, Infinity), [amount])
  const isCreateValid =
    kind === 'transfer'
      ? !recipientMsg && !amountMsg && recipient.length > 0 && amount.length > 0
      : !amountMsg && amount.length > 0 && isArcYieldPoolDeployed()

  const handleCreate = async () => {
    setTouched(true)
    if (!isCreateValid || !walletAddress) return
    setCreating(true)
    setCreateError(null)
    try {
      if (kind === 'transfer') {
        await createRecurringRule(walletAddress, {
          kind: 'transfer',
          recipient,
          amount,
          chainId: CHAINS[chainId].evmChainId!,
          frequency,
        })
        setRecipient('')
      } else {
        await createRecurringRule(walletAddress, {
          kind: 'pool_deposit',
          amount,
          chainId: ARC_TESTNET_EVM_CHAIN_ID,
          strategyId,
          frequency,
        })
      }
      setAmount('')
      setTouched(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create rule.')
    } finally {
      setCreating(false)
    }
  }

  // ---- Execution (self-custodial: always goes through the connected wallet — see the
  // "Fully Automatic Execution" note below for why nothing here signs on the user's behalf) ----
  const [executingRule, setExecutingRule] = useState<RecurringRule | null>(null)
  const [executing, setExecuting] = useState(false)
  const [executeError, setExecuteError] = useState<string | null>(null)

  const needsSwitchForExecution = executingRule ? !isOnChain(executingRule.chainId) : false

  const handleExecute = async () => {
    if (!executingRule || !walletAddress || executing) return
    setExecuting(true)
    setExecuteError(null)
    try {
      if (!isAuthenticated) throw new Error('Sign in with your wallet first — check the banner above.')
      if (!isOnChain(executingRule.chainId)) throw new Error('Switch to the rule’s chain to continue.')

      if (executingRule.kind === 'pool_deposit') {
        const poolAddress = getArcYieldPoolAddress()
        if (!poolAddress || !ARC_YIELD_POOL_USDC) throw new Error('ArcYieldPool is not deployed yet — refusing to proceed.')
        const verified = await verifyArcYieldPoolUsdc(() =>
          readContract(wagmiConfig, { chainId: ARC_TESTNET_EVM_CHAIN_ID, address: poolAddress, abi: ARC_YIELD_POOL_ABI, functionName: 'usdc' }),
        )
        if (!verified) throw new Error('Could not re-verify the deployed pool points at real Arc USDC — refusing to proceed.')

        const parsedAmount = parseUnits(executingRule.amount, ARC_YIELD_POOL_USDC.decimals)
        const allowance = await readContract(wagmiConfig, {
          chainId: ARC_TESTNET_EVM_CHAIN_ID,
          address: ARC_YIELD_POOL_USDC.address,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [walletAddress, poolAddress],
        })
        if (allowance < parsedAmount) {
          const approveFees = await getBufferedFees(wagmiConfig, ARC_TESTNET_EVM_CHAIN_ID)
          const approveHash = await writeContractAsync({
            chainId: ARC_TESTNET_EVM_CHAIN_ID,
            address: ARC_YIELD_POOL_USDC.address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [poolAddress, parsedAmount],
            ...approveFees,
          })
          const approveReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: approveHash, chainId: ARC_TESTNET_EVM_CHAIN_ID })
          if (approveReceipt.status !== 'success') throw new Error('Approval reverted on-chain.')
        }

        const depositFees = await getBufferedFees(wagmiConfig, ARC_TESTNET_EVM_CHAIN_ID)
        const hash = await writeContractAsync({
          chainId: ARC_TESTNET_EVM_CHAIN_ID,
          address: poolAddress,
          abi: ARC_YIELD_POOL_ABI,
          functionName: 'deposit',
          args: [parsedAmount, executingRule.strategyId ?? 0],
          ...depositFees,
        })
        const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: ARC_TESTNET_EVM_CHAIN_ID })
        if (receipt.status !== 'success') throw new Error('Deposit reverted on-chain.')

        void queryClient.invalidateQueries({ queryKey: usdcBalanceQueryKey(ARC_TESTNET_EVM_CHAIN_ID, walletAddress) })

        try {
          await logArcPoolDeposit(walletAddress, {
            txHash: hash,
            amount: executingRule.amount,
            token: 'USDC',
            chain: CHAINS.arc.name,
            strategyLabel: STRATEGIES.find((s) => s.id === executingRule.strategyId)?.label ?? 'Flexible',
            recurringRuleId: executingRule.id,
            explorerUrl: getExplorerTxUrl(ARC_TESTNET_EVM_CHAIN_ID, hash),
          })
        } catch (logErr) {
          console.error('Failed to persist recurring pool deposit to Firestore:', logErr)
        }

        await markRecurringRuleExecuted(walletAddress, executingRule.id, executingRule.frequency)
        setExecutingRule(null)
        return
      }

      const usdc = USDC_BY_CHAIN[executingRule.chainId]
      if (!usdc) throw new Error('USDC is not configured on this chain.')

      const parsedAmount = parseUnits(executingRule.amount, usdc.decimals)
      const fees = await getBufferedFees(wagmiConfig, executingRule.chainId)
      const hash = await writeContractAsync({
        chainId: executingRule.chainId,
        address: usdc.address,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [executingRule.recipient as `0x${string}`, parsedAmount],
        ...fees,
      })
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: executingRule.chainId })
      if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain.')

      void queryClient.invalidateQueries({ queryKey: usdcBalanceQueryKey(executingRule.chainId, walletAddress) })

      const chainMeta = Object.values(CHAINS).find((c) => c.evmChainId === executingRule.chainId)!
      try {
        await logTransfer(walletAddress, {
          txHash: hash,
          amount: Number(executingRule.amount),
          token: 'USDC',
          chain: chainMeta.name,
          counterparty: executingRule.recipient!,
          recurringRuleId: executingRule.id,
          explorerUrl: getExplorerTxUrl(executingRule.chainId, hash),
        })
      } catch (logErr) {
        console.error('Failed to persist recurring execution to Firestore:', logErr)
      }

      await markRecurringRuleExecuted(walletAddress, executingRule.id, executingRule.frequency)
      setExecutingRule(null)
    } catch (err) {
      const message = err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : 'Execution failed.'
      const rejected = /user rejected|denied the transaction|user denied/i.test(message)
      setExecuteError(rejected ? 'Execution cancelled — the wallet request was rejected.' : message)
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="space-y-stack-lg">
      <header className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="font-headline-xl text-headline-xl text-on-surface">Recurring Payments</h2>
            <span className="status-chip text-[10px]">
              <span className="status-chip-dot status-chip-dot-live" />
              Live
            </span>
          </div>
          <p className="text-on-surface-variant max-w-2xl">
            Real, persisted payment schedules — due dates are computed and tracked for real. Execution always goes
            through your own connected wallet (self-custodial), so a rule becoming due surfaces an "Execute Now"
            action rather than firing on its own. See "Fully Automatic Execution" below for why.
          </p>
        </div>
      </header>

      <AuthStatusBanner />

      {createError && (
        <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-error/20 bg-error/5">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
          <p className="text-body-sm text-error font-medium">{createError}</p>
        </div>
      )}

      <div className="grid grid-cols-12 gap-gutter">
        <section className="col-span-12 lg:col-span-5">
          <div className="glass-premium p-8 rounded-2xl h-full">
            <h3 className="font-headline-lg text-[20px] mb-6 flex items-center">
              <span className="material-symbols-outlined mr-3 text-primary">add_circle</span>
              Create New Rule
            </h3>
            <div className="space-y-6">
              <div className="glass rounded-2xl p-1.5 flex gap-1">
                <button
                  type="button"
                  onClick={() => setKind('transfer')}
                  className={`flex-1 py-2.5 font-semibold rounded-xl transition-premium text-xs ${kind === 'transfer' ? 'bg-primary/15 text-primary border border-primary/20' : 'text-on-surface-variant hover:text-on-surface border border-transparent'}`}
                >
                  Send to Recipient
                </button>
                <button
                  type="button"
                  onClick={() => setKind('pool_deposit')}
                  className={`flex-1 py-2.5 font-semibold rounded-xl transition-premium text-xs ${kind === 'pool_deposit' ? 'bg-primary/15 text-primary border border-primary/20' : 'text-on-surface-variant hover:text-on-surface border border-transparent'}`}
                >
                  Deposit into ArcYieldPool
                </button>
              </div>

              {kind === 'pool_deposit' && !isArcYieldPoolDeployed() && (
                <p className="text-[11px] text-error px-1">ArcYieldPool isn't deployed yet — this rule can be scheduled once it is.</p>
              )}

              {kind === 'transfer' ? (
                <>
                  <div>
                    <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                      Recipient Address
                    </label>
                    <input
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      onBlur={() => setTouched(true)}
                      className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline-2 focus-visible:outline-primary/45"
                      placeholder="0x..."
                      type="text"
                    />
                    {touched && <FieldError message={recipientMsg} />}
                  </div>
                  <div>
                    <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">Chain</label>
                    <Dropdown
                      value={chainId}
                      onChange={(v) => setChainId(v as ChainId)}
                      options={CHAIN_OPTIONS}
                      ariaLabel="Select chain"
                      triggerClassName="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-surface-container border border-white/10 text-sm transition-premium hover:border-white/20"
                      renderTrigger={(selected, open) => (
                        <>
                          <span className="flex items-center gap-2">
                            <SelectedChainIcon className="w-5 h-5" />
                            {selected?.label}
                          </span>
                          <span className={`material-symbols-outlined text-[18px] transition-transform ${open ? 'rotate-180' : ''}`}>
                            expand_more
                          </span>
                        </>
                      )}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">Strategy (Arc Testnet)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {STRATEGIES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStrategyId(s.id)}
                        className={`p-3 rounded-xl border text-left transition-premium ${strategyId === s.id ? 'border-primary/40 bg-primary/[0.06]' : 'border-white/10 bg-surface-container hover:border-white/20'}`}
                      >
                        <p className="text-[11px] font-bold">{s.label}</p>
                        <p className="text-[10px] text-on-surface-variant/50">{s.lockDays === 0 ? 'No lock' : `${s.lockDays}d lock`}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                    Amount (USDC)
                  </label>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={() => setTouched(true)}
                    inputMode="decimal"
                    className="w-full bg-surface-container border border-white/10 rounded-xl py-3 px-4 text-body-sm outline-none focus-visible:outline-2 focus-visible:outline-primary/45"
                    placeholder="0.00"
                    type="text"
                  />
                  {touched && <FieldError message={amountMsg} />}
                </div>
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2 uppercase">
                    Frequency
                  </label>
                  <Dropdown
                    value={frequency}
                    onChange={(v) => setFrequency(v as Frequency)}
                    options={FREQUENCY_OPTIONS}
                    ariaLabel="Select frequency"
                    triggerClassName="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-surface-container border border-white/10 text-sm transition-premium hover:border-white/20"
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
              </div>
              <div className="pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={!isCreateValid || creating}
                  className="btn-primary w-full py-4 rounded-xl text-body-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating…' : 'Create Rule'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="col-span-12 lg:col-span-7 space-y-gutter">
          <section className="glass-premium rounded-2xl overflow-hidden">
            <div className="px-8 py-5 border-b border-white/5">
              <h3 className="font-headline-lg text-[18px]">Active Rules</h3>
            </div>
            {rulesLoading ? (
              <div className="p-6 space-y-3">
                <SkeletonBlock className="h-16 w-full" />
                <SkeletonBlock className="h-16 w-full" />
              </div>
            ) : rules.length === 0 ? (
              <div className="p-14 empty-state">
                <div className="empty-state-icon">
                  <span className="material-symbols-outlined">rule</span>
                </div>
                <p className="empty-state-title">No rules configured yet</p>
                <p className="empty-state-desc">Create one on the left to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {rules.map((rule) => {
                  const due = isDue(rule.nextDueAt)
                  const overdue = daysOverdue(rule.nextDueAt)
                  const chainMeta = Object.values(CHAINS).find((c) => c.evmChainId === rule.chainId)
                  const destinationLabel =
                    rule.kind === 'pool_deposit'
                      ? `ArcYieldPool (${STRATEGIES.find((s) => s.id === rule.strategyId)?.label ?? 'Flexible'})`
                      : `${rule.recipient?.slice(0, 6)}…${rule.recipient?.slice(-4)}`
                  return (
                    <div key={rule.id} className="flex items-center justify-between px-6 py-5 gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        {chainMeta && <chainMeta.Icon className="w-8 h-8 shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-bold tracking-tight text-sm truncate">
                            {rule.amount} USDC → {destinationLabel}
                          </p>
                          <p className="text-[11px] text-on-surface-variant/55 mt-0.5">
                            {chainMeta?.name} · {rule.frequency} ·{' '}
                            {due ? (
                              <span className="text-tertiary font-semibold">
                                {overdue > 0 ? `${overdue}d overdue` : 'Due now'}
                              </span>
                            ) : (
                              `Next: ${rule.nextDueAt?.toLocaleDateString() ?? '—'}`
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setExecutingRule(rule)}
                          disabled={!rule.active}
                          className={`px-3.5 py-2 text-xs rounded-full font-bold transition-premium disabled:opacity-40 disabled:cursor-not-allowed ${
                            due ? 'btn-primary' : 'btn-secondary'
                          }`}
                        >
                          Execute Now
                        </button>
                        <button
                          type="button"
                          onClick={() => void setRecurringRuleActive(walletAddress!, rule.id, !rule.active)}
                          title={rule.active ? 'Pause rule' : 'Resume rule'}
                          className="icon-well w-9 h-9 bg-white/[0.04] border-white/10"
                        >
                          <span className="material-symbols-outlined text-[16px]">{rule.active ? 'pause' : 'play_arrow'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteRecurringRule(walletAddress!, rule.id)}
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
          </section>

          <section className="glass-premium rounded-2xl overflow-hidden">
            <div className="px-8 py-5 border-b border-white/5">
              <h3 className="font-headline-lg text-[18px]">Run History</h3>
            </div>
            {historyLoading ? (
              <div className="p-6">
                <SkeletonBlock className="h-10 w-full" />
              </div>
            ) : runHistory.length === 0 ? (
              <div className="p-14 empty-state">
                <div className="empty-state-icon">
                  <span className="material-symbols-outlined">history</span>
                </div>
                <p className="empty-state-title">No runs yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {runHistory.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-6 py-4 gap-4">
                    <div className="min-w-0">
                      <p className="text-body-sm font-bold truncate">
                        {typeof h.amount === 'number' ? h.amount.toFixed(2) : h.amount} {h.token} →{' '}
                        {h.type === 'arc_pool_deposit'
                          ? `ArcYieldPool (${h.strategyLabel ?? 'Flexible'})`
                          : `${h.counterparty?.slice(0, 6)}…${h.counterparty?.slice(-4)}`}
                      </p>
                      <p className="text-[11px] text-on-surface-variant/50 mt-0.5">{h.timestamp?.toLocaleString() ?? '—'}</p>
                    </div>
                    {h.explorerUrl && (
                      <a href={h.explorerUrl} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline underline-offset-2 shrink-0">
                        View tx
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div className="col-span-full">
          <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-6 uppercase text-center opacity-40">
            Coming Soon to Console v2.0
          </h4>
        </div>
        {UPCOMING_FEATURES.map((feature) => (
          <div key={feature.title} className="glass-premium p-6 rounded-2xl group hover:border-primary/40 transition-premium">
            <div className={`w-12 h-12 ${feature.glow} rounded-xl flex items-center justify-center mb-4`}>
              <span className={`material-symbols-outlined ${feature.accent}`}>{feature.icon}</span>
            </div>
            <h5 className="font-headline-lg text-[16px] mb-2">{feature.title}</h5>
            <p className="text-body-sm text-on-surface-variant leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </section>

      <ReviewModal
        open={executingRule !== null}
        onClose={() => setExecutingRule(null)}
        onConfirm={() => void handleExecute()}
        confirming={executing}
        title="Execute Recurring Payment"
        confirmLabel="Send Now"
        rows={executingRule ? executeReviewRows(executingRule) : []}
      />

      {needsSwitchForExecution && executingRule && (
        <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">sync_alt</span>
            <p className="text-body-sm text-tertiary font-medium">Switch networks to execute this rule</p>
          </div>
          <button
            type="button"
            onClick={() => ensureChain(executingRule.chainId)}
            disabled={switchPending}
            className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50"
          >
            {switchPending ? 'Switching…' : 'Switch Network'}
          </button>
        </div>
      )}

      {executeError && (
        <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-error/20 bg-error/5">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
          <p className="text-body-sm text-error font-medium">{executeError}</p>
        </div>
      )}
    </div>
  )
}

export default function RecurringPayments() {
  return (
    <RequireWallet noun="recurring payments">
      <RecurringPaymentsScreen />
    </RequireWallet>
  )
}
