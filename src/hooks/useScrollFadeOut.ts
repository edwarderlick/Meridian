import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * 1 while `ref`'s element is fully in view at the top of the page, fading linearly
 * to 0 as its top edge scrolls up past the viewport top by up to its own height.
 * Used to dim the hero shader gradually instead of a hard cut at the section boundary.
 */
export function useScrollFadeOut(ref: RefObject<HTMLElement | null>) {
  const [fade, setFade] = useState(1)

  useEffect(() => {
    let rafId = 0
    const update = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const ratio = rect.height > 0 ? 1 + rect.top / rect.height : 1
      setFade(Math.min(1, Math.max(0, ratio)))
    }
    const onScroll = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ref])

  return fade
}
