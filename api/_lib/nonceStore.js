// Sign-in nonce storage, backed by Firestore (via firebase-admin) rather than an in-memory
// Map. The phase brief allowed either — Firestore was chosen because this backend also runs
// as Vercel serverless functions, where each invocation can land on a different, short-lived
// instance: a nonce created in one invocation may simply not exist in the process memory of
// the invocation that later verifies it. Firestore makes nonce issuance/consumption correct
// regardless of which instance handles which request, at negligible extra cost since
// firebase-admin is already initialized for custom-token minting.
//
// Stored at a top-level `authNonces/{lowercasedAddress}` collection — NOT under
// users/{address}/..., since this is server-only bookkeeping, not user-facing app data.
// The Firestore rules explicitly deny all client access to this collection (the Admin SDK
// bypasses rules entirely, so only this server code can ever read/write it).

import { getAdminFirestore } from './firebaseAdmin.js'
import { randomBytes } from 'node:crypto'

const NONCE_TTL_MS = 5 * 60 * 1000
const COLLECTION = 'authNonces'

export async function createNonce(address) {
  const db = getAdminFirestore()
  const nonce = randomBytes(32).toString('hex')
  const expiresAt = Date.now() + NONCE_TTL_MS
  await db.collection(COLLECTION).doc(address.toLowerCase()).set({ nonce, expiresAt })
  return nonce
}

/** Validates and single-use-consumes a nonce — always deletes it, whether valid or not, so a leaked/guessed value can't be retried. */
export async function consumeNonce(address, candidateNonce) {
  const db = getAdminFirestore()
  const ref = db.collection(COLLECTION).doc(address.toLowerCase())
  const snap = await ref.get()
  if (!snap.exists) return false

  const { nonce, expiresAt } = snap.data()
  await ref.delete()

  if (!nonce || nonce !== candidateNonce) return false
  if (typeof expiresAt !== 'number' || Date.now() > expiresAt) return false
  return true
}
