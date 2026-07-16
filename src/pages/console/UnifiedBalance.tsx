import { deposit, estimateSpend, isKitError, spend, type EstimateSpendResult } from '@circle-fin/unified-balance-kit'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { CHAINS, CHAIN_LIST_STANDARD, type ChainId } from '../../assets/chains'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import Dropdown from '../../components/console/Dropdown'
import FieldError from '../../components/console/FieldError'
import MaxButton from '../../components/console/MaxButton'
import ReviewModal from '../../components/console/ReviewModal'
import { SkeletonBlock } from '../../components/console/Skeleton'
import { GATEWAY_CHAIN_BY_ID, GATEWAY_SUPPORTED_CHAIN_IDS, type GatewayChainId } from '../../config/gatewayChains'
import { useSolanaWallet } from '../../context/SolanaWalletContext'
import { useWalletAuthContext } from '../../context/WalletAuthContext'
import { useActivityLog } from '../../hooks/useActivityLog'
import { useEvmAdapter } from '../../hooks/useEvmAdapter'
import { useEvmChainSwitch } from '../../hooks/useEvmChainSwitch'
import { useGatewayBalances } from '../../hooks/useGatewayBalances'
import { useReconcileGatewayDeposits } from '../../hooks/useReconcileGatewayDeposits'
import { useSolanaAdapter } from '../../hooks/useSolanaAdapter'
import { useSolanaTokenBalance } from '../../hooks/useSolanaTokenBalance'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { appendGatewayDepositEvent, logGatewayWithdraw } from '../../lib/activityLogWrites'
import { unifiedBalanceContext } from '../../lib/unifiedBalanceKit'
import { amountError } from '../../lib/validation'
import { usdcBalanceQueryKey } from '../../hooks/useUsdcBalances'

const GATEWAY_CHAINS = GATEWAY_SUPPORTED_CHAIN_IDS.map((id) => CHAINS[id])
const CHAIN_OPTIONS = GATEWAY_CHAINS.map((c) => ({
  value: c.id,
  label: c.name,
  sublabel: c.layer,
  icon: <c.Icon className="w-6 h-6 shrink-0" />,
}))

/**
 * Logs the full KitError shape — including `cause.trace`, which is where Circle's SDKs put the
 * actually-useful diagnostic data (raw RPC error, endpoint, status code, etc.) — not just
 * `error.message`. Same motivation as Bridge's step-error logging: a generic "RPC endpoint error"
 * string is a broad classification bucket (matches rate limits, node health issues, AND unrelated
 * blockhash-expiry — see adapter-solana-kit's error normalizer), so the message alone can't tell
 * you whether this is a stale-RPC-override bug or something else. Without this, a real failure is
 * unrecoverable evidence-wise — console only ever shows the truncated message.
 */
function dumpKitError(label: string, err: unknown) {
  if (isKitError(err)) {
    console.error(`[UnifiedBalance] ${label} — KitError:`, {
      name: err.name,
      code: err.code,
      type: err.type,
      recoverability: err.recoverability,
      message: err.message,
      cause: err.cause,
    })
  } else {
    console.error(`[UnifiedBalance] ${label} — non-KitError:`, err)
  }
}

