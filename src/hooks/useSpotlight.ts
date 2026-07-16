import type { MouseEvent } from 'react'

/**
 * Updates the `.spotlight` CSS custom properties (--spot-x/--spot-y) to the pointer's position
 * within the element, in pixels. Pure CSS-var writes — no state, no re-render, transform/opacity
 * only downstream (see .spotlight in index.css), so this is safe to attach to onMouseMove.
 */
export function useSpotlight() {
  return (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--spot-x', `${e.clientX - rect.left}px`)
    e.currentTarget.style.setProperty('--spot-y', `${e.clientY - rect.top}px`)
  }
}
