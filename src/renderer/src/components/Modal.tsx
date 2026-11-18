import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ModalProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Submit handler: wraps the body in a <form> so Enter submits. */
  onSubmit?: () => void
}

const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

/** Open dialogs, innermost last: only the top one reacts to Escape. */
const modalStack: symbol[] = []

export function Modal({ title, onClose, children, footer, size = 'md', onSubmit }: ModalProps): ReactNode {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const me = Symbol('modal')
    modalStack.push(me)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === me) {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    // Focus the preferred element (or the first field) so keyboard users land inside the dialog.
    const panel = panelRef.current
    const first =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>('input:not([disabled]), select, textarea')
    ;(first ?? panel)?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      modalStack.splice(modalStack.indexOf(me), 1)
    }
  }, [])

  const body = (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <h2 id={titleId} className="text-xl font-bold text-slate-900">
          {title}
        </h2>
        <button type="button" className="btn btn-ghost btn-sm -mr-2 text-2xl leading-none" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</div>}
    </>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[calc(100vh-2rem)] w-full ${widths[size]} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none`}
      >
        {onSubmit ? (
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit()
            }}
          >
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>
  )
}

interface ConfirmProps {
  title: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

export function ConfirmDialog({ title, message, confirmLabel, danger, busy, onConfirm, onCancel, children }: ConfirmProps): ReactNode {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      onSubmit={onConfirm}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} data-autofocus={children ? undefined : true}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-base text-slate-700">{message}</div>
      {children && <div className="mt-4">{children}</div>}
    </Modal>
  )
}
