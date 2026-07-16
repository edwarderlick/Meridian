import { useEffect, useRef } from 'react'
import { usePointerCapable } from './usePointerCapable'

/**
 * Subtle magnetic pull toward the cursor within `radius` px, capped at `strength` px offset.
 * No-ops on touch/coarse-pointer devices.
 */
export function useMagnetic<T extends HTMLElement>(radius = 80, strength = 8) {
  const ref = useRef<T | null>(null)
  const pointerCapable = usePointerCapable()

  useEffect(() => {
    const el = ref.current
    if (!el || !pointerCapable) return

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.hypot(dx, dy)

      if (dist < radius + Math.max(rect.width, rect.height) / 2) {
        const pull = Math.max(0, 1 - dist / (radius + Math.max(rect.width, rect.height)))
        el.style.transform = `translate(${(dx * pull * strength) / radius}px, ${(dy * pull * strength) / radius}px)`
      } else {
        el.style.transform = 'translate(0, 0)'
      }
    }

    const reset = () => {
      el.style.transform = 'translate(0, 0)'
    }

    window.addEventListener('mousemove', handleMove)
    el.addEventListener('mouseleave', reset)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      el.removeEventListener('mouseleave', reset)
    }
  }, [pointerCapable, radius, strength])

  return ref
}
