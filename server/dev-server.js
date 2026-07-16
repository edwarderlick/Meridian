// Local dev-only counterpart to the Vercel serverless functions in api/ —
// mounts the same shared handlers behind Express so `npm run dev` behaves
// like production without needing `vercel dev`. Vite's dev server proxies
// /api/* requests here (see vite.config.ts).
//
// Run with Node's built-in --env-file flag (Node 20.6+) so CIRCLE_API_KEY
// etc. load from .env without adding a dotenv dependency.

import express from 'express'
import { circleHandler } from '../api/_lib/circleHandler.js'
import { swapHandler } from '../api/_lib/swapHandler.js'
import { nonceHandler, verifyHandler } from '../api/_lib/authHandler.js'

const app = express()
app.use(express.json())

// Express 5 (path-to-regexp v8) requires a named wildcard, unlike Express 4's bare `*`.
// req.query isn't reliably mutable in Express 5, so the path is passed explicitly.
// Swap is dispatched from this same catch-all via a path-prefix check, matching
// api/circle/[...path].js's single-route structure — a separate swap route here used to
// rely on Express's registration-order precedence, which is exactly what masked the
// production-only routing gap Vercel's nested-catch-all files turned out to have.
const SWAP_PREFIX = 'swap/'

app.all('/api/circle/*splat', (req, res) => {
  const path = req.params.splat.join('/')
  if (path === 'swap' || path.startsWith(SWAP_PREFIX)) {
    swapHandler(req, res, path.slice(SWAP_PREFIX.length))
    return
  }
  circleHandler(req, res, path)
})

app.post('/api/auth/nonce', nonceHandler)
app.post('/api/auth/verify', verifyHandler)

const port = process.env.API_PORT || 3001
const server = app.listen(port, () => {
  console.log(`Local API dev server listening on http://localhost:${port}`)
})

// Without this, a port already in use throws an uncaught 'error' event — Node prints a raw
// stack trace and exits 1 with no indication of what actually went wrong. A previous
// `npm run dev`/`npm run dev:api` left running (common when a background terminal or agent
// session didn't get torn down) is the most likely cause in practice.
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use — another process (likely a previous npm run dev / dev:api) is still running. Stop it and try again.`,
    )
  } else {
    console.error('Local API dev server failed to start:', error)
  }
  process.exit(1)
})
