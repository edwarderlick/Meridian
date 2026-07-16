import { BridgeKit, type BridgeResult } from '@circle-fin/bridge-kit'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { CHAIN_LIST, CHAINS, type ChainId, type NonEvmEcosystem } from '../../assets/chains'
import AuthStatusBanner from '../../components/console/AuthStatusBanner'
import { RequireWallet } from '../../components/console/ConnectWalletGate'
import Dropdown from '../../components/console/Dropdown'
import FieldError from '../../components/console/FieldError'
import MaxButton from '../../components/console/MaxButton'
import ReviewModal from '../../components/console/ReviewModal'
import { BRIDGE_CHAIN_BY_ID, isBridgeableChain, type BridgeableChainId } from '../../config/bridgeChains'
import { useSolanaWallet } from '../../context/SolanaWalletContext'
import { useSuiWallet } from '../../context/SuiWalletContext'
import { useWalletAuthContext } from '../../context/WalletAuthContext'
import { useActivityLog, type ActivityLogEntry } from '../../hooks/useActivityLog'
import { useEvmAdapter } from '../../hooks/useEvmAdapter'
import { useEvmChainSwitch } from '../../hooks/useEvmChainSwitch'
import { useSolanaAdapter } from '../../hooks/useSolanaAdapter'
import { fetchSolanaSolBalance, useSolanaTokenBalance } from '../../hooks/useSolanaTokenBalance'
import { useTokenBalance } from '../../hooks/useTokenBalance'
import { usdcBalanceQueryKey } from '../../hooks/useUsdcBalances'
import { appendBridgeEvent, type BridgeSnapshot } from '../../lib/activityLogWrites'
import { IDLE_STEPS, normalizeStepName, STEP_META, stepsFromResult, type StepBucket, type StepDisplay } from '../../lib/bridgeSteps'
import { amountError } from '../../lib/validation'

/** One kit instance for the app — it's stateless aside from event subscriptions, which are added/removed per bridge attempt. */
const kit = new BridgeKit()

/**
 * Maps this app's display-bucket labels back to the exact step-name vocabulary
 * @circle-fin/provider-cctp-v2 requires (CCTPv2StepName: approve/burn/fetchAttestation/mint/reAttest).
 * Needed only to read back Firestore docs written before real step names were persisted (see
 * persistLiveSnapshot) — 'attest' defaults to 'fetchAttestation' since the legacy shape couldn't
 * distinguish it from 'reAttest'. Names already in the real vocabulary pass through unchanged.
 */
const LEGACY_STEP_NAME_MAP: Record<string, string> = { approve: 'approve', burn: 'burn', attest: 'fetchAttestation', mint: 'mint' }
function toProviderStepName(name: string): string {
  return LEGACY_STEP_NAME_MAP[name.toLowerCase()] ?? name
}

const CHAIN_OPTIONS = CHAIN_LIST.map((c) => ({
  value: c.id,
  label: c.name,
  sublabel: c.layer,
  icon: <c.Icon className="w-6 h-6 shrink-0" />,
  groupLabel: c.isNonEvm ? 'Other Ecosystems' : undefined,
}))

