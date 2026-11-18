/**
 * Pure, framework-free POS business logic.
 *
 * - Never mutates its inputs: every operation returns new objects.
 * - All money is integer cents; all percentages are integer basis points.
 * - Business-rule violations throw `PosError` with a cashier-friendly message.
 */
import { applyBasisPoints, assertCents, formatCents, PosError } from './money'
import type {
  AdjustmentReason,
  AppData,
  CardDetails,
  CardType,
  Cart,
  CartLine,
  Cents,
  Discount,
  IconId,
  Payment,
  PaymentInput,
  PaymentMethod,
  Product,
  ProductInput,
  Sale,
  SaleLine,
  Settings,
  StockMovement
} from './types'

export { PosError } from './money'

/** Clock + id generator are injected so the logic stays deterministic and testable. */
export interface OpContext {
  /** ISO timestamp used for everything created by this operation. */
  now: string
  newId: () => string
}

export const CARD_TYPES: readonly CardType[] = ['Visa', 'Mastercard', 'Amex', 'Discover', 'Other']
export const MAX_NOTE_LENGTH = 80
export const MAX_QUANTITY = 100_000

// ---------------------------------------------------------------------------
// Stock helpers
// ---------------------------------------------------------------------------

export type StockStatus = 'ok' | 'low' | 'out'

export function stockStatus(p: Pick<Product, 'stock' | 'lowStockThreshold'>): StockStatus {
  if (p.stock <= 0) return 'out'
  if (p.stock <= p.lowStockThreshold) return 'low'
  return 'ok'
}

/** Active products at or below their low-stock threshold (includes out-of-stock ones). */
export function lowStockProducts(products: Product[]): Product[] {
  return products.filter((p) => !p.archived && p.stock <= p.lowStockThreshold)
}

// ---------------------------------------------------------------------------
// Discounts
// ---------------------------------------------------------------------------

/** Amount a discount takes off `baseCents`, always clamped to [0, baseCents]. */
export function discountAmount(discount: Discount | undefined, baseCents: Cents): Cents {
  assertCents(baseCents)
  if (!discount || baseCents <= 0) return 0
  const raw =
    discount.type === 'percent'
      ? applyBasisPoints(baseCents, Math.max(0, Math.min(10_000, discount.basisPoints)))
      : Math.max(0, discount.amountCents)
  return Math.min(raw, baseCents)
}

/**
 * Validate a discount the cashier is about to apply.
 * When `baseCents` is given, a fixed discount larger than the base is rejected
 * (so a discount can never push a total below zero).
 * Returns an error message, or null when valid.
 */
export function validateDiscount(discount: Discount, baseCents?: Cents): string | null {
  if (discount.type === 'percent') {
    if (!Number.isSafeInteger(discount.basisPoints)) return 'Enter a valid percentage.'
    if (discount.basisPoints <= 0) return 'Percentage must be greater than 0.'
    if (discount.basisPoints > 10_000) return 'Percentage cannot be more than 100%.'
  } else if (discount.type === 'fixed') {
    if (!Number.isSafeInteger(discount.amountCents)) return 'Enter a valid amount.'
    if (discount.amountCents <= 0) return 'Amount must be greater than $0.00.'
    if (baseCents !== undefined && discount.amountCents > baseCents) {
      return `Discount (${formatCents(discount.amountCents)}) is more than the amount it applies to (${formatCents(baseCents)}).`
    }
  } else {
    return 'Unknown discount type.'
  }
  if (discount.note !== undefined && discount.note.length > MAX_NOTE_LENGTH) {
    return `Note must be at most ${MAX_NOTE_LENGTH} characters.`
  }
  return null
}

export function describeDiscount(discount: Discount): string {
  const base =
    discount.type === 'percent'
      ? `${formatPercent(discount.basisPoints)} off`
      : `${formatCents(discount.amountCents)} off`
  return discount.note ? `${base} (${discount.note})` : base
}

