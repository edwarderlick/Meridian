// Minimal, dependency-free rate limiting for the publicly-reachable auth endpoints
// (/api/auth/nonce, /api/auth/verify). Firestore-backed for the same reason nonceStore.js is —
// each serverless invocation can land on a different, short-lived instance, so an in-memory
// counter wouldn't actually limit anything across requests. Fixed-window (not sliding), which is
// intentionally simple: good enough to stop naive scripted abuse without adding a new external
// dependency (e.g. Upstash) that would need its own account/approval.
//
// Stored at rateLimits/{key} — same "server-only bookkeeping" collection shape as authNonces;
// the Firestore rules already deny all client access to non-users/{address} collections.

import { getAdminFirestore } from './firebaseAdmin.js'

const COLLECTION = 'rateLimits'

/**
 * Returns true if `key` is currently under its limit (and records this call towards it), false
 * if the limit is already exceeded for the current window.
 */
export async function checkRateLimit(key, { limit, windowMs }) {
  const db = getAdminFirestore()
  const ref = db.collection(COLLECTION).doc(key)
  const now = Date.now()

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.exists ? snap.data() : null

    if (!data || now > data.windowResetAt) {
      tx.set(ref, { count: 1, windowResetAt: now + windowMs })
      return true
    }

    if (data.count >= limit) return false

    tx.update(ref, { count: data.count + 1 })
    return true
  })
}

/** Best-effort client identifier for a Vercel/Express request — IP isn't authenticated, just a speed bump. */
export function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}
