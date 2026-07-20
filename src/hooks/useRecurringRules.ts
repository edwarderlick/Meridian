import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../config/firebase'
import { nextDueDate, type Frequency } from '../lib/recurringSchedule'

/** 'transfer' is the original kind (send USDC to a recipient); 'pool_deposit' reuses the exact
 *  same schedule/due-date machinery to instead deposit into Meridian's own ArcYieldPool contract —
 *  see ArcYieldPoolPanel.tsx for the one-off version of the same action. */
export type RecurringRuleKind = 'transfer' | 'pool_deposit'

export interface RecurringRule {
  id: string
  /** Defaults to 'transfer' for any rule created before this field existed. */
  kind: RecurringRuleKind
  /** Required for 'transfer'; absent for 'pool_deposit', which has no recipient. */
  recipient?: string
  amount: string
  chainId: number
  /** Required for 'pool_deposit' (which strategy to deposit into); absent for 'transfer'. */
  strategyId?: 0 | 1 | 2
  frequency: Frequency
  nextDueAt: Date | null
  lastExecutedAt: Date | null
  active: boolean
  createdAt: Date | null
}

function toRule(id: string, data: DocumentData): RecurringRule {
  return {
    id,
    kind: (data.kind as RecurringRuleKind) ?? 'transfer',
    recipient: data.recipient,
    amount: data.amount,
    chainId: data.chainId,
    strategyId: data.strategyId,
    frequency: data.frequency,
    nextDueAt: data.nextDueAt instanceof Timestamp ? data.nextDueAt.toDate() : null,
    lastExecutedAt: data.lastExecutedAt instanceof Timestamp ? data.lastExecutedAt.toDate() : null,
    active: data.active,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
  }
}

/**
 * Real, persisted recurring-payment rules. Execution is deliberately NOT automatic: Meridian holds
 * no signing key and no user-granted allowance to move funds on its own (that would require a
 * relayer/allowance architecture — a real custody-adjacent decision, not something to build
 * silently alongside this). A rule becoming due is real (computed from a real persisted
 * `nextDueAt`, checked both live here and by the server cron for the "Payment Due" alert), but
 * actually executing it always goes through the user's own connected wallet, reusing Transfer's
 * real send path — see RecurringPayments.tsx's `handleExecute`.
 */
export function useRecurringRules(walletAddress: string | undefined) {
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!walletAddress) {
      setRules([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const lowerAddress = walletAddress.toLowerCase()
    const q = query(collection(db, 'users', lowerAddress, 'recurringRules'), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setRules(snapshot.docs.map((d) => toRule(d.id, d.data())))
        setIsLoading(false)
      },
      (err) => {
        console.error('[useRecurringRules] onSnapshot error:', err)
        setIsLoading(false)
      },
    )
    return unsubscribe
  }, [walletAddress])

  return { rules, isLoading }
}

export async function createRecurringRule(
  walletAddress: string,
  data:
    | { kind: 'transfer'; recipient: string; amount: string; chainId: number; frequency: Frequency }
    | { kind: 'pool_deposit'; amount: string; chainId: number; strategyId: 0 | 1 | 2; frequency: Frequency },
) {
  await addDoc(collection(db, 'users', walletAddress.toLowerCase(), 'recurringRules'), {
    ...data,
    active: true,
    nextDueAt: Timestamp.fromDate(nextDueDate(new Date(), data.frequency)),
    lastExecutedAt: null,
    createdAt: serverTimestamp(),
  })
}

export async function setRecurringRuleActive(walletAddress: string, ruleId: string, active: boolean) {
  await updateDoc(doc(db, 'users', walletAddress.toLowerCase(), 'recurringRules', ruleId), { active })
}

export async function deleteRecurringRule(walletAddress: string, ruleId: string) {
  await deleteDoc(doc(db, 'users', walletAddress.toLowerCase(), 'recurringRules', ruleId))
}

/** Called after a real on-chain execution succeeds — advances the schedule from the moment it was
 *  actually paid, not from when it was originally due, so a late execution doesn't immediately
 *  re-trigger as due again a moment later. */
export async function markRecurringRuleExecuted(walletAddress: string, ruleId: string, frequency: Frequency) {
  const now = new Date()
  await updateDoc(doc(db, 'users', walletAddress.toLowerCase(), 'recurringRules', ruleId), {
    lastExecutedAt: Timestamp.fromDate(now),
    nextDueAt: Timestamp.fromDate(nextDueDate(now, frequency)),
  })
}
