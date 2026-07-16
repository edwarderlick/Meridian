import type { SVGProps } from 'react'

export default function ArcIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="16" cy="16" r="16" fill="#F432F6" />
      <path
        d="M7 21C7 13.8 12.3 8 19.5 8"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="19.8" cy="8.2" r="2.4" fill="white" />
    </svg>
  )
}
