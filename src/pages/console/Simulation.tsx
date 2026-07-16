import { useMemo, useState } from 'react'
import { CHAIN_LIST_STANDARD, type ChainId } from '../../assets/chains'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import Dropdown from '../../components/console/Dropdown'
import FieldError from '../../components/console/FieldError'
import MaxButton from '../../components/console/MaxButton'
import { addressError, amountError } from '../../lib/validation'

const AVAILABLE_BALANCE = 0

const ACTIONS = [
  { id: 'transfer', label: 'Transfer', icon: 'send' },
  { id: 'bridge', label: 'Bridge', icon: 'alt_route' },
  { id: 'swap', label: 'Swap', icon: 'swap_horiz' },
  { id: 'agentic-flow', label: 'Agentic Flow', icon: 'robot_2' },
] as const

type ActionId = (typeof ACTIONS)[number]['id']

const AGENTIC_MODES = [
  { id: 'job', label: 'Job Escrow Flow' },
  { id: 'burst', label: 'Nanopayment Burst' },
] as const

type AgenticMode = (typeof AGENTIC_MODES)[number]['id']

const CHAIN_OPTIONS = CHAIN_LIST_STANDARD.map((c) => ({
  value: c.id,
  label: c.name,
  sublabel: c.layer,
  icon: <c.Icon className="w-6 h-6" />,
  groupLabel: c.isNonEvm ? 'Other Ecosystems' : undefined,
}))
const TOKEN_OPTIONS = [
  { value: 'SUI', label: 'SUI' },
  { value: 'USDT', label: 'USDT' },
  { value: 'wBTC', label: 'wBTC' },
]

