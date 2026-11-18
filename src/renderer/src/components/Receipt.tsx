import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { describeDiscount } from '../../../shared/pos'
import type { Sale } from '../../../shared/types'
import { formatBasisPoints, formatDateTime, money } from '../format'

function Row({ label, value, strong, className = '' }: { label: ReactNode; value: ReactNode; strong?: boolean; className?: string }): ReactNode {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'font-bold' : ''} ${className}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

export function Receipt({ sale }: { sale: Sale }): ReactNode {
  const voided = sale.status === 'voided'
  return (
    <div className="receipt selectable relative mx-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 font-mono text-[13px] leading-relaxed text-slate-900 shadow-sm">
      {voided && (
        <div className="mb-3 rounded-md border-2 border-red-600 py-1 text-center text-base font-bold tracking-widest text-red-600">
          VOIDED
        </div>
      )}
      <div className="text-center">
        <div className="text-base font-bold">{sale.storeName}</div>
        <div>Receipt #{sale.receiptNo}</div>
        <div>{formatDateTime(sale.createdAt)}</div>
      </div>
      <hr className="my-3 border-dashed border-slate-400" />

      {sale.lines.map((l) => (
        <div key={l.productId} className="mb-1.5">
          <Row label={l.name} value={money(l.grossCents)} />
          <div className="pl-3 text-slate-600">
            {l.quantity} × {money(l.unitPriceCents)}
          </div>
          {l.discountCents > 0 && l.discount && (
            <Row className="pl-3 text-slate-600" label={`Disc: ${describeDiscount(l.discount)}`} value={`-${money(l.discountCents)}`} />
          )}
        </div>
      ))}

      <hr className="my-3 border-dashed border-slate-400" />
      {sale.lineDiscountCents > 0 && <Row label="Items" value={money(sale.itemsGrossCents)} />}
      {sale.lineDiscountCents > 0 && <Row label="Item discounts" value={`-${money(sale.lineDiscountCents)}`} />}
      <Row label="Subtotal" value={money(sale.subtotalCents)} />
      {sale.orderDiscountCents > 0 && sale.orderDiscount && (
        <Row label={`Discount: ${describeDiscount(sale.orderDiscount)}`} value={`-${money(sale.orderDiscountCents)}`} />
      )}
      <Row label={`Tax (${formatBasisPoints(sale.taxRateBp)}%)`} value={money(sale.taxCents)} />
      <Row label="TOTAL" value={money(sale.totalCents)} strong className="mt-1 text-base" />
      {(sale.lineDiscountCents > 0 || sale.orderDiscountCents > 0) && (
        <div className="mt-1 text-center text-slate-600">
          You saved {money(sale.lineDiscountCents + sale.orderDiscountCents)}
        </div>
      )}

      <hr className="my-3 border-dashed border-slate-400" />
      {sale.payments.map((p, i) =>
        p.method === 'cash' ? (
          <div key={i}>
            <Row label="Cash" value={money(p.amountCents)} />
            {p.tenderedCents !== p.amountCents && <Row className="pl-3" label="Received" value={money(p.tenderedCents)} />}
          </div>
        ) : (
          <div key={i}>
            <Row label={`Card – ${p.cardType}${p.last4 ? ` ••••${p.last4}` : ''}`} value={money(p.amountCents)} />
            {p.reference && <div className="pl-3 text-slate-600">Ref: {p.reference}</div>}
          </div>
        )
      )}
      {sale.changeCents > 0 && <Row label="Change" value={money(sale.changeCents)} strong />}
      {voided && (
        <div className="mt-2 text-red-700">
          Voided {sale.voidedAt ? formatDateTime(sale.voidedAt) : ''}
          {sale.voidReason ? ` – ${sale.voidReason}` : ''}
        </div>
      )}

      <hr className="my-3 border-dashed border-slate-400" />
      <div className="text-center text-slate-600">
        Thank you!
        <br />
        Demo POS created by RWGN
      </div>
    </div>
  )
}

/** Mounts a copy of the receipt into #print-root so window.print() prints only the receipt. */
export function PrintableReceipt({ sale }: { sale: Sale }): ReactNode {
  const target = document.getElementById('print-root')
  return target ? createPortal(<Receipt sale={sale} />, target) : null
}
