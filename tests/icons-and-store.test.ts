import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DATA_FILE_NAME, DataStore } from '../src/main/store'
import { ICON_IDS, ICON_SIZE, ICONS, iconRuns, iconToSvg } from '../src/shared/icons'
import { receiveStock } from '../src/shared/pos'
import { SEED_PRODUCTS } from '../src/shared/seed'
import { ctx } from './helpers'

describe('pixel icons', () => {
  it.each(ICON_IDS)('%s is a valid 16x16 grid with a complete palette', (id) => {
    const icon = ICONS[id]
    expect(icon.rows).toHaveLength(ICON_SIZE)
    for (const row of icon.rows) {
      expect(row).toHaveLength(ICON_SIZE)
      for (const ch of row) if (ch !== '.') expect(icon.palette[ch], `colour for "${ch}"`).toMatch(/^#[0-9a-f]{6}$/i)
    }
    expect(iconRuns(id).length).toBeGreaterThan(10)
    expect(iconToSvg(id)).toMatch(/^<svg[^>]+viewBox="0 0 16 16"/)
  })

  it('every seed product uses its own icon', () => {
    const icons = SEED_PRODUCTS.map((p) => p.icon)
    expect(new Set(icons).size).toBe(10)
    for (const i of icons) expect(ICON_IDS).toContain(i)
  })
})

describe('DataStore (JSON file persistence)', () => {
  const dirs: string[] = []
  const tmp = (): string => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-pos-test-'))
    dirs.push(d)
    return d
  }
  afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
  })

  it('creates seed data on first run and reloads it', () => {
    const dir = tmp()
    const a = new DataStore(dir)
    expect(fs.existsSync(path.join(dir, DATA_FILE_NAME))).toBe(true)
    a.update((d) => receiveStock(d, 'p-muffin', 5, 'test', ctx()))
    const b = new DataStore(dir)
    expect(b.get().products.find((p) => p.id === 'p-muffin')!.stock).toBe(9)
  })

  it('writes atomically and leaves no temp files behind', () => {
    const dir = tmp()
    const store = new DataStore(dir)
    for (let i = 0; i < 5; i++) store.update((d) => receiveStock(d, 'p-water', 1, '', ctx()))
    expect(fs.readdirSync(dir)).toEqual([DATA_FILE_NAME])
  })

  it('keeps the old state if an update throws', () => {
    const dir = tmp()
    const store = new DataStore(dir)
    const before = fs.readFileSync(path.join(dir, DATA_FILE_NAME), 'utf8')
    expect(() => store.update((d) => receiveStock(d, 'p-water', -1, '', ctx()))).toThrow()
    expect(fs.readFileSync(path.join(dir, DATA_FILE_NAME), 'utf8')).toBe(before)
  })

  it('moves an unreadable data file aside instead of deleting it', () => {
    const dir = tmp()
    fs.writeFileSync(path.join(dir, DATA_FILE_NAME), '{ not json')
    const store = new DataStore(dir)
    expect(store.recoveredFrom).toBeTruthy()
    expect(fs.readFileSync(store.recoveredFrom!, 'utf8')).toBe('{ not json')
    expect(store.get().products).toHaveLength(10)
  })
})