function UnifiedBalanceScreen() {
  const [tab, setTab] = useState<'deposit' | 'spend'>('deposit')

  const { address: walletAddress } = useAccount()
  const { isAuthenticated } = useWalletAuthContext()
  const { adapter: evmAdapter, error: evmAdapterError } = useEvmAdapter()
  const solanaAdapter = useSolanaAdapter()
  const { connected: solanaConnected, connect: connectSolana } = useSolanaWallet()
  const { isOnChain, ensureChain, isPending: switchPending } = useEvmChainSwitch()
  const queryClient = useQueryClient()

  const gatewayBalances = useGatewayBalances()
  const balanceByChain = useMemo(
    () => new Map(gatewayBalances.perChain.map((c) => [c.chain, c])),
    [gatewayBalances.perChain],
  )

  const { entries: activityEntries } = useActivityLog(
    isAuthenticated ? walletAddress : undefined,
    ['gateway_deposit', 'gateway_withdraw'],
  )
  const depositEntries = activityEntries.filter((e) => e.type === 'gateway_deposit')
  const pendingDeposits = depositEntries.filter((e) => e.status === 'pending')
  useReconcileGatewayDeposits(
    isAuthenticated ? walletAddress : undefined,
    depositEntries,
    gatewayBalances.pendingTxHashes,
    gatewayBalances.hasLoadedOnce,
  )

  const adapterFor = (chainId: ChainId) => (chainId === 'solana' ? solanaAdapter : evmAdapter)
  const chainNeedsSolana = (chainId: ChainId) => chainId === 'solana' && !solanaConnected
  const chainNeedsSwitch = (chainId: ChainId) => {
    const meta = CHAINS[chainId]
    return meta.evmChainId !== undefined && !isOnChain(meta.evmChainId)
  }

  // ---- DEPOSIT TAB ------------------------------------------------------
  const [depositChainId, setDepositChainId] = useState<ChainId>('ethereum')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositTouched, setDepositTouched] = useState(false)
  const [depositReviewOpen, setDepositReviewOpen] = useState(false)
  const [depositConfirming, setDepositConfirming] = useState(false)
  const [depositError, setDepositError] = useState<string | null>(null)
  const [depositSuccess, setDepositSuccess] = useState<{ txHash: string; explorerUrl?: string } | null>(null)

  const depositChain = CHAINS[depositChainId]
  const depositWalletEvm = useTokenBalance(depositChain.evmChainId ?? 0)
  const depositWalletSolana = useSolanaTokenBalance()
  // "Available to deposit" is the real on-chain wallet balance on the selected chain — a
  // fundamentally different number from the Gateway balance this screen otherwise shows.
  const depositAvailable = depositChainId === 'solana' ? Number(depositWalletSolana.formatted) : Number(depositWalletEvm.formatted)
  const depositBalanceLoading = depositChainId === 'solana' ? depositWalletSolana.isLoading : depositWalletEvm.isLoading

  const depositAmountMsg = useMemo(() => amountError(depositAmount, depositAvailable), [depositAmount, depositAvailable])
  const depositNeedsWallet = chainNeedsSolana(depositChainId)
  const depositNeedsSwitch = chainNeedsSwitch(depositChainId)
  const depositValid = !depositAmountMsg && !depositNeedsWallet && !depositNeedsSwitch && isAuthenticated

  const selectDepositChain = (id: ChainId) => {
    setDepositChainId(id)
    const meta = CHAINS[id]
    if (meta.evmChainId !== undefined) ensureChain(meta.evmChainId)
  }

  const handleDepositConfirm = async () => {
    setDepositError(null)
    setDepositSuccess(null)
    setDepositConfirming(true)
    try {
      const adapter = adapterFor(depositChainId)
      if (!walletAddress) throw new Error('Wallet not connected.')
      if (!isAuthenticated) throw new Error('Sign in with your wallet first.')
      if (!adapter) throw new Error(evmAdapterError ?? 'Wallet adapter is not ready yet — try again in a moment.')

      // Default allowanceStrategy ('authorize', EIP-3009) deliberately left unset — it's a gasless
      // off-chain signature with no allowance step at all, so it can never hit the on-chain
      // allowance-accumulation footgun 'approve' has (see the CCTP approve() patch in
      // patches/@circle-fin+provider-cctp-v2 — the Gateway provider has the exact same
      // increaseAllowance-based 'approve' strategy, just unused here by not selecting it).
      const result = await deposit(unifiedBalanceContext, {
        from: { adapter, chain: GATEWAY_CHAIN_BY_ID[depositChainId as GatewayChainId] },
        amount: depositAmount,
      })

      const depositId = crypto.randomUUID()
      try {
        await appendGatewayDepositEvent(walletAddress, {
          depositId,
          sequence: 0,
          status: 'pending',
          amount: result.amount,
          token: result.token,
          chain: result.chain,
          depositedBy: result.depositedBy,
          depositedTo: result.depositedTo,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
        })
      } catch (logErr) {
        console.error('Failed to persist deposit to Firestore:', logErr)
      }

      setDepositSuccess({ txHash: result.txHash, explorerUrl: result.explorerUrl })
      setDepositReviewOpen(false)
      setDepositAmount('')
      setDepositTouched(false)
      void gatewayBalances.refetch()
      // A Gateway deposit actually moves real USDC out of the source chain's wallet balance —
      // Overview's Total Balance (a separate cache entry, keyed by usdcBalanceQueryKey) needs its
      // own invalidation or it keeps showing the pre-deposit amount until its next 20s poll.
      // Solana has no entry in that cache (Overview only tracks the 7 EVM chains), so only bother
      // when the deposit chain is actually EVM.
      if (depositChain.evmChainId !== undefined) {
        void queryClient.invalidateQueries({ queryKey: usdcBalanceQueryKey(depositChain.evmChainId, walletAddress) })
      }
    } catch (err) {
      dumpKitError('deposit failed', err)
      const message = err instanceof Error ? err.message : 'Deposit failed.'
      const rejected = /user rejected|denied the transaction|user denied/i.test(message)
      setDepositError(rejected ? 'Deposit cancelled — the wallet request was rejected.' : message)
      setDepositReviewOpen(false)
    } finally {
      setDepositConfirming(false)
    }
  }

  // ---- SPEND TAB ----------------------------------------------------------
  const [spendFromId, setSpendFromId] = useState<ChainId>('ethereum')
  const [spendToId, setSpendToId] = useState<ChainId>('arc')
  const [spendAmount, setSpendAmount] = useState('')
  const [spendTouched, setSpendTouched] = useState(false)
  const [spendReviewOpen, setSpendReviewOpen] = useState(false)
  const [spendConfirming, setSpendConfirming] = useState(false)
  const [spendError, setSpendError] = useState<string | null>(null)
  const [spendSuccess, setSpendSuccess] = useState<{ txHash: string; explorerUrl?: string } | null>(null)
  const [feeEstimate, setFeeEstimate] = useState<EstimateSpendResult | null>(null)
  const [feeEstimateError, setFeeEstimateError] = useState<string | null>(null)

  const spendFromGatewayBalance = Number(balanceByChain.get(GATEWAY_CHAIN_BY_ID[spendFromId as GatewayChainId])?.confirmedBalance ?? '0')
  const spendSameChain = spendFromId === spendToId
  const spendAmountMsg = useMemo(() => amountError(spendAmount, spendFromGatewayBalance), [spendAmount, spendFromGatewayBalance])
  const spendNeedsWallet = chainNeedsSolana(spendFromId) || chainNeedsSolana(spendToId)
  const spendNeedsSwitch = chainNeedsSwitch(spendFromId)
  const spendValid = !spendAmountMsg && !spendSameChain && !spendNeedsWallet && !spendNeedsSwitch && isAuthenticated

  const selectSpendFromChain = (id: ChainId) => {
    setSpendFromId(id)
    const meta = CHAINS[id]
    if (meta.evmChainId !== undefined) ensureChain(meta.evmChainId)
  }

  const buildSpendParams = () => {
    const fromAdapter = adapterFor(spendFromId)
    const toAdapter = adapterFor(spendToId)
    if (!fromAdapter || !toAdapter) return null
    return {
      from: {
        adapter: fromAdapter,
        allocations: { amount: spendAmount, chain: GATEWAY_CHAIN_BY_ID[spendFromId as GatewayChainId] },
      },
      to: {
        adapter: toAdapter,
        chain: GATEWAY_CHAIN_BY_ID[spendToId as GatewayChainId],
        // Client-side minting to Solana hit RPC/signing issues on Bridge's equivalent forwarder-
        // eligible path (see Bridge.tsx) — routing Solana-destination spends through Circle's
        // Forwarding Service the same way sidesteps that same class of problem here.
        ...(spendToId === 'solana' && { useForwarder: true }),
      },
      amount: spendAmount,
    }
  }

  // Best-effort fee preview — never blocks opening the review modal if it fails.
  useEffect(() => {
    if (!spendReviewOpen || !spendValid) {
      setFeeEstimate(null)
      setFeeEstimateError(null)
      return
    }
    const params = buildSpendParams()
    if (!params) return
    let cancelled = false
    setFeeEstimateError(null)
    estimateSpend(unifiedBalanceContext, params)
      .then((est) => {
        if (!cancelled) setFeeEstimate(est)
      })
      .catch((err) => {
        if (!cancelled) {
          setFeeEstimate(null)
          setFeeEstimateError(err instanceof Error ? err.message : 'Fee estimate unavailable.')
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spendReviewOpen, spendValid, spendFromId, spendToId, spendAmount])

  const handleSpendConfirm = async () => {
    setSpendError(null)
    setSpendSuccess(null)
    setSpendConfirming(true)
    try {
      if (!walletAddress) throw new Error('Wallet not connected.')
      if (!isAuthenticated) throw new Error('Sign in with your wallet first.')
      const params = buildSpendParams()
      if (!params) throw new Error(evmAdapterError ?? 'Wallet adapter is not ready yet — try again in a moment.')

      const result = await spend(unifiedBalanceContext, params)

      try {
        await logGatewayWithdraw(walletAddress, {
          txHash: result.txHash,
          amount: spendAmount,
          token: 'USDC',
          fromChain: CHAINS[spendFromId].name,
          toChain: CHAINS[spendToId].name,
          explorerUrl: result.explorerUrl,
        })
      } catch (logErr) {
        console.error('Failed to persist spend to Firestore:', logErr)
      }

      setSpendSuccess({ txHash: result.txHash, explorerUrl: result.explorerUrl })
      setSpendReviewOpen(false)
      setSpendAmount('')
      setSpendTouched(false)
      void gatewayBalances.refetch()
      // A Gateway spend deposits real USDC into the destination chain's wallet balance — same
      // cross-screen cache gap as the deposit side above.
      const spendToEvmChainId = CHAINS[spendToId].evmChainId
      if (spendToEvmChainId !== undefined) {
        void queryClient.invalidateQueries({ queryKey: usdcBalanceQueryKey(spendToEvmChainId, walletAddress) })
      }
    } catch (err) {
      dumpKitError('spend failed', err)
      const message = err instanceof Error ? err.message : 'Spend failed.'
      const rejected = /user rejected|denied the transaction|user denied/i.test(message)
      setSpendError(rejected ? 'Spend cancelled — the wallet request was rejected.' : message)
      setSpendReviewOpen(false)
    } finally {
      setSpendConfirming(false)
    }
  }

  const feeRows = feeEstimate?.fees.map((fee) => ({ label: `${fee.type} fee`, value: `${fee.amount} ${fee.token}` })) ?? []

  // JSX tag names can't be computed member expressions (CHAINS[id].Icon) — bind to locals first.
  const SpendFromIcon = CHAINS[spendFromId].Icon
  const SpendToIcon = CHAINS[spendToId].Icon

  return (
    <div className="max-w-[1200px] mx-auto space-y-gutter">
      <section className="glass-premium rounded-[32px] p-10 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary/5 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-end md:items-center">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="font-label-caps text-on-surface-variant/55 tracking-[0.14em] uppercase text-[11px]">
                Unified Total Balance
              </span>
              <span className="status-chip text-[10px]">
                <span className="status-chip-dot status-chip-dot-live" />
                Gateway Live
              </span>
              <button
                type="button"
                onClick={() => gatewayBalances.refetch()}
                aria-label="Refresh balances"
                className="btn-icon w-8 h-8 rounded-lg glass hover:text-primary"
              >
                <span className={`material-symbols-outlined text-[16px] ${gatewayBalances.isLoading ? 'animate-spin' : ''}`}>
                  refresh
                </span>
              </button>
            </div>
            {gatewayBalances.isLoading ? (
              <SkeletonBlock className="h-14 w-56" />
            ) : (
              <h2 className="font-headline-xl text-on-surface tracking-tighter flex items-baseline gap-2">
                <span className="opacity-40 text-[32px] font-semibold">$</span>
                <span className="text-[56px] font-extrabold tabular-nums">{gatewayBalances.totalConfirmed.toFixed(2)}</span>
              </h2>
            )}
            <div className="flex items-center gap-4 mt-6">
              <div className="text-on-surface-variant/70 font-body-sm">
                <span className="opacity-60">Pending Finality:</span>{' '}
                <span className="font-mono-data text-on-surface">${gatewayBalances.totalPending.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="mt-8 md:mt-0 flex gap-3">
            <button type="button" onClick={() => setTab('deposit')} className="btn-primary h-14 px-8 rounded-2xl font-bold">
              <span className="material-symbols-outlined">add_circle</span>
              Deposit
            </button>
            <button type="button" onClick={() => setTab('spend')} className="btn-secondary h-14 px-8 rounded-2xl font-bold">
              <span className="material-symbols-outlined">bolt</span>
              Spend
            </button>
          </div>
        </div>
      </section>

      {pendingDeposits.length > 0 && (
        <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-tertiary/20 bg-tertiary/5 animate-fade-in-up">
          <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0 animate-spin">progress_activity</span>
          <p className="text-body-sm text-tertiary font-medium">
            {pendingDeposits.length} deposit{pendingDeposits.length > 1 ? 's' : ''} finalizing — funds will become spendable once
            the source chain confirms finality. This persists across a refresh.
          </p>
        </div>
      )}

      <div className="grid grid-cols-12 gap-gutter items-start">
        <div className="col-span-12 lg:col-span-7 space-y-gutter">
          <div className="glass rounded-3xl p-1.5 flex gap-1">
            <button
              type="button"
              onClick={() => setTab('deposit')}
              className={`flex-1 py-3 font-semibold rounded-2xl transition-premium text-sm ${
                tab === 'deposit'
                  ? 'bg-primary/15 text-primary border border-primary/20 shadow-[0_0_20px_-8px_rgba(255,170,246,0.3)]'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              Deposit
            </button>
            <button
              type="button"
              onClick={() => setTab('spend')}
              className={`flex-1 py-3 font-semibold rounded-2xl transition-premium text-sm ${
                tab === 'spend'
                  ? 'bg-primary/15 text-primary border border-primary/20 shadow-[0_0_20px_-8px_rgba(255,170,246,0.3)]'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              Spend
            </button>
          </div>

          {tab === 'deposit' ? (
            <div className="glass-premium rounded-[32px] p-8">
              <div className="space-y-6">
                <h3 className="font-headline-lg text-[24px] tracking-tight">Deposit to Gateway</h3>

                {depositSuccess && (
                  <div className="banner-success animate-fade-in-up">
                    <span className="material-symbols-outlined text-green-400 text-[20px] shrink-0">check_circle</span>
                    <div className="min-w-0">
                      <p className="text-body-sm text-green-400 font-medium">
                        Deposit submitted — finalizing (may take real time on this chain).
                      </p>
                      {depositSuccess.explorerUrl && (
                        <a
                          href={depositSuccess.explorerUrl}
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
                {depositError && (
                  <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-error/20 bg-error/5 animate-fade-in-up">
                    <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
                    <p className="text-body-sm text-error font-medium">{depositError}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="font-label-caps text-on-surface-variant/55 ml-1 text-[11px] tracking-[0.12em]">
                    From Chain
                  </label>
                  <div className="flex items-center justify-between p-4 rounded-2xl panel">
                    <Dropdown
                      value={depositChainId}
                      onChange={(v) => selectDepositChain(v as ChainId)}
                      options={CHAIN_OPTIONS}
                      ariaLabel="Select deposit source chain"
                      triggerClassName="flex items-center gap-3 rounded-xl transition-premium hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
                      renderTrigger={() => (
                        <>
                          <depositChain.Icon className="w-9 h-9" />
                          <div className="text-left">
                            <p className="font-bold leading-tight tracking-tight flex items-center gap-1">
                              {depositChain.shortLabel}
                              <span className="material-symbols-outlined text-[16px] text-on-surface-variant/50">expand_more</span>
                            </p>
                            <p className="text-body-sm text-on-surface-variant/55">{depositChain.layer}</p>
                          </div>
                        </>
                      )}
                    />
                    {depositBalanceLoading ? (
                      <SkeletonBlock className="h-4 w-20" />
                    ) : (
                      <span className="font-mono-data text-[13px] data-muted">
                        Wallet: {depositAvailable.toFixed(2)} USDC
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-label-caps text-on-surface-variant/55 ml-1 text-[11px] tracking-[0.12em]">
                    Amount
                  </label>
                  <input
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    onBlur={() => setDepositTouched(true)}
                    inputMode="decimal"
                    className="w-full h-20 panel rounded-2xl px-6 text-[32px] font-mono-data text-on-surface outline-none tabular-nums tracking-tight"
                    placeholder="0.00"
                    type="text"
                  />
                  <div className="flex justify-end">
                    <MaxButton onClick={() => setDepositAmount(String(depositAvailable))} />
                  </div>
                  {depositTouched && <FieldError message={depositAmountMsg} />}
                </div>

                {depositNeedsSwitch && (
                  <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5">
                    <p className="text-body-sm text-tertiary font-medium">
                      Your wallet is on a different network — switch to {depositChain.shortLabel} to continue
                    </p>
                    <button
                      type="button"
                      onClick={() => depositChain.evmChainId !== undefined && ensureChain(depositChain.evmChainId)}
                      disabled={switchPending}
                      className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50"
                    >
                      {switchPending ? 'Switching…' : `Switch to ${depositChain.shortLabel}`}
                    </button>
                  </div>
                )}

                {depositNeedsWallet ? (
                  <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5">
                    <p className="text-body-sm text-tertiary font-medium">Connect a Solana wallet to continue</p>
                    <button type="button" onClick={connectSolana} className="btn-secondary px-4 py-2 text-sm shrink-0">
                      Connect Solana Wallet
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDepositTouched(true)
                      if (depositValid) setDepositReviewOpen(true)
                    }}
                    disabled={!depositValid}
                    className="btn-primary w-full h-16 rounded-2xl text-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Review Deposit
                  </button>
                )}
              </div>

              <ReviewModal
                open={depositReviewOpen}
                onClose={() => setDepositReviewOpen(false)}
                onConfirm={handleDepositConfirm}
                confirming={depositConfirming}
                title="Review Deposit"
                confirmLabel="Confirm Deposit"
                rows={[
                  { label: 'Amount', value: `${depositAmount || '0.00'} USDC`, accent: true },
                  { label: 'Chain', value: depositChain.name },
                ]}
              />
            </div>
          ) : (
            <div className="glass-premium rounded-[32px] p-8">
              <div className="space-y-6">
                <h3 className="font-headline-lg text-[24px] tracking-tight">Spend from Gateway</h3>
                <p className="text-body-sm text-on-surface-variant/60">
                  Gateway spends settle in under a second once your balance is finalized — no multi-step
                  wait like a bridge.
                </p>

                {spendSuccess && (
                  <div className="banner-success animate-fade-in-up">
                    <span className="material-symbols-outlined text-green-400 text-[20px] shrink-0">check_circle</span>
                    <div className="min-w-0">
                      <p className="text-body-sm text-green-400 font-medium">Spend complete.</p>
                      {spendSuccess.explorerUrl && (
                        <a
                          href={spendSuccess.explorerUrl}
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
                {spendError && (
                  <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-error/20 bg-error/5 animate-fade-in-up">
                    <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
                    <p className="text-body-sm text-error font-medium">{spendError}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="font-label-caps text-on-surface-variant/55 ml-1 text-[11px] tracking-[0.12em]">
                    From Chain
                  </label>
                  <div className="flex items-center justify-between p-4 rounded-2xl panel">
                    <Dropdown
                      value={spendFromId}
                      onChange={(v) => selectSpendFromChain(v as ChainId)}
                      options={CHAIN_OPTIONS}
                      ariaLabel="Select spend source chain"
                      triggerClassName="flex items-center gap-3 rounded-xl transition-premium hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
                      renderTrigger={() => (
                        <>
                          <SpendFromIcon className="w-9 h-9" />
                          <div className="text-left">
                            <p className="font-bold leading-tight tracking-tight flex items-center gap-1">
                              {CHAINS[spendFromId].shortLabel}
                              <span className="material-symbols-outlined text-[16px] text-on-surface-variant/50">expand_more</span>
                            </p>
                          </div>
                        </>
                      )}
                    />
                    <span className="font-mono-data text-[13px] data-muted">
                      Available: {spendFromGatewayBalance.toFixed(2)} USDC
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-label-caps text-on-surface-variant/55 ml-1 text-[11px] tracking-[0.12em]">
                    To Chain
                  </label>
                  <div className="flex items-center justify-between p-4 rounded-2xl panel">
                    <Dropdown
                      value={spendToId}
                      onChange={(v) => setSpendToId(v as ChainId)}
                      options={CHAIN_OPTIONS}
                      ariaLabel="Select spend destination chain"
                      triggerClassName="flex items-center gap-3 rounded-xl transition-premium hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
                      renderTrigger={() => (
                        <>
                          <SpendToIcon className="w-9 h-9" />
                          <div className="text-left">
                            <p className="font-bold leading-tight tracking-tight flex items-center gap-1">
                              {CHAINS[spendToId].shortLabel}
                              <span className="material-symbols-outlined text-[16px] text-on-surface-variant/50">expand_more</span>
                            </p>
                          </div>
                        </>
                      )}
                    />
                  </div>
                  {spendSameChain && <FieldError message="Source and destination chains must be different" />}
                </div>

                <div className="space-y-2">
                  <label className="font-label-caps text-on-surface-variant/55 ml-1 text-[11px] tracking-[0.12em]">
                    Amount
                  </label>
                  <input
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value)}
                    onBlur={() => setSpendTouched(true)}
                    inputMode="decimal"
                    className="w-full h-20 panel rounded-2xl px-6 text-[32px] font-mono-data text-on-surface outline-none tabular-nums tracking-tight"
                    placeholder="0.00"
                    type="text"
                  />
                  <div className="flex justify-end">
                    <MaxButton onClick={() => setSpendAmount(String(spendFromGatewayBalance))} />
                  </div>
                  {spendTouched && <FieldError message={spendAmountMsg} />}
                </div>

                {spendNeedsSwitch && (
                  <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5">
                    <p className="text-body-sm text-tertiary font-medium">
                      Your wallet is on a different network — switch to {CHAINS[spendFromId].shortLabel} to continue
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const evmChainId = CHAINS[spendFromId].evmChainId
                        if (evmChainId !== undefined) ensureChain(evmChainId)
                      }}
                      disabled={switchPending}
                      className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50"
                    >
                      {switchPending ? 'Switching…' : `Switch to ${CHAINS[spendFromId].shortLabel}`}
                    </button>
                  </div>
                )}

                {spendNeedsWallet ? (
                  <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5">
                    <p className="text-body-sm text-tertiary font-medium">Connect a Solana wallet to continue</p>
                    <button type="button" onClick={connectSolana} className="btn-secondary px-4 py-2 text-sm shrink-0">
                      Connect Solana Wallet
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSpendTouched(true)
                      if (spendValid) setSpendReviewOpen(true)
                    }}
                    disabled={!spendValid}
                    className="btn-primary w-full h-16 rounded-2xl text-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined">bolt</span>
                    Review Spend
                  </button>
                )}
              </div>

              <ReviewModal
                open={spendReviewOpen}
                onClose={() => setSpendReviewOpen(false)}
                onConfirm={handleSpendConfirm}
                confirming={spendConfirming}
                title="Review Spend"
                confirmLabel="Confirm Spend"
                rows={[
                  { label: 'Amount', value: `${spendAmount || '0.00'} USDC`, accent: true },
                  { label: 'From', value: CHAINS[spendFromId].name },
                  { label: 'To', value: CHAINS[spendToId].name },
                  ...(feeRows.length > 0
                    ? feeRows
                    : [{ label: 'Fee', value: feeEstimateError ? 'Unavailable' : 'Estimating…' }]),
                ]}
              />
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-gutter">
          <div className="glass-premium rounded-[32px] overflow-hidden">
            <div className="p-6 border-b border-white/[0.06] flex justify-between items-center">
              <h3 className="font-headline-lg text-[18px] font-semibold tracking-tight">Chain Allocation</h3>
            </div>
            <div className="p-2">
              <div className="space-y-0.5">
                {CHAIN_LIST_STANDARD.map((chain) => {
                  const isGateway = GATEWAY_SUPPORTED_CHAIN_IDS.includes(chain.id as GatewayChainId)
                  const balance = isGateway ? balanceByChain.get(GATEWAY_CHAIN_BY_ID[chain.id as GatewayChainId]) : undefined
                  const confirmed = balance ? Number(balance.confirmedBalance) : 0
                  const pending = balance ? Number(balance.pendingBalance) : 0
                  const pct = gatewayBalances.totalConfirmed > 0 ? (confirmed / gatewayBalances.totalConfirmed) * 100 : 0
                  return (
                    <div
                      key={chain.id}
                      className="flex items-center justify-between p-5 rounded-2xl cursor-default hover:bg-white/[0.03] transition-premium"
                    >
                      <div className="flex items-center gap-4">
                        <chain.Icon className="w-11 h-11" />
                        <div>
                          <p className="font-bold tracking-tight">{chain.name}</p>
                          <p className="text-label-caps text-on-surface-variant/40 text-[10px] tracking-[0.1em]">
                            {chain.layer.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {!isGateway ? (
                          <p className="font-mono-data text-[13px] text-on-surface-variant/40">Not yet tracked</p>
                        ) : gatewayBalances.isLoading && !gatewayBalances.hasLoadedOnce ? (
                          <SkeletonBlock className="h-4 w-16 ml-auto" />
                        ) : (
                          <>
                            <p className="font-mono-data text-[15px] tabular-nums">${confirmed.toFixed(2)}</p>
                            <p className="text-body-sm text-on-surface-variant/50 font-mono-data">
                              {pending > 0 ? `+$${pending.toFixed(2)} pending` : `${pct.toFixed(1)}%`}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="glass rounded-[28px] p-6 border-l-[3px] border-l-tertiary">
            <div className="flex gap-4">
              <div className="icon-well bg-tertiary/10 border-tertiary/15 text-tertiary h-fit shrink-0">
                <span className="material-symbols-outlined text-[20px]">insights</span>
              </div>
              <div>
                <h4 className="font-semibold tracking-tight mb-1.5">No insights yet</h4>
                <p className="text-body-sm text-on-surface-variant/70 leading-relaxed">
                  Yield and rebalancing suggestions will appear here once activity is detected.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UnifiedBalance() {
  return (
    <RequireWallet noun="your unified balance">
      <UnifiedBalanceScreen />
    </RequireWallet>
  )
}
