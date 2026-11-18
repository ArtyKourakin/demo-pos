import type { OpContext } from '../src/shared/pos'
import { createSeedData } from '../src/shared/seed'
import type { AppData, Product } from '../src/shared/types'

export const NOW = '2026-11-19T15:30:00.000Z'

let idCounter = 0

/** Deterministic clock; ids are unique across every ctx() call in a test run (like randomUUID). */
export function ctx(now = NOW): OpContext {
  return { now, newId: () => `id-${++idCounter}` }
}

export function seed(): AppData {
  let n = 0
  return createSeedData(NOW, () => `seed-${++n}`)
}

export function product(data: AppData, id: string): Product {
  const p = data.products.find((x) => x.id === id)
  if (!p) throw new Error(`no product ${id}`)
  return p
}
