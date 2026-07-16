import { circleHandler } from '../_lib/circleHandler.js'
import { swapHandler } from '../_lib/swapHandler.js'

// Swap is dispatched from here rather than from its own nested api/circle/swap/[...path].js —
// confirmed live in production that Vercel's file-system routing does not reliably give a nested
// rest-parameter route (api/circle/swap/[...path].js) precedence over this parent catch-all: swap
// requests were hitting Vercel's own NOT_FOUND page (raw HTML, not JSON), never reaching either
// function. Express's dev server sidestepped this by registering routes in explicit order, which
// masked the gap in local dev. One catch-all with an internal prefix check removes the ambiguity
// instead of relying on undocumented cross-directory dynamic-route precedence.
const SWAP_PREFIX = 'swap/'

export default async function handler(req, res) {
  const rawPath = req.query?.path
  const path = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath ?? '')

  if (path === 'swap' || path.startsWith(SWAP_PREFIX)) {
    await swapHandler(req, res, path.slice(SWAP_PREFIX.length))
    return
  }

  await circleHandler(req, res, path)
}
