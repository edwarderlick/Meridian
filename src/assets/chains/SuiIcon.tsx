import type { SVGProps } from 'react'

export default function SuiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="16" cy="16" r="16" fill="#4DA2FF" />
      <path
        d="M16 6.2C16 6.2 10.3 13.7 10.3 18.6C10.3 22.3 12.9 25.1 16 25.1C19.1 25.1 21.7 22.3 21.7 18.6C21.7 13.7 16 6.2 16 6.2Z"
        fill="white"
      />
      <path
        d="M16 11.6C16 11.6 13 15.9 13 18.5C13 20.3 14.3 21.7 16 21.7C17.6 21.7 18.9 20.3 18.9 18.5C18.9 15.9 16 11.6 16 11.6Z"
        fill="#4DA2FF"
      />
    </svg>
  )
}
