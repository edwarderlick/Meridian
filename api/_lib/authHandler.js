// Shared SIWE-style auth handlers — used by both the Vercel serverless functions
// (api/auth/nonce.js, api/auth/verify.js) and the local Express dev server
// (server/dev-server.js), matching the existing api/_lib/circleHandler.js pattern.

import { verifyMessage } from 'viem'
import { getAdminAuth } from './firebaseAdmin.js'
import { consumeNonce, createNonce } from './nonceStore.js'
import { checkRateLimit, clientIp } from './rateLimit.js'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
// Generous enough for real retries (a user re-signing after rejecting the wallet prompt, a flaky
// network requiring a couple of attempts) while still stopping a naive scripted hammer.
const NONCE_RATE_LIMIT = 20
const VERIFY_RATE_LIMIT = 20

/**
 * KEEP THIS BYTE-FOR-BYTE IDENTICAL to buildSignInMessage() in src/hooks/useWalletAuth.ts —
 * the signature only verifies if both sides produce the exact same message string.
 */
function buildSignInMessage(nonce) {
  return `Sign in to Meridian Console\n\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any gas.`
}

export async function nonceHandler(req, res) {
  const address = req.body?.address
  console.log(`[auth/nonce] request received: method=${req.method} address=${address ?? '(none)'}`)

  if (req.method !== 'POST') {
    console.warn(`[auth/nonce] rejected: method ${req.method} not allowed`)
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (typeof address !== 'string' || !ADDRESS_RE.test(address)) {
    console.warn(`[auth/nonce] rejected: invalid address param: ${JSON.stringify(address)}`)
    res.status(400).json({ error: 'A valid 0x wallet address is required' })
    return
  }

  const ip = clientIp(req)
  const [ipOk, addressOk] = await Promise.all([
    checkRateLimit(`nonce:ip:${ip}`, { limit: NONCE_RATE_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS }),
    checkRateLimit(`nonce:addr:${address.toLowerCase()}`, { limit: NONCE_RATE_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS }),
  ])
  if (!ipOk || !addressOk) {
    console.warn(`[auth/nonce] rate limited: ip=${ip} address=${address}`)
    res.status(429).json({ error: 'Too many requests — try again in a few minutes.' })
    return
  }

  try {
    const nonce = await createNonce(address)
    console.log(`[auth/nonce] issued nonce for ${address}`)
    res.status(200).json({ nonce })
  } catch (error) {
    console.error(`[auth/nonce] failed to issue nonce for ${address}:`, error)
    res.status(500).json({ error: 'Failed to issue nonce', detail: error instanceof Error ? error.message : String(error) })
  }
}

export async function verifyHandler(req, res) {
  const { address, signature, nonce } = req.body ?? {}
  console.log(`[auth/verify] request received: method=${req.method} address=${address ?? '(none)'}`)

  if (req.method !== 'POST') {
    console.warn(`[auth/verify] rejected: method ${req.method} not allowed`)
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (typeof address !== 'string' || !ADDRESS_RE.test(address) || typeof signature !== 'string' || typeof nonce !== 'string') {
    console.warn('[auth/verify] rejected: missing/invalid address, signature, or nonce')
    res.status(400).json({ error: 'address, signature, and nonce are all required' })
    return
  }

  const ip = clientIp(req)
  const [ipOk, addressOk] = await Promise.all([
    checkRateLimit(`verify:ip:${ip}`, { limit: VERIFY_RATE_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS }),
    checkRateLimit(`verify:addr:${address.toLowerCase()}`, { limit: VERIFY_RATE_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS }),
  ])
  if (!ipOk || !addressOk) {
    console.warn(`[auth/verify] rate limited: ip=${ip} address=${address}`)
    res.status(429).json({ error: 'Too many requests — try again in a few minutes.' })
    return
  }

  try {
    const nonceValid = await consumeNonce(address, nonce)
    if (!nonceValid) {
      console.warn(`[auth/verify] rejected: nonce invalid/expired/already used for ${address}`)
      res.status(401).json({ error: 'Nonce is invalid, expired, or already used' })
      return
    }

    const message = buildSignInMessage(nonce)
    // verifyMessage throws (rather than returning false) for a structurally malformed
    // signature — treat that the same as "didn't verify" instead of letting it fall through
    // to the generic 500 below.
    let signatureValid = false
    try {
      signatureValid = await verifyMessage({ address, message, signature })
    } catch (sigErr) {
      console.warn(`[auth/verify] signature malformed for ${address}:`, sigErr instanceof Error ? sigErr.message : sigErr)
    }
    if (!signatureValid) {
      console.warn(`[auth/verify] rejected: signature verification failed for ${address}`)
      res.status(401).json({ error: 'Signature verification failed' })
      return
    }

    // Lowercased uid — addresses can be represented in mixed checksum case, and Firestore
    // rules compare request.auth.uid against path segments that must match exactly.
    const uid = address.toLowerCase()
    const token = await getAdminAuth().createCustomToken(uid)
    console.log(`[auth/verify] minted custom token for uid ${uid}`)
    res.status(200).json({ token })
  } catch (error) {
    console.error(`[auth/verify] failed for ${address}:`, error)
    res.status(500).json({ error: 'Verification failed', detail: error instanceof Error ? error.message : String(error) })
  }
}
