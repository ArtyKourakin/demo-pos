import { centsToDecimalString } from './money'
import type { Cents, Sale } from './types'

/** Sales whose timestamp is in [startMs, endMs), newest first. */
export function salesInRange(sales: Sale[], startMs: number, endMs: number): Sale[] {
  return sales
    .filter((s) => {
      const t = Date.parse(s.createdAt)
      return t >= startMs && t < endMs
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export interface TopProduct {
  productId: string
  name: string
  quantity: number
  revenueCents: Cents
}

export interface SalesSummary {
  /** Completed (non-voided) sales. */
  transactions: number
  voidedCount: number
  itemsSold: number
  /** Item prices before any discount. */
  grossCents: Cents
  /** Line + order discounts. */
  discountCents: Cents
  taxCents: Cents
  /** Gross − discounts (excludes tax). */
  netRevenueCents: Cents
  /** Net revenue + tax = what was actually collected. */
  totalCollectedCents: Cents
  cashCents: Cents
  cardCents: Cents
  topProducts: TopProduct[]
}

/** Summarise sales. Voided sales are counted in `voidedCount` but excluded from every money figure. */
export function summarizeSales(sales: Sale[], topN = 5): SalesSummary {
  const summary: SalesSummary = {
    transactions: 0,
    voidedCount: 0,
    itemsSold: 0,
    grossCents: 0,
    discountCents: 0,
    taxCents: 0,
    netRevenueCents: 0,
    totalCollectedCents: 0,
    cashCents: 0,
    cardCents: 0,
    topProducts: []
  }
  const products = new Map<string, TopProduct>()

  for (const sale of sales) {
    if (sale.status === 'voided') {
      summary.voidedCount += 1
      continue
    }
    summary.transactions += 1
    summary.grossCents += sale.itemsGrossCents
    summary.discountCents += sale.lineDiscountCents + sale.orderDiscountCents
    summary.taxCents += sale.taxCents
    summary.totalCollectedCents += sale.totalCents
    for (const p of sale.payments) {
      if (p.method === 'cash') summary.cashCents += p.amountCents
      else summary.cardCents += p.amountCents
    }
    for (const line of sale.lines) {
      summary.itemsSold += line.quantity
      const entry = products.get(line.productId) ?? {
        productId: line.productId,
        name: line.name,
        quantity: 0,
        revenueCents: 0
      }
      entry.quantity += line.quantity
      entry.revenueCents += line.netCents
      products.set(line.productId, entry)
    }
  }
  summary.netRevenueCents = summary.grossCents - summary.discountCents
  summary.topProducts = [...products.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenueCents - a.revenueCents || a.name.localeCompare(b.name))
    .slice(0, topN)
  return summary
}

export function itemCount(sale: Sale): number {
  return sale.lines.reduce((n, l) => n + l.quantity, 0)
}

export function paymentLabel(sale: Sale): string {
  if (sale.paymentMethod === 'split') return 'Split (cash + card)'
  if (sale.paymentMethod === 'cash') return 'Cash'
  const card = sale.payments.find((p) => p.method === 'card')
  return card && card.method === 'card' ? `Card (${card.cardType})` : 'Card'
}

export function csvEscape(value: string | number): string {
  const s = String(value)
  // Neutralise spreadsheet formula injection, then quote if needed.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function row(values: (string | number)[]): string {
  return values.map(csvEscape).join(',')
}

/**
 * Build a CSV report: summary block, top products, then one row per sale.
 * `formatDateTime` is injected so this module stays locale-free and testable.
 */
export function buildReportCsv(
  rangeLabel: string,
  sales: Sale[],
  formatDateTime: (iso: string) => string
): string {
  const s = summarizeSales(sales, 10)
  const money = centsToDecimalString
  const lines: string[] = [
    row(['Sales report', rangeLabel]),
    '',
    row(['Summary', 'Value']),
    row(['Gross sales', money(s.grossCents)]),
    row(['Total discounts', money(s.discountCents)]),
    row(['Tax', money(s.taxCents)]),
    row(['Net revenue (excl. tax)', money(s.netRevenueCents)]),
    row(['Total collected', money(s.totalCollectedCents)]),
    row(['Transactions', s.transactions]),
    row(['Voided sales', s.voidedCount]),
    row(['Items sold', s.itemsSold]),
    row(['Cash total', money(s.cashCents)]),
    row(['Card total', money(s.cardCents)]),
    '',
    row(['Top products', 'Quantity', 'Revenue']),
    ...s.topProducts.map((p) => row([p.name, p.quantity, money(p.revenueCents)])),
    '',
    row([
      'Date/time',
      'Receipt #',
      'Status',
      'Items',
      'Gross',
      'Discounts',
      'Tax',
      'Total',
      'Payment',
      'Cash',
      'Card'
    ])
  ]
  for (const sale of sales) {
    const cash = sale.payments.filter((p) => p.method === 'cash').reduce((n, p) => n + p.amountCents, 0)
    const card = sale.payments.filter((p) => p.method === 'card').reduce((n, p) => n + p.amountCents, 0)
    lines.push(
      row([
        formatDateTime(sale.createdAt),
        sale.receiptNo,
        sale.status,
        itemCount(sale),
        money(sale.itemsGrossCents),
        money(sale.lineDiscountCents + sale.orderDiscountCents),
        money(sale.taxCents),
        money(sale.totalCents),
        paymentLabel(sale),
        money(cash),
        money(card)
      ])
    )
  }
  return lines.join('\r\n') + '\r\n'
}
