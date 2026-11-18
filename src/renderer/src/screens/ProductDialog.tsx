import { useMemo, useState, type ReactNode } from 'react'
import { ICON_IDS, ICONS } from '../../../shared/icons'
import { validateProductInput } from '../../../shared/pos'
import type { IconId, Product, ProductInput } from '../../../shared/types'
import { Modal } from '../components/Modal'
import { PixelIcon } from '../components/PixelIcon'
import { useData } from '../data'
import { centsToDecimalString, parseMoneyToCents } from '../format'

function parseCount(s: string): number | null {
  return /^\d{1,6}$/.test(s.trim()) ? Number(s.trim()) : null
}

export function ProductDialog({ product, onClose }: { product?: Product; onClose: () => void }): ReactNode {
  const { data, apply } = useData()
  const [name, setName] = useState(product?.name ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [category, setCategory] = useState(product?.category ?? '')
  const [price, setPrice] = useState(product ? centsToDecimalString(product.priceCents) : '')
  const [threshold, setThreshold] = useState(String(product?.lowStockThreshold ?? 5))
  const [initialStock, setInitialStock] = useState('0')
  const [icon, setIcon] = useState<IconId>(product?.icon ?? 'box')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  const categories = useMemo(() => [...new Set(data.products.map((p) => p.category))].sort(), [data.products])

  const { input, error } = useMemo((): { input?: ProductInput; error?: string } => {
    const priceCents = parseMoneyToCents(price)
    if (priceCents === null) return { error: 'Enter a valid price, e.g. 3.50' }
    const lowStockThreshold = parseCount(threshold)
    if (lowStockThreshold === null) return { error: 'Low-stock threshold must be a whole number.' }
    const stock = product ? undefined : parseCount(initialStock)
    if (!product && stock === null) return { error: 'Starting stock must be a whole number.' }
    const candidate: ProductInput = {
      ...(product ? { id: product.id } : {}),
      name,
      sku,
      category,
      priceCents,
      lowStockThreshold,
      icon,
      ...(stock !== undefined && stock !== null ? { initialStock: stock } : {})
    }
    const err = validateProductInput(data, candidate, ICON_IDS)
    return err ? { error: err } : { input: candidate }
  }, [name, sku, category, price, threshold, initialStock, icon, product, data])

  const save = async (): Promise<void> => {
    setTouched(true)
    if (!input || busy) return
    setBusy(true)
    const ok = await apply(() => window.pos.saveProduct(input), product ? `${input.name.trim()} updated` : `${input.name.trim()} added`)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal
      title={product ? `Edit ${product.name}` : 'Add product'}
      onClose={onClose}
      size="lg"
      onSubmit={() => void save()}
      footer={
        <>
          {touched && error && <span className="mr-auto font-semibold text-red-600">{error}</span>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary min-w-36" disabled={busy}>
            {product ? 'Save changes' : 'Add product'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label" htmlFor="p-name">Name</label>
          <input id="p-name" className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cappuccino" />
        </div>
        <div>
          <label className="label" htmlFor="p-sku">SKU</label>
          <input id="p-sku" className="input font-mono" maxLength={24} value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} placeholder="COF-003" />
        </div>
        <div>
          <label className="label" htmlFor="p-cat">Category</label>
          <input id="p-cat" className="input" maxLength={24} list="category-options" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Coffee" />
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="p-price">Price ($)</label>
          <input id="p-price" className="input tabular-nums" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="3.50" />
        </div>
        <div>
          <label className="label" htmlFor="p-threshold">Low-stock warning at</label>
          <input id="p-threshold" className="input tabular-nums" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
        {!product && (
          <div>
            <label className="label" htmlFor="p-stock">Starting stock</label>
            <input id="p-stock" className="input tabular-nums" inputMode="numeric" value={initialStock} onChange={(e) => setInitialStock(e.target.value)} />
          </div>
        )}
        {product && (
          <div className="col-span-2 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
            Current stock: <b>{product.stock}</b>. Change stock with “Receive” or “Adjust” so every change is logged.
          </div>
        )}
        <div className="col-span-2">
          <div className="label">Image</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2">
            {ICON_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={`flex flex-col items-center rounded-xl border-2 p-2 ${icon === id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-slate-300'}`}
                onClick={() => setIcon(id)}
                aria-pressed={icon === id}
                title={ICONS[id].label}
              >
                <PixelIcon id={id} size={44} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
