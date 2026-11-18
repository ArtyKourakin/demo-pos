import { describe, expect, it } from 'vitest'
import { ICON_IDS } from '../src/shared/icons'
import {
  addToCart,
  adjustStock,
  buildPayments,
  completeSale,
  computeCartTotals,
  discountAmount,
  emptyCart,
  lowStockProducts,
  PosError,
  receiveStock,
  reconcileCart,
  setLineDiscount,
  setLineQuantity,
  setOrderDiscount,
  setProductArchived,
  stockStatus,
  updateSettings,
  upsertProduct,
  validateCardDetails,
  validateDiscount,
  voidSale
} from '../src/shared/pos'
import type { AppData, Cart } from '../src/shared/types'
import { findDataProblem } from '../src/shared/validate'
import { ctx, product, seed } from './helpers'

/** 2 lattes ($4.25) + 1 croissant ($3.50) = $12.00 */
function demoCart(data: AppData): Cart {
  let cart = addToCart(emptyCart(), product(data, 'p-latte'))
  cart = addToCart(cart, product(data, 'p-latte'))
  return addToCart(cart, product(data, 'p-croissant'))
}

describe('seed data', () => {
  it('has 10 valid products with one or two near the low-stock threshold', () => {
    const data = seed()
    expect(data.products).toHaveLength(10)
    expect(findDataProblem(data)).toBeNull()
    const low = lowStockProducts(data.products)
    expect(low.length).toBeGreaterThanOrEqual(1)
    expect(low.length).toBeLessThanOrEqual(2)
    expect(data.settings.taxRateBp).toBe(0)
  })
})

describe('cart totals and discounts', () => {
  it('totals the demo cart in integer cents', () => {
    const data = seed()
    const t = computeCartTotals(demoCart(data), data.products, 0)
    expect(t.itemCount).toBe(3)
    expect(t.itemsGrossCents).toBe(1200)
    expect(t.subtotalCents).toBe(1200)
    expect(t.totalCents).toBe(1200)
  })

  it('applies an order-level percentage discount', () => {
    const data = seed()
    const cart = setOrderDiscount(demoCart(data), { type: 'percent', basisPoints: 1000, note: 'Promo' })
    const t = computeCartTotals(cart, data.products, 0)
    expect(t.orderDiscountCents).toBe(120)
    expect(t.totalCents).toBe(1080)
    expect(t.orderDiscount?.note).toBe('Promo')
  })

  it('applies an order-level fixed discount', () => {
    const data = seed()
    const cart = setOrderDiscount(demoCart(data), { type: 'fixed', amountCents: 500 })
    expect(computeCartTotals(cart, data.products, 0).totalCents).toBe(700)
  })

  it('applies line-item percentage and fixed discounts', () => {
    const data = seed()
    let cart = setLineDiscount(demoCart(data), 'p-latte', { type: 'percent', basisPoints: 5000, note: 'Staff' })
    cart = setLineDiscount(cart, 'p-croissant', { type: 'fixed', amountCents: 100 })
    const t = computeCartTotals(cart, data.products, 0)
    const latte = t.lines.find((l) => l.productId === 'p-latte')!
    const croissant = t.lines.find((l) => l.productId === 'p-croissant')!
    expect(latte.grossCents).toBe(850)
    expect(latte.discountCents).toBe(425)
    expect(latte.netCents).toBe(425)
    expect(croissant.netCents).toBe(250)
    expect(t.lineDiscountCents).toBe(525)
    expect(t.subtotalCents).toBe(675)
    expect(t.totalCents).toBe(675)
  })

  it('stacks line and order discounts, then taxes the discounted amount', () => {
    const data = seed()
    let cart = setLineDiscount(demoCart(data), 'p-croissant', { type: 'fixed', amountCents: 50 })
    cart = setOrderDiscount(cart, { type: 'percent', basisPoints: 1000 })
    const t = computeCartTotals(cart, data.products, 825) // 8.25% tax
    expect(t.subtotalCents).toBe(1150)
    expect(t.orderDiscountCents).toBe(115)
    expect(t.taxCents).toBe(85) // 1035 * 8.25% = 85.3875 -> 85
    expect(t.totalCents).toBe(1035 + 85)
  })

  it('never lets a discount make a total negative', () => {
    const data = seed()
    let cart = setLineDiscount(demoCart(data), 'p-croissant', { type: 'fixed', amountCents: 99_999 })
    cart = setOrderDiscount(cart, { type: 'fixed', amountCents: 1_000_000 })
    const t = computeCartTotals(cart, data.products, 1000)
    expect(t.lines.find((l) => l.productId === 'p-croissant')!.netCents).toBe(0)
    expect(t.orderDiscountCents).toBe(t.subtotalCents)
    expect(t.totalCents).toBe(0)
    expect(t.lines.every((l) => l.netCents >= 0)).toBe(true)
    expect(discountAmount({ type: 'percent', basisPoints: 50_000 }, 1000)).toBe(1000)
  })

  it('validates discounts before they are applied', () => {
    expect(validateDiscount({ type: 'percent', basisPoints: 1000 })).toBeNull()
    expect(validateDiscount({ type: 'percent', basisPoints: 0 })).toMatch(/greater than 0/)
    expect(validateDiscount({ type: 'percent', basisPoints: 10_001 })).toMatch(/100%/)
    expect(validateDiscount({ type: 'fixed', amountCents: 500 }, 1200)).toBeNull()
    expect(validateDiscount({ type: 'fixed', amountCents: 1500 }, 1200)).toMatch(/more than/)
    expect(validateDiscount({ type: 'fixed', amountCents: 1.5 })).toMatch(/valid amount/)
  })
})

