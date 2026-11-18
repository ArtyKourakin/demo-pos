import type {
  AdjustmentReason,
  AppData,
  Cart,
  PaymentInput,
  ProductInput,
  Sale,
  Settings
} from './types'

/** The only external URL the app ever opens (in the system browser, never inside the app). */
export const WEBSITE_URL = 'https://marketingredwagon.biz'
export const APP_TITLE = 'Demo POS created by RWGN'

export type FileSaveResult = { status: 'saved'; path: string } | { status: 'canceled' }
export type ImportResult = { status: 'imported'; path: string; data: AppData } | { status: 'canceled' }

/** Typed API exposed to the renderer as `window.pos` (see src/preload/index.ts). */
export interface PosApi {
  load(): Promise<AppData>
  completeSale(cart: Cart, payment: PaymentInput): Promise<{ data: AppData; sale: Sale }>
  voidSale(saleId: string, reason: string): Promise<AppData>
  receiveStock(productId: string, quantity: number, note: string): Promise<AppData>
  adjustStock(productId: string, newCount: number, reason: AdjustmentReason, note: string): Promise<AppData>
  saveProduct(input: ProductInput): Promise<AppData>
  setProductArchived(productId: string, archived: boolean): Promise<AppData>
  updateSettings(settings: Settings): Promise<AppData>
  exportBackup(): Promise<FileSaveResult>
  importBackup(): Promise<ImportResult>
  resetDemoData(): Promise<AppData>
  saveCsv(suggestedName: string, content: string): Promise<FileSaveResult>
  getDataFilePath(): Promise<string>
  showDataFile(): Promise<void>
  openWebsite(): Promise<void>
  /** Subscribe to the "About" menu item. Returns an unsubscribe function. */
  onShowAbout(callback: () => void): () => void
}

/** IPC channel names. Kept in one place so main and preload can't drift apart. */
export const IPC = {
  load: 'pos:load',
  completeSale: 'pos:complete-sale',
  voidSale: 'pos:void-sale',
  receiveStock: 'pos:receive-stock',
  adjustStock: 'pos:adjust-stock',
  saveProduct: 'pos:save-product',
  setProductArchived: 'pos:set-product-archived',
  updateSettings: 'pos:update-settings',
  exportBackup: 'pos:export-backup',
  importBackup: 'pos:import-backup',
  resetDemoData: 'pos:reset-demo-data',
  saveCsv: 'pos:save-csv',
  getDataFilePath: 'pos:get-data-file-path',
  showDataFile: 'pos:show-data-file',
  openWebsite: 'pos:open-website',
  showAbout: 'menu:show-about'
} as const

/** Envelope used over IPC so errors arrive with a clean, user-facing message. */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string }
