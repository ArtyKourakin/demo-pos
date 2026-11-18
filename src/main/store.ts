/**
 * JSON file persistence. Only the main process touches the data file.
 *
 * Writes are atomic: the new content goes to a temp file in the same folder, is fsync'd,
 * then renamed over the real file. A crash mid-write leaves the previous file intact.
 * The in-memory copy only changes after the write has succeeded.
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createSeedData } from '../shared/seed'
import { findDataProblem } from '../shared/validate'
import type { AppData } from '../shared/types'

export const DATA_FILE_NAME = 'pos-data.json'

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

export function writeFileAtomic(filePath: string, content: string): void {
  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`)
  const fd = fs.openSync(tmp, 'w')
  try {
    fs.writeFileSync(fd, content, 'utf8')
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  // On Windows, antivirus / indexers can briefly lock the target: retry a few times.
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(tmp, filePath)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (attempt < 5 && (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES')) {
        sleepSync(50 * (attempt + 1))
        continue
      }
      try {
        fs.unlinkSync(tmp)
      } catch {
        /* ignore */
      }
      throw err
    }
  }
}

export function writeJsonAtomic(filePath: string, value: unknown): void {
  writeFileAtomic(filePath, JSON.stringify(value, null, 2))
}

export class DataStore {
  readonly filePath: string
  private data: AppData
  /** Set when an unreadable data file was found and moved aside on startup. */
  readonly recoveredFrom: string | null = null

  constructor(dir: string) {
    fs.mkdirSync(dir, { recursive: true })
    this.filePath = path.join(dir, DATA_FILE_NAME)

    if (!fs.existsSync(this.filePath)) {
      this.data = DataStore.seed()
      writeJsonAtomic(this.filePath, this.data)
      return
    }

    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
      const problem = findDataProblem(parsed)
      if (problem) throw new Error(problem)
      this.data = parsed as AppData
    } catch (err) {
      // Never silently destroy data: keep the unreadable file next to the new one.
      const aside = path.join(dir, `pos-data.unreadable-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
      fs.renameSync(this.filePath, aside)
      console.warn(`[store] Data file was unreadable (${(err as Error).message}); moved to ${aside} and reseeded.`)
      this.recoveredFrom = aside
      this.data = DataStore.seed()
      writeJsonAtomic(this.filePath, this.data)
    }
  }

  static seed(): AppData {
    return createSeedData(new Date().toISOString(), () => randomUUID())
  }

  get(): AppData {
    return this.data
  }

  /** Persist `next` atomically, then make it the current state. */
  replace(next: AppData): AppData {
    const problem = findDataProblem(next)
    if (problem) throw new Error(`Refusing to save invalid data: ${problem}`)
    writeJsonAtomic(this.filePath, next)
    this.data = next
    return next
  }

  /** Apply a pure update function and persist its result as one atomic step. */
  update(fn: (current: AppData) => AppData): AppData {
    return this.replace(fn(this.data))
  }
}
