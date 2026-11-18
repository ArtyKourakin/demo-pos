import { useMemo, useState, type ReactNode } from 'react'
import type { MovementReason, StockMovement } from '../../../shared/types'
import { useData } from '../data'
import { formatDateTime } from '../format'

const LIMIT = 300

const REASON_STYLE: Record<MovementReason, string> = {
  sale: 'bg-sky-100 text-sky-800',
  received: 'bg-emerald-100 text-emerald-800',
  adjustment: 'bg-amber-100 text-amber-900',
  void: 'bg-purple-100 text-purple-800'
}

const ADJ_LABEL = { damaged: 'damaged', count_correction: 'count correction', other: 'other' } as const

function reasonLabel(m: StockMovement): string {
  if (m.reason === 'adjustment' && m.adjustmentReason) return `Adjustment · ${ADJ_LABEL[m.adjustmentReason]}`
  return m.reason.charAt(0).toUpperCase() + m.reason.slice(1)
}

export function MovementHistory(): ReactNode {
  const { data } = useData()
  const [productId, setProductId] = useState('all')
  const [reason, setReason] = useState<'all' | MovementReason>('all')

  const filtered = useMemo(
    () =>
      data.movements
        .filter((m) => (productId === 'all' || m.productId === productId) && (reason === 'all' || m.reason === reason))
        .sort((a, b) => b.at.localeCompare(a.at)),
    [data.movements, productId, reason]
  )
  const shown = filtered.slice(0, LIMIT)
  const products = useMemo(() => [...data.products].sort((a, b) => a.name.localeCompare(b.name)), [data.products])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select className="input w-64" value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Filter by product">
          <option value="all">All products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.archived ? ' (archived)' : ''}
            </option>
          ))}
        </select>
        <select className="input w-52" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} aria-label="Filter by reason">
          <option value="all">All reasons</option>
          <option value="sale">Sale</option>
          <option value="received">Received</option>
          <option value="adjustment">Adjustment</option>
          <option value="void">Void</option>
        </select>
        <span className="ml-auto text-sm text-slate-500">
          {filtered.length > LIMIT ? `Showing latest ${LIMIT} of ${filtered.length}` : `${filtered.length} movements`}
        </span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-base">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Date / time</th>
              <th className="th">Product</th>
              <th className="th text-right">Change</th>
              <th className="th">Reason</th>
              <th className="th">Note</th>
              <th className="th text-right">Resulting stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  No stock movements yet.
                </td>
              </tr>
            )}
            {shown.map((m) => (
              <tr key={m.id}>
                <td className="td whitespace-nowrap text-slate-600">{formatDateTime(m.at)}</td>
                <td className="td font-semibold">{m.productName}</td>
                <td className={`td text-right text-lg font-bold tabular-nums ${m.change > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {m.change > 0 ? `+${m.change}` : m.change}
                </td>
                <td className="td">
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap ${REASON_STYLE[m.reason]}`}>{reasonLabel(m)}</span>
                </td>
                <td className="td text-slate-600">{m.note ?? '—'}</td>
                <td className="td text-right font-semibold tabular-nums">{m.resultingStock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
