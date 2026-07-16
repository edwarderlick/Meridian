// Shared Circle API proxy handler — used by both the Vercel serverless
// function (api/circle/[...path].js) and the local Express dev server
// (server/dev-server.js), so local dev and production behave identically.
//
// CIRCLE_API_KEY lives only in this process's environment (never VITE_-
// prefixed, never sent to the client) and is attached to the upstream
// request here. The frontend only ever talks to /api/circle/*.
//
// No real Circle endpoints are wired to specific business logic yet (no
// Bridge/Swap/Unified Balance calls exist in this phase) — this is a
// generic pass-through proxy so that shape exists before that work begins.

const CIRCLE_API_BASE_URL = process.env.CIRCLE_API_BASE_URL || 'https://api-sandbox.circle.com'

/**
 * @param path - Circle API path segment(s), already resolved by the caller
 *   (each runtime has its own way of extracting a wildcard route param —
 *   Vercel's [...path].js gives an array via req.query.path, Express 5's
 *   named wildcard gives an array via req.params.splat, and req.query
 *   itself isn't reliably mutable across both, so callers pass it in
 *   explicitly rather than this handler reaching into req for it).
 */
export async function circleHandler(req, res, path) {
  const apiKey = process.env.CIRCLE_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'CIRCLE_API_KEY is not configured on the server' })
    return
  }

  if (!path) {
    res.status(400).json({ error: 'Missing Circle API path' })
    return
  }

  const method = req.method ?? 'GET'
  const hasBody = !['GET', 'HEAD'].includes(method)

  try {
    const upstream = await fetch(`${CIRCLE_API_BASE_URL}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
    })

    const text = await upstream.text()
    const data = text ? JSON.parse(text) : null
    res.status(upstream.status).json(data)
  } catch (error) {
    res.status(502).json({
      error: 'Circle API request failed',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
