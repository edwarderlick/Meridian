import type { SVGProps } from 'react'

export default function ArbitrumIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="16" cy="16" r="16" fill="#2D374B" />
      <path d="M16 6L24.5 21H20.9L16 12.3L11.1 21H7.5L16 6Z" fill="#28A0F0" />
      <path d="M13.4 21H16.9L16 19.3L13.4 21Z" fill="#28A0F0" />
      <path d="M18.6 21H22.1L16 10L14.3 13L18.6 21Z" fill="white" fillOpacity="0.9" />
    </svg>
  )
}
