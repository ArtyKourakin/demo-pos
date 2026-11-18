import { useState, type ReactNode } from 'react'
import type { AdjustmentReason, Product } from '../../../shared/types'
import { Modal } from '../components/Modal'
import { PixelIcon } from '../components/PixelIcon'
import { useData } from '../data'

function parseCount(s: string): number | null {
  return /^\d{1,6}$/.test(s.trim()) ? Number(s.trim()) : null
}

function ProductHeader({ product }: { product: Product }): ReactNode {
  return (
    <div className="mb-5 flex items-center gap-4 rounded-xl bg-slate-100 px-4 py-3">
      <PixelIcon id={product.icon} size={48} />
      <div className="flex-1">
        <div className="text-lg font-bold">{product.name}</div>
        <div className="font-mono text-sm text-slate-500">{product.sku}</div>
      </div>
      <div className="text-right">
        <div className="text-sm text-slate-500">Current stock</div>
        <div className="text-3xl font-extrabold tabular-nums">{product.stock}</div>
      </div>
    </div>
  )
}

export function ReceiveStockDialog({ product, onClose }: { product: Product; onClose: () => void }): ReactNode {
  const { apply } = useData()
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const n = parseCount(qty)
  const valid = n !== null && n > 0

  const save = async (): Promise<void> => {
    if (!valid || busy) return
    setBusy(true)
    const ok = await apply(() => window.pos.receiveStock(product.id, n, note), `Received ${n} × ${product.name}`)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal
      title="Receive stock"
      onClose={onClose}
      onSubmit={() => void save()}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary min-w-40" disabled={!valid || busy}>
            Receive {valid ? `+${n}` : ''}
          </button>
        </>
      }
    >
      <ProductHeader product={product} />
      <label className="label" htmlFor="recv-qty">Quantity received</label>
      <input
        id="recv-qty"
        className="input min-h-14 text-2xl font-bold tabular-nums"
        inputMode="numeric"
        placeholder="0"
        value={qty}
        onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
        data-autofocus
      />
      <div className="mt-2 flex gap-2">
        {[6, 12, 24, 48].map((v) => (
          <button key={v} type="button" className="btn btn-secondary btn-sm" onClick={() => setQty(String(v))}>
            +{v}
          </button>
        ))}
      </div>
      <label className="label mt-5" htmlFor="recv-note">
        Note <span className="font-normal text-slate-500">(optional)</span>
      </label>
      <input id="recv-note" className="input" maxLength={80} placeholder="e.g. Morning delivery from supplier" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-lg font-semibold text-emerald-900">
        New stock: {product.stock} → <span className="tabular-nums">{product.stock + (n ?? 0)}</span>
      </div>
    </Modal>
  )
}

const REASONS: { id: AdjustmentReason; label: string }[] = [
  { id: 'damaged', label: 'Damaged' },
  { id: 'count_correction', label: 'Count correction' },
  { id: 'other', label: 'Other' }
]

export function AdjustStockDialog({ product, onClose }: { product: Product; onClose: () => void }): ReactNode {
  const { apply } = useData()
  const [count, setCount] = useState(String(product.stock))
  const [reason, setReason] = useState<AdjustmentReason | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const n = parseCount(count)
  const change = n === null ? 0 : n - product.stock
  const problem =
    n === null ? 'Enter the exact stock count.' : change === 0 ? 'Count is unchanged.' : !reason ? 'Choose a reason.' : null

  const save = async (): Promise<void> => {
    if (problem || n === null || !reason || busy) return
    setBusy(true)
    const ok = await apply(() => window.pos.adjustStock(product.id, n, reason, note), `${product.name} stock set to ${n}`)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal
      title="Adjust stock"
      onClose={onClose}
      onSubmit={() => void save()}
      footer={
        <>
          {problem && <span className="mr-auto text-slate-500">{problem}</span>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary min-w-40" disabled={!!problem || busy}>
            Save count
          </button>
        </>
      }
    >
      <ProductHeader product={product} />
      <label className="label" htmlFor="adj-count">Set exact stock count</label>
      <input
        id="adj-count"
        className="input min-h-14 text-2xl font-bold tabular-nums"
        inputMode="numeric"
        value={count}
        onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))}
        data-autofocus
      />
      <div className="label mt-5">Reason</div>
      <div className="grid grid-cols-3 gap-2">
        {REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`btn ${reason === r.id ? 'bg-slate-900 text-white' : 'btn-secondary'}`}
            onClick={() => setReason(r.id)}
            aria-pressed={reason === r.id}
          >
            {r.label}
          </button>
        ))}
      </div>
      <label className="label mt-5" htmlFor="adj-note">
        Note <span className="font-normal text-slate-500">(optional)</span>
      </label>
      <input id="adj-note" className="input" maxLength={80} placeholder="e.g. Dropped two bottles" value={note} onChange={(e) => setNote(e.target.value)} />
      {n !== null && change !== 0 && (
        <div className={`mt-5 rounded-xl px-4 py-3 text-lg font-semibold ${change > 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
          Change: {change > 0 ? `+${change}` : change} ({product.stock} → {n})
        </div>
      )}
    </Modal>
  )
}
