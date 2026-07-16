import { useEffect, useState } from 'react'

/** Briefly shows a loading state on mount so skeletons are demonstrable before real data fetching is wired in. */
export function useSimulatedLoading(durationMs = 700) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), durationMs)
    return () => clearTimeout(timer)
  }, [durationMs])

  return loading
}
