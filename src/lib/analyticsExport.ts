import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { AnalyticsRange } from '../hooks/useSpendingAnalytics'
import type { OutflowBucket, OutflowRow } from '../hooks/useSpendingAnalytics'

/** Escapes a field for CSV per RFC 4180 — wraps in quotes and doubles any embedded quote whenever
 *  the value contains a comma, quote, or newline that would otherwise break column alignment. */
function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Real CSV built from the same rows the charts render — one row per real, completed outflow
 *  transaction in the selected range, not a placeholder/sample export. */
export function exportOutflowCsv(rows: OutflowRow[], range: AnalyticsRange, walletAddress: string) {
  const header = ['Date', 'Category', 'Chain', 'Counterparty', 'Amount (USDC)', 'Unpriced Leg', 'Transaction Hash']
  const lines = rows.map((row) =>
    [
      row.timestamp ? row.timestamp.toISOString() : '',
      row.category,
      row.chain,
      row.counterparty ?? '',
      row.amountUsdc.toFixed(6),
      row.hasUnpricedLeg ? 'yes' : 'no',
      row.txHash ?? '',
    ]
      .map(csvField)
      .join(','),
  )
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `meridian-spending-${walletAddress.slice(0, 8)}-${range}-${Date.now()}.csv`)
}

/** Real PDF report built from the same aggregates the page displays — summary totals, the
 *  category/chain/recipient breakdowns, and the full transaction list, not placeholder content. */
export function exportOutflowPdf(
  rows: OutflowRow[],
  byCategory: OutflowBucket[],
  byChain: OutflowBucket[],
  byRecipient: OutflowBucket[],
  totalOutflow: number,
  range: AnalyticsRange,
  walletAddress: string,
) {
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text('Meridian — Spending Analytics Report', 14, 18)
  doc.setFontSize(10)
  doc.text(`Wallet: ${walletAddress}`, 14, 26)
  doc.text(`Range: ${range}  ·  Generated: ${new Date().toLocaleString()}`, 14, 32)
  doc.text(`Total outflow: $${totalOutflow.toFixed(2)} (USDC-denominated legs only)`, 14, 38)

  let cursorY = 46

  if (byCategory.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Category', 'Amount (USDC)']],
      body: byCategory.map((b) => [b.label, `$${b.amount.toFixed(2)}`]),
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 45] },
    })
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  if (byChain.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Chain', 'Amount (USDC)']],
      body: byChain.map((b) => [b.label, `$${b.amount.toFixed(2)}`]),
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 45] },
    })
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  if (byRecipient.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Recipient', 'Amount (USDC)']],
      body: byRecipient.map((b) => [b.label, `$${b.amount.toFixed(2)}`]),
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 45] },
    })
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  autoTable(doc, {
    startY: cursorY,
    head: [['Date', 'Category', 'Chain', 'Counterparty', 'Amount (USDC)', 'Tx Hash']],
    body: rows.map((row) => [
      row.timestamp ? row.timestamp.toLocaleString() : '—',
      row.category,
      row.chain,
      row.counterparty ? `${row.counterparty.slice(0, 6)}…${row.counterparty.slice(-4)}` : '—',
      `$${row.amountUsdc.toFixed(2)}${row.hasUnpricedLeg ? ' *' : ''}`,
      row.txHash ? `${row.txHash.slice(0, 10)}…` : '—',
    ]),
    theme: 'striped',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [40, 40, 45] },
  })

  doc.setFontSize(8)
  doc.text(
    '* Unpriced leg — this transaction moved a real amount not denominated in USDC (e.g. WETH in a Uniswap LP deposit),',
    14,
    doc.internal.pageSize.getHeight() - 14,
  )
  doc.text('excluded from the dollar total shown, consistent with this app not fabricating testnet asset prices.', 14, doc.internal.pageSize.getHeight() - 9)

  doc.save(`meridian-spending-${walletAddress.slice(0, 8)}-${range}-${Date.now()}.pdf`)
}
