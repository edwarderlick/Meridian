export type NetworkStatus = 'healthy' | 'degraded' | 'down'

/**
 * Stand-in for a real network health check — no monitoring backend exists yet
 * (see BuiltOnArc's "Live status monitoring launches with mainnet" notice).
 * Returns a fixed simulated value now; swap the body for a real check later
 * without touching the components that read it.
 */
export function useSimulatedNetworkStatus(): NetworkStatus {
  return 'healthy'
}
