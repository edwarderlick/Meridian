import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import Dropdown from '../../components/console/Dropdown'
import FieldError from '../../components/console/FieldError'
import MaxButton from '../../components/console/MaxButton'
import ReviewModal from '../../components/console/ReviewModal'
import { SkeletonBlock } from '../../components/console/Skeleton'
import { arcTestnet } from '../../config/chains'
import { useEvmAdapter } from '../../hooks/useEvmAdapter'
import { useEvmChainSwitch } from '../../hooks/useEvmChainSwitch'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { logSwap } from '../../lib/activityLogWrites'
import { getExplorerTxUrl } from '../../lib/explorer'
import { estimateSwap, executeSwap, friendlySwapError, SWAP_TOKENS, type SwapToken } from '../../lib/swapClient'
import { amountError } from '../../lib/validation'
import { usdcBalanceQueryKey } from '../../hooks/useUsdcBalances'
import type { SwapEstimate } from '@circle-fin/swap-kit'

const TOKEN_OPTIONS = (Object.keys(SWAP_TOKENS) as SwapToken[]).map((value) => ({
  value,
  label: SWAP_TOKENS[value].label,
}))

function SwapForm() {
  const { chainId } = useAccount()
  const { isOnChain, ensureChain, isPending: switchPending } = useEvmChainSwitch()
  const { adapter, error: adapterError } = useEvmAdapter()
  const onArcTestnet = isOnChain(arcTestnet.id)
  const queryClient = useQueryClient()

  const [payToken, setPayToken] = useState<SwapToken>('USDC')
  const [receiveToken, setReceiveToken] = useState<SwapToken>('EURC')
  const [amount, setAmount] = useState('')
  const [touched, setTouched] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [sentTxHash, setSentTxHash] = useState<string | null>(null)
  const [sentExplorerUrl, setSentExplorerUrl] = useState<string | undefined>(undefined)

  const [quote, setQuote] = useState<SwapEstimate | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const payBalance = useTokenBalance(arcTestnet.id, SWAP_TOKENS[payToken])
  const receiveBalance = useTokenBalance(arcTestnet.id, SWAP_TOKENS[receiveToken])
  const availableBalance = Number(payBalance.formatted)

  const isPositiveAmount = !amountError(amount, Infinity)

  const amountMsg = useMemo(() => {
    if (payBalance.isLoading) return null
    return amountError(amount, availableBalance)
  }, [amount, availableBalance, payBalance.isLoading])
  const isValid = !amountMsg && !!adapter && onArcTestnet && payToken !== receiveToken

  useEffect(() => {
    setQuote(null)
    setQuoteError(null)

    if (!onArcTestnet || !adapter || !isPositiveAmount || payToken === receiveToken) return

    setQuoteLoading(true)
    // `cancelled` guards the async response, not just the debounce timer: clearTimeout only stops
    // the request from ever starting, but once estimateSwap() is actually in flight, a newer
    // effect run's cleanup can't cancel that promise — without this flag, an old, slower quote
    // response landing after a newer request started would overwrite the current (correct) quote
    // with stale data for params that are no longer selected. Same pattern already used correctly
    // in UnifiedBalance.tsx's fee-estimate effect.
    let cancelled = false
    const timer = setTimeout(() => {
      estimateSwap({ adapter, tokenIn: payToken, tokenOut: receiveToken, amountIn: amount })
        .then((result) => {
          if (!cancelled) setQuote(result)
        })
        .catch((error: unknown) => {
          if (!cancelled) setQuoteError(friendlySwapError(error))
        })
        .finally(() => {
          if (!cancelled) setQuoteLoading(false)
        })
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
      setQuoteLoading(false)
    }
  }, [onArcTestnet, adapter, payToken, receiveToken, amount, isPositiveAmount])

  const handleConfirm = async () => {
    if (confirming) return
    if (!adapter) {
      setSwapError('Wallet adapter is not ready — try reconnecting your wallet.')
      return
    }
    setSwapError(null)
    setConfirming(true)
    try {
      const result = await executeSwap({ adapter, tokenIn: payToken, tokenOut: receiveToken, amountIn: amount })

      const explorerUrl = getExplorerTxUrl(arcTestnet.id, result.txHash)
      setSentTxHash(result.txHash)
      setSentExplorerUrl(explorerUrl)

      void payBalance.refetch()
      void receiveBalance.refetch()
      // Swap's own Pay/Receive balances above use wagmi's own auto-keyed query cache — a
      // completely separate cache entry from Overview's Total Balance (useUsdcBalances, keyed by
      // usdcBalanceQueryKey). Without this, a real swap changes the wallet's actual on-chain USDC
      // balance on Arc Testnet, but Overview would keep showing the pre-swap total until its own
      // 20s poll happens to tick over — the exact "works but needs a refresh" bug this pass is
      // hunting for. Unconditional (not just when USDC is one of the two legs) since it's a cheap
      // no-op refetch otherwise, and safer than trying to special-case which token touched USDC.
      void queryClient.invalidateQueries({ queryKey: usdcBalanceQueryKey(arcTestnet.id, result.fromAddress) })

      // Own try/catch: the swap already succeeded on-chain at this point, so a Firestore write
      // failure must never surface as "Swap failed" — same pattern as Transfer/Bridge.
      try {
        await logSwap(result.fromAddress, {
          txHash: result.txHash,
          amount: Number(amount),
          token: payToken,
          route: `${payToken} → ${receiveToken}`,
          chain: 'Arc Testnet',
        })
      } catch (logErr) {
        console.error('Failed to persist swap to Firestore:', logErr)
      }

      setReviewOpen(false)
      setAmount('')
      setTouched(false)
      setQuote(null)
    } catch (err) {
      setSwapError(friendlySwapError(err))
      setReviewOpen(false)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      {chainId !== undefined && !onArcTestnet && (
        <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">sync_alt</span>
            <p className="text-body-sm text-tertiary font-medium">
              Swap is only available on Arc Testnet — switch networks to continue
            </p>
          </div>
          <button
            type="button"
            onClick={() => ensureChain(arcTestnet.id)}
            disabled={switchPending}
            className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {switchPending ? 'Switching…' : 'Switch to Arc Testnet'}
          </button>
        </div>
      )}

      {sentTxHash && (
        <div className="banner-success animate-fade-in-up">
          <span className="material-symbols-outlined text-green-400 text-[20px] shrink-0">check_circle</span>
          <div className="min-w-0">
            <p className="text-body-sm text-green-400 font-medium">Swap confirmed on-chain.</p>
            <p className="text-[11px] font-mono-data text-green-400/60 truncate">{sentTxHash}</p>
            {sentExplorerUrl && (
              <a
                href={sentExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-green-400/80 underline underline-offset-2 hover:text-green-400"
              >
                View transaction on explorer
              </a>
            )}
          </div>
        </div>
      )}

      {(swapError || adapterError) && (
        <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-error/20 bg-error/5 animate-fade-in-up">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
          <p className="text-body-sm text-error font-medium">{swapError ?? adapterError}</p>
        </div>
      )}

      <section className="glass-premium p-6 sm:p-7 rounded-3xl relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="page-title text-2xl">Swap Assets</h2>
        </div>

        <div className="panel p-5 rounded-2xl mb-2">
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="swap-pay" className="field-label">
              Pay
            </label>
            {payBalance.isLoading ? (
              <SkeletonBlock className="h-3 w-24" />
            ) : (
              <span className="font-label-caps text-[10px] data-muted">
                Balance: {availableBalance.toFixed(2)} {payToken}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <input
              id="swap-pay"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => setTouched(true)}
              inputMode="decimal"
              className="input-amount font-headline-xl text-3xl"
              placeholder="0.00"
              type="text"
            />
            <div className="flex items-center gap-2 shrink-0">
              <MaxButton onClick={() => setAmount(String(availableBalance))} />
              <Dropdown
                value={payToken}
                onChange={(value) => setPayToken(value as SwapToken)}
                options={TOKEN_OPTIONS}
                ariaLabel="Select pay token"
                triggerClassName="flex items-center gap-2 bg-surface/80 p-2 pr-3 rounded-full border border-white/10 transition-premium hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
                renderTrigger={(selected) => (
                  <>
                    <div className="w-8 h-8 rounded-full bg-tertiary-container/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-tertiary text-sm">monetization_on</span>
                    </div>
                    <span className="font-bold font-body-md text-sm">{selected?.label}</span>
                    <span className="material-symbols-outlined text-sm text-on-surface-variant/60">expand_more</span>
                  </>
                )}
              />
            </div>
          </div>
          {touched && <FieldError message={amountMsg} />}
        </div>

        <div className="relative h-4 z-10 flex justify-center">
          <button
            type="button"
            aria-label="Flip pay and receive tokens"
            onClick={() => {
              setPayToken(receiveToken)
              setReceiveToken(payToken)
            }}
            className="absolute -top-4 w-10 h-10 rounded-xl bg-surface-container border border-white/10 flex items-center justify-center text-primary hover:rotate-180 hover:border-primary/30 transition-all duration-500 ease-premium shadow-glass"
          >
            <span className="material-symbols-outlined">south</span>
          </button>
        </div>

        <div className="panel p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <label className="field-label">Receive</label>
            {receiveBalance.isLoading ? (
              <SkeletonBlock className="h-3 w-24" />
            ) : (
              <span className="font-label-caps text-[10px] data-muted">
                Balance: {Number(receiveBalance.formatted).toFixed(2)} {receiveToken}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <input
              disabled
              readOnly
              value={quote ? Number(quote.estimatedOutput.amount).toFixed(6) : ''}
              className="input-amount font-headline-xl text-3xl text-on-surface/40"
              placeholder="0.00"
              type="text"
            />
            <Dropdown
              value={receiveToken}
              onChange={(value) => setReceiveToken(value as SwapToken)}
              options={TOKEN_OPTIONS}
              ariaLabel="Select receive token"
              triggerClassName="flex items-center gap-2 bg-surface/80 p-2 pr-3 rounded-full border border-white/10 transition-premium hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 shrink-0"
              renderTrigger={(selected) => (
                <>
                  <div className="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-sm">generating_tokens</span>
                  </div>
                  <span className="font-bold font-body-md text-sm">{selected?.label}</span>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant/60">expand_more</span>
                </>
              )}
            />
          </div>
          {payToken === receiveToken && (
            <p className="text-body-sm text-on-surface-variant/50 mt-2">Pick two different tokens to get a quote.</p>
          )}
        </div>

        <div className="mt-6 space-y-2.5">
          <div className="flex justify-between text-body-sm font-body-sm text-on-surface-variant/60">
            <span>Rate</span>
            <span className="font-mono-data data-muted">
              {quoteLoading
                ? 'Fetching…'
                : quote
                  ? `1 ${payToken} ≈ ${(Number(quote.estimatedOutput.amount) / Number(amount || '1')).toFixed(6)} ${receiveToken}`
                  : '—'}
            </span>
          </div>
          <div className="flex justify-between text-body-sm font-body-sm text-on-surface-variant/60">
            <span>Min. Received</span>
            <span className="data-muted">{quote ? `${Number(quote.stopLimit.amount).toFixed(6)} ${receiveToken}` : '—'}</span>
          </div>
          <div className="flex justify-between text-body-sm font-body-sm text-on-surface-variant/60">
            <span>Slippage Tolerance</span>
            <span className="font-mono-data text-on-surface">5%</span>
          </div>
        </div>

        {quoteError && <FieldError message={quoteError} />}

        <button
          type="button"
          onClick={() => {
            setTouched(true)
            if (isValid) setReviewOpen(true)
          }}
          disabled={!isValid}
          className="btn-primary w-full py-5 rounded-2xl mt-8 text-lg font-extrabold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Swap
        </button>
        <p className="text-[11px] text-center text-on-surface-variant/40 mt-2">
          Live on Arc Testnet via Circle Swap Kit. Signing happens in your wallet — nothing is
          submitted without your confirmation.
        </p>
      </section>

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={handleConfirm}
        confirming={confirming}
        title="Review Swap"
        confirmLabel="Confirm Swap"
        rows={[
          { label: 'Pay', value: `${amount || '0.00'} ${payToken}`, accent: true },
          { label: 'Receive', value: quote ? `${Number(quote.estimatedOutput.amount).toFixed(6)} ${receiveToken}` : '—' },
          { label: 'Min. Received', value: quote ? `${Number(quote.stopLimit.amount).toFixed(6)} ${receiveToken}` : '—' },
          { label: 'Slippage Tolerance', value: '5%' },
        ]}
      />
    </div>
  )
}

export default function Swap() {
  return (
    <RequireWallet noun="swap markets">
      <SwapForm />
    </RequireWallet>
  )
}
