// Proxies to Circle's Stablecoin Kits swap service (https://api.circle.com/*) server-side.
//
// Mounted at /api/circle/swap/* and paired with a client-side fetch() rewrite
// (src/lib/circleFetchProxy.ts) that transparently redirects @circle-fin/swap-kit's hardcoded
// `https://api.circle.com/...` calls here. That lets the real SDK run entirely unmodified in the
// browser — including signing, which stays on the user's own wallet — while its network traffic
// becomes same-origin. CORS doesn't apply to same-origin requests at all, which is why this works
// where trying to satisfy the preflight directly doesn't: api.circle.com's CORS allow-list is
// missing X-User-Agent, a header swap-kit attaches to every request unconditionally in browser
// contexts (confirmed by reading its bundled source — pollApiWithValidation in index.mjs — and by
// a live OPTIONS check against api.circle.com; this holds true as of v1.4.0 too, keyless or not).
// This exact fetch-rewrite + same-origin-proxy technique is what a real, working reference
// implementation (github.com/edwarderlick/PayZapp) uses in production.
//
// A flat 1:1 passthrough (no path rewriting) so it mirrors the SDK's own absolute URLs exactly: a
// rewritten fetch to /api/circle/swap/v1/stablecoinKits/quote forwards verbatim to
// https://api.circle.com/v1/stablecoinKits/quote.
//
// CIRCLE_API_KEY is injected server-side on every proxied request regardless of whether the
// client's SDK call included one — swap-kit v1.4.0 made the kit key optional specifically so
// browser code never needs to hold it (see its CHANGELOG), so the client here is configured
// keyless on purpose (see swapClient.ts) and never sees the real key at all.

const SWAP_SERVICE_BASE_URL = process.env.CIRCLE_SWAP_BASE_URL || 'https://api.circle.com'

function buildQueryString(query) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (key === 'path') continue
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v)
    } else if (value !== undefined) {
      params.append(key, value)
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * @param path - Full path under api.circle.com (e.g. "v1/stablecoinKits/quote"), already resolved
 *   by the caller (see circleHandler.js's docblock for why each runtime passes this in explicitly
 *   instead of the handler reaching into req for it).
 */
export async function swapHandler(req, res, path) {
  const apiKey = process.env.CIRCLE_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'CIRCLE_API_KEY is not configured on the server' })
    return
  }

  if (!path) {
    res.status(400).json({ error: 'Missing swap API path' })
    return
  }

  const method = req.method ?? 'GET'
  const hasBody = !['GET', 'HEAD'].includes(method)
  const queryString = buildQueryString(req.query)

  try {
    const upstream = await fetch(`${SWAP_SERVICE_BASE_URL}/${path}${queryString}`, {
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
      error: 'Swap API request failed',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
