import type { SVGProps } from 'react'

export default function BaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="16" cy="16" r="16" fill="#0052FF" />
      <path
        d="M16 24C20.4183 24 24 20.4183 24 16C24 11.5817 20.4183 8 16 8C11.7793 8 8.32234 11.2657 8.02168 15.4091H19.0909V16.5909H8.02168C8.32234 20.7343 11.7793 24 16 24Z"
        fill="white"
      />
    </svg>
  )
}
