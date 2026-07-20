import type { BridgeResult } from '@circle-fin/bridge-kit'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'

type BridgeStepLike = BridgeResult['steps'][number]

/** Real Firestore write for a completed Transfer send — never called on rejection/failure.
 *  `recurringRuleId`, when present, traces this execution back to the Recurring Payments rule
 *  that produced it — RecurringPayments.tsx's Run History filters on it; every other consumer
 *  (Activity Feed, Spending Analytics) ignores it and treats this like any other real transfer. */
export async function logTransfer(
  walletAddress: string,
  data: {
    txHash: string
    amount: number
    token: string
    chain: string
    counterparty: string
    recurringRuleId?: string
    explorerUrl?: string
  },
) {
  // Lowercased — Firebase Auth's uid (see useWalletAuth) is always lowercase, and Firestore
  // rules compare request.auth.uid against this exact path segment.
  await addDoc(collection(db, 'users', walletAddress.toLowerCase(), 'transfers'), {
    type: 'transfer',
    ...data,
    timestamp: serverTimestamp(),
  })
}

/** Real Firestore write for a completed Swap — never called on rejection/failure. */
export async function logSwap(
  walletAddress: string,
  data: { txHash: string; amount: number; token: string; route: string; chain: string },
) {
  await addDoc(collection(db, 'users', walletAddress.toLowerCase(), 'transfers'), {
    type: 'swap',
    ...data,
    timestamp: serverTimestamp(),
  })
}

/** Firestore only stores JSON-safe values — drop the raw `error`/`data` blobs (may hold BigInt/Error objects). */
function sanitizeSteps(steps: BridgeStepLike[]) {
  return steps.map((step) => ({
    name: step.name,
    state: step.state,
    txHash: step.txHash ?? null,
    explorerUrl: step.explorerUrl ?? null,
    errorMessage: step.errorMessage ?? null,
    errorCategory: step.errorCategory ?? null,
  }))
}

export interface BridgeSnapshot {
  /** Shared by every document belonging to the same bridge attempt — lets readers regroup them. */
  bridgeId: string
  /** Monotonically increasing per bridgeId — the doc with the highest sequence is authoritative,
   *  independent of serverTimestamp() resolution order (which can race across rapid writes). */
  sequence: number
  status: 'pending_attestation' | 'success' | 'error'
  amount: string
  token: string
  provider: string
  source: { address: string; chain: unknown }
  // `useForwarder` must round-trip through persistence: kit.retry() reads it straight off the
  // resumed BridgeResult's `destination` (not from the adapter passed to retry()) to decide
  // whether the mint step uses Circle's relayer or the client-side adapter path. Dropping it here
  // would silently regress a resumed Solana-destination bridge back onto the client-side mint.
  destination: { address: string; chain: unknown; useForwarder?: boolean }
  steps: BridgeStepLike[]
}

/**
 * Append-only write: every call creates a brand-new document (addDoc) — never updates,
 * merges into, or overwrites a previous one. All documents for one bridge attempt share
 * `bridgeId`; useActivityLog collapses them back into a single logical entry (highest
 * `sequence`) for display. This is what makes a `create`-only, no-`update`/`delete`
 * Firestore rule viable for this activity log.
 */
export async function appendBridgeEvent(walletAddress: string, snapshot: BridgeSnapshot) {
  // Lowercased — see the matching comment in logTransfer() above.
  await addDoc(collection(db, 'users', walletAddress.toLowerCase(), 'transfers'), {
    type: 'bridge',
    ...snapshot,
    steps: sanitizeSteps(snapshot.steps),
    timestamp: serverTimestamp(),
  })
}

/**
 * A Gateway deposit's finality genuinely depends on source-chain finality — `deposit()` itself
 * only waits for 1 on-chain confirmation (confirmed by reading @circle-fin/provider-gateway-v1's
 * `executeAndWait`: `adapter.waitForTransaction(txHash, { confirmations: 1 }, chain)`), well before
 * Gateway's own backend treats the funds as finalized/spendable. So a deposit is naturally a
 * multi-state event over time (submitted -> pending -> finalized, possibly minutes apart on slower
 * chains) — same append-only shape as Bridge's burn->mint, not a single mutable document.
 */
export interface GatewayDepositSnapshot {
  /** Shared by every document belonging to the same deposit attempt — Bridge's `bridgeId`, renamed
   *  for this activity type so a reader never mistakes a deposit doc for a bridge one. */
  depositId: string
  /** Monotonically increasing per depositId — same "highest sequence wins" rule as Bridge. */
  sequence: number
  status: 'pending' | 'finalized' | 'error'
  amount: string
  token: string
  chain: unknown
  depositedBy: string
  depositedTo: string
  txHash: string
  explorerUrl?: string
  errorMessage?: string
}

/** Append-only write for a Gateway deposit — see GatewayDepositSnapshot's docblock for why this
 *  can't be a single mutable document. */