describe('stock rules in the cart', () => {
  it('never lets cart quantity exceed stock', () => {
    const data = seed()
    const sandwich = product(data, 'p-sandwich') // 3 in stock
    let cart = emptyCart()
    for (let i = 0; i < 3; i++) cart = addToCart(cart, sandwich)
    expect(() => addToCart(cart, sandwich)).toThrow(PosError)
    expect(() => setLineQuantity(cart, sandwich, 4)).toThrow(/Only 3/)
    expect(setLineQuantity(cart, sandwich, 0).lines).toHaveLength(0)
  })

  it('refuses out-of-stock and archived products', () => {
    const data = seed()
    const empty = { ...product(data, 'p-chips'), stock: 0 }
    expect(stockStatus(empty)).toBe('out')
    expect(() => addToCart(emptyCart(), empty)).toThrow(/out of stock/)
    const archived = { ...product(data, 'p-chips'), archived: true }
    expect(() => addToCart(emptyCart(), archived)).toThrow(/no longer sold/)
  })

  it('reconciles a cart after stock changes', () => {
    const data = seed()
    const cart = setLineQuantity(emptyCart(), product(data, 'p-latte'), 5)
    const products = data.products.map((p) => (p.id === 'p-latte' ? { ...p, stock: 2 } : p))
    const r = reconcileCart(cart, products)
    expect(r.changed).toBe(true)
    expect(r.cart.lines[0]!.quantity).toBe(2)
    expect(reconcileCart(r.cart, products).changed).toBe(false)
  })
})

describe('payments', () => {
  it('cash: computes change and blocks short payments', () => {
    const r = buildPayments({ kind: 'cash', tenderedCents: 2000 }, 1080)
    expect(r.method).toBe('cash')
    expect(r.changeCents).toBe(920)
    expect(r.payments[0]).toMatchObject({ method: 'cash', amountCents: 1080, tenderedCents: 2000, changeCents: 920 })
    expect(() => buildPayments({ kind: 'cash', tenderedCents: 1079 }, 1080)).toThrow(/less than the total/)
    expect(buildPayments({ kind: 'cash', tenderedCents: 1080 }, 1080).changeCents).toBe(0)
  })

  it('card: stores only card type, last 4 and reference', () => {
    const r = buildPayments({ kind: 'card', card: { cardType: 'Visa', last4: '4242', reference: ' A1B2 ' } }, 1080)
    expect(r.payments).toEqual([{ method: 'card', amountCents: 1080, cardType: 'Visa', last4: '4242', reference: 'A1B2' }])
    expect(validateCardDetails({ cardType: 'Visa', last4: '424' })).toMatch(/4 digits/)
    expect(validateCardDetails({ cardType: 'Visa', reference: '4242 4242 4242 4242' })).toMatch(/card number/)
    expect(() => buildPayments({ kind: 'card', card: { cardType: 'Visa', last4: '12345' } }, 100)).toThrow(PosError)
  })

  it('split: cash + card must add up to the total', () => {
    const card = { cardType: 'Mastercard' as const }
    const r = buildPayments({ kind: 'split', cashCents: 500, cardCents: 580, card }, 1080)
    expect(r.method).toBe('split')
    expect(r.payments.map((p) => [p.method, p.amountCents])).toEqual([
      ['cash', 500],
      ['card', 580]
    ])
    expect(() => buildPayments({ kind: 'split', cashCents: 500, cardCents: 500, card }, 1080)).toThrow(/must equal/)
    expect(() => buildPayments({ kind: 'split', cashCents: 600, cardCents: 500, card }, 1080)).toThrow(/must equal/)
    expect(() => buildPayments({ kind: 'split', cashCents: 0, cardCents: 1080, card }, 1080)).toThrow(/both/)
  })
})

