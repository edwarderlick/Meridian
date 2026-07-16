const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ENS_NAME = /^[a-zA-Z0-9-]+\.eth$/

export function isValidAddress(value: string): boolean {
  const trimmed = value.trim()
  return HEX_ADDRESS.test(trimmed) || ENS_NAME.test(trimmed)
}

export function addressError(value: string): string | null {
  if (!value.trim()) return 'Address is required'
  if (!isValidAddress(value)) return 'Enter a valid 0x address or ENS name'
  return null
}

export function amountError(value: string, available: number): string | null {
  if (!value.trim()) return 'Amount is required'
  const parsed = Number(value.replace(/,/g, ''))
  if (Number.isNaN(parsed) || parsed <= 0) return 'Enter a valid amount'
  if (parsed > available) return 'Amount exceeds available balance'
  return null
}
