// Generates build/icon.png (1024x1024) for electron-builder from the Latte pixel-art icon.
// Zero dependencies: parses the grid out of src/shared/icons.ts and writes a PNG with node:zlib.
// Usage: npm run icon
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = fs.readFileSync(path.join(root, 'src/shared/icons.ts'), 'utf8')
const block = /\n {2}latte: \{([\s\S]*?)\n {2}\}/.exec(src)?.[1]
if (!block) throw new Error('latte icon not found in icons.ts')
const palette = Object.fromEntries([...block.matchAll(/(\w): '(#[0-9a-fA-F]{6})'/g)].map((m) => [m[1], m[2]]))
const rows = [...block.matchAll(/^ {6}'([^']{16})'/gm)].map((m) => m[1])
if (rows.length !== 16) throw new Error('unexpected icon grid')

const SIZE = 1024
const BG = [0xc6, 0x28, 0x28]
const RADIUS = 200
const SCALE = 44 // 16 * 44 = 704px artwork
const OFFSET = (SIZE - 16 * SCALE) / 2
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

const px = Buffer.alloc(SIZE * SIZE * 4)
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const o = (y * SIZE + x) * 4
    // rounded-square background
    const cx = Math.max(RADIUS - x, 0, x - (SIZE - 1 - RADIUS))
    const cy = Math.max(RADIUS - y, 0, y - (SIZE - 1 - RADIUS))
    if (cx * cx + cy * cy > RADIUS * RADIUS) continue // transparent corner
    let c = BG
    const gx = Math.floor((x - OFFSET) / SCALE)
    const gy = Math.floor((y - OFFSET) / SCALE)
    if (gx >= 0 && gy >= 0 && gx < 16 && gy < 16) {
      const ch = rows[gy][gx]
      if (ch !== '.' && palette[ch]) c = hex(palette[ch])
    }
    px[o] = c[0]
    px[o + 1] = c[1]
    px[o + 2] = c[2]
    px[o + 3] = 255
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let crc = 0xffffffff
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let y = 0; y < SIZE; y++) px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8
ihdr[9] = 6
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])
fs.mkdirSync(path.join(root, 'build'), { recursive: true })
fs.writeFileSync(path.join(root, 'build/icon.png'), png)
console.log(`Wrote build/icon.png (${SIZE}x${SIZE}, ${png.length} bytes)`)
