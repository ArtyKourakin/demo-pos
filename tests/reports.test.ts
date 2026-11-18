import { describe, expect, it } from 'vitest'
import { addToCart, completeSale, emptyCart, setOrderDiscount, voidSale } from '../src/shared/pos'
import { buildReportCsv, csvEscape, salesInRange, summarizeSales } from '../src/shared/reports'
import { ctx, product, seed } from './helpers'

function dayOfSales() {
  let data = seed()
  // Sale 1: 2 lattes + croissant, 10% off, cash ($10.80)
  let cart = addToCart(addToCart(addToCart(emptyCart(), product(data, 'p-latte')), product(data, 'p-latte')), product(data, 'p-croissant'))
  cart = setOrderDiscount(cart, { type: 'percent', basisPoints: 1000 })
  const s1 = completeSale(data, cart, { kind: 'cash', tenderedCents: 2000 }, ctx('2026-11-19T09:00:00.000Z'))
  data = s1.data
  // Sale 2: chips, card ($1.99)
  const s2 = completeSale(data, addToCart(emptyCart(), product(data, 'p-chips')), { kind: 'card', card: { cardType: 'Visa' } }, ctx('2026-11-19T10:00:00.000Z'))
  data = s2.data
  // Sale 3: sandwich, split $3 cash + $4.95 card
  const s3 = completeSale(
    data,
    addToCart(emptyCart(), product(data, 'p-sandwich')),
    { kind: 'split', cashCents: 300, cardCents: 495, card: { cardType: 'Amex' } },
    ctx('2026-11-19T11:00:00.000Z')
  )
  data = s3.data
  // Sale 4: voided latte
  const s4 = completeSale(data, addToCart(emptyCart(), product(data, 'p-latte')), { kind: 'cash', tenderedCents: 500 }, ctx('2026-11-19T12:00:00.000Z'))
  data = voidSale(s4.data, s4.sale.id, 'test', ctx('2026-11-19T12:05:00.000Z'))
  return data
}

describe('reports', () => {
  it('filters sales by range, newest first', () => {
    const data = dayOfSales()
    const range = salesInRange(data.sales, Date.parse('2026-11-19T09:30:00Z'), Date.parse('2026-11-19T11:30:00Z'))
    expect(range.map((s) => s.receiptNo)).toEqual([1003, 1002])
  })

  it('summarises the day and excludes voided sales from money totals', () => {
    const s = summarizeSales(dayOfSales().sales)
    expect(s.transactions).toBe(3)
    expect(s.voidedCount).toBe(1)
    expect(s.grossCents).toBe(1200 + 199 + 795)
    expect(s.discountCents).toBe(120)
    expect(s.netRevenueCents).toBe(1080 + 199 + 795)
    expect(s.totalCollectedCents).toBe(1080 + 199 + 795)
    expect(s.cashCents).toBe(1080 + 300)
    expect(s.cardCents).toBe(199 + 495)
    expect(s.cashCents + s.cardCents).toBe(s.totalCollectedCents)
    expect(s.topProducts[0]).toMatchObject({ productId: 'p-latte', quantity: 2 })
    expect(s.itemsSold).toBe(5)
  })

  it('exports a CSV with summary and one row per sale', () => {
    const data = dayOfSales()
    const csv = buildReportCsv('Nov 19, 2026', data.sales, (iso) => iso)
    expect(csv).toContain('Cash total,13.80')
    expect(csv).toContain('Card total,6.94')
    expect(csv).toContain('Net revenue (excl. tax),20.74')
    expect(csv.split('\r\n').filter((l) => /^2026-11-19T/.test(l))).toHaveLength(4)
    expect(csv).toContain('voided')
  })

  it('escapes CSV values safely', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvEscape('-1.50')).toBe('-1.50')
  })
})