function BridgeForm() {
  const {
    connected: solanaConnected,
    connect: connectSolana,
    address: solanaAddress,
    walletName: solanaWalletName,
  } = useSolanaWallet()
  const { connected: suiConnected, connect: connectSui } = useSuiWallet()
  const { isOnChain, ensureChain, isPending: switchPending } = useEvmChainSwitch()
  const { address: walletAddress } = useAccount()
  const { isAuthenticated } = useWalletAuthContext()
  const { adapter: evmAdapter, error: evmAdapterError } = useEvmAdapter()
  const solanaAdapter = useSolanaAdapter()
  const queryClient = useQueryClient()

  const [fromId, setFromId] = useState<ChainId>('ethereum')
  const [toId, setToId] = useState<ChainId>('arc')
  const [amount, setAmount] = useState('')
  const [touched, setTouched] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [bridging, setBridging] = useState(false)
  const [bridgeError, setBridgeError] = useState<string | null>(null)
  const [steps, setSteps] = useState<Record<StepBucket, StepDisplay>>(IDLE_STEPS)
  const [completedResult, setCompletedResult] = useState<BridgeResult | null>(null)
  /** Append-only bookkeeping: shared id + incrementing sequence for every doc in one bridge attempt. */
  const bridgeIdRef = useRef<string | null>(null)
  const sequenceRef = useRef(0)
  /** Real provider step name -> step data, in first-reached order. This is what actually gets
   *  persisted (see persistLiveSnapshot) — it must use the SDK's own vocabulary so kit.retry()'s
   *  rule engine can recognize the last-reached step on resume. */
  const rawStepsRef = useRef<Map<string, BridgeResult['steps'][number]>>(new Map())
  /** Synchronous guard against double-submission (e.g. a rapid double-click landing both events
   *  before React re-renders the disabled button) — checked before any state update or await. */
  const submittingRef = useRef(false)

  const from = CHAINS[fromId]
  const to = CHAINS[toId]

  const fromBalance = useTokenBalance(from.evmChainId ?? 0)
  const fromSolanaBalance = useSolanaTokenBalance()
  const availableBalance =
    from.evmChainId !== undefined
      ? Number(fromBalance.formatted)
      : fromId === 'solana'
        ? Number(fromSolanaBalance.formatted)
        : 0
  const amountMsg = useMemo(() => amountError(amount, availableBalance), [amount, availableBalance])
  const sameChain = fromId === toId
  // Covers EVM<->EVM and EVM<->Solana — isBridgeableChain already excludes Sui (no Circle Bridge
  // Kit adapter exists for it) since 'sui' was never added to BRIDGE_CHAIN_BY_ID.
  const canBridge = isBridgeableChain(fromId) && isBridgeableChain(toId)
  // Solflare's Wallet Standard raw-signing path re-derives the burn transaction's account-key
  // ordering rather than signing the literal bytes handed to it (confirmed by diffing sent vs.
  // returned message bytes — see signRawTransactionsViaWalletStandard's docblock in
  // useSolanaAdapter.ts), which breaks the fee-payer signature for any Solana-source burn. Phantom
  // doesn't have this issue. Flagged here rather than left to surface as a generic simulation error.
  const solflareSourceIssue = fromId === 'solana' && solanaConnected && solanaWalletName === 'Solflare'

  const { entries: bridgeEntries } = useActivityLog(isAuthenticated ? walletAddress : undefined, ['bridge'])
  const pendingBridges = bridgeEntries.filter((entry) => entry.status === 'pending_attestation')

  const ECOSYSTEM_CONNECT: Record<NonEvmEcosystem, { label: string; connected: boolean; connect: () => void }> = {
    solana: { label: 'Solana', connected: solanaConnected, connect: connectSolana },
    sui: { label: 'Sui', connected: suiConnected, connect: connectSui },
  }
  const requiredEcosystems = Array.from(
    new Set([from.nonEvmEcosystem, to.nonEvmEcosystem].filter((e): e is NonEvmEcosystem => Boolean(e))),
  )
  const missingEcosystems = requiredEcosystems.filter((eco) => !ECOSYSTEM_CONNECT[eco].connected)
  const needsWalletConnect = missingEcosystems.length > 0
  const needsChainSwitch = from.evmChainId !== undefined && !isOnChain(from.evmChainId)
  // Bridge's Firestore writes aren't just cosmetic history — they're the crash-recovery record
  // for an in-flight burn->mint, so submission requires a real Firebase session up front rather
  // than risking a bridge that starts moving funds with no way to persist its progress.
  const isValid = !amountMsg && !sameChain && !needsWalletConnect && !needsChainSwitch && canBridge && isAuthenticated

  const selectFromChain = (id: ChainId) => {
    // Guards the Resume path specifically — a fresh bridge already keeps the review modal open
    // (and thus the page behind it unreachable) for the whole async operation, but Resume has no
    // modal, so without this a chain switch mid-resume would change what's shown here while an
    // unrelated bridge is still actually in flight.
    if (bridging) return
    setFromId(id)
    const target = CHAINS[id]
    if (target.evmChainId !== undefined) ensureChain(target.evmChainId)
  }

  /** The address that will actually sign/receive on a given leg — the EVM wallet for every
   *  chain except Solana, which has its own separate connected address. */
  const addressForChain = (chainId: ChainId): string | undefined => (chainId === 'solana' ? solanaAddress : walletAddress)

  /**
   * A bridge moves funds on two chains, minutes apart (burn on the source, mint on the
   * destination) — so each leg's balance is refetched independently as soon as that leg's step
   * actually succeeds, rather than waiting for one "refetch everything" at the very end.
   * `fromBalance`/`fromSolanaBalance` are the hook instances actually rendered on this page (the
   * "From Chain" panel), so a source-side refetch always updates what's on screen immediately.
   * A destination-side refetch has nothing on this page to update directly (no "To Chain" balance
   * is shown), so it invalidates the shared useUsdcBalances cache instead — Overview/Unified
   * Balance pick up the fresh value as soon as they're next viewed.
   */
  const refetchChainBalance = (chainId: ChainId) => {
    if (chainId === 'solana') {
      void fromSolanaBalance.refetch()
      return
    }
    const evmChainId = CHAINS[chainId].evmChainId
    if (evmChainId === undefined) return
    if (chainId === fromId) void fromBalance.refetch()
    void queryClient.invalidateQueries({ queryKey: usdcBalanceQueryKey(evmChainId, addressForChain(chainId)) })
  }

  /** Resume's persisted BridgeResult carries Bridge Kit's own chain definitions rather than this
   *  app's ChainId, since it's reconstructed straight from Firestore — maps back via the same
   *  numeric chainId every BRIDGE_CHAIN_BY_ID entry carries, so refetchChainBalance can be reused. */
  const chainIdFromBridgeChain = (chain: { type: string; chainId?: number }): ChainId | undefined => {
    if (chain.type === 'solana') return 'solana'
    return (Object.keys(BRIDGE_CHAIN_BY_ID) as BridgeableChainId[]).find(
      (id) => BRIDGE_CHAIN_BY_ID[id].type === 'evm' && BRIDGE_CHAIN_BY_ID[id].chainId === chain.chainId,
    )
  }

  const swapDirection = () => {
    if (bridging) return
    const nextFromId = toId
    setFromId(nextFromId)
    setToId(fromId)
    const target = CHAINS[nextFromId]
    if (target.evmChainId !== undefined) ensureChain(target.evmChainId)
  }

  /**
   * Builds a Firestore-safe snapshot from current UI step state and appends it as a brand-new
   * document — never updates a previous one. Called on every live step event once the burn has
   * succeeded; all appended docs for this attempt share bridgeIdRef.current and an incrementing
   * sequence, so useActivityLog can collapse them back into a single logical row.
   */
  const persistLiveSnapshot = (
    currentSteps: Record<StepBucket, StepDisplay>,
    justCompleted: StepBucket,
    sourceChainId: ChainId,
    destChainId: ChainId,
  ) => {
    if (!walletAddress || !isBridgeableChain(sourceChainId) || !isBridgeableChain(destChainId)) return

    if (justCompleted === 'burn' && currentSteps.burn.state === 'success' && !bridgeIdRef.current) {
      bridgeIdRef.current = crypto.randomUUID()
    }
    if (!bridgeIdRef.current) return

    // Derived from the step data in *this* snapshot, not just "we got an event" — otherwise a tab
    // closed/refreshed between the mint-success event and kit.bridge()'s promise resolving (which
    // is what normally writes the terminal status via appendFinalResult) leaves the doc stuck on
    // 'pending_attestation' forever, even though its own steps array already shows completion.
    const anyStepErrored = Object.values(currentSteps).some((s) => s.state === 'error')
    const status: BridgeSnapshot['status'] =
      currentSteps.mint.state === 'success' ? 'success' : anyStepErrored ? 'error' : 'pending_attestation'

    const snapshot: BridgeSnapshot = {
      bridgeId: bridgeIdRef.current,
      sequence: sequenceRef.current++,
      status,
      amount,
      token: 'USDC',
      provider: 'CCTPV2BridgingProvider',
      source: { address: addressForChain(sourceChainId) ?? walletAddress, chain: BRIDGE_CHAIN_BY_ID[sourceChainId] },
      destination: {
        address: addressForChain(destChainId) ?? walletAddress,
        chain: BRIDGE_CHAIN_BY_ID[destChainId],
        ...(destChainId === 'solana' && { useForwarder: true }),
      },
      // Only steps the SDK has actually reported an event for, using its own step names —
      // never synthesized from the UI's idle/bucket state (see rawStepsRef).
      steps: Array.from(rawStepsRef.current.values()),
    }

    void appendBridgeEvent(walletAddress, snapshot)
  }

  /** Appends the terminal event for a bridge attempt (success or error) — one more create, never an update. */
  const appendFinalResult = (walletAddress: string, bridgeId: string, result: BridgeResult) =>
    appendBridgeEvent(walletAddress, {
      bridgeId,
      sequence: sequenceRef.current++,
      status: result.state === 'success' ? 'success' : result.state === 'error' ? 'error' : 'pending_attestation',
      amount: result.amount,
      token: result.token,
      provider: result.provider,
      source: { address: result.source.address, chain: result.source.chain },
      destination: {
        address: result.destination.address,
        chain: result.destination.chain,
        ...(result.destination.useForwarder !== undefined && { useForwarder: result.destination.useForwarder }),
      },
      steps: result.steps,
    })

  const handleConfirm = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setBridgeError(null)
    setSteps(IDLE_STEPS)
    setCompletedResult(null)
    setBridging(true)
    bridgeIdRef.current = null
    sequenceRef.current = 0
    rawStepsRef.current = new Map()

    const sourceChainId = fromId
    const destChainId = toId

    const onEvent = (payload: unknown) => {
      const p = payload as {
        method?: string
        values?: {
          name?: string
          state?: string
          txHash?: string
          explorerUrl?: string
          errorMessage?: string
          errorCategory?: string
          error?: unknown
        }
      }
      const bucket = p?.method ? normalizeStepName(p.method) : null
      if (!bucket || !p.values) return
      // Log the full raw step object on failure — Firestore only ever showed errorMessage: null
      // for every real mint failure investigated, because neither this handler nor the persisted
      // snapshot captured it before now. This is the one thing to check in devtools on the next
      // failed attempt: it has whatever message/code/revert reason Bridge Kit actually attached.
      if (p.values.state === 'error') {
        console.error(`[Bridge] step "${p.values.name ?? p.method}" failed:`, p.values)
      }
      const realName = p.values.name ?? p.method!
      rawStepsRef.current.set(realName, {
        name: realName,
        state: (p.values.state as BridgeResult['steps'][number]['state']) ?? 'pending',
        txHash: p.values.txHash,
        explorerUrl: p.values.explorerUrl,
        errorMessage: p.values.errorMessage,
        errorCategory: p.values.errorCategory as BridgeResult['steps'][number]['errorCategory'],
      })
      setSteps((prev) => {
        const nextState = p.values!.state === 'noop' ? 'success' : (p.values!.state as StepDisplay['state'] | undefined)
        const next: Record<StepBucket, StepDisplay> = {
          ...prev,
          [bucket]: {
            state: nextState ?? 'pending',
            txHash: p.values!.txHash,
            explorerUrl: p.values!.explorerUrl,
            errorMessage: p.values!.errorMessage,
          },
        }
        persistLiveSnapshot(next, bucket, sourceChainId, destChainId)
        // Burn changes the source chain's balance the moment it lands, and mint (or forwarder
        // completion, which also reports through the 'mint' bucket) changes the destination's —
        // refetch each the instant its own step succeeds rather than one refetch at the very end.
        if (bucket === 'burn' && next.burn.state === 'success') refetchChainBalance(sourceChainId)
        if (bucket === 'mint' && next.mint.state === 'success') refetchChainBalance(destChainId)
        return next
      })
    }

    kit.on('*', onEvent)

    try {
      if (!walletAddress) throw new Error('Wallet not connected.')
      if (!isAuthenticated) throw new Error('Sign in with your wallet first — check the banner above.')
      if (!canBridge) {
        throw new Error(
          'This chain pair is not wired to real CCTP bridging yet — Circle has no Sui Bridge Kit adapter, so Sui is excluded.',
        )
      }
      const sourceIsSolana = sourceChainId === 'solana'
      const destIsSolana = destChainId === 'solana'
      if (!sourceIsSolana && from.evmChainId === undefined) throw new Error('Unsupported source chain.')
      if (!sourceIsSolana && !isOnChain(from.evmChainId!)) {
        throw new Error('Your wallet must be on the source chain to sign the burn — switch networks and try again.')
      }
      if (sourceIsSolana && !solanaConnected) throw new Error('Connect a Solana wallet to continue.')
      if (destIsSolana && !solanaConnected) throw new Error('Connect a Solana wallet to continue.')
      if (sourceIsSolana && solanaAddress) {
        // Burn needs real SOL regardless of the USDC amount — the base tx fee plus rent to fund
        // the ephemeral "message account" depositForBurn creates (~0.0039 SOL, see
        // fetchSolanaSolBalance). Checked here rather than left to fail at simulation, where
        // Solana's own rejection carries no logs and reads as an opaque, unhelpful error.
        const solBalance = await fetchSolanaSolBalance(solanaAddress)
        const MIN_SOL_FOR_BURN_FEES = 0.01
        if (solBalance < MIN_SOL_FOR_BURN_FEES) {
          throw new Error(
            `Insufficient SOL for network fees — your Solana wallet has ${solBalance.toFixed(4)} SOL, need at least ${MIN_SOL_FOR_BURN_FEES} SOL. Get Devnet SOL from a faucet (e.g. faucet.solana.com) and try again.`,
          )
        }
      }

      const fromAdapter = sourceIsSolana ? solanaAdapter : evmAdapter
      const toAdapter = destIsSolana ? solanaAdapter : evmAdapter
      if (!fromAdapter || !toAdapter) {
        throw new Error(evmAdapterError ?? 'Wallet adapter is not ready yet — try again in a moment.')
      }

      const sourceChain = BRIDGE_CHAIN_BY_ID[sourceChainId as BridgeableChainId]
      const destChain = BRIDGE_CHAIN_BY_ID[destChainId as BridgeableChainId]

      const result = await kit.bridge({
        from: { adapter: fromAdapter, chain: sourceChain },
        // Solana-as-destination routes through Circle's Orbit relayer instead of a client-side
        // mint: the adapter stays attached (BridgeDestination's documented `dest3` shape —
        // "adapter for tx confirmation") but the actual mint transaction is submitted and paid
        // for by the relayer, not by SolanaKitAdapter.executeTransaction(). This sidesteps the
        // Solana RPC call that was throwing RPC_ENDPOINT_ERROR at the client-side mint step. The
        // relay fee is deducted from the minted USDC at mint time (Circle's own documented
        // tradeoff for this mode) — the recipient receives slightly less than the burned amount.
        to: destIsSolana ? { adapter: toAdapter, chain: destChain, useForwarder: true } : { adapter: toAdapter, chain: destChain },
        amount,
        token: 'USDC',
      })

      setSteps(stepsFromResult(result))

      // Always leaves an audit record of the attempt, even if burn never reached success
      // (e.g. approve was rejected) and no live event ever allocated a bridgeId yet. Kept in
      // its own try/catch: a Firestore write failure here must never be reported as "the
      // bridge failed" when the on-chain result — the thing that actually moved funds — may
      // have genuinely succeeded.
      if (!bridgeIdRef.current) bridgeIdRef.current = crypto.randomUUID()
      try {
        await appendFinalResult(walletAddress, bridgeIdRef.current, result)
      } catch (logErr) {
        console.error('Failed to persist bridge result to Firestore:', logErr)
      }

      if (result.state !== 'success') {
        const failedStep = result.steps.find((step) => step.state === 'error')
        console.error('[Bridge] bridge did not complete successfully. Failed step:', failedStep, 'full result:', result)
        throw new Error('Bridge did not complete successfully — see step details below.')
      }

      setCompletedResult(result)
      setAmount('')
      setTouched(false)
      setReviewOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bridge failed.'
      const rejected = /user rejected|denied the transaction|user denied/i.test(message)
      setBridgeError(rejected ? 'Bridge cancelled — the wallet request was rejected.' : message)
      setReviewOpen(false)
    } finally {
      kit.off('*', onEvent)
      setBridging(false)
      submittingRef.current = false
    }
  }

  /**
   * Best-effort resume for a bridge left pending after a refresh/navigation. Reconstructs a
   * BridgeResult from the persisted Firestore doc and hands it to kit.retry() per Circle's
   * documented retry guide. kit.retry() itself decides whether continuing needs a fresh wallet
   * signature (isActionable step -> re-invokes the real executor, prompting the wallet) or is
   * purely resumable by polling (fetchAttestation/pending tx confirmation, no signature) — this
   * function's job is just to hand it an accurate BridgeResult, not to guess which case applies.
   */
  const handleResume = async (entry: ActivityLogEntry) => {
    if (!walletAddress || !entry.bridgeId || !isAuthenticated) return
    if (submittingRef.current) return
    submittingRef.current = true
    setBridgeError(null)
    setBridging(true)
    // Continue the same bridgeId's sequence rather than starting a new one, so this resume's
    // outcome is still one more append in the same append-only chain, not a fresh bridge record.
    bridgeIdRef.current = entry.bridgeId
    sequenceRef.current = (entry.sequence ?? 0) + 1
    try {
      // Normalize legacy docs (persisted with display-bucket names like 'Attest' instead of the
      // provider's real step names) and drop entries that were never actually reached — those
      // were defaulted from 'idle' to 'pending' with no txHash, so they're indistinguishable
      // from a real in-flight step except by the absence of a txHash/terminal state.
      const normalizedSteps = ((entry.steps ?? []) as BridgeResult['steps'])
        .filter((step) => step.state !== 'pending' || Boolean(step.txHash))
        .map((step) => ({ ...step, name: toProviderStepName(step.name) }))

      // Derived from the steps themselves rather than entry.status: a doc written before the
      // status-derivation fix in persistLiveSnapshot can have every step at 'success' (mint
      // included) while status is still frozen on 'pending_attestation' — kit.retry() only takes
      // its "already done" shortcut when state === 'success', so trusting the stale status field
      // here would send an already-completed bridge through retry() and hit the same throw.
      const mintStep = normalizedSteps.find((step) => step.name === 'mint')
      const anyErrored = normalizedSteps.some((step) => step.state === 'error')
      const state: BridgeResult['state'] = mintStep?.state === 'success' ? 'success' : anyErrored ? 'error' : 'pending'

      const reconstructed: BridgeResult = {
        amount: String(entry.amount ?? '0'),
        token: 'USDC',
        state,
        provider: entry.provider ?? 'CCTPV2BridgingProvider',
        source: entry.source as BridgeResult['source'],
        destination: entry.destination as BridgeResult['destination'],
        steps: normalizedSteps,
      }

      // Resume can involve either ecosystem depending on which chain this bridgeId actually used
      // — pick the adapter per side from the persisted chain data rather than assuming EVM.
      const resumeFromAdapter = reconstructed.source.chain.type === 'solana' ? solanaAdapter : evmAdapter
      const resumeToAdapter = reconstructed.destination.chain.type === 'solana' ? solanaAdapter : evmAdapter
      if (!resumeFromAdapter || !resumeToAdapter) {
        throw new Error(evmAdapterError ?? 'Wallet adapter is not ready yet — connect the right wallet and try again.')
      }

      const retried = await kit.retry(reconstructed, { from: resumeFromAdapter, to: resumeToAdapter })
      setSteps(stepsFromResult(retried))
      try {
        await appendFinalResult(walletAddress, entry.bridgeId, retried)
      } catch (logErr) {
        console.error('Failed to persist resumed bridge result to Firestore:', logErr)
      }

      if (retried.state === 'success') {
        setCompletedResult(retried)
        // Resume doesn't get the granular per-step burn/mint events handleConfirm's onEvent
        // relies on (kit.retry() isn't subscribed to kit.on('*', ...)) — refetch both legs now
        // that the whole thing is confirmed done.
        const resumedSourceChainId = chainIdFromBridgeChain(reconstructed.source.chain)
        const resumedDestChainId = chainIdFromBridgeChain(reconstructed.destination.chain)
        if (resumedSourceChainId) refetchChainBalance(resumedSourceChainId)
        if (resumedDestChainId) refetchChainBalance(resumedDestChainId)
      } else {
        throw new Error('Resume did not complete — see step details below.')
      }
    } catch (err) {
      setBridgeError(err instanceof Error ? err.message : 'Resume failed.')
    } finally {
      setBridging(false)
      submittingRef.current = false
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-gutter">
      <div className="page-header mb-2">
        <h2 className="page-title text-headline-xl">Asset Bridge</h2>
        <p className="page-subtitle">Cross-chain liquidity protocol for institutional vaults.</p>
      </div>

      <AuthStatusBanner />

      {completedResult && (
        <div className="banner-success animate-fade-in-up">
          <span className="material-symbols-outlined text-green-400 text-[20px] shrink-0">check_circle</span>
          <p className="text-body-sm text-green-400 font-medium">Bridge completed — funds minted on {to.name}.</p>
        </div>
      )}

      {bridgeError && (
        <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-error/20 bg-error/5 animate-fade-in-up">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
          <p className="text-body-sm text-error font-medium">{bridgeError}</p>
        </div>
      )}

      {solflareSourceIssue && (
        <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border-tertiary/20 bg-tertiary/5 animate-fade-in-up">
          <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">warning</span>
          <p className="text-body-sm text-tertiary font-medium">
            Solflare has a known compatibility issue with Solana-source bridging — Phantom is recommended for this
            route.
          </p>
        </div>
      )}

      {pendingBridges.length > 0 && (
        <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0 animate-spin">
              progress_activity
            </span>
            <p className="text-body-sm text-tertiary font-medium">
              {pendingBridges.length} bridge{pendingBridges.length > 1 ? 's' : ''} still in progress from a previous
              session.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleResume(pendingBridges[0])}
            disabled={bridging}
            className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Resume
          </button>
        </div>
      )}

      <div className="space-y-2 relative">
        <div className="glass-premium p-8 rounded-2xl relative z-10">
          <div className="flex justify-between items-center mb-6">
            <span className="field-label">From Chain</span>
            <span className="font-mono-data text-xs data-muted">Balance: {availableBalance.toFixed(2)} USDC</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <Dropdown
              value={fromId}
              onChange={(v) => selectFromChain(v as ChainId)}
              options={CHAIN_OPTIONS}
              ariaLabel="Select source chain"
              triggerClassName="flex items-center gap-4 rounded-xl px-2 py-1 -ml-2 transition-premium hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
              renderTrigger={() => (
                <>
                  <from.Icon className="w-12 h-12" />
                  <div className="text-left">
                    <div className="font-headline-lg text-headline-lg font-bold text-on-surface leading-tight tracking-tight flex items-center gap-1.5">
                      {from.shortLabel}
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant/50">
                        expand_more
                      </span>
                    </div>
                    <div className="text-on-surface-variant/65 text-sm mt-0.5">{from.layer}</div>
                  </div>
                </>
              )}
            />
            <div className="text-right">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => setTouched(true)}
                inputMode="decimal"
                className="input-amount text-right font-mono-data text-4xl font-bold"
                placeholder="0.00"
                type="text"
              />
              <div className="flex justify-end mt-1">
                <MaxButton onClick={() => setAmount(String(availableBalance))} />
              </div>
            </div>
          </div>
          {touched && <FieldError message={amountMsg} />}
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-20">
          <button
            type="button"
            onClick={swapDirection}
            aria-label="Swap source and destination chains"
            className="form-connector-btn !border-background !w-12 !h-12 hover:scale-110"
          >
            <span className="material-symbols-outlined group-hover:rotate-180 transition-transform duration-500">
              expand_more
            </span>
          </button>
        </div>

        <div className="glass-premium p-8 rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <span className="field-label">To Chain</span>
            <span className="font-mono-data text-xs data-muted">
              Receive Address:{' '}
              {(() => {
                const receiveAddress = addressForChain(toId)
                return receiveAddress ? `${receiveAddress.slice(0, 6)}…${receiveAddress.slice(-4)}` : 'Not set'
              })()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <Dropdown
              value={toId}
              onChange={(v) => {
                if (bridging) return
                setToId(v as ChainId)
              }}
              options={CHAIN_OPTIONS}
              ariaLabel="Select destination chain"
              triggerClassName="flex items-center gap-4 rounded-xl px-2 py-1 -ml-2 transition-premium hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45"
              renderTrigger={() => (
                <>
                  <to.Icon className="w-12 h-12" />
                  <div className="text-left">
                    <div className="font-headline-lg text-headline-lg font-bold text-on-surface leading-tight tracking-tight flex items-center gap-1.5">
                      {to.shortLabel}
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant/50">
                        expand_more
                      </span>
                    </div>
                    <div className="text-on-surface-variant/65 text-sm mt-0.5">{to.layer}</div>
                  </div>
                </>
              )}
            />
            <div className="text-right">
              <div className="font-mono-data text-4xl font-bold text-on-surface/30 leading-tight tabular-nums tracking-tight">
                {amount || '0.00'}
              </div>
              <div className="text-on-surface-variant/50 text-sm mt-1">Fee: —</div>
            </div>
          </div>
          {sameChain && <FieldError message="Source and destination chains must be different" />}
          {!sameChain && !canBridge && (
            <FieldError message="Sui isn't wired to real CCTP bridging — Circle has no Bridge Kit adapter for it yet. Pick EVM chains and/or Solana." />
          )}
        </div>

        {needsChainSwitch && (
          <div className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">sync_alt</span>
              <p className="text-body-sm text-tertiary font-medium">
                Your wallet is on a different network — switch to {from.shortLabel} to continue
              </p>
            </div>
            <button
              type="button"
              onClick={() => from.evmChainId !== undefined && ensureChain(from.evmChainId)}
              disabled={switchPending}
              className="btn-secondary px-4 py-2 text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {switchPending ? 'Switching…' : `Switch to ${from.shortLabel}`}
            </button>
          </div>
        )}

        {needsWalletConnect ? (
          <div className="space-y-2">
            {missingEcosystems.map((eco) => (
              <div
                key={eco}
                className="glass rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-tertiary/20 bg-tertiary/5"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">
                    account_balance_wallet
                  </span>
                  <p className="text-body-sm text-tertiary font-medium">
                    Connect a {ECOSYSTEM_CONNECT[eco].label} wallet to continue
                  </p>
                </div>
                <button
                  type="button"
                  onClick={ECOSYSTEM_CONNECT[eco].connect}
                  className="btn-secondary px-4 py-2 text-sm shrink-0"
                >
                  Connect {ECOSYSTEM_CONNECT[eco].label} Wallet
                </button>
              </div>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setTouched(true)
              if (isValid) setReviewOpen(true)
            }}
            disabled={!isValid || bridging}
            className="btn-primary w-full h-16 rounded-2xl text-lg font-extrabold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {bridging ? 'Bridging…' : 'Initiate Cross-Chain Bridge'}
            <span className="material-symbols-outlined">trending_flat</span>
          </button>
        )}

        <div className="glass-premium rounded-2xl p-6">
          <div className="flex justify-between items-center mb-8">
            <h4 className="field-label tracking-[0.12em]">Bridge Protocol Sequence</h4>
          </div>
          <div className="relative">
            <div className="absolute top-5 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent z-0" />
            <div
              className="absolute top-5 left-8 h-px bg-gradient-to-r from-primary to-tertiary z-0 transition-all duration-700 ease-premium"
              style={{
                width: `calc((100% - 4rem) * ${STEP_META.filter(({ bucket }) => steps[bucket].state === 'success').length / (STEP_META.length - 1)})`,
              }}
            />
            <div className="grid grid-cols-4 relative z-10">
              {STEP_META.map(({ bucket, label, icon }) => {
                const step = steps[bucket]
                const colorClass =
                  step.state === 'success'
                    ? 'text-green-400 border-green-400/30 bg-green-400/10'
                    : step.state === 'error'
                      ? 'text-error border-error/30 bg-error/10'
                      : step.state === 'pending'
                        ? 'text-tertiary border-tertiary/30 bg-tertiary/10 animate-pulse'
                        : 'text-on-surface-variant/55 border-white/10'
                const displayIcon =
                  step.state === 'success' ? 'check_circle' : step.state === 'error' ? 'error' : icon
                return (
                  <div key={bucket} className="flex flex-col items-center gap-3">
                    <div className={`icon-well w-11 h-11 rounded-full border transition-premium ${colorClass}`}>
                      <span className="material-symbols-outlined text-lg">{displayIcon}</span>
                    </div>
                    <span className="font-mono-data text-xs font-bold text-on-surface-variant/60">{label}</span>
                    {step.explorerUrl ? (
                      <a
                        href={step.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-primary underline underline-offset-2"
                      >
                        View tx
                      </a>
                    ) : (
                      <p
                        className={`hidden sm:block text-[10px] text-center px-2 leading-relaxed ${step.state === 'error' && step.errorMessage ? 'text-error' : 'text-on-surface-variant/40'}`}
                        title={step.errorMessage}
                      >
                        {step.state === 'idle' ? '—' : step.state === 'error' && step.errorMessage ? step.errorMessage : step.state}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-gutter">
          {[
            { label: 'Slippage Tolerance', value: '0.1%', muted: false },
            { label: 'Route', value: canBridge ? 'CCTPv2' : 'Not selected', muted: !canBridge },
            { label: 'Est. Gas Cost', value: '—', muted: true },
          ].map((item) => (
            <div key={item.label} className="glass card-interactive rounded-xl p-4 flex flex-col gap-1.5">
              <span className="field-label !text-[10px]">{item.label}</span>
              <span
                className={`font-mono-data text-sm font-bold ${item.muted ? 'data-muted' : 'text-on-surface'}`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={() => void handleConfirm()}
        confirming={bridging}
        title="Review Bridge Transaction"
        confirmLabel="Confirm Bridge"
        rows={[
          { label: 'Amount', value: `${amount || '0.00'} USDC`, accent: true },
          { label: 'From', value: from.name },
          { label: 'To', value: to.name },
          { label: 'Provider', value: 'Circle CCTPv2' },
        ]}
      />
    </div>
  )
}

export default function Bridge() {
  return (
    <RequireWallet noun="your bridge activity">
      <BridgeForm />
    </RequireWallet>
  )
}
