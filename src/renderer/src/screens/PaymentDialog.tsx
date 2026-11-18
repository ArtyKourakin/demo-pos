import { useMemo, useState, type ReactNode } from 'react'
import { CARD_TYPES, validateCardDetails } from '../../../shared/pos'
import type { CardDetails, CardType, Cart, PaymentInput, Sale } from '../../../shared/types'
import { Modal } from '../components/Modal'
import { useData } from '../data'
import { centsToDecimalString, errorMessage, money, parseMoneyToCents } from '../format'

type Mode = 'cash' | 'card' | 'split'

interface Props {
  cart: Cart
  totalCents: number
  onClose: () => void
  onCompleted: (sale: Sale) => void
}

function MoneyField({
  label,
  value,
  onChange,
  autoFocus,
  id
}: {
  label: string
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
  id: string
}): ReactNode {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl font-bold text-slate-400">$</span>
        <input
          id={id}
          className="input min-h-16 pl-10 text-3xl font-bold tabular-nums"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-autofocus={autoFocus || undefined}
        />
      </div>
    </div>
  )
}

function CardFields({ card, onChange }: { card: CardDetails; onChange: (c: CardDetails) => void }): ReactNode {
  return (
    <div className="space-y-4">
      <div>
        <div className="label">Card type</div>
        <div className="grid grid-cols-5 gap-2">
          {CARD_TYPES.map((t: CardType) => (
            <button
              key={t}
              type="button"
              className={`btn px-2 ${card.cardType === t ? 'bg-slate-900 text-white' : 'btn-secondary'}`}
              onClick={() => onChange({ ...card, cardType: t })}
              aria-pressed={card.cardType === t}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="card-last4">
            Last 4 digits <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="card-last4"
            className="input font-mono text-lg tracking-widest"
            inputMode="numeric"
            autoComplete="off"
            placeholder="1234"
            maxLength={4}
            value={card.last4 ?? ''}
            onChange={(e) => onChange({ ...card, last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          />
        </div>
        <div>
          <label className="label" htmlFor="card-ref">
            Approval / reference # <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="card-ref"
            className="input font-mono text-lg"
            autoComplete="off"
            placeholder="e.g. 083412"
            maxLength={40}
            value={card.reference ?? ''}
            onChange={(e) => onChange({ ...card, reference: e.target.value })}
          />
        </div>
      </div>
      <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
        Process the card on your <b>standalone card terminal</b> first, then record it here. This app never asks for or stores
        the full card number, expiry date or CVV.
      </p>
    </div>
  )
}

export function PaymentDialog({ cart, totalCents, onClose, onCompleted }: Props): ReactNode {
  const { setData } = useData()
  const [mode, setMode] = useState<Mode>('cash')
  const [tendered, setTendered] = useState('')
  const [card, setCard] = useState<CardDetails>({ cardType: 'Visa' })
  const [splitCash, setSplitCash] = useState('')
  const [splitCard, setSplitCard] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tenderedCents = parseMoneyToCents(tendered)
  const splitCashCents = parseMoneyToCents(splitCash)
  const splitCardCents = parseMoneyToCents(splitCard)

  const status = useMemo((): { input?: PaymentInput; problem?: string } => {
    if (mode === 'cash') {
      if (tenderedCents === null) return { problem: 'Enter the amount received.' }
      if (tenderedCents < totalCents) return { problem: `Amount received is ${money(totalCents - tenderedCents)} short.` }
      return { input: { kind: 'cash', tenderedCents } }
    }
    const cardErr = validateCardDetails(card)
    if (mode === 'card') {
      if (cardErr) return { problem: cardErr }
      return { input: { kind: 'card', card } }
    }
    if (splitCashCents === null || splitCardCents === null) return { problem: 'Enter both the cash and the card amount.' }
    if (splitCashCents <= 0 || splitCardCents <= 0) return { problem: 'Both amounts must be more than $0.00.' }
    const diff = totalCents - splitCashCents - splitCardCents
    if (diff > 0) return { problem: `${money(diff)} still to allocate.` }
    if (diff < 0) return { problem: `Over the total by ${money(-diff)}.` }
    if (cardErr) return { problem: cardErr }
    return { input: { kind: 'split', cashCents: splitCashCents, cardCents: splitCardCents, card } }
  }, [mode, tenderedCents, totalCents, card, splitCashCents, splitCardCents])

  const complete = async (): Promise<void> => {
    if (!status.input || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await window.pos.completeSale(cart, status.input)
      setData(result.data)
      onCompleted(result.sale)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const quickCash = [
    { label: `Exact ${money(totalCents)}`, cents: totalCents },
    { label: '$20', cents: 2000 },
    { label: '$50', cents: 5000 },
    { label: '$100', cents: 10000 }
  ]

  return (
    <Modal
      title="Take payment"
      onClose={busy ? () => undefined : onClose}
      size="lg"
      onSubmit={() => void complete()}
      footer={
        <>
          <div className={`mr-auto text-base font-semibold ${status.problem ? 'text-slate-500' : 'text-emerald-700'}`}>
            {status.problem ?? 'Ready to complete'}
          </div>
          <button type="button" className="btn btn-secondary btn-lg" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-lg min-w-52" disabled={!status.input || busy}>
            {busy ? 'Saving…' : 'Complete sale'}
          </button>
        </>
      }
    >
      <div className="mb-5 flex items-center justify-between rounded-2xl bg-slate-900 px-6 py-4 text-white">
        <span className="text-lg font-semibold text-slate-300">Total due</span>
        <span className="text-4xl font-extrabold tabular-nums">{money(totalCents)}</span>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5" role="tablist">
        {(
          [
            ['cash', '💵 Cash'],
            ['card', '💳 Card'],
            ['split', '➗ Split']
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`btn btn-lg ${mode === m ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-white'}`}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'cash' && (
        <div className="space-y-4">
          <MoneyField id="cash-received" label="Amount received" value={tendered} onChange={setTendered} autoFocus />
          <div className="grid grid-cols-4 gap-2">
            {quickCash.map((q) => (
              <button
                key={q.label}
                type="button"
                className="btn btn-secondary btn-lg px-2"
                disabled={q.cents < totalCents}
                onClick={() => setTendered(centsToDecimalString(q.cents))}
              >
                {q.label}
              </button>
            ))}
          </div>
          <div
            className={`flex items-center justify-between rounded-2xl px-6 py-4 ${
              tenderedCents !== null && tenderedCents >= totalCents ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span className="text-lg font-semibold">Change due</span>
            <span className="text-4xl font-extrabold tabular-nums">
              {tenderedCents !== null && tenderedCents >= totalCents ? money(tenderedCents - totalCents) : '—'}
            </span>
          </div>
        </div>
      )}

      {mode === 'card' && <CardFields card={card} onChange={setCard} />}

      {mode === 'split' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <MoneyField
              id="split-cash"
              label="Cash portion"
              value={splitCash}
              autoFocus
              onChange={(v) => {
                setSplitCash(v)
                const c = parseMoneyToCents(v)
                if (c !== null && c < totalCents) setSplitCard(centsToDecimalString(totalCents - c))
              }}
            />
            <MoneyField id="split-card" label="Card portion" value={splitCard} onChange={setSplitCard} />
          </div>
          <p className="text-sm text-slate-500">
            Typing the cash portion fills in the card portion automatically. Cash + card must equal {money(totalCents)}. Collect the
            cash portion exactly.
          </p>
          <CardFields card={card} onChange={setCard} />
        </div>
      )}

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 font-semibold text-red-700">{error}</p>}
    </Modal>
  )
}
