import { useMemo, useState, type ReactNode } from 'react'
import { describeDiscount, discountAmount, validateDiscount } from '../../../shared/pos'
import type { Discount, DiscountPreset } from '../../../shared/types'
import { Modal } from '../components/Modal'
import { formatBasisPoints, centsToDecimalString, money, parseMoneyToCents, parsePercentToBasisPoints } from '../format'

interface Props {
  title: string
  /** Amount the discount applies to (line total or order subtotal). */
  baseCents: number
  current?: Discount
  presets: DiscountPreset[]
  onApply: (discount: Discount) => void
  onRemove?: () => void
  onClose: () => void
}

const NOTE_SUGGESTIONS = ['Staff', 'Promo', 'Loyalty', 'Damaged item', 'Manager']
const PERCENT_QUICK = [5, 10, 15, 20, 50]
const FIXED_QUICK = [100, 200, 500, 1000]

export function DiscountDialog({ title, baseCents, current, presets, onApply, onRemove, onClose }: Props): ReactNode {
  const [type, setType] = useState<Discount['type']>(current?.type ?? 'percent')
  const [valueText, setValueText] = useState(
    current ? (current.type === 'percent' ? formatBasisPoints(current.basisPoints) : centsToDecimalString(current.amountCents)) : ''
  )
  const [note, setNote] = useState(current?.note ?? '')
  const [presetError, setPresetError] = useState<string | null>(null)

  const parsed = useMemo((): { discount?: Discount; error?: string } => {
    if (valueText.trim() === '') return {}
    const trimmedNote = note.trim()
    const extra = trimmedNote ? { note: trimmedNote } : {}
    if (type === 'percent') {
      const bp = parsePercentToBasisPoints(valueText)
      if (bp === null) return { error: 'Enter a percentage like 10 or 12.5' }
      const d: Discount = { type: 'percent', basisPoints: bp, ...extra }
      const err = validateDiscount(d, baseCents)
      return err ? { error: err } : { discount: d }
    }
    const cents = parseMoneyToCents(valueText)
    if (cents === null) return { error: 'Enter an amount like 5 or 2.50' }
    const d: Discount = { type: 'fixed', amountCents: cents, ...extra }
    const err = validateDiscount(d, baseCents)
    return err ? { error: err } : { discount: d }
  }, [type, valueText, note, baseCents])

  const amount = parsed.discount ? discountAmount(parsed.discount, baseCents) : 0

  const applyPreset = (preset: DiscountPreset): void => {
    const err = validateDiscount(preset.discount, baseCents)
    if (err) {
      setPresetError(`${preset.label}: ${err}`)
      return
    }
    onApply(preset.discount)
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      onSubmit={() => parsed.discount && onApply(parsed.discount)}
      footer={
        <>
          {onRemove && current && (
            <button type="button" className="btn btn-danger-outline mr-auto" onClick={onRemove}>
              Remove discount
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary min-w-36" disabled={!parsed.discount}>
            Apply discount
          </button>
        </>
      }
    >
      <div className="mb-4 flex items-baseline justify-between rounded-xl bg-slate-100 px-4 py-3">
        <span className="font-semibold text-slate-600">Applies to</span>
        <span className="text-xl font-bold tabular-nums">{money(baseCents)}</span>
      </div>

      {presets.length > 0 && (
        <div className="mb-5">
          <div className="label">Saved presets (one tap)</div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button key={p.id} type="button" className="btn btn-secondary border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100" onClick={() => applyPreset(p)}>
                {p.label}
              </button>
            ))}
          </div>
          {presetError && <p className="mt-2 text-sm font-semibold text-red-600">{presetError}</p>}
        </div>
      )}

      <div className="label">Custom discount</div>
      <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
        {(['percent', 'fixed'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn ${type === t ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-white'}`}
            onClick={() => {
              setType(t)
              setValueText('')
            }}
          >
            {t === 'percent' ? 'Percent (%)' : 'Amount ($)'}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-xl font-bold text-slate-400">
            {type === 'percent' ? '%' : '$'}
          </span>
          <input
            className="input min-h-14 pl-10 text-2xl font-bold tabular-nums"
            inputMode="decimal"
            placeholder={type === 'percent' ? '10' : '5.00'}
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            aria-label={type === 'percent' ? 'Discount percent' : 'Discount amount'}
            data-autofocus
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {(type === 'percent' ? PERCENT_QUICK : FIXED_QUICK).map((v) => (
          <button
            key={v}
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setValueText(type === 'percent' ? String(v) : centsToDecimalString(v))}
          >
            {type === 'percent' ? `${v}%` : money(v)}
          </button>
        ))}
      </div>

      <label className="label mt-5" htmlFor="discount-note">
        Note / reason <span className="font-normal text-slate-500">(optional)</span>
      </label>
      <input id="discount-note" className="input" maxLength={80} placeholder="e.g. Staff, Promo" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-2 flex flex-wrap gap-2">
        {NOTE_SUGGESTIONS.map((s) => (
          <button key={s} type="button" className={`btn btn-sm ${note === s ? 'bg-slate-800 text-white' : 'btn-secondary'}`} onClick={() => setNote(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="mt-5 min-h-12">
        {parsed.error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 font-semibold text-red-700">{parsed.error}</p>
        ) : parsed.discount ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
            {describeDiscount(parsed.discount)} → saves {money(amount)}, new amount {money(baseCents - amount)}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
