import type { ReactNode } from 'react'
import type { Sale } from '../../../shared/types'
import { Modal } from './Modal'
import { PrintableReceipt, Receipt } from './Receipt'

interface Props {
  sale: Sale
  title: string
  onClose: () => void
  closeLabel?: string
  banner?: ReactNode
  extraActions?: ReactNode
}

export function ReceiptDialog({ sale, title, onClose, closeLabel = 'Close', banner, extraActions }: Props): ReactNode {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="md"
      footer={
        <>
          {extraActions}
          <div className="flex-1" />
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => window.print()}>
            🖨 Print
          </button>
          <button type="button" className="btn btn-primary btn-lg min-w-40" onClick={onClose} data-autofocus>
            {closeLabel}
          </button>
        </>
      }
    >
      {banner}
      <Receipt sale={sale} />
      <PrintableReceipt sale={sale} />
    </Modal>
  )
}
