import { collection, limit, onSnapshot, orderBy, query, Timestamp, type DocumentData } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../config/firebase'

export interface AlertEvent {
  id: string
  ruleId: string
  ruleType: string
  message: string
  chain?: string
  value?: number
  threshold?: number
  timestamp: Date | null
}

function toEvent(id: string, data: DocumentData): AlertEvent {
  return {
    id,
    ruleId: data.ruleId,
    ruleType: data.ruleType,
    message: data.message,
    chain: data.chain,
    value: data.value,
    threshold: data.threshold,
    timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : null,
  }
}

/**
 * Real triggered-alert history — written ONLY by the server-side evaluator
 * (api/_lib/alertsEvaluator.js, via Firebase Admin), never by the client. This hook is read-only:
 * there's no client write path for this collection, by design, so a triggered alert always means
 * the condition was actually checked against live chain state, not something the browser guessed.
 */
export function useAlertEvents(walletAddress: string | undefined) {
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!walletAddress) {
      setEvents([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const lowerAddress = walletAddress.toLowerCase()
    const q = query(collection(db, 'users', lowerAddress, 'alertEvents'), orderBy('timestamp', 'desc'), limit(50))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setEvents(snapshot.docs.map((d) => toEvent(d.id, d.data())))
        setIsLoading(false)
      },
      (err) => {
        console.error('[useAlertEvents] onSnapshot error:', err)
        setIsLoading(false)
      },
    )
    return unsubscribe
  }, [walletAddress])

  return { events, isLoading }
}
