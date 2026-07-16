// Shared firebase-admin bootstrap — server-side only. FIREBASE_SERVICE_ACCOUNT_KEY holds the
// full service account JSON as a single-line string (never VITE_-prefixed, never sent to the
// client). Initialization is lazy (only on first use) so a missing/invalid key only breaks the
// auth endpoints that actually need it, not every serverless function that happens to bundle
// this module.

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

let app

function getAdminApp() {
  if (app) return app
  if (getApps().length > 0) {
    app = getApps()[0]
    return app
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw) {
    const message =
      'FIREBASE_SERVICE_ACCOUNT_KEY is not configured on the server. Generate one from ' +
      'Firebase Console > Project Settings > Service Accounts > Generate New Private Key, ' +
      'and set its full JSON contents (as a single-line string) in that env var.'
    console.error('[firebaseAdmin] ' + message)
    throw new Error(message)
  }

  let serviceAccount
  try {
    serviceAccount = JSON.parse(raw)
  } catch (err) {
    // Doesn't log `raw` itself — it's the key material, even though it failed to parse.
    console.error(
      '[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON:',
      err instanceof Error ? err.message : String(err),
      `(length=${raw.length}) — a common cause is pasting the downloaded JSON file's` +
        ' multi-line formatting directly into .env instead of collapsing it to one line first.',
    )
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.')
  }

  app = initializeApp({ credential: cert(serviceAccount) })
  // project_id/client_email aren't secret — they're already visible in the Firebase console URL
  // and the service account's public identity. Confirms init succeeded without logging the key.
  console.log(
    `[firebaseAdmin] Initialized successfully for project "${serviceAccount.project_id}" ` +
      `(${serviceAccount.client_email})`,
  )
  return app
}

export function getAdminAuth() {
  return getAuth(getAdminApp())
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp())
}
