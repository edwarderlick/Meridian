/**
 * Calls Circle's API through the backend proxy (api/_lib/circleHandler.js)
 * instead of hitting Circle directly — CIRCLE_API_KEY never leaves the
 * server. No real Circle endpoints are consumed through this yet (that's
 * future-phase Bridge/Swap/Unified Balance work); this establishes the
 * calling convention ahead of that work.
 */
export async function callCircleApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/circle/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message || body?.error || `Circle API request failed: ${response.status}`)
  }

  return response.json()
}
