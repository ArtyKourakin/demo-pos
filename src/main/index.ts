import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell, type IpcMainInvokeEvent } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { APP_TITLE, IPC, WEBSITE_URL, type FileSaveResult, type ImportResult, type IpcResult } from '../shared/ipc'
import { ICON_IDS } from '../shared/icons'
import { PosError } from '../shared/money'
import {
  adjustStock,
  completeSale,
  receiveStock,
  setProductArchived,
  updateSettings,
  upsertProduct,
  voidSale,
  type OpContext
} from '../shared/pos'
import type { AdjustmentReason, AppData, Cart, PaymentInput, ProductInput, Sale, Settings } from '../shared/types'
import { findDataProblem } from '../shared/validate'
import { DataStore, writeFileAtomic, writeJsonAtomic } from './store'

const DEV_URL = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined

let mainWindow: BrowserWindow | null = null
let store: DataStore

// One instance only: two windows writing the same data file would be a bad day.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  app.whenReady().then(start)
}

function ctx(): OpContext {
  return { now: new Date().toISOString(), newId: () => randomUUID() }
}

function today(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ---------------------------------------------------------------------------
// Offline lockdown
// ---------------------------------------------------------------------------

function isAllowedUrl(url: string): boolean {
  if (url.startsWith('file:') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('devtools:')) {
    return true
  }
  if (DEV_URL) {
    // Dev only: the local Vite server (http + websocket for hot reload). Never anything remote.
    const dev = new URL(DEV_URL)
    try {
      const u = new URL(url)
      return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.port === dev.port
    } catch {
      return false
    }
  }
  return false
}

function lockDownSession(): void {
  const ses = session.defaultSession
  // Block every network request that isn't a local file (CSP in index.html is the second layer).
  ses.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedUrl(details.url)
    if (!allowed) console.warn(`[offline] Blocked request to ${details.url}`)
    callback({ cancel: !allowed })
  })
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
}

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? ''
  return url.startsWith('file:') || (!!DEV_URL && url.startsWith(DEV_URL))
}

// ---------------------------------------------------------------------------
// Window + menu
// ---------------------------------------------------------------------------

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1100,
    minHeight: 680,
    title: APP_TITLE,
    backgroundColor: '#f1f5f9',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false // the spellchecker would download dictionaries
    }
  })

  mainWindow.on('page-title-updated', (e) => e.preventDefault())
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => (mainWindow = null))

  // Nothing may open inside the app: no popups, no navigation away from the bundle.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault())

  if (DEV_URL) {
    void mainWindow.loadURL(DEV_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function showAbout(): void {
  mainWindow?.webContents.send(IPC.showAbout)
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'Demo POS',
            submenu: [
              { label: 'About Demo POS', click: showAbout },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : [{ label: 'File', submenu: [{ role: 'quit' as const }] }]),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { label: 'Help', submenu: [{ label: 'About Demo POS', click: showAbout }] }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => R | Promise<R>): void {
  ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<R>> => {
    if (!isTrustedSender(event)) return { ok: false, error: 'Untrusted sender.' }
    try {
      return { ok: true, value: await fn(...(args as A)) }
    } catch (err) {
      if (err instanceof PosError) return { ok: false, error: err.message }
      console.error(`[ipc] ${channel} failed:`, err)
      return { ok: false, error: `Something went wrong: ${(err as Error)?.message ?? String(err)}` }
    }
  })
}

function registerIpc(): void {
  handle(IPC.load, (): AppData => store.get())

  handle(IPC.completeSale, (cart: Cart, payment: PaymentInput) => {
    let sale: Sale | undefined
    const data = store.update((current) => {
      const result = completeSale(current, cart, payment, ctx())
      sale = result.sale
      return result.data
    })
    return { data, sale: sale! }
  })

  handle(IPC.voidSale, (saleId: string, reason: string) =>
    store.update((d) => voidSale(d, saleId, String(reason ?? ''), ctx()))
  )

  handle(IPC.receiveStock, (productId: string, quantity: number, note: string) =>
    store.update((d) => receiveStock(d, productId, quantity, String(note ?? ''), ctx()))
  )

  handle(IPC.adjustStock, (productId: string, newCount: number, reason: AdjustmentReason, note: string) =>
    store.update((d) => adjustStock(d, productId, newCount, reason, String(note ?? ''), ctx()))
  )

  handle(IPC.saveProduct, (input: ProductInput) => store.update((d) => upsertProduct(d, input, ICON_IDS, ctx())))

  handle(IPC.setProductArchived, (productId: string, archived: boolean) =>
    store.update((d) => setProductArchived(d, productId, archived === true))
  )

  handle(IPC.updateSettings, (settings: Settings) => store.update((d) => updateSettings(d, settings)))

  handle(IPC.exportBackup, async (): Promise<FileSaveResult> => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export backup',
      defaultPath: path.join(app.getPath('documents'), `demo-pos-backup-${today()}.json`),
      filters: [{ name: 'Demo POS backup', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { status: 'canceled' }
    writeJsonAtomic(result.filePath, store.get())
    return { status: 'saved', path: result.filePath }
  })

  handle(IPC.importBackup, async (): Promise<ImportResult> => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Import backup',
      properties: ['openFile'],
      filters: [{ name: 'Demo POS backup', extensions: ['json'] }]
    })
    const file = result.filePaths[0]
    if (result.canceled || !file) return { status: 'canceled' }
    if (fs.statSync(file).size > 100 * 1024 * 1024) throw new PosError('That file is too large to be a Demo POS backup.')
    let parsed: unknown
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      throw new PosError('That file is not valid JSON.')
    }
    const problem = findDataProblem(parsed)
    if (problem) throw new PosError(`That file is not a valid Demo POS backup (${problem}).`)
    const data = store.replace(parsed as AppData)
    return { status: 'imported', path: file, data }
  })

  handle(IPC.resetDemoData, () => store.replace(DataStore.seed()))

  handle(IPC.saveCsv, async (suggestedName: string, content: string): Promise<FileSaveResult> => {
    const safeName = String(suggestedName).replace(/[^\w.-]+/g, '-') || 'report.csv'
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export report (CSV)',
      defaultPath: path.join(app.getPath('documents'), safeName),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (result.canceled || !result.filePath) return { status: 'canceled' }
    // UTF-8 BOM so Excel opens it with the right encoding.
    writeFileAtomic(result.filePath, '﻿' + String(content))
    return { status: 'saved', path: result.filePath }
  })

  handle(IPC.getDataFilePath, () => store.filePath)

  handle(IPC.showDataFile, () => shell.showItemInFolder(store.filePath))

  // The ONLY external link in the app, opened in the system browser. The URL is fixed here,
  // so the renderer can't ask the main process to open anything else.
  handle(IPC.openWebsite, () => shell.openExternal(WEBSITE_URL))
}

// ---------------------------------------------------------------------------

function start(): void {
  app.setAppUserModelId('biz.marketingredwagon.demopos')
  try {
    store = new DataStore(app.getPath('userData'))
  } catch (err) {
    dialog.showErrorBox('Demo POS', `Could not open the data file:\n${(err as Error).message}`)
    app.quit()
    return
  }
  lockDownSession()
  registerIpc()
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Defence in depth: refuse to create any webview or extra window from any webContents.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-attach-webview', (event) => event.preventDefault())
})
