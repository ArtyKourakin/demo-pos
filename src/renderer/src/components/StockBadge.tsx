import type { ReactNode } from 'react'
import { stockStatus } from '../../../shared/pos'
import type { Product } from '../../../shared/types'

export function StockBadge({ product, compact }: { product: Product; compact?: boolean }): ReactNode {
  const status = stockStatus(product)
  if (status === 'out') {
    return <span className="inline-flex rounded-full bg-red-600 px-2.5 py-0.5 text-sm font-bold text-white">Out of stock</span>
  }
  if (status === 'low') {
    return (
      <span className="inline-flex rounded-full bg-amber-400 px-2.5 py-0.5 text-sm font-bold text-amber-950">
        {product.stock} in stock{compact ? '' : ' · low'}
      </span>
    )
  }
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-700">{product.stock} in stock</span>
}

export function StatusPill({ product }: { product: Product }): ReactNode {
  if (product.archived) return <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-sm font-semibold text-slate-600">Archived</span>
  const status = stockStatus(product)
  if (status === 'out') return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-bold text-red-700">Out of stock</span>
  if (status === 'low') return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-800">Low stock</span>
  return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-800">In stock</span>
}
