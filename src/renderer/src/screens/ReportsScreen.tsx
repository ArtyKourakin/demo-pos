import { useMemo, useState, type ReactNode } from 'react'
import { buildReportCsv, itemCount, paymentLabel, salesInRange, summarizeSales } from '../../../shared/reports'
import type { Sale } from '../../../shared/types'
import { ConfirmDialog } from '../components/Modal'
import { PixelIcon } from '../components/PixelIcon'
import { ReceiptDialog } from '../components/ReceiptDialog'
import { useToast } from '../components/Toasts'
import { useData } from '../data'
import { addDays, errorMessage, formatDate, formatDateTime, formatTime, fromDateInput, money, startOfToday, toDateInput } from '../format'

function Stat({ label, value, tone = 'default', sub }: { label: string; value: string; tone?: 'default' | 'good' | 'warn'; sub?: string }): ReactNode {
  return (
    <div className="card px-5 py-4">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div
        className={`mt-1 text-3xl font-extrabold tabular-nums ${tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900'}`}
      >
        {value}
      </div>
      {sub && <div className="text-sm text-slate-500">{sub}</div>}
    </div>
  )
}

export function ReportsScreen(): ReactNode {
  const { data, apply } = useData()
  const toast = useToast()
  const [from, setFrom] = useState(() => toDateInput(startOfToday()))
  const [to, setTo] = useState(() => toDateInput(startOfToday()))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmVoid, setConfirmVoid] = useState(false)
  const [voidReason, setVoidReason] = useState('')

  const fromDate = fromDateInput(from) ?? startOfToday()
  const toDate = fromDateInput(to) ?? startOfToday()
  const rangeInvalid = toDate < fromDate
  const sameDay = from === to

  const sales = useMemo(
    () => (rangeInvalid ? [] : salesInRange(data.sales, fromDate.getTime(), addDays(toDate, 1).getTime())),
    // Dates are derived from the from/to strings, so those are the real dependencies.
    [data.sales, from, to, rangeInvalid]
  )
  const summary = useMemo(() => summarizeSales(sales), [sales])
  const selected = selectedId ? data.sales.find((s) => s.id === selectedId) : undefined
  const rangeLabel = sameDay ? formatDate(fromDate) : `${formatDate(fromDate)} – ${formatDate(toDate)}`

  const setRange = (start: Date, end: Date): void => {
    setFrom(toDateInput(start))
    setTo(toDateInput(end))
  }
  const today = startOfToday()
  const presets: { label: string; start: Date; end: Date }[] = [
    { label: 'Today', start: today, end: today },
    { label: 'Yesterday', start: addDays(today, -1), end: addDays(today, -1) },
    { label: 'Last 7 days', start: addDays(today, -6), end: today },
    { label: 'This month', start: new Date(today.getFullYear(), today.getMonth(), 1), end: today }
  ]

  const exportCsv = async (): Promise<void> => {
    try {
      const csv = buildReportCsv(rangeLabel, sales, formatDateTime)
      const name = sameDay ? `sales-report-${from}.csv` : `sales-report-${from}-to-${to}.csv`
      const r = await window.pos.saveCsv(name, csv)
      if (r.status === 'saved') toast(`Report saved to ${r.path}`, 'success')
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const cashShare = summary.cashCents + summary.cardCents > 0 ? summary.cashCents / (summary.cashCents + summary.cardCents) : 0

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => {
              const active = from === toDateInput(p.start) && to === toDateInput(p.end)
              return (
                <button key={p.label} type="button" className={`btn ${active ? 'bg-slate-900 text-white' : 'btn-secondary'}`} onClick={() => setRange(p.start, p.end)}>
                  {p.label}
                </button>
              )
            })}
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="label" htmlFor="r-from">From</label>
              <input id="r-from" type="date" className="input w-44" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="r-to">To</label>
              <input id="r-to" type="date" className="input w-44" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
            </div>
          </div>
          <button type="button" className="btn btn-primary ml-auto" onClick={() => void exportCsv()} disabled={rangeInvalid}>
            ⬇ Export CSV
          </button>
        </div>

        <h2 className="text-2xl font-extrabold">
          {sameDay ? 'Daily summary' : 'Summary'} · <span className="text-slate-600">{rangeLabel}</span>
        </h2>
        {rangeInvalid && <p className="font-semibold text-red-600">“To” date is before “From” date.</p>}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat label="Gross sales" value={money(summary.grossCents)} sub="before discounts" />
          <Stat label="Discounts" value={summary.discountCents > 0 ? `−${money(summary.discountCents)}` : money(0)} tone="warn" />
          <Stat label="Tax" value={money(summary.taxCents)} />
          <Stat label="Net revenue" value={money(summary.netRevenueCents)} tone="good" sub={`excl. tax · ${money(summary.totalCollectedCents)} collected`} />
          <Stat
            label="Transactions"
            value={String(summary.transactions)}
            sub={`${summary.itemsSold} items sold${summary.voidedCount ? ` · ${summary.voidedCount} voided` : ''}`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="card p-5">
            <h3 className="text-lg font-bold">Cash vs card</h3>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-emerald-50 px-4 py-3">
                <div className="font-semibold text-emerald-800">💵 Cash</div>
                <div className="text-3xl font-extrabold text-emerald-900 tabular-nums">{money(summary.cashCents)}</div>
              </div>
              <div className="rounded-xl bg-sky-50 px-4 py-3">
                <div className="font-semibold text-sky-800">💳 Card</div>
                <div className="text-3xl font-extrabold text-sky-900 tabular-nums">{money(summary.cardCents)}</div>
              </div>
            </div>
            <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div className="bg-emerald-500" style={{ width: `${cashShare * 100}%` }} />
              <div className="flex-1 bg-sky-500" style={{ opacity: summary.cardCents > 0 ? 1 : 0 }} />
            </div>
            <div className="mt-1 flex justify-between text-sm text-slate-500">
              <span>{Math.round(cashShare * 100)}% cash</span>
              <span>{summary.cashCents + summary.cardCents > 0 ? `${100 - Math.round(cashShare * 100)}% card` : ''}</span>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-lg font-bold">Top-selling products</h3>
            {summary.topProducts.length === 0 ? (
              <p className="mt-6 text-center text-slate-500">No items sold in this period.</p>
            ) : (
              <ol className="mt-2 divide-y divide-slate-100">
                {summary.topProducts.map((t, i) => {
                  const product = data.products.find((p) => p.id === t.productId)
                  return (
                    <li key={t.productId} className="flex items-center gap-3 py-2">
                      <span className="w-5 text-right font-bold text-slate-400">{i + 1}</span>
                      {product && <PixelIcon id={product.icon} size={32} />}
                      <span className="flex-1 font-semibold">{t.name}</span>
                      <span className="font-bold tabular-nums">{t.quantity} sold</span>
                      <span className="w-24 text-right text-slate-600 tabular-nums">{money(t.revenueCents)}</span>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h3 className="text-lg font-bold">Sales</h3>
            <span className="text-sm text-slate-500">Click a row to see the receipt</span>
          </div>
          <table className="w-full text-base">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">{sameDay ? 'Time' : 'Date / time'}</th>
                <th className="th">Receipt #</th>
                <th className="th text-right">Items</th>
                <th className="th text-right">Total</th>
                <th className="th">Payment</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <PixelIcon id="box" size={48} className="mx-auto mb-2 opacity-60" />
                    No sales in this period yet.
                  </td>
                </tr>
              )}
              {sales.map((s: Sale) => (
                <tr
                  key={s.id}
                  className={`cursor-pointer hover:bg-sky-50 ${s.status === 'voided' ? 'text-slate-400' : ''}`}
                  onClick={() => setSelectedId(s.id)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedId(s.id)}
                >
                  <td className="td whitespace-nowrap">{sameDay ? formatTime(s.createdAt) : formatDateTime(s.createdAt)}</td>
                  <td className="td font-mono font-semibold">#{s.receiptNo}</td>
                  <td className="td text-right tabular-nums">{itemCount(s)}</td>
                  <td className={`td text-right font-bold tabular-nums ${s.status === 'voided' ? 'line-through' : ''}`}>{money(s.totalCents)}</td>
                  <td className="td">{paymentLabel(s)}</td>
                  <td className="td">
                    {s.status === 'voided' ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-bold text-red-700">Voided</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-800">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <ReceiptDialog
          sale={selected}
          title={`Receipt #${selected.receiptNo}`}
          onClose={() => setSelectedId(null)}
          extraActions={
            selected.status === 'completed' ? (
              <button
                type="button"
                className="btn btn-danger-outline btn-lg"
                onClick={() => {
                  setVoidReason('')
                  setConfirmVoid(true)
                }}
              >
                Void sale
              </button>
            ) : undefined
          }
        />
      )}
      {selected && confirmVoid && (
        <ConfirmDialog
          title={`Void receipt #${selected.receiptNo}?`}
          message={
            <>
              The sale of <b>{money(selected.totalCents)}</b> will be marked as voided and its {itemCount(selected)} item(s) returned to
              stock. Refund the customer separately. This cannot be undone.
            </>
          }
          confirmLabel="Void sale"
          danger
          onCancel={() => setConfirmVoid(false)}
          onConfirm={async () => {
            const ok = await apply(() => window.pos.voidSale(selected.id, voidReason), `Receipt #${selected.receiptNo} voided`)
            if (ok) setConfirmVoid(false)
          }}
        >
          <label className="label" htmlFor="void-reason">
            Reason <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="void-reason"
            className="input"
            maxLength={80}
            placeholder="e.g. Customer changed their mind"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
        </ConfirmDialog>
      )}
    </div>
  )
}
