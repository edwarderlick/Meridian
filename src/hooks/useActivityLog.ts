import { collection, onSnapshot, orderBy, query, Timestamp, type DocumentData } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { ActivityItem } from '../components/console/ActivityFeed'
import { db } from '../config/firebase'

/**
 * Matches the activity log schema from the phase brief: users/{walletAddress}/transfers/{id},
 * distinguished by `type`. "swap" is included so Swap can adopt this hook once it's wired later.
 */
export type ActivityType = 'transfer' | 'bridge' | 'gateway_deposit' | 'gateway_withdraw' | 'swap' | 'aave_deposit' | 'aave_withdraw'

export interface ActivityLogEntry {
  id: string
  type: ActivityType
  // Bridge and Gateway both persist the SDK's own human-readable decimal string as-is (avoids float
  // precision loss); Transfer persists a plain number. ActivityItem.formatAmount already handles both.
  amount?: number | string
  token?: string
  fromChain?: string
  toChain?: string
  counterparty?: string
  label?: string
  /** Bridge-specific: lifecycle status for in-flight/completed bridges (e.g. 'pending_attestation', 'success', 'error'). */
  status?: string
  source?: { address: string; chain?: unknown }
  destination?: { address: string; chain?: unknown; useForwarder?: boolean }
  /** Bridge-specific: Bridge Kit provider name + sanitized step history, kept for resume/retry. */
  provider?: string
  steps?: { name: string; state: string; txHash?: string | null; explorerUrl?: string | null }[]
  /**
   * Bridge-specific: every document written during one bridge attempt shares a `bridgeId`
   * (append-only — each step transition is a new doc, never an update to a previous one).
   * `sequence` is monotonically increasing within a bridgeId; the highest `sequence` is the
   * current state. useActivityLog collapses same-bridgeId docs down to that one entry before
   * returning them, so consumers never see duplicate rows for a single bridge.
   */
  bridgeId?: string
  /** Gateway-deposit-specific: same append-only/collapse discipline as bridgeId, above — see
   *  GatewayDepositSnapshot's docblock in activityLogWrites.ts for why a deposit needs this at all. */
  depositId?: string
  sequence?: number
  /** Gateway-deposit-specific: the chain the deposit was made from. */
  chain?: unknown
  /** Gateway-specific: the deposit/spend transaction hash — used by useReconcileGatewayDeposits to
   *  match a persisted 'pending' deposit against Gateway's live pending-transaction data. */
  txHash?: string
  explorerUrl?: string
  depositedBy?: string
  depositedTo?: string
  errorMessage?: string
  /** Aave-specific: which real pool the deposit/withdrawal was against (e.g. "USDC Yield Vault (Aave V3)"). */
  poolName?: string
  timestamp: Date | null
}

const TYPE_LABELS: Record<ActivityType, string> = {
  transfer: 'Transfer',
  bridge: 'Bridge',
  gateway_deposit: 'Deposit',
  // Circle's SDK (and Gateway's own terminology) calls this "spend", not "withdraw" — the Firestore
  // `type: 'gateway_withdraw'` value is kept as-is (established schema), only the display label changes.
  gateway_withdraw: 'Spend',
  swap: 'Swap',
  aave_deposit: 'Aave Deposit',
  aave_withdraw: 'Aave Withdraw',
}

function toEntry(id: string, data: DocumentData): ActivityLogEntry {
  return {
    id,
    type: data.type,
    amount: data.amount,
    token: data.token,
    fromChain: data.fromChain,
    toChain: data.toChain,
    counterparty: data.counterparty,
    label: data.label,
    status: data.status,
    source: data.source,
    destination: data.destination,
    provider: data.provider,
    steps: data.steps,
    bridgeId: data.bridgeId,
    depositId: data.depositId,
    chain: data.chain,
    txHash: data.txHash,
    explorerUrl: data.explorerUrl,
    depositedBy: data.depositedBy,
    depositedTo: data.depositedTo,
    errorMessage: data.errorMessage,
    poolName: data.poolName,
    sequence: data.sequence,
    timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : null,
  }
}

