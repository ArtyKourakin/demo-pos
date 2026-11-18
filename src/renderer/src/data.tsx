import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppData } from '../../shared/types'
import { useToast } from './components/Toasts'
import { errorMessage } from './format'

interface DataContextValue {
  data: AppData
  /** Run an operation that returns fresh AppData; shows a toast on success/failure. Returns true on success. */
  apply: (op: () => Promise<AppData>, successMessage?: string) => Promise<boolean>
  setData: (data: AppData) => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }): ReactNode {
  const [data, setData] = useState<AppData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    window.pos.load().then(setData, (err: unknown) => setLoadError(errorMessage(err)))
  }, [])

  const apply = useCallback(
    async (op: () => Promise<AppData>, successMessage?: string): Promise<boolean> => {
      try {
        setData(await op())
        if (successMessage) toast(successMessage, 'success')
        return true
      } catch (err) {
        toast(errorMessage(err), 'error')
        return false
      }
    },
    [toast]
  )

  const value = useMemo(() => (data ? { data, apply, setData } : null), [data, apply])

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="card max-w-lg p-8 text-center">
          <h1 className="text-xl font-bold">Could not load data</h1>
          <p className="mt-2 text-slate-600">{loadError}</p>
        </div>
      </div>
    )
  }
  if (!value) {
    return <div className="flex h-full items-center justify-center text-slate-500">Loading…</div>
  }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}
