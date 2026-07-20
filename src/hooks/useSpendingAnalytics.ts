import { useMemo } from 'react'
import type { ActivityLogEntry } from './useActivityLog'
import { useActivityLog } from './useActivityLog'

export const ANALYTICS_RANGES = ['1D', '1W', '1M', '1Y'] as const
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]

const RANGE_MS: Record<AnalyticsRange, number> = {
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  '1Y': 365 * 24 * 60 * 60 * 1000,
}

export interface OutflowBucket {
  label: string
  amount: number
}

export interface OutflowRow {
  id: string
  timestamp: Date | null
  category: string
  chain: string
  counterparty?: string
  amountUsdc: number
  /** True when this entry moved a real amount that isn't priced in USDC (e.g. the WETH leg of a
   *  Uniswap LP deposit, or a Swap whose input wasn't USDC) — excluded from every dollar total
   *  below, same "don't fabricate a testnet USD price" discipline as the Liquidity module. */
  hasUnpricedLeg: boolean
  txHash?: string
  explorerUrl?: string
}

/**
 * "Outflow" here means the standard treasury-ops sense — real capital leaving its current
 * chain/liquid-USDC state, for any reason — not just third-party payments. That covers Transfer
 * (to a counterparty), Bridge and Gateway Deposit (leaving the source chain), Swap (leaving as
 * USDC for another asset), Gateway Spend (leaving the unified balance), and Yield Deposit
 * (Aave/Uniswap — leaving the liquid state for a position). aave_withdraw/uniswap_withdraw are
 * deliberately excluded: those are capital coming BACK, the opposite of outflow, and counting them
 * here would double-count the same funds as both an outflow (on deposit) and an outflow again (on
 * withdrawal) if included naively.
 */
function chainNameFromUnknown(chain: unknown): string | undefined {
  return chain && typeof chain === 'object' && 'name' in chain ? String((chain as { name: unknown }).name) : undefined
}

function resolveChain(entry: ActivityLogEntry): string | undefined {
  switch (entry.type) {
    case 'bridge':
      return chainNameFromUnknown(entry.source?.chain)
    case 'gateway_deposit':
      return chainNameFromUnknown(entry.chain)
    case 'gateway_withdraw':
      return entry.fromChain
    case 'transfer':
    case 'swap':
    case 'aave_deposit':
    case 'uniswap_deposit':
      return typeof entry.chain === 'string' ? entry.chain : entry.fromChain ?? entry.toChain
    default:
      return undefined
  }
}

const CATEGORY_LABEL: Record<string, string> = {
  transfer: 'Transfer',
  bridge: 'Bridge',
  swap: 'Swap',
  gateway_deposit: 'Gateway Deposit',
  gateway_withdraw: 'Gateway Spend',
  aave_deposit: 'Yield Deposit',
  uniswap_deposit: 'Yield Deposit',
}

/** Resolves one entry into an outflow row, or null if it isn't a real completed outflow at all
 *  (still-pending/failed bridges and deposits, or a withdraw/inflow type). */
function toOutflowRow(entry: ActivityLogEntry): OutflowRow | null {
  const category = CATEGORY_LABEL[entry.type]
  if (!category) return null // aave_withdraw, uniswap_withdraw — inflows, not outflow

  if (entry.type === 'bridge' && entry.status !== 'success') return null
  if (entry.type === 'gateway_deposit' && entry.status !== 'finalized') return null

  const chain = resolveChain(entry) ?? 'Unknown'
  const base = {
    id: entry.id,
    timestamp: entry.timestamp,
    category,
    chain,
    counterparty: entry.counterparty,
    txHash: entry.txHash,
    explorerUrl: entry.explorerUrl,
  }

  if (entry.type === 'uniswap_deposit') {
    const amountUsdc = entry.token0Symbol === 'USDC' ? Number(entry.amount0) : entry.token1Symbol === 'USDC' ? Number(entry.amount1) : 0
    return { ...base, amountUsdc: Number.isFinite(amountUsdc) ? amountUsdc : 0, hasUnpricedLeg: true }
  }

  // Every other counted type logs a plain amount+token — only the USDC-denominated leg is a real
  // dollar figure (a Swap paid for in EURC/cirBTC, for instance, has no reliable testnet USD price).
  const isUsdc = entry.token === undefined || entry.token === 'USDC'
  const numericAmount = Number(entry.amount)
  const amountUsdc = isUsdc && Number.isFinite(numericAmount) ? numericAmount : 0
  return { ...base, amountUsdc, hasUnpricedLeg: !isUsdc }
}

function aggregate(rows: OutflowRow[], keyOf: (row: OutflowRow) => string): OutflowBucket[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const key = keyOf(row)
    totals.set(key, (totals.get(key) ?? 0) + row.amountUsdc)
  }
  return Array.from(totals.entries())
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount)
}

/**
 * Real spending analytics, built entirely off this app's own activity log (Firestore) — the same
 * per-wallet transaction history Transfer/Bridge/Swap/Liquidity already write to on every real
 * completed action. No separate indexer or backend needed: every write already happens today,
 * this just reads and categorizes it. See toOutflowRow's docblock for what counts as "outflow" and
 * why aave_withdraw/uniswap_withdraw are excluded.
 */
export function useSpendingAnalytics(walletAddress: string | undefined, range: AnalyticsRange) {
  const { entries, isLoading, error } = useActivityLog(walletAddress)

  const cutoff = useMemo(() => Date.now() - RANGE_MS[range], [range])

  const rows = useMemo(() => {
    return entries
      .filter((entry) => (entry.timestamp ? entry.timestamp.getTime() >= cutoff : false))
      .map(toOutflowRow)
      .filter((row): row is OutflowRow => row !== null)
  }, [entries, cutoff])

  const byCategory = useMemo(() => aggregate(rows, (r) => r.category), [rows])
  const byChain = useMemo(() => aggregate(rows, (r) => r.chain), [rows])
  const byRecipient = useMemo(
    () => aggregate(rows.filter((r) => r.category === 'Transfer' && r.counterparty), (r) => r.counterparty!),
    [rows],
  )

  const totalOutflow = rows.reduce((sum, r) => sum + r.amountUsdc, 0)
  const hasUnpricedLegs = rows.some((r) => r.hasUnpricedLeg)

  return { rows, byCategory, byChain, byRecipient, totalOutflow, hasUnpricedLegs, isLoading, error }
}