function chainName(chain: unknown): string | undefined {
  return chain && typeof chain === 'object' && 'name' in chain ? String((chain as { name: unknown }).name) : undefined
}

/**
 * Collapses append-only multi-document activity types — bridge (grouped by `bridgeId`) and
 * Gateway deposit (grouped by `depositId`) — down to one entry each, the one with the highest
 * `sequence`, so N persisted state-transitions still render as a single row. Every other type
 * (transfer, gateway_withdraw, swap — all single-document writes) passes through untouched, as
 * does any stray grouped doc missing its group-id field.
 */
function collapseBridgeGroups(entries: ActivityLogEntry[]): ActivityLogEntry[] {
  const groups = new Map<string, ActivityLogEntry[]>()
  const passthrough: ActivityLogEntry[] = []

  for (const entry of entries) {
    const groupId = entry.type === 'bridge' ? entry.bridgeId : entry.type === 'gateway_deposit' ? entry.depositId : undefined
    if (groupId) {
      const group = groups.get(groupId)
      if (group) group.push(entry)
      else groups.set(groupId, [entry])
    } else {
      passthrough.push(entry)
    }
  }

  const collapsed = Array.from(groups.values(), (group) =>
    group.reduce((latest, candidate) => ((candidate.sequence ?? -1) > (latest.sequence ?? -1) ? candidate : latest)),
  )

  return [...passthrough, ...collapsed].sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0))
}

const STATUS_LABELS: Record<string, string> = {
  pending_attestation: 'Pending',
  success: 'Success',
  error: 'Failed',
  pending: 'Pending',
  finalized: 'Finalized',
}

/** Adapts a raw Firestore entry into the structured shape ActivityFeed renders each row from. */
export function toActivityItem(entry: ActivityLogEntry): ActivityItem {
  const label = entry.label ?? TYPE_LABELS[entry.type] ?? entry.type
  const fromChainName = entry.fromChain ?? chainName(entry.source?.chain) ?? chainName(entry.chain)
  const toChainName = entry.toChain ?? chainName(entry.destination?.chain)
  const route = fromChainName && toChainName ? `${fromChainName} → ${toChainName}` : fromChainName ?? toChainName
  return {
    id: entry.id,
    type: entry.type,
    label,
    amount: entry.amount,
    token: entry.token,
    counterparty: entry.counterparty,
    route,
    status: entry.status,
    statusLabel: entry.status ? (STATUS_LABELS[entry.status] ?? entry.status) : undefined,
    timestamp: entry.timestamp ? entry.timestamp.toLocaleString() : '—',
  }
}

/** Real-time activity log for a wallet, ordered newest-first. Pass `types` to filter (e.g. Bridge -> ['bridge']). */
export function useActivityLog(walletAddress: string | undefined, types?: ActivityType[]) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!walletAddress) {
      setEntries([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    // Lowercased: Firebase Auth's uid is always lowercase (see useWalletAuth), and Firestore
    // rules compare request.auth.uid against this exact path segment — a checksummed address
    // here would silently fail every rule check even though the code "looks" like it matches.
    const lowerAddress = walletAddress.toLowerCase()
    const path = `users/${lowerAddress}/transfers`

    const q = query(collection(db, 'users', lowerAddress, 'transfers'), orderBy('timestamp', 'desc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rawEntries = snapshot.docs.map((doc) => toEntry(doc.id, doc.data()))
        const collapsed = collapseBridgeGroups(rawEntries)
        setEntries(collapsed)
        setIsLoading(false)
      },
      (err) => {
        console.error(`[useActivityLog] onSnapshot ERROR for "${path}":`, err.code, err.message, err)
        setError(err)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [walletAddress])

  const filtered = types ? entries.filter((entry) => types.includes(entry.type)) : entries

  return { entries: filtered, isLoading, error }
}
