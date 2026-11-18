import type { AppData, IconId, Product, StockMovement } from './types'

interface SeedProduct {
  id: string
  name: string
  sku: string
  category: string
  priceCents: number
  stock: number
  lowStockThreshold: number
  icon: IconId
}

/** 10 café / convenience-store products. Muffin and Sandwich start at/below their threshold. */
export const SEED_PRODUCTS: readonly SeedProduct[] = [
  { id: 'p-espresso', name: 'Espresso', sku: 'COF-001', category: 'Coffee', priceCents: 275, stock: 40, lowStockThreshold: 10, icon: 'espresso' },
  { id: 'p-latte', name: 'Latte', sku: 'COF-002', category: 'Coffee', priceCents: 425, stock: 35, lowStockThreshold: 10, icon: 'latte' },
  { id: 'p-iced-tea', name: 'Iced Tea', sku: 'DRK-001', category: 'Drinks', priceCents: 300, stock: 24, lowStockThreshold: 8, icon: 'iced-tea' },
  { id: 'p-croissant', name: 'Croissant', sku: 'BAK-001', category: 'Bakery', priceCents: 350, stock: 12, lowStockThreshold: 5, icon: 'croissant' },
  { id: 'p-muffin', name: 'Blueberry Muffin', sku: 'BAK-002', category: 'Bakery', priceCents: 325, stock: 4, lowStockThreshold: 5, icon: 'muffin' },
  { id: 'p-bagel', name: 'Bagel', sku: 'BAK-003', category: 'Bakery', priceCents: 250, stock: 18, lowStockThreshold: 6, icon: 'bagel' },
  { id: 'p-water', name: 'Bottled Water', sku: 'DRK-002', category: 'Drinks', priceCents: 175, stock: 48, lowStockThreshold: 12, icon: 'water' },
  { id: 'p-chips', name: 'Chips', sku: 'SNK-001', category: 'Snacks', priceCents: 199, stock: 30, lowStockThreshold: 8, icon: 'chips' },
  { id: 'p-chocolate', name: 'Chocolate Bar', sku: 'SNK-002', category: 'Snacks', priceCents: 225, stock: 25, lowStockThreshold: 8, icon: 'chocolate' },
  { id: 'p-sandwich', name: 'Sandwich', sku: 'DEL-001', category: 'Deli', priceCents: 795, stock: 3, lowStockThreshold: 4, icon: 'sandwich' }
]

export const DEFAULT_STORE_NAME = 'Red Wagon Café'

export function createSeedData(now: string, newId: () => string): AppData {
  const products: Product[] = SEED_PRODUCTS.map((p) => ({ ...p, archived: false, createdAt: now }))
  const movements: StockMovement[] = products.map((p) => ({
    id: newId(),
    at: now,
    productId: p.id,
    productName: p.name,
    change: p.stock,
    reason: 'received',
    note: 'Initial stock (demo data)',
    resultingStock: p.stock
  }))
  return {
    schemaVersion: 1,
    settings: {
      storeName: DEFAULT_STORE_NAME,
      taxRateBp: 0,
      discountPresets: [
        { id: 'preset-staff', label: 'Staff 20%', discount: { type: 'percent', basisPoints: 2000, note: 'Staff' } },
        { id: 'preset-5off', label: '$5 off', discount: { type: 'fixed', amountCents: 500, note: 'Promo' } },
        { id: 'preset-loyalty', label: 'Loyalty 10%', discount: { type: 'percent', basisPoints: 1000, note: 'Loyalty' } }
      ]
    },
    products,
    sales: [],
    movements,
    nextReceiptNo: 1001
  }
}