function formatPercent(bp: number): string {
  const whole = Math.floor(bp / 100)
  const frac = bp % 100
  return frac === 0 ? `${whole}%` : `${whole}.${frac.toString().padStart(2, '0').replace(/0$/, '')}%`
}

function cleanDiscount(discount: Discount | undefined): Discount | undefined {
  if (!discount) return undefined
  const note = discount.note?.trim()
  const withNote = note ? { note } : {}
  return discount.type === 'percent'
    ? { type: 'percent', basisPoints: discount.basisPoints, ...withNote }
    : { type: 'fixed', amountCents: discount.amountCents, ...withNote }
}

// ---------------------------------------------------------------------------
// Cart totals
// ---------------------------------------------------------------------------

export type LineTotals = SaleLine

export interface CartTotals {
  lines: LineTotals[]
  itemCount: number
  itemsGrossCents: Cents
  lineDiscountCents: Cents
  /** Items after line discounts, before the order discount. */
  subtotalCents: Cents
  orderDiscount?: Discount
  orderDiscountCents: Cents
  taxRateBp: number
  taxCents: Cents
  totalCents: Cents
}

/**
 * gross per line − line discount = line net
 * Σ line net = subtotal
 * subtotal − order discount = taxable
 * taxable + tax(taxable) = total
 */
export function computeCartTotals(cart: Cart, products: Product[], taxRateBp: number): CartTotals {
  if (!Number.isSafeInteger(taxRateBp) || taxRateBp < 0) throw new PosError('Tax rate is invalid.')
  const byId = new Map(products.map((p) => [p.id, p]))
  const lines: LineTotals[] = cart.lines.map((line) => {
    const product = byId.get(line.productId)
    if (!product) throw new PosError('A product in the cart no longer exists.')
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new PosError(`Invalid quantity for ${product.name}.`)
    }
    const grossCents = product.priceCents * line.quantity
    const discountCents = discountAmount(line.discount, grossCents)
    const discount = cleanDiscount(line.discount)
    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      unitPriceCents: product.priceCents,
      quantity: line.quantity,
      grossCents,
      ...(discount ? { discount } : {}),
      discountCents,
      netCents: grossCents - discountCents
    }
  })

  const itemsGrossCents = sum(lines.map((l) => l.grossCents))
  const lineDiscountCents = sum(lines.map((l) => l.discountCents))
  const subtotalCents = itemsGrossCents - lineDiscountCents
  const orderDiscountCents = discountAmount(cart.orderDiscount, subtotalCents)
  const taxableCents = subtotalCents - orderDiscountCents
  const taxCents = applyBasisPoints(taxableCents, taxRateBp)
  const orderDiscount = cleanDiscount(cart.orderDiscount)

  return {
    lines,
    itemCount: sum(lines.map((l) => l.quantity)),
    itemsGrossCents,
    lineDiscountCents,
    subtotalCents,
    ...(orderDiscount ? { orderDiscount } : {}),
    orderDiscountCents,
    taxRateBp,
    taxCents,
    totalCents: taxableCents + taxCents
  }
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

// ---------------------------------------------------------------------------
// Cart operations (stock-aware: cart quantity can never exceed stock)
// ---------------------------------------------------------------------------

export const emptyCart = (): Cart => ({ lines: [] })

export function cartQuantity(cart: Cart, productId: string): number {
  return cart.lines.find((l) => l.productId === productId)?.quantity ?? 0
}

export function addToCart(cart: Cart, product: Product, quantity = 1): Cart {
  if (product.archived) throw new PosError(`${product.name} is no longer sold.`)
  if (product.stock <= 0) throw new PosError(`${product.name} is out of stock.`)
  const current = cartQuantity(cart, product.id)
  const next = current + quantity
  if (next > product.stock) {
    throw new PosError(`Only ${product.stock} ${product.name} in stock.`)
  }
  if (current === 0) {
    return { ...cart, lines: [...cart.lines, { productId: product.id, quantity: next }] }
  }
  return {
    ...cart,
    lines: cart.lines.map((l) => (l.productId === product.id ? { ...l, quantity: next } : l))
  }
}

