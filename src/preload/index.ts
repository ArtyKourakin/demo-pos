import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type IpcResult, type PosApi } from '../shared/ipc'

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (result.ok) return result.value
  throw new Error(result.error)
}

const api: PosApi = {
  load: () => call(IPC.load),
  completeSale: (cart, payment) => call(IPC.completeSale, cart, payment),
  voidSale: (saleId, reason) => call(IPC.voidSale, saleId, reason),
  receiveStock: (productId, quantity, note) => call(IPC.receiveStock, productId, quantity, note),
  adjustStock: (productId, newCount, reason, note) => call(IPC.adjustStock, productId, newCount, reason, note),
  saveProduct: (input) => call(IPC.saveProduct, input),
  setProductArchived: (productId, archived) => call(IPC.setProductArchived, productId, archived),
  updateSettings: (settings) => call(IPC.updateSettings, settings),
  exportBackup: () => call(IPC.exportBackup),
  importBackup: () => call(IPC.importBackup),
  resetDemoData: () => call(IPC.resetDemoData),
  saveCsv: (suggestedName, content) => call(IPC.saveCsv, suggestedName, content),
  getDataFilePath: () => call(IPC.getDataFilePath),
  showDataFile: () => call(IPC.showDataFile),
  openWebsite: () => call(IPC.openWebsite),
  onShowAbout: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.showAbout, listener)
    return () => {
      ipcRenderer.removeListener(IPC.showAbout, listener)
    }
  }
}

contextBridge.exposeInMainWorld('pos', api)
