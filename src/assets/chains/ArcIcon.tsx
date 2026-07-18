import type { SVGProps } from 'react'
import arcLogo from './arc-logo.jpg'

/** Official Arc logo (Circle Brand Kit), clipped to the same circular frame every other chain icon in this set uses. */
export default function ArcIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <clipPath id="arc-logo-clip">
          <circle cx="16" cy="16" r="16" />
        </clipPath>
      </defs>
      <image href={arcLogo} x="0" y="0" width="32" height="32" preserveAspectRatio="xMidYMid slice" clipPath="url(#arc-logo-clip)" />
    </svg>
  )
}
