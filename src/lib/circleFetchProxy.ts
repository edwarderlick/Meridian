/**
 * Rewrites @circle-fin/swap-kit's hardcoded `https://api.circle.com/*` calls to our own
 * same-origin backend proxy (`/api/circle/swap/*`, see api/_lib/swapHandler.js) before they leave
 * the browser. That host's CORS allow-list is missing X-User-Agent, a header the SDK attaches to
 * every request unconditionally in browser contexts — same-origin requests aren't subject to CORS
 * at all, so rewriting the destination sidesteps the block without needing Circle to change
 * anything or needing to reimplement the SDK's REST calls by hand. This exact technique is what a
 * real, working reference implementation (github.com/edwarderlick/PayZapp) uses in production —
 * verified live by curling its deployed proxy and getting a real Circle quote back.
 *
 * Must be imported before any @circle-fin/swap-kit code actually calls fetch — imported at the top
 * of main.tsx so it's in effect before anything else in the app runs.
 */
const PROXY_MAP: [string, string][] = [['https://api.circle.com', '/api/circle/swap']]

const originalFetch = window.fetch.bind(window)

window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

  for (const [origin, proxyPrefix] of PROXY_MAP) {
    if (raw.startsWith(origin)) {
      return originalFetch(raw.replace(origin, proxyPrefix), init)
    }
  }

  return originalFetch(input, init)
}) as typeof window.fetch
