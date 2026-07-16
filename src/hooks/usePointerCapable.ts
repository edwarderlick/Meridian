import { useEffect, useState } from 'react'

/**
 * True only on devices with a fine pointer that supports hover (mouse/trackpad).
 * Used to gate cursor-reactive effects so they degrade gracefully (no-op) on touch.
 */
export function usePointerCapable() {
  const [capable, setCapable] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    setCapable(mq.matches)
    const handler = (e: MediaQueryListEvent) => setCapable(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return capable
}