describe('completing a sale', () => {
  it('saves the sale, decrements stock and logs movements in one step (demo scenario)', () => {
    const data = seed()
    const cart = setOrderDiscount(demoCart(data), { type: 'percent', basisPoints: 1000 })
    const { data: next, sale } = completeSale(data, cart, { kind: 'cash', tenderedCents: 2000 }, ctx())

    expect(sale.totalCents).toBe(1080)
    expect(sale.changeCents).toBe(920)
    expect(sale.receiptNo).toBe(1001)
    expect(sale.status).toBe('completed')
    expect(next.sales).toHaveLength(1)
    expect(next.nextReceiptNo).toBe(1002)
    expect(product(next, 'p-latte').stock).toBe(product(data, 'p-latte').stock - 2)
    expect(product(next, 'p-croissant').stock).toBe(product(data, 'p-croissant').stock - 1)

    const saleMoves = next.movements.filter((m) => m.saleId === sale.id)
    expect(saleMoves).toHaveLength(2)
    expect(saleMoves.find((m) => m.productId === 'p-latte')).toMatchObject({ change: -2, reason: 'sale', resultingStock: 33 })

    // input untouched (pure function)
    expect(data.sales).toHaveLength(0)
    expect(product(data, 'p-latte').stock).toBe(35)
    expect(findDataProblem(next)).toBeNull()
  })

  it('stock can never go negative: selling more than in stock is rejected and nothing changes', () => {
    const data = seed()
    const cart: Cart = { lines: [{ productId: 'p-sandwich', quantity: 4 }] } // only 3 in stock
    expect(() => completeSale(data, cart, { kind: 'cash', tenderedCents: 10_000 }, ctx())).toThrow(/Only 3/)
    expect(product(data, 'p-sandwich').stock).toBe(3)
    expect(data.sales).toHaveLength(0)
  })

  it('sells the last unit down to exactly zero', () => {
    const data = seed()
    const cart: Cart = { lines: [{ productId: 'p-sandwich', quantity: 3 }] }
    const { data: next } = completeSale(data, cart, { kind: 'card', card: { cardType: 'Amex' } }, ctx())
    expect(product(next, 'p-sandwich').stock).toBe(0)
    expect(() => completeSale(next, { lines: [{ productId: 'p-sandwich', quantity: 1 }] }, { kind: 'cash', tenderedCents: 1000 }, ctx())).toThrow(
      PosError
    )
  })

  it('rejects empty carts, bad quantities, short cash and duplicate lines without changing data', () => {
    const data = seed()
    expect(() => completeSale(data, emptyCart(), { kind: 'cash', tenderedCents: 0 }, ctx())).toThrow(/empty/)
    expect(() => completeSale(data, { lines: [{ productId: 'p-latte', quantity: 0 }] }, { kind: 'cash', tenderedCents: 0 }, ctx())).toThrow()
    expect(() => completeSale(data, { lines: [{ productId: 'p-latte', quantity: 1.5 }] }, { kind: 'cash', tenderedCents: 999 }, ctx())).toThrow()
    expect(() => completeSale(data, demoCart(data), { kind: 'cash', tenderedCents: 1199 }, ctx())).toThrow(/less than/)
    const dup: Cart = { lines: [{ productId: 'p-latte', quantity: 1 }, { productId: 'p-latte', quantity: 1 }] }
    expect(() => completeSale(data, dup, { kind: 'cash', tenderedCents: 5000 }, ctx())).toThrow(/duplicate/)
    expect(data.sales).toHaveLength(0)
  })

  it('records a split payment sale', () => {
    const data = seed()
    const { sale } = completeSale(data, demoCart(data), { kind: 'split', cashCents: 200, cardCents: 1000, card: { cardType: 'Visa', last4: '1111' } }, ctx())
    expect(sale.paymentMethod).toBe('split')
    expect(sale.payments.reduce((n, p) => n + p.amountCents, 0)).toBe(sale.totalCents)
  })
})

