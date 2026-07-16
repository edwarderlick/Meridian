import type { SVGProps } from 'react'

export default function EthereumIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path d="M16.5 4.5V13.2L23.8 16.5L16.5 4.5Z" fill="white" fillOpacity="0.6" />
      <path d="M16.5 4.5L9.2 16.5L16.5 13.2V4.5Z" fill="white" />
      <path d="M16.5 21.9V27.5L23.8 17.9L16.5 21.9Z" fill="white" fillOpacity="0.6" />
      <path d="M16.5 27.5V21.9L9.2 17.9L16.5 27.5Z" fill="white" />
      <path d="M16.5 20.6L23.8 16.5L16.5 13.2V20.6Z" fill="white" fillOpacity="0.2" />
      <path d="M9.2 16.5L16.5 20.6V13.2L9.2 16.5Z" fill="white" fillOpacity="0.6" />
    </svg>
  )
}
