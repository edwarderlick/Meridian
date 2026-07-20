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

/**
 * Real, evaluable alert types only — 'Policy Violation' from the old UI mock is deliberately
 * absent: Policy.tsx has no real enforced rules yet (it's local `useState` same as this page used
 * to be), so there is nothing true to check a "violation" against. Adding it back is a matter of
 * Policy becoming real, not of this module needing more code.
 */
export type AlertRuleType = 'low_balance' | 'large_transfer' | 'yield_rate_drop' | 'pool_health_drop'

export interface AlertRule {
  id: string
  type: AlertRuleType
  threshold: number
  /** Required for low_balance/yield_rate_drop (which chain to check); absent for large_transfer
   *  (watches the activity log across every chain) and pool_health_drop (there's only one
   *  ArcYieldPool, on Arc Testnet). */
  chainId?: number
  enabled: boolean
  createdAt: Date | null
  lastTriggeredAt: Date | null
}

function toRule(id: string, data: DocumentData): AlertRule {
  return {
    id,
    type: data.type,
    threshold: data.threshold,
    chainId: data.chainId,
    enabled: data.enabled,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    lastTriggeredAt: data.lastTriggeredAt instanceof Timestamp ? data.lastTriggeredAt.toDate() : null,
  }
}

/** Real-time alert rule config for a wallet — read/write directly from the client (these are just
 *  thresholds/metadata, no signing involved), evaluated against live chain state server-side by
 *  the same cron job that also checks recurring-payment due dates (see api/_lib/alertsEvaluator.js). */
export function useAlertRules(walletAddress: string | undefined) {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!walletAddress) {
      setRules([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const lowerAddress = walletAddress.toLowerCase()
    const q = query(collection(db, 'users', lowerAddress, 'alertRules'), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setRules(snapshot.docs.map((d) => toRule(d.id, d.data())))
        setIsLoading(false)
      },
      (err) => {
        console.error('[useAlertRules] onSnapshot error:', err)
        setIsLoading(false)
      },
    )
    return unsubscribe
  }, [walletAddress])

  return { rules, isLoading }
}

export async function createAlertRule(
  walletAddress: string,
  data: { type: AlertRuleType; threshold: number; chainId?: number },
) {
  await addDoc(collection(db, 'users', walletAddress.toLowerCase(), 'alertRules'), {
    ...data,
    enabled: true,
    createdAt: serverTimestamp(),
    lastTriggeredAt: null,
  })
}

export async function setAlertRuleEnabled(walletAddress: string, ruleId: string, enabled: boolean) {
  await updateDoc(doc(db, 'users', walletAddress.toLowerCase(), 'alertRules', ruleId), { enabled })
}

export async function updateAlertRuleThreshold(walletAddress: string, ruleId: string, threshold: number) {
  await updateDoc(doc(db, 'users', walletAddress.toLowerCase(), 'alertRules', ruleId), { threshold })
}

export async function deleteAlertRule(walletAddress: string, ruleId: string) {
  await deleteDoc(doc(db, 'users', walletAddress.toLowerCase(), 'alertRules', ruleId))
}
