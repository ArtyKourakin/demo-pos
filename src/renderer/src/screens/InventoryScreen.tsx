import { useMemo, useState, type ReactNode } from 'react'
import { lowStockProducts } from '../../../shared/pos'
import type { Product } from '../../../shared/types'
import { ConfirmDialog } from '../components/Modal'
import { PixelIcon } from '../components/PixelIcon'
import { StatusPill } from '../components/StockBadge'
import { useData } from '../data'
import { money, plural } from '../format'
import { MovementHistory } from './MovementHistory'
import { ProductDialog } from './ProductDialog'
import { SettingsPanel } from './SettingsPanel'
import { AdjustStockDialog, ReceiveStockDialog } from './StockDialogs'

type SubTab = 'products' | 'history' | 'settings'

type Action =
  | { kind: 'edit'; product: Product }
  | { kind: 'new' }
  | { kind: 'receive'; product: Product }
  | { kind: 'adjust'; product: Product }
  | { kind: 'archive'; product: Product }

export function InventoryScreen(): ReactNode {
  const [tab, setTab] = useState<SubTab>('products')
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-2 border-b border-slate-200 bg-white px-5 pt-3" role="tablist">
        {(
          [
            ['products', 'Products'],
            ['history', 'Stock history'],
            ['settings', 'Settings & data']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`-mb-px min-h-12 rounded-t-xl border-b-4 px-5 text-base font-bold ${
              tab === id ? 'border-brand-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === 'products' && <ProductsPanel />}
        {tab === 'history' && <MovementHistory />}
        {tab === 'settings' && <SettingsPanel />}
      </div>
    </div>
  )
}

function ProductsPanel(): ReactNode {
  const { data, apply } = useData()
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [action, setAction] = useState<Action | null>(null)

  const low = useMemo(() => lowStockProducts(data.products), [data.products])
  const archivedCount = data.products.filter((p) => p.archived).length
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.products
      .filter((p) => showArchived || !p.archived)
      .filter((p) => !q || [p.name, p.sku, p.category].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => Number(a.archived) - Number(b.archived) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  }, [data.products, search, showArchived])

  const close = (): void => setAction(null)

  return (
    <div className="space-y-4">
      {low.length > 0 ? (
        <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 border-amber-300 bg-amber-50 px-5 py-4">
          <span className="text-lg font-bold text-amber-900">⚠ {plural(low.length, 'item')} running low</span>
          <div className="flex flex-wrap gap-2">
            {low.map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn btn-sm border border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                onClick={() => setAction({ kind: 'receive', product: p })}
                title="Receive stock"
              >
                <PixelIcon id={p.icon} size={22} />
                {p.name}: {p.stock} left
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="card border-emerald-200 bg-emerald-50 px-5 py-4 text-lg font-bold text-emerald-800">✓ All products are well stocked</div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          type="search"
          placeholder="Search name, SKU or category"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
        />
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-base font-semibold text-slate-700">
          <input type="checkbox" className="h-5 w-5" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived ({archivedCount})
        </label>
        <button type="button" className="btn btn-primary ml-auto" onClick={() => setAction({ kind: 'new' })}>
          + Add product
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-base">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th w-16">Image</th>
              <th className="th">Name</th>
              <th className="th">SKU</th>
              <th className="th">Category</th>
              <th className="th text-right">Price</th>
              <th className="th text-right">Stock</th>
              <th className="th text-right">Low at</th>
              <th className="th">Status</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                  {data.products.length === 0 ? 'No products yet. Add your first product.' : 'No products match your search.'}
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className={p.archived ? 'bg-slate-50 text-slate-500' : ''}>
                <td className="td">
                  <PixelIcon id={p.icon} size={40} className={p.archived ? 'opacity-50 grayscale' : ''} />
                </td>
                <td className="td font-semibold">{p.name}</td>
                <td className="td font-mono text-sm">{p.sku}</td>
                <td className="td">{p.category}</td>
                <td className="td text-right tabular-nums">{money(p.priceCents)}</td>
                <td
                  className={`td text-right text-lg font-bold tabular-nums ${
                    !p.archived && p.stock <= 0 ? 'text-red-600' : !p.archived && p.stock <= p.lowStockThreshold ? 'text-amber-600' : ''
                  }`}
                >
                  {p.stock}
                </td>
                <td className="td text-right tabular-nums">{p.lowStockThreshold}</td>
                <td className="td">
                  <StatusPill product={p} />
                </td>
                <td className="td">
                  <div className="flex justify-end gap-1.5">
                    {p.archived ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void apply(() => window.pos.setProductArchived(p.id, false), `${p.name} restored`)}
                      >
                        Restore
                      </button>
                    ) : (
                      <>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction({ kind: 'edit', product: p })}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100"
                          onClick={() => setAction({ kind: 'receive', product: p })}
                        >
                          + Receive
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction({ kind: 'adjust', product: p })}>
                          Adjust
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-slate-500"
                          onClick={() => setAction({ kind: 'archive', product: p })}
                        >
                          Archive
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {action?.kind === 'new' && <ProductDialog onClose={close} />}
      {action?.kind === 'edit' && <ProductDialog product={action.product} onClose={close} />}
      {action?.kind === 'receive' && <ReceiveStockDialog product={action.product} onClose={close} />}
      {action?.kind === 'adjust' && <AdjustStockDialog product={action.product} onClose={close} />}
      {action?.kind === 'archive' && (
        <ConfirmDialog
          title={`Archive ${action.product.name}?`}
          message={
            <>
              It will be hidden from the Sales screen. Its sales and stock history are kept, and you can restore it at any time with
              “Show archived”.
            </>
          }
          confirmLabel="Archive product"
          danger
          onCancel={close}
          onConfirm={async () => {
            const ok = await apply(() => window.pos.setProductArchived(action.product.id, true), `${action.product.name} archived`)
            if (ok) close()
          }}
        />
      )}
    </div>
  )
}