/** Set an exact quantity; 0 or less removes the line. Throws if it would exceed stock. */
export function setLineQuantity(cart: Cart, product: Product, quantity: number): Cart {
  if (!Number.isSafeInteger(quantity)) throw new PosError('Quantity must be a whole number.')
  if (quantity <= 0) return removeLine(cart, product.id)
  if (quantity > product.stock) throw new PosError(`Only ${product.stock} ${product.name} in stock.`)
  if (cartQuantity(cart, product.id) === 0) return addToCart(cart, product, quantity)
  return {
    ...cart,
    lines: cart.lines.map((l) => (l.productId === product.id ? { ...l, quantity } : l))
  }
}

export function removeLine(cart: Cart, productId: string): Cart {
  return { ...cart, lines: cart.lines.filter((l) => l.productId !== productId) }
}

export function setLineDiscount(cart: Cart, productId: string, discount: Discount | undefined): Cart {
  return {
    ...cart,
    lines: cart.lines.map((l) => {
      if (l.productId !== productId) return l
      const { discount: _old, ...rest } = l
      const cleaned = cleanDiscount(discount)
      return cleaned ? { ...rest, discount: cleaned } : rest
    })
  }
}

export function setOrderDiscount(cart: Cart, discount: Discount | undefined): Cart {
  const { orderDiscount: _old, ...rest } = cart
  const cleaned = cleanDiscount(discount)
  return cleaned ? { ...rest, orderDiscount: cleaned } : rest
}

/**
 * Bring a cart back in line with the current product list (after a reload, import or reset):
 * drops lines for missing / archived / out-of-stock products and caps quantities at stock.
 */