describe('voiding a sale', () => {
  it('marks it voided, restores stock and logs void movements', () => {
    const data = seed()
    const { data: afterSale, sale } = completeSale(data, demoCart(data), { kind: 'cash', tenderedCents: 1200 }, ctx())
    const afterVoid = voidSale(afterSale, sale.id, 'Customer changed mind', ctx('2026-11-19T16:00:00.000Z'))

    const voided = afterVoid.sales.find((s) => s.id === sale.id)!
    expect(voided.status).toBe('voided')
    expect(voided.voidReason).toBe('Customer changed mind')
    expect(voided.voidedAt).toBe('2026-11-19T16:00:00.000Z')
    expect(product(afterVoid, 'p-latte').stock).toBe(product(data, 'p-latte').stock)
    expect(product(afterVoid, 'p-croissant').stock).toBe(product(data, 'p-croissant').stock)

    const voidMoves = afterVoid.movements.filter((m) => m.reason === 'void')
    expect(voidMoves.map((m) => [m.productId, m.change])).toEqual([
      ['p-latte', 2],
      ['p-croissant', 1]
    ])
    expect(findDataProblem(afterVoid)).toBeNull()
  })

  it('cannot void twice (stock is only restored once)', () => {
    const data = seed()
    const { data: afterSale, sale } = completeSale(data, demoCart(data), { kind: 'cash', tenderedCents: 1200 }, ctx())
    const once = voidSale(afterSale, sale.id, '', ctx())
    expect(() => voidSale(once, sale.id, '', ctx())).toThrow(/already voided/)
    expect(() => voidSale(once, 'nope', '', ctx())).toThrow(/not found/)
  })

  it('restores stock even if the product was archived after the sale', () => {
    const data = seed()
    const { data: afterSale, sale } = completeSale(data, demoCart(data), { kind: 'cash', tenderedCents: 1200 }, ctx())
    const archived = setProductArchived(afterSale, 'p-croissant', true)
    const afterVoid = voidSale(archived, sale.id, '', ctx())
    expect(product(afterVoid, 'p-croissant').stock).toBe(12)
  })
})

describe('inventory operations', () => {
  it('receives stock with a note', () => {
    const data = seed()
    const next = receiveStock(data, 'p-muffin', 12, 'Morning delivery', ctx())
    expect(product(next, 'p-muffin').stock).toBe(16)
    expect(next.movements.at(-1)).toMatchObject({ productId: 'p-muffin', change: 12, reason: 'received', note: 'Morning delivery', resultingStock: 16 })
    expect(() => receiveStock(data, 'p-muffin', 0, '', ctx())).toThrow()
    expect(() => receiveStock(data, 'p-muffin', -3, '', ctx())).toThrow()
  })

  it('adjusts stock to an exact count with a reason, never below zero', () => {
    const data = seed()
    const next = adjustStock(data, 'p-water', 45, 'damaged', 'Dropped a pack', ctx())
    expect(product(next, 'p-water').stock).toBe(45)
    expect(next.movements.at(-1)).toMatchObject({ change: -3, reason: 'adjustment', adjustmentReason: 'damaged', resultingStock: 45 })
    expect(() => adjustStock(data, 'p-water', -1, 'other', '', ctx())).toThrow(/0 or more/)
    expect(() => adjustStock(data, 'p-water', 48, 'count_correction', '', ctx())).toThrow(/already/)
  })

  it('adds, edits and archives products', () => {
    const data = seed()
    const added = upsertProduct(
      data,
      { name: 'Donut', sku: 'BAK-009', category: 'Bakery', priceCents: 199, lowStockThreshold: 4, icon: 'donut', initialStock: 10 },
      ICON_IDS,
      ctx()
    )
    const donut = added.products.find((p) => p.sku === 'BAK-009')!
    expect(donut.stock).toBe(10)
    expect(added.movements.at(-1)).toMatchObject({ productId: donut.id, change: 10, reason: 'received' })

    const edited = upsertProduct(added, { id: donut.id, name: 'Glazed Donut', sku: 'BAK-009', category: 'Bakery', priceCents: 249, lowStockThreshold: 4, icon: 'donut' }, ICON_IDS, ctx())
    expect(product(edited, donut.id)).toMatchObject({ name: 'Glazed Donut', priceCents: 249, stock: 10 })

    expect(() =>
      upsertProduct(data, { name: 'Dup', sku: 'cof-001', category: 'X', priceCents: 1, lowStockThreshold: 0, icon: 'box' }, ICON_IDS, ctx())
    ).toThrow(/already used/)

    expect(product(setProductArchived(data, 'p-chips', true), 'p-chips').archived).toBe(true)
  })

  it('validates settings', () => {
    const data = seed()
    const next = updateSettings(data, { ...data.settings, storeName: '  Corner Café ', taxRateBp: 825 })
    expect(next.settings.storeName).toBe('Corner Café')
    expect(next.settings.taxRateBp).toBe(825)
    expect(() => updateSettings(data, { ...data.settings, storeName: ' ' })).toThrow()
    expect(() => updateSettings(data, { ...data.settings, taxRateBp: -1 })).toThrow()
  })
})
