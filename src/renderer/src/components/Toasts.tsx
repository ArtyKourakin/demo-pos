import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  message: string
  kind: ToastKind
}
type ShowToast = (message: string, kind?: ToastKind) => void

const ToastContext = createContext<ShowToast | null>(null)

export function ToastProvider({ children }: { children: ReactNode }): ReactNode {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const show = useCallback<ShowToast>((message, kind = 'info') => {
    const id = nextId.current++
    setToasts((t) => [...t.slice(-3), { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 3000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto max-w-xl rounded-xl px-5 py-3 text-base font-semibold shadow-lg ${
              t.kind === 'error'
                ? 'bg-red-600 text-white'
                : t.kind === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
