import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { describeDiscount, validateDiscount } from '../../../shared/pos'
import type { Discount, DiscountPreset, Settings } from '../../../shared/types'
import { ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/Toasts'
import { useData } from '../data'
import { errorMessage, formatBasisPoints, parseMoneyToCents, parsePercentToBasisPoints } from '../format'

export function SettingsPanel(): ReactNode {
  return (
    <div className="grid max-w-6xl grid-cols-1 gap-5 xl:grid-cols-2">
      <StoreSettings />
      <PresetSettings />
      <DataTools />
    </div>
  )
}

function StoreSettings(): ReactNode {
  const { data, apply } = useData()
  const [storeName, setStoreName] = useState(data.settings.storeName)
  const [tax, setTax] = useState(formatBasisPoints(data.settings.taxRateBp))

  useEffect(() => {
    setStoreName(data.settings.storeName)
    setTax(formatBasisPoints(data.settings.taxRateBp))
  }, [data.settings.storeName, data.settings.taxRateBp])

  const taxBp = parsePercentToBasisPoints(tax)
  const dirty = storeName !== data.settings.storeName || taxBp !== data.settings.taxRateBp
  const error = !storeName.trim() ? 'Store name is required.' : taxBp === null || taxBp > 5000 ? 'Tax rate must be between 0 and 50%.' : null

  const save = (): void => {
    if (error || taxBp === null) return
    void apply(() => window.pos.updateSettings({ ...data.settings, storeName, taxRateBp: taxBp }), 'Settings saved')
  }

  return (
    <section className="card p-5">
      <h3 className="text-lg font-bold">Store</h3>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div>
          <label className="label" htmlFor="s-name">Store name (shown on receipts)</label>
          <input id="s-name" className="input" maxLength={60} value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="s-tax">Tax rate (%)</label>
          <div className="flex items-center gap-2">
            <input id="s-tax" className="input w-40 tabular-nums" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />
            <span className="text-slate-500">e.g. 0, 7.5 or 8.25. Applied after discounts.</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={!dirty || !!error}>
            Save settings
          </button>
          {error && <span className="font-semibold text-red-600">{error}</span>}
        </div>
      </form>
    </section>
  )
}

function PresetSettings(): ReactNode {
  const { data, apply } = useData()
  const [label, setLabel] = useState('')
  const [type, setType] = useState<Discount['type']>('percent')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [toDelete, setToDelete] = useState<DiscountPreset | null>(null)

  const parsed = useMemo((): { discount?: Discount; error?: string } => {
    if (!label.trim() && !value.trim()) return {}
    if (!label.trim()) return { error: 'Give the preset a name.' }
    const extra = note.trim() ? { note: note.trim() } : {}
    let d: Discount
    if (type === 'percent') {
      const bp = parsePercentToBasisPoints(value)
      if (bp === null) return { error: 'Enter a percentage.' }
      d = { type: 'percent', basisPoints: bp, ...extra }
    } else {
      const c = parseMoneyToCents(value)
      if (c === null) return { error: 'Enter an amount.' }
      d = { type: 'fixed', amountCents: c, ...extra }
    }
    const err = validateDiscount(d)
    return err ? { error: err } : { discount: d }
  }, [label, type, value, note])

  const savePresets = (presets: DiscountPreset[], message: string): Promise<boolean> => {
    const settings: Settings = { ...data.settings, discountPresets: presets }
    return apply(() => window.pos.updateSettings(settings), message)
  }

  const add = async (): Promise<void> => {
    if (!parsed.discount) return
    const preset: DiscountPreset = { id: crypto.randomUUID(), label: label.trim(), discount: parsed.discount }
    const ok = await savePresets([...data.settings.discountPresets, preset], `Preset “${preset.label}” added`)
    if (ok) {
      setLabel('')
      setValue('')
      setNote('')
    }
  }

  return (
    <section className="card p-5">
      <h3 className="text-lg font-bold">Discount presets</h3>
      <p className="text-sm text-slate-500">Shown as one-tap buttons in the cart and the discount dialog.</p>
      <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {data.settings.discountPresets.length === 0 && <li className="px-4 py-6 text-center text-slate-500">No presets yet.</li>}
        {data.settings.discountPresets.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-2">
            <span className="rounded-lg bg-sky-50 px-3 py-1 font-bold text-sky-900">{p.label}</span>
            <span className="flex-1 text-slate-600">{describeDiscount(p.discount)}</span>
            <button type="button" className="btn btn-ghost btn-sm text-red-600" onClick={() => setToDelete(p)}>
              Delete
            </button>
          </li>
        ))}
      </ul>

      <form
        className="mt-4 grid grid-cols-[1fr_auto] gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <input className="input" placeholder="Preset name, e.g. Happy hour" maxLength={24} value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Preset name" />
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {(['percent', 'fixed'] as const).map((t) => (
            <button key={t} type="button" className={`btn btn-sm min-h-9 ${type === t ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-white'}`} onClick={() => setType(t)}>
              {t === 'percent' ? '%' : '$'}
            </button>
          ))}
        </div>
        <input
          className="input tabular-nums"
          inputMode="decimal"
          placeholder={type === 'percent' ? 'Percent, e.g. 15' : 'Amount, e.g. 2.00'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Preset value"
        />
        <input className="input w-40" placeholder="Note (optional)" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Preset note" />
        <div className="col-span-2 flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={!parsed.discount}>
            Add preset
          </button>
          {parsed.error && <span className="font-semibold text-red-600">{parsed.error}</span>}
        </div>
      </form>

      {toDelete && (
        <ConfirmDialog
          title={`Delete “${toDelete.label}”?`}
          message="This preset will no longer be offered. Past sales that used it are not changed."
          confirmLabel="Delete preset"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={async () => {
            const ok = await savePresets(
              data.settings.discountPresets.filter((p) => p.id !== toDelete.id),
              `Preset “${toDelete.label}” deleted`
            )
            if (ok) setToDelete(null)
          }}
        />
      )}
    </section>
  )
}

