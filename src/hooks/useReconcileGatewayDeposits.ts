import { useEffect, useRef } from 'react'
import { appendGatewayDepositEvent } from '../lib/activityLogWrites'
import type { ActivityLogEntry } from './useActivityLog'

/**
 * Reconciles Firestore's persisted 'pending' Gateway deposit docs against Gateway's own live
 * pending-transaction data. deposit() itself only waits for 1 on-chain confirmation (see
 * GatewayDepositSnapshot's docblock) — it has no way to tell the caller when a deposit actually
 * finalizes, so this is the only signal available: once a deposit's tx hash drops out of
 * getBalances(..., includePending: true)'s pending set (polled every 20s by useGatewayBalances),
 * Gateway has finalized it. Appends a 'finalized' follow-up doc at that point, continuing the same
 * depositId/sequence chain — never mutates the original 'pending' doc.
 */
export function useReconcileGatewayDeposits(
  walletAddress: string | undefined,
  depositEntries: ActivityLogEntry[],
  pendingTxHashes: Set<string>,
  hasLoadedOnce: boolean,
) {
  // Guards against re-appending a 'finalized' doc for the same depositId on every poll tick before
  // Firestore's own onSnapshot has had a chance to reflect the just-written doc back into
  // depositEntries (which is what would otherwise naturally stop this loop).
  const reconciledRef = useRef(new Set<string>())

  useEffect(() => {
    if (!walletAddress || !hasLoadedOnce) return

    const pendingDeposits = depositEntries.filter(
      (entry): entry is ActivityLogEntry & { depositId: string; txHash: string } =>
        entry.status === 'pending' && Boolean(entry.depositId) && Boolean(entry.txHash),
    )

    for (const entry of pendingDeposits) {
      if (reconciledRef.current.has(entry.depositId)) continue
      if (pendingTxHashes.has(entry.txHash)) continue

      reconciledRef.current.add(entry.depositId)
      void appendGatewayDepositEvent(walletAddress, {
        depositId: entry.depositId,
        sequence: (entry.sequence ?? 0) + 1,
        status: 'finalized',
        amount: String(entry.amount ?? '0'),
        token: entry.token ?? 'USDC',
        chain: entry.chain,
        depositedBy: entry.depositedBy ?? '',
        depositedTo: entry.depositedTo ?? '',
        txHash: entry.txHash,
      }).catch((err) => {
        console.error('[useReconcileGatewayDeposits] failed to persist finalized deposit:', err)
        reconciledRef.current.delete(entry.depositId)
      })
    }
  }, [walletAddress, depositEntries, pendingTxHashes, hasLoadedOnce])
}
