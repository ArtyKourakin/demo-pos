import { useMemo, useState, type ReactNode } from 'react'
import {
  computeCartTotals,
  describeDiscount,
  PosError,
  removeLine,
  setLineDiscount,
  setLineQuantity,
  setOrderDiscount,
  validateDiscount,
  type CartTotals
} from '../../../shared/pos'
import type { Cart, DiscountPreset } from '../../../shared/types'
import { ConfirmDialog } from '../components/Modal'
import { PixelIcon } from '../components/PixelIcon'
import { useToast } from '../components/Toasts'
import { useData } from '../data'
import { formatBasisPoints, money, plural } from '../format'
import { DiscountDialog } from './DiscountDialog'

interface Props {
  cart: Cart
  setCart: (cart: Cart) => void
  onCharge: (totalCents: number) => void
}

type DiscountTarget = { kind: 'order' } | { kind: 'line'; productId: string }

export function CartPanel({ cart, setCart, onCharge }: Props): ReactNode {
  const { data } = useData()
  const toast = useToast()
  const [discountTarget, setDiscountTarget] = useState<DiscountTarget | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const totals = useMemo((): CartTotals | null => {
    try {
      return computeCartTotals(cart, data.products, data.settings.taxRateBp)
    } catch {
      return null
    }
  }, [cart, data.products, data.settings.taxRateBp])

  const productById = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products])

  const changeQty = (productId: string, quantity: number): void => {
    const product = productById.get(productId)
    if (!product) return
    try {
      setCart(setLineQuantity(cart, product, quantity))
    } catch (err) {
      toast(err instanceof PosError ? err.message : String(err), 'error')
    }
  }

  const applyPresetToOrder = (preset: DiscountPreset): void => {
    if (!totals) return
    const err = validateDiscount(preset.discount, totals.subtotalCents)
    if (err) {
      toast(`${preset.label}: ${err}`, 'error')
      return
    }
    setCart(setOrderDiscount(cart, preset.discount))
    toast(`${preset.label} applied`, 'success')
  }

  const empty = cart.lines.length === 0 || !totals
  const targetLine =
    discountTarget?.kind === 'line' ? totals?.lines.find((l) => l.productId === discountTarget.productId) : undefined

  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div>
          <h2 className="text-xl font-bold">Current sale</h2>
          <div className="text-sm text-slate-500">{totals ? plural(totals.itemCount, 'item') : '0 items'}</div>
        </div>
        <button type="button" className="btn btn-danger-outline btn-sm" disabled={cart.lines.length === 0} onClick={() => setConfirmClear(true)}>
          Clear cart
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center text-slate-500">
            <div className="flex gap-1 opacity-70">
              <PixelIcon id="espresso" size={44} />
              <PixelIcon id="croissant" size={44} />
            </div>
            <p className="mt-3 text-lg font-semibold text-slate-700">Cart is empty</p>
            <p>Tap a product to add it to the sale.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {totals.lines.map((line) => {
              const product = productById.get(line.productId)
              const atMax = product ? line.quantity >= product.stock : true
              return (
                <li key={line.productId} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    {product && <PixelIcon id={product.icon} size={40} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">{line.name}</span>
                        <span className="text-lg font-bold tabular-nums">{money(line.netCents)}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 text-sm text-slate-500">
                        <span>{money(line.unitPriceCents)} each</span>
                        {line.discountCents > 0 && <span className="tabular-nums line-through">{money(line.grossCents)}</span>}
                      </div>
                      {line.discount && line.discountCents > 0 && (
                        <div className="mt-1 inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-900">
                          {describeDiscount(line.discount)} · −{money(line.discountCents)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 pl-[52px]">
                    <button
                      type="button"
                      className="btn btn-secondary h-11 w-11 p-0 text-2xl"
                      onClick={() => changeQty(line.productId, line.quantity - 1)}
                      aria-label={`One less ${line.name}`}
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-xl font-bold tabular-nums" aria-label="Quantity">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary h-11 w-11 p-0 text-2xl"
                      onClick={() => changeQty(line.productId, line.quantity + 1)}
                      disabled={atMax}
                      title={atMax ? 'No more in stock' : undefined}
                      aria-label={`One more ${line.name}`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ml-auto ${line.discount ? 'bg-amber-100 text-amber-900' : 'btn-secondary'}`}
                      onClick={() => setDiscountTarget({ kind: 'line', productId: line.productId })}
                    >
                      % Disc.
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-red-600"
                      onClick={() => setCart(removeLine(cart, line.productId))}
                      aria-label={`Remove ${line.name}`}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
        {data.settings.discountPresets.length > 0 && !empty && (
          <div className="mb-3 flex flex-wrap gap-2">
            {data.settings.discountPresets.map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn btn-sm border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
                onClick={() => applyPresetToOrder(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        <dl className="space-y-1 text-base">
          {totals && totals.lineDiscountCents > 0 && (
            <div className="flex justify-between text-slate-500">
              <dt>Items</dt>
              <dd className="tabular-nums">{money(totals.itemsGrossCents)}</dd>
            </div>
          )}
          {totals && totals.lineDiscountCents > 0 && (
            <div className="flex justify-between text-amber-800">
              <dt>Item discounts</dt>
              <dd className="tabular-nums">−{money(totals.lineDiscountCents)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="font-semibold tabular-nums">{money(totals?.subtotalCents ?? 0)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="min-w-0 text-slate-600">
              {totals?.orderDiscount ? (
                <button
                  type="button"
                  className="truncate text-left font-semibold text-amber-800 underline-offset-2 hover:underline"
                  onClick={() => setDiscountTarget({ kind: 'order' })}
                >
                  Discount: {describeDiscount(totals.orderDiscount)} ✎
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={empty}
                  onClick={() => setDiscountTarget({ kind: 'order' })}
                >
                  + Add order discount
                </button>
              )}
            </dt>
            <dd className={`tabular-nums ${totals && totals.orderDiscountCents > 0 ? 'font-semibold text-amber-800' : ''}`}>
              {totals && totals.orderDiscountCents > 0 ? `−${money(totals.orderDiscountCents)}` : money(0)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Tax ({formatBasisPoints(data.settings.taxRateBp)}%)</dt>
            <dd className="tabular-nums">{money(totals?.taxCents ?? 0)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-slate-300 pt-2">
            <dt className="text-xl font-extrabold">TOTAL</dt>
            <dd className="text-3xl font-extrabold tabular-nums">{money(totals?.totalCents ?? 0)}</dd>
          </div>
        </dl>
        <button
          type="button"
          className="btn btn-primary btn-lg mt-3 w-full text-xl"
          disabled={empty}
          onClick={() => totals && onCharge(totals.totalCents)}
        >
          Charge {money(totals?.totalCents ?? 0)}
        </button>
      </div>

      {discountTarget?.kind === 'order' && totals && (
        <DiscountDialog
          title="Order discount"
          baseCents={totals.subtotalCents}
          current={cart.orderDiscount}
          presets={data.settings.discountPresets}
          onClose={() => setDiscountTarget(null)}
          onApply={(d) => {
            setCart(setOrderDiscount(cart, d))
            setDiscountTarget(null)
          }}
          onRemove={() => {
            setCart(setOrderDiscount(cart, undefined))
            setDiscountTarget(null)
          }}
        />
      )}
      {discountTarget?.kind === 'line' && targetLine && (
        <DiscountDialog
          title={`Discount on ${targetLine.name}`}
          baseCents={targetLine.grossCents}
          current={cart.lines.find((l) => l.productId === targetLine.productId)?.discount}
          presets={data.settings.discountPresets}
          onClose={() => setDiscountTarget(null)}
          onApply={(d) => {
            setCart(setLineDiscount(cart, targetLine.productId, d))
            setDiscountTarget(null)
          }}
          onRemove={() => {
            setCart(setLineDiscount(cart, targetLine.productId, undefined))
            setDiscountTarget(null)
          }}
        />
      )}
      {confirmClear && (
        <ConfirmDialog
          title="Clear cart?"
          message="All items and discounts in the current sale will be removed."
          confirmLabel="Clear cart"
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            setCart({ lines: [] })
            setConfirmClear(false)
          }}
        />
      )}
    </aside>
  )
}
