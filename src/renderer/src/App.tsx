import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { APP_TITLE } from '../../shared/ipc'
import { emptyCart, lowStockProducts, reconcileCart } from '../../shared/pos'
import type { Cart } from '../../shared/types'
import { AboutDialog, WebsiteLink } from './components/AboutDialog'
import { PixelIcon } from './components/PixelIcon'
import { useToast } from './components/Toasts'
import { useData } from './data'
import { InventoryScreen } from './screens/InventoryScreen'
import { ReportsScreen } from './screens/ReportsScreen'
import { SalesScreen } from './screens/SalesScreen'

type Tab = 'sales' | 'inventory' | 'reports'

export default function App(): ReactNode {
  const { data } = useData()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('sales')
  const [cart, setCart] = useState<Cart>(emptyCart)
  const [showAbout, setShowAbout] = useState(false)

  useEffect(() => window.pos.onShowAbout(() => setShowAbout(true)), [])

  // Keep the cart valid whenever stock or products change (archive, adjust, import, reset…).
  useEffect(() => {
    const result = reconcileCart(cart, data.products)
    if (result.changed) {
      setCart(result.cart)
      toast('Cart updated to match current stock', 'info')
    }
  }, [cart, data.products, toast])

  const lowCount = useMemo(() => lowStockProducts(data.products).length, [data.products])

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'sales', label: 'Sales' },
    { id: 'inventory', label: 'Inventory & Settings', badge: lowCount },
    { id: 'reports', label: 'Reports' }
  ]

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center gap-4 bg-slate-900 px-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <PixelIcon id="latte" size={30} />
          </div>
          <h1 className="text-lg leading-tight font-extrabold whitespace-nowrap">{APP_TITLE}</h1>
        </div>
        <nav className="ml-4 flex gap-1" aria-label="Main">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? 'page' : undefined}
              className={`relative min-h-11 rounded-xl px-4 text-base font-bold transition-colors ${
                tab === t.id ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {!!t.badge && (
                <span
                  className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-400 px-1.5 text-sm font-extrabold text-amber-950"
                  title={`${t.badge} low-stock items`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm whitespace-nowrap">
          <WebsiteLink className="text-slate-300 hover:text-white" />
          <button type="button" className="btn btn-sm border border-slate-600 text-slate-100 hover:bg-slate-800" onClick={() => setShowAbout(true)}>
            About
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {tab === 'sales' && <SalesScreen cart={cart} setCart={setCart} />}
        {tab === 'inventory' && <InventoryScreen />}
        {tab === 'reports' && <ReportsScreen />}
      </main>

      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
    </div>
  )
}
