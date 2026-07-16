import { circleHandler } from '../_lib/circleHandler.js'
import { swapHandler } from '../_lib/swapHandler.js'

/**
 * Routed here via an explicit rewrite in vercel.json (`/api/circle/:path*` ->
 * `/api/circle/proxy?path=:path*`) instead of Vercel's own `[...path].js` file-system catch-all
 * convention. Confirmed live in production (real curl requests against the deployed domain, not
 * guessed): the catch-all didn't match multi-segment sub-paths at all (identical response to a
 * genuinely made-up path — Vercel's own NOT_FOUND page) and even mis-handled single-segment ones
 * (function was invoked but req.query.path came through empty). Meanwhile plain, non-bracket
 * function files (api/auth/nonce.js, api/auth/verify.js) worked correctly the whole time. An
 * explicit rewrite to a plain filename sidesteps whatever is wrong with bracket-route detection in
 * this deployment entirely, using the same proven-working file shape instead.
 */
const SWAP_PREFIX = 'swap/'

export default async function handler(req, res) {
  const rawPath = req.query?.path
  const path = Array.isArray(rawPath) ? rawPath.join('/') : typeof rawPath === 'string' ? rawPath : ''

  if (path === 'swap' || path.startsWith(SWAP_PREFIX)) {
    await swapHandler(req, res, path.slice(SWAP_PREFIX.length))
    return
  }

  await circleHandler(req, res, path)
}
