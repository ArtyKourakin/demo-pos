import { useMemo, useState, type ReactNode } from 'react'
import { addToCart, cartQuantity, PosError, stockStatus } from '../../../shared/pos'
import type { Cart, Product, Sale } from '../../../shared/types'
import { PixelIcon } from '../components/PixelIcon'
import { ReceiptDialog } from '../components/ReceiptDialog'
import { StockBadge } from '../components/StockBadge'
import { useToast } from '../components/Toasts'
import { useData } from '../data'
import { emptyCart } from '../../../shared/pos'
import { money } from '../format'
import { CartPanel } from './CartPanel'
import { PaymentDialog } from './PaymentDialog'

interface Props {
  cart: Cart
  setCart: (cart: Cart) => void
}

function ProductCard({ product, inCart, onAdd }: { product: Product; inCart: number; onAdd: () => void }): ReactNode {
  const out = stockStatus(product) === 'out'
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={out}
      className={`group relative flex flex-col items-center rounded-2xl border-2 bg-white p-3 pt-4 text-center shadow-sm transition active:scale-[0.98] ${
        out ? 'border-slate-200 opacity-55 grayscale' : inCart > 0 ? 'border-sky-400' : 'border-transparent hover:border-sky-300'
      }`}
      aria-label={`Add ${product.name}, ${money(product.priceCents)}`}
    >
      {inCart > 0 && (
        <span className="absolute top-2 right-2 flex h-8 min-w-8 items-center justify-center rounded-full bg-sky-600 px-2 text-base font-bold text-white">
          {inCart}
        </span>
      )}
      <PixelIcon id={product.icon} size={72} />
      <div className="mt-2 line-clamp-2 min-h-[2.5rem] text-base leading-tight font-semibold text-slate-900">{product.name}</div>
      <div className="mt-0.5 text-xl font-extrabold text-slate-900 tabular-nums">{money(product.priceCents)}</div>
      <div className="mt-2">
        <StockBadge product={product} compact />
      </div>
    </button>
  )
}

export function SalesScreen({ cart, setCart }: Props): ReactNode {
  const { data } = useData()
  const toast = useToast()
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [paying, setPaying] = useState<{ totalCents: number } | null>(null)
  const [completed, setCompleted] = useState<Sale | null>(null)

  const active = useMemo(() => data.products.filter((p) => !p.archived), [data.products])
  const categories = useMemo(() => ['All', ...[...new Set(active.map((p) => p.category))].sort()], [active])
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return active.filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    )
  }, [active, category, search])

  const add = (product: Product): void => {
    try {
      setCart(addToCart(cart, product))
    } catch (err) {
      toast(err instanceof PosError ? err.message : String(err), 'error')
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categories">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={category === c}
                className={`btn ${category === c ? 'bg-slate-900 text-white' : 'btn-secondary'}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative ml-auto w-64">
            <input
              className="input pr-10"
              type="search"
              placeholder="Search name or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {visible.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
              <PixelIcon id="box" size={64} className="opacity-60" />
              <p className="mt-3 text-lg font-semibold">No products found</p>
              <p>{active.length === 0 ? 'Add products in Inventory & Settings.' : 'Try another category or search.'}</p>
              {(search || category !== 'All') && (
                <button
                  type="button"
                  className="btn btn-secondary mt-4"
                  onClick={() => {
                    setSearch('')
                    setCategory('All')
                  }}
                >
                  Show all products
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-3">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} inCart={cartQuantity(cart, p.id)} onAdd={() => add(p)} />
              ))}
            </div>
          )}
        </div>
      </section>

      <CartPanel cart={cart} setCart={setCart} onCharge={(totalCents) => setPaying({ totalCents })} />

      {paying && (
        <PaymentDialog
          cart={cart}
          totalCents={paying.totalCents}
          onClose={() => setPaying(null)}
          onCompleted={(sale) => {
            setPaying(null)
            setCart(emptyCart())
            setCompleted(sale)
          }}
        />
      )}

      {completed && (
        <ReceiptDialog
          sale={completed}
          title={`Sale complete · Receipt #${completed.receiptNo}`}
          closeLabel="New sale"
          onClose={() => setCompleted(null)}
          banner={
            completed.changeCents > 0 ? (
              <div className="mb-4 flex items-center justify-between rounded-2xl bg-emerald-600 px-6 py-4 text-white">
                <span className="text-lg font-semibold">Change due</span>
                <span className="text-4xl font-extrabold tabular-nums">{money(completed.changeCents)}</span>
              </div>
            ) : (
              <div className="mb-4 rounded-2xl bg-emerald-50 px-6 py-3 text-center text-lg font-semibold text-emerald-800">
                Payment recorded · {money(completed.totalCents)}
              </div>
            )
          }
        />
      )}
    </div>
  )
}