export function reconcileCart(cart: Cart, products: Product[]): { cart: Cart; changed: boolean } {
  const byId = new Map(products.map((p) => [p.id, p]))
  let changed = false
  const lines: CartLine[] = []
  for (const line of cart.lines) {
    const p = byId.get(line.productId)
    if (!p || p.archived || p.stock <= 0) {
      changed = true
      continue
    }
    if (line.quantity > p.stock) {
      changed = true
      lines.push({ ...line, quantity: p.stock })
    } else {
      lines.push(line)
    }
  }
  return { cart: changed ? { ...cart, lines } : cart, changed }
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export function validateCardDetails(card: CardDetails): string | null {
  if (!CARD_TYPES.includes(card.cardType)) return 'Choose a card type.'
  if (card.last4 !== undefined && card.last4 !== '' && !/^\d{4}$/.test(card.last4)) {
    return 'Last 4 digits must be exactly 4 digits.'
  }
  if (card.reference !== undefined && card.reference !== '') {
    if (card.reference.length > 40) return 'Reference number is too long.'
    // Guard against a full card number being typed into the reference field.
    if (/^\d{12,19}$/.test(card.reference.replace(/[\s-]/g, ''))) {
      return 'That looks like a card number. Never enter full card numbers, only the approval/reference code.'
    }
  }
  return null
}

function cleanCard(card: CardDetails): CardDetails {
  const last4 = card.last4?.trim()
  const reference = card.reference?.trim()
  return {
    cardType: card.cardType,
    ...(last4 ? { last4 } : {}),
    ...(reference ? { reference } : {})
  }
}

export interface PaymentResult {
  payments: Payment[]
  method: PaymentMethod
  changeCents: Cents
}

/** Validate a payment against the sale total and produce the payment records. */
export function buildPayments(input: PaymentInput, totalCents: Cents): PaymentResult {
  assertCents(totalCents, 'Total')
  switch (input.kind) {
    case 'cash': {
      assertCents(input.tenderedCents, 'Amount received')
      if (input.tenderedCents < totalCents) {
        throw new PosError(
          `Amount received (${formatCents(input.tenderedCents)}) is less than the total (${formatCents(totalCents)}).`
        )
      }
      const changeCents = input.tenderedCents - totalCents
      return {
        payments: [{ method: 'cash', amountCents: totalCents, tenderedCents: input.tenderedCents, changeCents }],
        method: 'cash',
        changeCents
      }
    }
    case 'card': {
      const err = validateCardDetails(input.card)
      if (err) throw new PosError(err)
      return {
        payments: [{ method: 'card', amountCents: totalCents, ...cleanCard(input.card) }],
        method: 'card',
        changeCents: 0
      }
    }
    case 'split': {
      assertCents(input.cashCents, 'Cash amount')
      assertCents(input.cardCents, 'Card amount')
      if (input.cashCents <= 0 || input.cardCents <= 0) {
        throw new PosError('A split payment needs both a cash amount and a card amount.')
      }
      if (input.cashCents + input.cardCents !== totalCents) {
        throw new PosError(
          `Cash + card (${formatCents(input.cashCents + input.cardCents)}) must equal the total (${formatCents(totalCents)}).`
        )
      }
      const err = validateCardDetails(input.card)
      if (err) throw new PosError(err)
      return {
        payments: [
          { method: 'cash', amountCents: input.cashCents, tenderedCents: input.cashCents, changeCents: 0 },
          { method: 'card', amountCents: input.cardCents, ...cleanCard(input.card) }
        ],
        method: 'split',
        changeCents: 0
      }
    }
    default:
      throw new PosError('Unknown payment type.')
  }
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

/**
 * Complete a sale as ONE operation: save the sale, subtract stock, and log a stock movement per item.
 * Returns a brand-new AppData; the input is untouched, so callers can persist atomically.
 */
export function completeSale(
  data: AppData,
  cart: Cart,
  paymentInput: PaymentInput,
  ctx: OpContext
): { data: AppData; sale: Sale } {
  if (cart.lines.length === 0) throw new PosError('The cart is empty.')
  const seen = new Set<string>()
  for (const line of cart.lines) {
    if (seen.has(line.productId)) throw new PosError('The cart contains a duplicate line.')
    seen.add(line.productId)
    const product = data.products.find((p) => p.id === line.productId)
    if (!product) throw new PosError('A product in the cart no longer exists.')
    if (product.archived) throw new PosError(`${product.name} is no longer sold.`)
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new PosError(`Invalid quantity for ${product.name}.`)
    }
    if (line.quantity > product.stock) {
      throw new PosError(`Only ${product.stock} ${product.name} in stock.`)
    }
    if (line.discount) {
      const err = validateDiscount(line.discount)
      if (err) throw new PosError(`${product.name}: ${err}`)
    }
  }
  if (cart.orderDiscount) {
    const err = validateDiscount(cart.orderDiscount)
    if (err) throw new PosError(err)
  }

  const totals = computeCartTotals(cart, data.products, data.settings.taxRateBp)
  const payment = buildPayments(paymentInput, totals.totalCents)

  const next = structuredClone(data)
  const sale: Sale = {
    id: ctx.newId(),
    receiptNo: next.nextReceiptNo,
    createdAt: ctx.now,
    storeName: next.settings.storeName,
    lines: totals.lines,
    itemsGrossCents: totals.itemsGrossCents,
    lineDiscountCents: totals.lineDiscountCents,
    subtotalCents: totals.subtotalCents,
    ...(totals.orderDiscount ? { orderDiscount: totals.orderDiscount } : {}),
    orderDiscountCents: totals.orderDiscountCents,
    taxRateBp: totals.taxRateBp,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    payments: payment.payments,
    paymentMethod: payment.method,
    changeCents: payment.changeCents,
    status: 'completed'
  }

  for (const line of sale.lines) {
    const product = next.products.find((p) => p.id === line.productId)!
    product.stock -= line.quantity
    next.movements.push({
      id: ctx.newId(),
      at: ctx.now,
      productId: product.id,
      productName: product.name,
      change: -line.quantity,
      reason: 'sale',
      note: `Receipt #${sale.receiptNo}`,
      saleId: sale.id,
      resultingStock: product.stock
    })
  }
  next.sales.push(sale)
  next.nextReceiptNo += 1
  return { data: next, sale }
}

/** Mark a sale voided, return its items to stock and log a 'void' movement per item. */
export function voidSale(data: AppData, saleId: string, reason: string, ctx: OpContext): AppData {
  const existing = data.sales.find((s) => s.id === saleId)
  if (!existing) throw new PosError('Sale not found.')
  if (existing.status === 'voided') throw new PosError(`Receipt #${existing.receiptNo} is already voided.`)
  const trimmed = reason.trim()
  if (trimmed.length > MAX_NOTE_LENGTH) throw new PosError(`Reason must be at most ${MAX_NOTE_LENGTH} characters.`)

  const next = structuredClone(data)
  const sale = next.sales.find((s) => s.id === saleId)!
  sale.status = 'voided'
  sale.voidedAt = ctx.now
  if (trimmed) sale.voidReason = trimmed

  for (const line of sale.lines) {
    const product = next.products.find((p) => p.id === line.productId)
    if (!product) continue // product record missing (should never happen: products are archived, not deleted)
    product.stock += line.quantity
    next.movements.push({
      id: ctx.newId(),
      at: ctx.now,
      productId: product.id,
      productName: product.name,
      change: line.quantity,
      reason: 'void',
      note: `Void of receipt #${sale.receiptNo}${trimmed ? ` – ${trimmed}` : ''}`,
      saleId: sale.id,
      resultingStock: product.stock
    })
  }
  return next
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

function findProduct(data: AppData, productId: string): Product {
  const p = data.products.find((x) => x.id === productId)
  if (!p) throw new PosError('Product not found.')
  return p
}

function checkNote(note: string): string | undefined {
  const t = note.trim()
  if (t.length > MAX_NOTE_LENGTH) throw new PosError(`Note must be at most ${MAX_NOTE_LENGTH} characters.`)
  return t || undefined
}

export function receiveStock(
  data: AppData,
  productId: string,
  quantity: number,
  note: string,
  ctx: OpContext
): AppData {
  findProduct(data, productId)
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new PosError('Quantity must be a whole number above 0.')
  if (quantity > MAX_QUANTITY) throw new PosError(`Quantity cannot exceed ${MAX_QUANTITY}.`)
  const cleanNote = checkNote(note)
  const next = structuredClone(data)
  const product = findProduct(next, productId)
  product.stock += quantity
  next.movements.push(movement(ctx, product, quantity, 'received', cleanNote))
  return next
}

export function adjustStock(
  data: AppData,
  productId: string,
  newCount: number,
  adjustmentReason: AdjustmentReason,
  note: string,
  ctx: OpContext
): AppData {
  const current = findProduct(data, productId)
  if (!Number.isSafeInteger(newCount) || newCount < 0) {
    throw new PosError('Stock count must be a whole number of 0 or more.')
  }
  if (newCount > MAX_QUANTITY) throw new PosError(`Stock count cannot exceed ${MAX_QUANTITY}.`)
  if (!['damaged', 'count_correction', 'other'].includes(adjustmentReason)) {
    throw new PosError('Choose a reason for the adjustment.')
  }
  if (newCount === current.stock) throw new PosError(`Stock is already ${newCount}.`)
  const cleanNote = checkNote(note)
  const next = structuredClone(data)
  const product = findProduct(next, productId)
  const change = newCount - product.stock
  product.stock = newCount
  next.movements.push({ ...movement(ctx, product, change, 'adjustment', cleanNote), adjustmentReason })
  return next
}

function movement(
  ctx: OpContext,
  product: Product,
  change: number,
  reason: StockMovement['reason'],
  note: string | undefined
): StockMovement {
  return {
    id: ctx.newId(),
    at: ctx.now,
    productId: product.id,
    productName: product.name,
    change,
    reason,
    ...(note ? { note } : {}),
    resultingStock: product.stock
  }
}

export function validateProductInput(data: AppData, input: ProductInput, validIcons: readonly IconId[]): string | null {
  const name = input.name.trim()
  const sku = input.sku.trim()
  const category = input.category.trim()
  if (!name) return 'Name is required.'
  if (name.length > 40) return 'Name must be at most 40 characters.'
  if (!sku) return 'SKU is required.'
  if (sku.length > 24) return 'SKU must be at most 24 characters.'
  if (!category) return 'Category is required.'
  if (category.length > 24) return 'Category must be at most 24 characters.'
  if (!Number.isSafeInteger(input.priceCents) || input.priceCents < 0) return 'Enter a valid price.'
  if (input.priceCents > 99_999_99) return 'Price is too large.'
  if (!Number.isSafeInteger(input.lowStockThreshold) || input.lowStockThreshold < 0) {
    return 'Low-stock threshold must be a whole number of 0 or more.'
  }
  if (!validIcons.includes(input.icon)) return 'Choose an image.'
  if (input.id === undefined && input.initialStock !== undefined) {
    if (!Number.isSafeInteger(input.initialStock) || input.initialStock < 0 || input.initialStock > MAX_QUANTITY) {
      return 'Starting stock must be a whole number of 0 or more.'
    }
  }
  const skuTaken = data.products.some((p) => p.id !== input.id && p.sku.toLowerCase() === sku.toLowerCase())
  if (skuTaken) return `SKU "${sku}" is already used by another product.`
  if (input.id !== undefined && !data.products.some((p) => p.id === input.id)) return 'Product not found.'
  return null
}

export function upsertProduct(
  data: AppData,
  input: ProductInput,
  validIcons: readonly IconId[],
  ctx: OpContext
): AppData {
  const err = validateProductInput(data, input, validIcons)
  if (err) throw new PosError(err)
  const next = structuredClone(data)
  const fields = {
    name: input.name.trim(),
    sku: input.sku.trim(),
    category: input.category.trim(),
    priceCents: input.priceCents,
    lowStockThreshold: input.lowStockThreshold,
    icon: input.icon
  }
  if (input.id !== undefined) {
    const product = findProduct(next, input.id)
    Object.assign(product, fields)
    return next
  }
  const product: Product = {
    id: ctx.newId(),
    ...fields,
    stock: 0,
    archived: false,
    createdAt: ctx.now
  }
  next.products.push(product)
  const initial = input.initialStock ?? 0
  if (initial > 0) {
    product.stock = initial
    next.movements.push(movement(ctx, product, initial, 'received', 'Initial stock'))
  }
  return next
}

export function setProductArchived(data: AppData, productId: string, archived: boolean): AppData {
  findProduct(data, productId)
  const next = structuredClone(data)
  findProduct(next, productId).archived = archived
  return next
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function validateSettings(settings: Settings): string | null {
  const name = settings.storeName.trim()
  if (!name) return 'Store name is required.'
  if (name.length > 60) return 'Store name must be at most 60 characters.'
  if (!Number.isSafeInteger(settings.taxRateBp) || settings.taxRateBp < 0 || settings.taxRateBp > 5_000) {
    return 'Tax rate must be between 0% and 50%.'
  }
  const ids = new Set<string>()
  for (const preset of settings.discountPresets) {
    if (!preset.id || ids.has(preset.id)) return 'Discount presets have duplicate ids.'
    ids.add(preset.id)
    if (!preset.label.trim()) return 'Every discount preset needs a name.'
    if (preset.label.trim().length > 24) return 'Preset names must be at most 24 characters.'
    const err = validateDiscount(preset.discount)
    if (err) return `Preset "${preset.label}": ${err}`
  }
  return null
}

export function updateSettings(data: AppData, settings: Settings): AppData {
  const err = validateSettings(settings)
  if (err) throw new PosError(err)
  const next = structuredClone(data)
  next.settings = {
    storeName: settings.storeName.trim(),
    taxRateBp: settings.taxRateBp,
    discountPresets: settings.discountPresets.map((p) => ({
      id: p.id,
      label: p.label.trim(),
      discount: cleanDiscount(p.discount)!
    }))
  }
  return next
}
