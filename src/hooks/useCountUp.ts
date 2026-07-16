import { useEffect, useState } from 'react'

/**
 * Reproduces the original inline script's counter algorithm exactly:
 * increment = target / 200, advance by Math.ceil each tick, 1ms between ticks.
 */
export function useCountUp(target: number, active: boolean) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return

    let cancelled = false
    let timeoutId: number

    const speed = 200
    const tick = (current: number) => {
      if (cancelled) return
      const inc = target / speed
      if (current < target) {
        const next = Math.ceil(current + inc)
        setValue(next)
        timeoutId = window.setTimeout(() => tick(next), 1)
      } else {
        setValue(target)
      }
    }
    tick(0)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [active, target])

  return value
}
