import type { PosApi } from '../shared/ipc'

declare global {
  interface Window {
    pos: PosApi
  }
}

export {}