function DataTools(): ReactNode {
  const { setData, apply } = useData()
  const toast = useToast()
  const [path, setPath] = useState('')
  const [confirm, setConfirm] = useState<'import' | 'reset' | null>(null)

  useEffect(() => {
    window.pos.getDataFilePath().then(setPath, () => setPath(''))
  }, [])

  const exportBackup = async (): Promise<void> => {
    try {
      const r = await window.pos.exportBackup()
      if (r.status === 'saved') toast(`Backup saved to ${r.path}`, 'success')
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const importBackup = async (): Promise<void> => {
    setConfirm(null)
    try {
      const r = await window.pos.importBackup()
      if (r.status === 'imported') {
        setData(r.data)
        toast('Backup imported', 'success')
      }
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <section className="card p-5 xl:col-span-2">
      <h3 className="text-lg font-bold">Data</h3>
      <p className="mt-1 text-slate-600">
        All data is stored locally on this computer in a single file. Nothing is sent over the internet.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-slate-100 px-4 py-3">
        <code className="selectable min-w-0 flex-1 font-mono text-sm break-all text-slate-700">{path || '…'}</code>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void window.pos.showDataFile()}>
          Show in folder
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="btn btn-secondary" onClick={() => void exportBackup()}>
          ⬇ Export backup
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setConfirm('import')}>
          ⬆ Import backup
        </button>
        <button type="button" className="btn btn-danger-outline ml-auto" onClick={() => setConfirm('reset')}>
          Reset demo data
        </button>
      </div>

      {confirm === 'import' && (
        <ConfirmDialog
          title="Import a backup?"
          message="Importing replaces ALL current products, sales, stock history and settings with the contents of the backup file. Consider exporting a backup first."
          confirmLabel="Choose backup file…"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => void importBackup()}
        />
      )}
      {confirm === 'reset' && (
        <ConfirmDialog
          title="Reset demo data?"
          message="This deletes all sales, stock history, custom products and settings, and restores the 10 demo products. This cannot be undone."
          confirmLabel="Reset everything"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const ok = await apply(() => window.pos.resetDemoData(), 'Demo data restored')
            if (ok) setConfirm(null)
          }}
        />
      )}
    </section>
  )
}
