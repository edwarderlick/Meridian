import type { SVGProps } from 'react'

export default function SolanaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="16" cy="16" r="16" fill="#9945FF" />
      <path
        d="M9.5 20.2C9.7 20 10 19.9 10.3 19.9H24.3C24.8 19.9 25 20.5 24.7 20.8L21.5 24C21.3 24.2 21 24.3 20.7 24.3H6.7C6.2 24.3 6 23.7 6.3 23.4L9.5 20.2Z"
        fill="white"
      />
      <path
        d="M9.5 8C9.7 7.8 10 7.7 10.3 7.7H24.3C24.8 7.7 25 8.3 24.7 8.6L21.5 11.8C21.3 12 21 12.1 20.7 12.1H6.7C6.2 12.1 6 11.5 6.3 11.2L9.5 8Z"
        fill="white"
      />
      <path
        d="M21.5 14.1C21.3 13.9 21 13.8 20.7 13.8H6.7C6.2 13.8 6 14.4 6.3 14.7L9.5 17.9C9.7 18.1 10 18.2 10.3 18.2H24.3C24.8 18.2 25 17.6 24.7 17.3L21.5 14.1Z"
        fill="white"
      />
    </svg>
  )
}
