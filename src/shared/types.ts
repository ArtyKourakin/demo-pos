/**
 * Data model for Demo POS.
 *
 * Money is ALWAYS an integer number of cents (`Cents`).
 * Percentages are ALWAYS integer basis points (`BasisPoints`, 100 bp = 1%, 1000 bp = 10%).
 */

export type Cents = number
export type BasisPoints = number

export type IconId =
  | 'espresso'
  | 'latte'
  | 'iced-tea'
  | 'croissant'
  | 'muffin'
  | 'bagel'
  | 'water'
  | 'chips'
  | 'chocolate'
  | 'sandwich'
  | 'donut'
  | 'cookie'
  | 'apple'
  | 'soda'
  | 'box'

export type Discount =
  | { type: 'percent'; basisPoints: BasisPoints; note?: string }
  | { type: 'fixed'; amountCents: Cents; note?: string }

export interface DiscountPreset {
  id: string
  label: string
  discount: Discount
}

export interface Product {
  id: string
  name: string
  sku: string
  category: string
  priceCents: Cents
  stock: number
  lowStockThreshold: number
  icon: IconId
  archived: boolean
  createdAt: string
}

export interface CartLine {
  productId: string
  quantity: number
  discount?: Discount
}

export interface Cart {
  lines: CartLine[]
  orderDiscount?: Discount
}

export type CardType = 'Visa' | 'Mastercard' | 'Amex' | 'Discover' | 'Other'

/** Card payments are a manual record only. NEVER a full card number, expiry date or CVV. */
export interface CardDetails {
  cardType: CardType
  /** Optional last 4 digits, exactly 4 digits when present. */
  last4?: string
  /** Optional approval / reference number from the standalone card terminal. */
  reference?: string
}

export interface CashPayment {
  method: 'cash'
  /** Portion of the sale total settled in cash. */
  amountCents: Cents
  /** Cash handed over by the customer. */
  tenderedCents: Cents
  changeCents: Cents
}

export interface CardPayment extends CardDetails {
  method: 'card'
  amountCents: Cents
}

export type Payment = CashPayment | CardPayment

export type PaymentInput =
  | { kind: 'cash'; tenderedCents: Cents }
  | { kind: 'card'; card: CardDetails }
  | { kind: 'split'; cashCents: Cents; cardCents: Cents; card: CardDetails }

export type PaymentMethod = 'cash' | 'card' | 'split'

export interface SaleLine {
  productId: string
  name: string
  sku: string
  unitPriceCents: Cents
  quantity: number
  grossCents: Cents
  discount?: Discount
  discountCents: Cents
  netCents: Cents
}

export interface Sale {
  id: string
  receiptNo: number
  createdAt: string
  storeName: string
  lines: SaleLine[]
  itemsGrossCents: Cents
  lineDiscountCents: Cents
  subtotalCents: Cents
  orderDiscount?: Discount
  orderDiscountCents: Cents
  taxRateBp: BasisPoints
  taxCents: Cents
  totalCents: Cents
  payments: Payment[]
  paymentMethod: PaymentMethod
  changeCents: Cents
  status: 'completed' | 'voided'
  voidedAt?: string
  voidReason?: string
}

export type MovementReason = 'sale' | 'received' | 'adjustment' | 'void'
export type AdjustmentReason = 'damaged' | 'count_correction' | 'other'

export interface StockMovement {
  id: string
  at: string
  productId: string
  productName: string
  /** Signed quantity change (+ received/void, - sale/damage). */
  change: number
  reason: MovementReason
  adjustmentReason?: AdjustmentReason
  note?: string
  saleId?: string
  resultingStock: number
}

export interface Settings {
  storeName: string
  taxRateBp: BasisPoints
  discountPresets: DiscountPreset[]
}

export interface AppData {
  schemaVersion: 1
  settings: Settings
  products: Product[]
  sales: Sale[]
  movements: StockMovement[]
  nextReceiptNo: number
}

/** Editable product fields (create when `id` is absent, update otherwise). */
export interface ProductInput {
  id?: string
  name: string
  sku: string
  category: string
  priceCents: Cents
  lowStockThreshold: number
  icon: IconId
  /** Only used when creating a product. */
  initialStock?: number
}
