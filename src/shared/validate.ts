/**
 * Structural validation for the data file and imported backups.
 * Rejects anything that doesn't look like Demo POS data so a bad import can't corrupt the store.
 */
import { ICON_IDS } from './icons'
import type { AppData } from './types'

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)
const isOptStr = (v: unknown): boolean => v === undefined || isStr(v)

function isDiscount(v: unknown): boolean {
  if (!isObj(v) || !isOptStr(v.note)) return false
  if (v.type === 'percent') return isInt(v.basisPoints) && v.basisPoints >= 0 && v.basisPoints <= 10_000
  if (v.type === 'fixed') return isInt(v.amountCents) && v.amountCents >= 0
  return false
}

function checkProduct(p: unknown, i: number): string | null {
  const at = `products[${i}]`
  if (!isObj(p)) return `${at} is not an object`
  for (const k of ['id', 'name', 'sku', 'category', 'createdAt'] as const) {
    if (!isStr(p[k])) return `${at}.${k} must be text`
  }
  for (const k of ['priceCents', 'stock', 'lowStockThreshold'] as const) {
    const v = p[k]
    if (!isInt(v) || v < 0) return `${at}.${k} must be a whole number ≥ 0`
  }
  if (!isStr(p.icon) || !(ICON_IDS as readonly string[]).includes(p.icon)) return `${at}.icon is unknown`
  if (typeof p.archived !== 'boolean') return `${at}.archived must be true/false`
  return null
}

function checkPayment(p: unknown): boolean {
  if (!isObj(p) || !isInt(p.amountCents)) return false
  if (p.method === 'cash') return isInt(p.tenderedCents) && isInt(p.changeCents)
  if (p.method === 'card') return isStr(p.cardType) && isOptStr(p.last4) && isOptStr(p.reference)
  return false
}

function checkSale(s: unknown, i: number): string | null {
  const at = `sales[${i}]`
  if (!isObj(s)) return `${at} is not an object`
  for (const k of ['id', 'createdAt', 'storeName'] as const) if (!isStr(s[k])) return `${at}.${k} must be text`
  for (const k of [
    'receiptNo',
    'itemsGrossCents',
    'lineDiscountCents',
    'subtotalCents',
    'orderDiscountCents',
    'taxRateBp',
    'taxCents',
    'totalCents',
    'changeCents'
  ] as const) {
    if (!isInt(s[k])) return `${at}.${k} must be a whole number`
  }
  if (s.orderDiscount !== undefined && !isDiscount(s.orderDiscount)) return `${at}.orderDiscount is invalid`
  if (!['cash', 'card', 'split'].includes(s.paymentMethod as string)) return `${at}.paymentMethod is invalid`
  if (!['completed', 'voided'].includes(s.status as string)) return `${at}.status is invalid`
  if (!Array.isArray(s.payments) || !s.payments.every(checkPayment)) return `${at}.payments are invalid`
  if (!Array.isArray(s.lines) || s.lines.length === 0) return `${at}.lines are missing`
  for (const l of s.lines as unknown[]) {
    if (!isObj(l)) return `${at}.lines contain an invalid entry`
    if (!isStr(l.productId) || !isStr(l.name) || !isStr(l.sku)) return `${at}.lines contain an invalid entry`
    for (const k of ['unitPriceCents', 'quantity', 'grossCents', 'discountCents', 'netCents'] as const) {
      if (!isInt(l[k])) return `${at}.lines contain an invalid number`
    }
    if (l.discount !== undefined && !isDiscount(l.discount)) return `${at}.lines contain an invalid discount`
  }
  return null
}

function checkMovement(m: unknown, i: number): string | null {
  const at = `movements[${i}]`
  if (!isObj(m)) return `${at} is not an object`
  if (!isStr(m.id) || !isStr(m.at) || !isStr(m.productId) || !isStr(m.productName)) return `${at} is missing fields`
  if (!isInt(m.change) || !isInt(m.resultingStock)) return `${at} has invalid numbers`
  if (!['sale', 'received', 'adjustment', 'void'].includes(m.reason as string)) return `${at}.reason is invalid`
  if (!isOptStr(m.note) || !isOptStr(m.saleId) || !isOptStr(m.adjustmentReason)) return `${at} has invalid fields`
  return null
}

/** Returns null when `value` is valid AppData, otherwise a short description of the first problem. */
export function findDataProblem(value: unknown): string | null {
  if (!isObj(value)) return 'File is not a Demo POS data file.'
  if (value.schemaVersion !== 1) return 'Unsupported data version (expected schemaVersion 1).'
  const st = value.settings
  if (!isObj(st) || !isStr(st.storeName) || !isInt(st.taxRateBp) || !Array.isArray(st.discountPresets)) {
    return 'settings are missing or invalid'
  }
  for (const p of st.discountPresets as unknown[]) {
    if (!isObj(p) || !isStr(p.id) || !isStr(p.label) || !isDiscount(p.discount)) return 'a discount preset is invalid'
  }
  if (!isInt(value.nextReceiptNo) || value.nextReceiptNo < 1) return 'nextReceiptNo is invalid'
  if (!Array.isArray(value.products)) return 'products are missing'
  if (!Array.isArray(value.sales)) return 'sales are missing'
  if (!Array.isArray(value.movements)) return 'movements are missing'
  const ids = new Set<string>()
  for (let i = 0; i < value.products.length; i++) {
    const err = checkProduct(value.products[i], i)
    if (err) return err
    const id = (value.products[i] as Obj).id as string
    if (ids.has(id)) return `duplicate product id "${id}"`
    ids.add(id)
  }
  for (let i = 0; i < value.sales.length; i++) {
    const err = checkSale(value.sales[i], i)
    if (err) return err
  }
  for (let i = 0; i < value.movements.length; i++) {
    const err = checkMovement(value.movements[i], i)
    if (err) return err
  }
  return null
}

export function isAppData(value: unknown): value is AppData {
  return findDataProblem(value) === null
}
