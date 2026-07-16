import type { SVGProps } from 'react'

export default function OptimismIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="16" cy="16" r="16" fill="#FF0420" />
      <ellipse cx="12.3" cy="16" rx="3.3" ry="4.6" stroke="white" strokeWidth="2.2" />
      <path
        d="M20.4 20.4L21.5 11.7H23.6L23.4 13.2C23.9 12.1 24.9 11.5 26.2 11.5C27.9 11.5 29 12.7 28.7 14.5L27.9 20.4H25.7L26.4 15.1C26.6 14 26.1 13.4 25.1 13.4C24 13.4 23.2 14.2 23 15.6L22.4 20.4H20.4Z"
        fill="white"
      />
    </svg>
  )
}
