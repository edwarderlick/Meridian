import { useMemo, useState } from 'react'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import Dropdown from '../../components/console/Dropdown'
import FieldError from '../../components/console/FieldError'
import MaxButton from '../../components/console/MaxButton'
import { amountError } from '../../lib/validation'

const AVAILABLE_BALANCE = 0
const TOKENS = [
  { value: 'USDC', label: 'USDC', sublabel: 'USD Coin (Circle)' },
  { value: 'EURC', label: 'EURC', sublabel: 'Euro Coin (Circle)' },
]

function StableFXScreen() {
  const [amount, setAmount] = useState('')
  const [payToken, setPayToken] = useState('USDC')
  const [receiveToken, setReceiveToken] = useState('EURC')
  const [touched, setTouched] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [requested, setRequested] = useState(false)

  const amountMsg = useMemo(() => amountError(amount, AVAILABLE_BALANCE), [amount])
  const isValid = !amountMsg

  const handleRequestAccess = () => {
    setTouched(true)
    if (!isValid) return
    setRequesting(true)
    setTimeout(() => {
      setRequesting(false)
      setRequested(true)
    }, 900)
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="text-center page-header items-center">
        <div className="flex items-center justify-center gap-2.5">
          <h2 className="page-title text-headline-lg">StableFX</h2>
          <span className="px-2.5 py-1 rounded-full border font-label-caps text-[10px] uppercase tracking-wider bg-white/[0.03] text-on-surface-variant/45 border-white/[0.08]">
            Institutional — Request Access
          </span>
        </div>
        <p className="page-subtitle">Onchain FX between USDC and EURC, settled PvP on Arc</p>
      </div>

      {requested && (
        <div className="banner-success animate-fade-in-up">
          <span className="material-symbols-outlined text-green-400 text-[20px] shrink-0">check_circle</span>
          <p className="text-body-sm text-green-400 font-medium">
            Access request submitted — our team will follow up.
          </p>
        </div>
      )}

      <div className="form-stack">
        <div className="panel p-6">
          <div className="flex justify-between items-center mb-4">
            <label htmlFor="stablefx-pay" className="field-label">
              Pay
            </label>
            <span className="text-body-sm text-on-surface-variant/65 font-mono-data">
              Balance: <span className="text-on-surface">{AVAILABLE_BALANCE.toFixed(2)} {payToken}</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <input
              id="stablefx-pay"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => setTouched(true)}
              inputMode="decimal"
              className="input-amount text-[40px] font-headline-lg"
              placeholder="0.00"
              type="text"
            />
            <MaxButton onClick={() => setAmount(String(AVAILABLE_BALANCE))} />
            <Dropdown
              value={payToken}
              onChange={setPayToken}
              options={TOKENS}
              ariaLabel="Select pay currency"
              triggerClassName="bg-white/[0.04] border border-white/10 flex items-center gap-2 px-3 py-2 rounded-xl transition-premium hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
              renderTrigger={(selected) => (
                <>
                  <div className="w-6 h-6 rounded-full bg-tertiary/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-tertiary text-sm">monetization_on</span>
                  </div>
                  <span className="font-bold text-on-surface text-sm">{selected?.label}</span>
                  <span className="material-symbols-outlined text-on-surface-variant">expand_more</span>
                </>
              )}
            />
          </div>
          {touched && <FieldError message={amountMsg} />}
        </div>

        <div className="form-connector">
          <div className="form-connector-btn pointer-events-none" aria-hidden>
            <span className="material-symbols-outlined text-[20px]">south</span>
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex justify-between items-center mb-4">
            <label className="field-label">Receive</label>
            <span className="text-body-sm text-on-surface-variant/65 font-mono-data">
              Balance: 0.00 {receiveToken}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <input
              disabled
              readOnly
              value=""
              className="input-amount text-[40px] font-headline-lg text-on-surface/40"
              placeholder="0.00"
              type="text"
            />
            <Dropdown
              value={receiveToken}
              onChange={setReceiveToken}
              options={TOKENS}
              ariaLabel="Select receive currency"
              triggerClassName="bg-white/[0.04] border border-white/10 flex items-center gap-2 px-3 py-2 rounded-xl transition-premium hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
              renderTrigger={(selected) => (
                <>
                  <div className="w-6 h-6 rounded-full bg-primary-container/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-sm">generating_tokens</span>
                  </div>
                  <span className="font-bold text-on-surface text-sm">{selected?.label}</span>
                  <span className="material-symbols-outlined text-on-surface-variant">expand_more</span>
                </>
              )}
            />
          </div>
        </div>
      </div>

      <div className="glass-premium rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center text-body-sm">
          <span className="text-on-surface-variant/70">Indicative Rate</span>
          <span className="font-mono-data data-muted">—</span>
        </div>
        <div className="flex justify-between items-center text-body-sm">
          <span className="text-on-surface-variant/70">Settlement</span>
          <span className="font-mono-data data-muted">—</span>
        </div>
        <div className="pt-4 border-t border-white/[0.06] flex justify-between items-center text-body-sm">
          <span className="text-on-surface-variant/70">Access Tier</span>
          <span className="data-muted">Institutional (Request Required)</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleRequestAccess}
        disabled={requesting || requested || !isValid}
        className="btn-primary w-full py-5 rounded-2xl text-lg disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {requesting ? (
          <>
            <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            Submitting…
          </>
        ) : requested ? (
          'Request Submitted'
        ) : (
          <>
            <span>Request Institutional Access</span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </>
        )}
      </button>

      <div className="glass-premium rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="icon-well bg-tertiary/10 border-tertiary/15">
            <span className="material-symbols-outlined text-tertiary text-[18px]">bolt</span>
          </div>
          <h3 className="font-headline-lg text-[16px] font-semibold tracking-tight">Onchain PvP Settlement</h3>
        </div>
        <p className="text-body-sm text-on-surface-variant/75 leading-relaxed">
          StableFX settles payment-versus-payment onchain on Arc — both legs of the FX trade execute atomically, with
          sub-second finality and no counterparty settlement risk. Access is currently permissioned through Circle's
          institutional sales process.
        </p>
      </div>
    </div>
  )
}

export default function StableFX() {
  return (
    <RequireWallet noun="StableFX">
      <StableFXScreen />
    </RequireWallet>
  )
}