function SimulationScreen() {
  const [action, setAction] = useState<ActionId>('transfer')
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState<ChainId>('arbitrum')
  const [token, setToken] = useState('SUI')
  const [touched, setTouched] = useState(false)
  const [hasSimulated, setHasSimulated] = useState(false)
  const [agenticMode, setAgenticMode] = useState<AgenticMode>('job')
  const [jobTask, setJobTask] = useState('')
  const [burstCount, setBurstCount] = useState('')

  const amountMsg = useMemo(() => amountError(amount, AVAILABLE_BALANCE), [amount])
  const addressMsg = useMemo(() => (action === 'transfer' ? addressError(address) : null), [action, address])
  const jobTaskMsg = useMemo(
    () => (action === 'agentic-flow' && agenticMode === 'job' && !jobTask.trim() ? 'Task description is required' : null),
    [action, agenticMode, jobTask],
  )
  const burstCountMsg = useMemo(() => {
    if (action !== 'agentic-flow' || agenticMode !== 'burst') return null
    const parsed = Number(burstCount)
    if (!burstCount.trim() || Number.isNaN(parsed) || parsed <= 0) return 'Enter a valid number of payments'
    return null
  }, [action, agenticMode, burstCount])
  const isValid = action === 'agentic-flow' ? !amountMsg && !jobTaskMsg && !burstCountMsg : !amountMsg && !addressMsg

  const switchAction = (id: ActionId) => {
    setAction(id)
    setHasSimulated(false)
    setTouched(false)
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2 tracking-tight">Simulation</h2>
        <p className="text-on-surface-variant/75 text-body-md leading-relaxed">
          Preview the outcome of an action before sending it on-chain
        </p>
      </div>

      <div className="glass rounded-2xl px-5 py-3.5 flex items-center gap-3 border-tertiary/20 bg-tertiary/5">
        <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">info</span>
        <p className="text-body-sm text-tertiary font-semibold tracking-tight">
          Preview Only — No Transaction Sent
        </p>
      </div>

      <div className="glass rounded-2xl p-1.5 flex gap-1">
        {ACTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => switchAction(item.id)}
            className={`flex-1 py-3 font-semibold rounded-xl transition-premium text-sm flex items-center justify-center gap-2 ${
              action === item.id
                ? 'bg-primary/15 text-primary border border-primary/20 shadow-[0_0_20px_-8px_rgba(255,170,246,0.3)]'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03] border border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {action === 'agentic-flow' && (
        <div className="glass rounded-full p-1 flex gap-1 w-fit mx-auto">
          {AGENTIC_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                setAgenticMode(mode.id)
                setHasSimulated(false)
                setTouched(false)
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-mono-data font-bold transition-premium border ${
                agenticMode === mode.id
                  ? 'bg-primary/15 text-primary border-primary/20'
                  : 'text-on-surface-variant hover:text-on-surface border-transparent'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <div className="panel rounded-t-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <label htmlFor="sim-amount" className="font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase">
              {action === 'agentic-flow' ? (agenticMode === 'job' ? 'Escrow Budget' : 'Amount per Payment') : 'Amount'}
            </label>
            <span className="text-body-sm text-on-surface-variant/70 font-mono-data">
              Balance: <span className="text-on-surface">{AVAILABLE_BALANCE.toFixed(2)} USDC</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="sim-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => setTouched(true)}
              inputMode="decimal"
              className="bg-transparent border-none p-0 text-[36px] font-headline-lg text-on-surface focus:ring-0 w-full placeholder:text-on-surface/20 tracking-tight tabular-nums"
              placeholder="0.00"
              type="text"
            />
            <MaxButton onClick={() => setAmount(String(AVAILABLE_BALANCE))} />
          </div>
          {touched && <FieldError message={amountMsg} />}
        </div>

        <div className="relative h-4 flex items-center justify-center z-10">
          <div className="bg-surface-container h-10 w-10 rounded-full flex items-center justify-center border border-white/10 shadow-glass">
            <span className="material-symbols-outlined text-primary text-[20px]">south</span>
          </div>
        </div>

        <div className="panel rounded-b-2xl p-6">
          <label className="font-label-caps text-[11px] tracking-[0.12em] text-on-surface-variant/60 uppercase mb-4 block">
            {action === 'transfer'
              ? 'Recipient Address'
              : action === 'bridge'
                ? 'Destination Chain'
                : action === 'swap'
                  ? 'Receive Token'
                  : agenticMode === 'job'
                    ? 'Task Description'
                    : 'Number of Payments'}
          </label>

          {action === 'agentic-flow' && agenticMode === 'job' && (
            <>
              <textarea
                id="sim-job-task"
                value={jobTask}
                onChange={(e) => setJobTask(e.target.value)}
                onBlur={() => setTouched(true)}
                rows={2}
                className="bg-transparent border-none p-0 text-[16px] font-body-md text-on-surface focus:ring-0 w-full placeholder:text-on-surface/30 tracking-tight resize-none"
                placeholder="Describe the task the agent should complete…"
              />
              {touched && <FieldError message={jobTaskMsg} />}
            </>
          )}

          {action === 'agentic-flow' && agenticMode === 'burst' && (
            <>
              <input
                id="sim-burst-count"
                value={burstCount}
                onChange={(e) => setBurstCount(e.target.value)}
                onBlur={() => setTouched(true)}
                inputMode="numeric"
                className="bg-transparent border-none p-0 text-[36px] font-headline-lg text-on-surface focus:ring-0 w-full placeholder:text-on-surface/20 tracking-tight tabular-nums"
                placeholder="100"
                type="text"
              />
              {touched && <FieldError message={burstCountMsg} />}
            </>
          )}

          {action === 'transfer' && (
            <>
              <input
                id="sim-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={() => setTouched(true)}
                className="bg-transparent border-none p-0 text-[16px] font-body-md text-on-surface focus:ring-0 w-full placeholder:text-on-surface/30 tracking-tight"
                placeholder="Enter ENS or 0x address…"
                type="text"
              />
              {touched && <FieldError message={addressMsg} />}
            </>
          )}

          {action === 'bridge' && (
            <Dropdown
              value={chainId}
              onChange={(v) => setChainId(v as (typeof CHAIN_LIST_STANDARD)[number]['id'])}
              options={CHAIN_OPTIONS}
              ariaLabel="Select destination chain"
              triggerClassName="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] transition-premium hover:border-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
              renderTrigger={(selected, open) => (
                <>
                  <span className="text-sm font-medium">{selected?.label}</span>
                  <span className={`material-symbols-outlined text-[18px] opacity-40 transition-transform ${open ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </>
              )}
            />
          )}

          {action === 'swap' && (
            <Dropdown
              value={token}
              onChange={setToken}
              options={TOKEN_OPTIONS}
              ariaLabel="Select receive token"
              triggerClassName="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] transition-premium hover:border-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
              renderTrigger={(selected, open) => (
                <>
                  <span className="text-sm font-medium">{selected?.label}</span>
                  <span className={`material-symbols-outlined text-[18px] opacity-40 transition-transform ${open ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </>
              )}
            />
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setTouched(true)
          if (isValid) setHasSimulated(true)
        }}
        disabled={!isValid}
        className="btn-primary w-full py-4 rounded-2xl text-base disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[18px]">science</span>
        Simulate
      </button>

      {hasSimulated && (
        <div className="glass-premium rounded-2xl p-6 space-y-4 animate-fade-in-up">
          <h3 className="font-headline-lg text-[16px] font-semibold tracking-tight mb-2">Preview Result</h3>
          <div className="flex justify-between items-center text-body-sm">
            <div className="flex items-center gap-2 text-on-surface-variant/75">
              <span className="material-symbols-outlined text-sm opacity-70">gas_meter</span>
              <span>Estimated Fees</span>
            </div>
            <span className="font-mono-data text-on-surface-variant/45">—</span>
          </div>
          <div className="flex justify-between items-center text-body-sm">
            <div className="flex items-center gap-2 text-on-surface-variant/75">
              <span className="material-symbols-outlined text-sm opacity-70">schedule</span>
              <span>Estimated Time</span>
            </div>
            <span className="font-mono-data text-on-surface-variant/45">—</span>
          </div>
          <div className="pt-4 border-t border-white/[0.06] flex justify-between items-center text-body-sm">
            <div className="flex items-center gap-2 text-on-surface-variant/75">
              <span className="material-symbols-outlined text-sm opacity-70">payments</span>
              <span>Final Received Amount</span>
            </div>
            <span className="font-mono-data text-on-surface-variant/45">—</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Simulation() {
  return (
    <RequireWallet noun="simulation">
      <SimulationScreen />
    </RequireWallet>
  )
}