export async function appendGatewayDepositEvent(walletAddress: string, snapshot: GatewayDepositSnapshot) {
  await addDoc(collection(db, 'users', walletAddress.toLowerCase(), 'transfers'), {
    type: 'gateway_deposit',
    ...snapshot,
    timestamp: serverTimestamp(),
  })
}

/**
 * Aave supply/withdraw are each a single, fast, wallet-confirmed transaction on a chain the user
 * is already on — no multi-minute attestation wait like Bridge, so (like Transfer/Swap/Gateway
 * spend) a single document on real success is the whole record. The multi-minute, interruptible
 * part of a cross-chain Aave deposit is the bridge leg itself, which already gets Bridge's own
 * append-only `appendBridgeEvent` persistence and resume support — logged as a real `type: 'bridge'`
 * entry exactly as it would be from the Bridge page, not a bespoke Aave-specific shape.
 */
export async function logAaveDeposit(
  walletAddress: string,
  data: { txHash: string; amount: string; token: string; chain: string; poolName: string; explorerUrl?: string },
) {
  await addDoc(collection(db, 'users', walletAddress.toLowerCase(), 'transfers'), {
    type: 'aave_deposit',
    status: 'success',
    ...data,
    timestamp: serverTimestamp(),
  })
}

/** Real Firestore write for a completed Aave withdrawal — never called on rejection/failure. */
export async function logAaveWithdraw(
  walletAddress: string,
  data: { txHash: string; amount: string; token: string; chain: string; poolName: string; explorerUrl?: string },
) {
  await addDoc(collection(db, 'users', walletAddress.toLowerCase(), 'transfers'), {
    type: 'aave_withdraw',
    status: 'success',
    ...data,
    timestamp: serverTimestamp(),
  })
}

/**
 * Real Firestore write for a completed Uniswap V3 LP deposit (swap leg + mint). Records the exact
 * amount0/amount1 actually supplied — real numbers straight off the mint() transaction's own return
 * values, never estimated — so a later PnL comparison (current amounts vs. these) has a real cost
 * basis to compare against, in native token amounts rather than a fabricated USD figure (there's no
 * reliable USD price for testnet WETH, see Liquidity.tsx's disclosure).
 */
export async function logUniswapDeposit(
  walletAddress: string,
  data: {
    txHash: string
    chain: string
    poolName: string
    tokenId: string
    amount0: string
    amount1: string
    token0Symbol: string
    token1Symbol: string
    explorerUrl?: string
  },
) {
  await addDoc(collection(db, 'users', walletAddress.toLowerCase(), 'transfers'), {
    type: 'uniswap_deposit',
    status: 'success',
    ...data,
    timestamp: serverTimestamp(),
  })
}

/** Real Firestore write for a completed Uniswap V3 LP withdrawal (decreaseLiquidity + collect + burn). */
export async function logUniswapWithdraw(
  walletAddress: string,
  data: {
    txHash: string
    chain: string
    poolName: string
    tokenId: string
    amount0: string
    amount1: string
    token0Symbol: string
    token1Symbol: string
    explorerUrl?: string
  },
) {
  await addDoc(collection(db, 'users', walletAddress.toLowerCase(), 'transfers'), {
    type: 'uniswap_withdraw',
    status: 'success',
    ...data,
    timestamp: serverTimestamp(),
  })
}

/** Real Firestore write for a completed deposit into Meridian's own ArcYieldPool contract. */
export async function logArcPoolDeposit(
  walletAddress: string,
  data: { txHash: string; amount: string; token: string; chain: string; strategyLabel: string; explorerUrl?: string; recurringRuleId?: string },
) {
  await addDoc(collection(db, 'users', walletAddress.toLowerCase(), 'transfers'), {
    type: 'arc_pool_deposit',
    status: 'success',
    poolName: 'ArcYieldPool',
    ...data,
    timestamp: serverTimestamp(),
  })
}

/** Real Firestore write for a completed withdrawal from Meridian's own ArcYieldPool contract. */
export async function logArcPoolWithdraw(
  walletAddress: string,
  data: { txHash: string; amount: string; token: string; chain: string; strategyLabel: string; explorerUrl?: string },
) {
  await addDoc(collection(db, 'users', walletAddress.toLowerCase(), 'transfers'), {
    type: 'arc_pool_withdraw',
    status: 'success',
    poolName: 'ArcYieldPool',
    ...data,
    timestamp: serverTimestamp(),
  })
}

/**
 * A Gateway spend settles in under 500ms once the source funds are deposited — one on-chain mint,
 * no attestation wait, no multi-step lifecycle worth persisting incrementally. A single document on
 * real success is the whole record, matching the existing `gateway_withdraw` activity type.
 */
export async function logGatewayWithdraw(
  walletAddress: string,
  data: { txHash: string; amount: string; token: string; fromChain: string; toChain: string; explorerUrl?: string },
) {
  await addDoc(collection(db, 'users', walletAddress.toLowerCase(), 'transfers'), {
    type: 'gateway_withdraw',
    status: 'success',
    ...data,
    timestamp: serverTimestamp(),
  })
}
