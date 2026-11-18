import { useEffect, useState, type ReactNode } from 'react'
import { APP_TITLE } from '../../../shared/ipc'
import { Modal } from './Modal'
import { PixelIcon } from './PixelIcon'

export function WebsiteLink({ className = '' }: { className?: string }): ReactNode {
  return (
    <button
      type="button"
      className={`underline-offset-2 hover:underline ${className}`}
      onClick={() => void window.pos.openWebsite()}
      title="Opens https://marketingredwagon.biz in your web browser"
    >
      by Red Wagon · marketingredwagon.biz
    </button>
  )
}

export function AboutDialog({ onClose }: { onClose: () => void }): ReactNode {
  const [path, setPath] = useState('')
  useEffect(() => {
    window.pos.getDataFilePath().then(setPath, () => setPath(''))
  }, [])

  return (
    <Modal
      title="About"
      onClose={onClose}
      size="sm"
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose} data-autofocus>
          Close
        </button>
      }
    >
      <div className="flex flex-col items-center text-center">
        <div className="flex gap-1">
          <PixelIcon id="latte" size={48} />
          <PixelIcon id="croissant" size={48} />
          <PixelIcon id="chips" size={48} />
        </div>
        <h3 className="mt-3 text-2xl font-extrabold">{APP_TITLE}</h3>
        <div className="text-sm text-slate-500">Version {__APP_VERSION__}</div>
        <WebsiteLink className="mt-2 font-semibold text-brand-600" />
        <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
          All data is stored locally on this computer.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Works fully offline. No internet connection is used, and no data ever leaves this device.
        </p>
        {path && (
          <div className="mt-4 w-full text-left">
            <div className="label">Data file</div>
            <div className="selectable rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs break-all text-slate-700">{path}</div>
          </div>
        )}
      </div>
    </Modal>
  )
}
