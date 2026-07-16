import { onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { auth } from '../config/firebase'

export type WalletAuthStatus = 'idle' | 'awaiting-signature' | 'verifying' | 'authenticated' | 'error'

export interface WalletAuthState {
  status: WalletAuthStatus
  error: string | null
  isAuthenticated: boolean
}

/**
 * KEEP THIS BYTE-FOR-BYTE IDENTICAL to buildSignInMessage() in api/_lib/authHandler.js —
 * the signature only verifies if both sides produce the exact same message string.
 */
function buildSignInMessage(nonce: string): string {
  return `Sign in to Meridian Console\n\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any gas.`
}

async function readJsonError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    return typeof body?.error === 'string' ? body.error : fallback
  } catch {
    return fallback
  }
}

/**
 * Bridges the connected wagmi wallet to a real Firebase Auth session: on connect (or address
 * change), fetches a nonce, prompts a signature, verifies it server-side, and signs in with the
 * resulting custom token. On disconnect, signs out of Firebase too. Meant to be called ONCE from
 * WalletAuthProvider — call sites needing auth state should read it via useWalletAuthContext()
 * instead of calling this hook directly, so only one sign-in flow ever runs at a time.
 */
export function useWalletAuth(): WalletAuthState {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [status, setStatus] = useState<WalletAuthStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  // undefined = Firebase's first auth-state emission hasn't arrived yet — deliberately distinct
  // from null (signed out), so a persisted session from a prior visit isn't clobbered by a
  // redundant re-sign before we've even checked whether one already exists.
  const [firebaseUid, setFirebaseUid] = useState<string | null | undefined>(undefined)
  const runIdRef = useRef(0)

  useEffect(() => onAuthStateChanged(auth, (user) => setFirebaseUid(user?.uid ?? null)), [])

  useEffect(() => {
    if (firebaseUid === undefined) return

    const runId = ++runIdRef.current
    const isStale = () => runId !== runIdRef.current

    async function run() {
      if (!isConnected || !address) {
        if (auth.currentUser) await signOut(auth)
        setStatus('idle')
        setError(null)
        return
      }

      const lower = address.toLowerCase()

      if (firebaseUid === lower) {
        setStatus('authenticated')
        setError(null)
        return
      }

      if (auth.currentUser) {
        await signOut(auth)
      }

      setStatus('awaiting-signature')
      setError(null)

      try {
        const nonceRes = await fetch('/api/auth/nonce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        })
        if (!nonceRes.ok) throw new Error(await readJsonError(nonceRes, 'Could not start sign-in — try again.'))
        const { nonce } = await nonceRes.json()

        const message = buildSignInMessage(nonce)
        const signature = await signMessageAsync({ message })
        if (isStale()) return

        setStatus('verifying')
        const verifyRes = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, signature, nonce }),
        })
        if (!verifyRes.ok) throw new Error(await readJsonError(verifyRes, 'Sign-in verification failed — try again.'))
        const { token } = await verifyRes.json()
        if (isStale()) return

        await signInWithCustomToken(auth, token)
        // onAuthStateChanged will fire with the new uid, which re-runs this effect and flips
        // status to 'authenticated' once firebaseUid matches — not set directly here.
      } catch (err) {
        if (isStale()) return
        const message = err instanceof Error ? err.message : 'Sign-in failed.'
        const rejected = /user rejected|denied the transaction|user denied/i.test(message)
        setError(rejected ? 'Sign-in cancelled — the signature request was rejected.' : message)
        setStatus('error')
      }
    }

    void run()
  }, [address, isConnected, firebaseUid, signMessageAsync])

  const isAuthenticated = status === 'authenticated' && firebaseUid === (address ? address.toLowerCase() : null)

  // Memoized so the returned object's REFERENCE only changes when status/error/isAuthenticated
  // actually do. This hook is called once inside WalletAuthProvider and handed straight to a
  // Context — React re-renders every consumer whenever a Context `value` reference changes,
  // with no regard for whether its contents differ. Without this, useAccount() ticking every
  // few seconds (RainbowKit's default block-watch polling) was enough to manufacture a brand
  // new {status, error, isAuthenticated} object on each tick even though nothing had changed,
  // which fanned out into a re-render storm across every screen that reads this context.
  return useMemo(() => ({ status, error, isAuthenticated }), [status, error, isAuthenticated])
}
