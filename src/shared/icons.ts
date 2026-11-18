/**
 * Original 16x16 pixel-art product icons.
 *
 * Each icon is a grid of characters; "." is transparent and every other character maps to a colour
 * in that icon's palette. Rendered as crisp SVG rectangles with image-rendering: pixelated.
 */
import type { IconId } from './types'

export interface PixelIcon {
  label: string
  palette: Record<string, string>
  rows: readonly string[]
}

export const ICON_SIZE = 16

export const ICONS: Record<IconId, PixelIcon> = {
  espresso: {
    label: 'Espresso cup',
    palette: { k: '#3b2416', c: '#5a3018', C: '#c58b4f', w: '#fbf7f0', g: '#d8cfc2', p: '#ece6da', P: '#cfc6b6', s: '#aab6c2' },
    rows: [
      '......s..s......',
      '.......s..s.....',
      '......s..s......',
      '.......s..s.....',
      '................',
      '....kkkkkkkk....',
      '...kcCCCcccckk..',
      '...kwwwwwwwgwwk.',
      '...kwwwwwwwgkwk.',
      '...kwwwwwwwgwwk.',
      '...kwwwwwwwgkk..',
      '....kwwwwwgk....',
      '.kkkkkkkkkkkkkk.',
      'kppppppppppppppk',
      '.kkPPPPPPPPPPkk.',
      '...kkkkkkkkkk...'
    ]
  },
  latte: {
    label: 'Latte glass',
    palette: { k: '#4a3426', f: '#fffaf0', m: '#e2c29b', c: '#8a5a35', h: '#f1dcc0', H: '#a9774f', G: '#d9e4ea', s: '#aab6c2' },
    rows: [
      '......s..s......',
      '.......s..s.....',
      '......s..s......',
      '....kkkkkkkk....',
      '...kffffffffk...',
      '...kffffffffkk..',
      '...kmhmmmmmmGGk.',
      '...kmhmmmmmmkGk.',
      '...kmhmmmmmmkGk.',
      '...kmhmmmmmmGGk.',
      '...kcHcccccckk..',
      '...kcHcccccck...',
      '...kcHcccccck...',
      '...kcccccccck...',
      '....kkkkkkkk....',
      '................'
    ]
  },
  'iced-tea': {
    label: 'Iced tea glass',
    palette: { k: '#2f3b45', t: '#d17f22', T: '#a85a12', i: '#eaf7fd', I: '#b7dcef', r: '#e2453c', y: '#f5d33d', Y: '#fff6b0' },
    rows: [
      '.............r..',
      '..yy........r...',
      '.yYYy......r....',
      '...kkkkkkkrkk...',
      '..kTTTTTTTrTTk..',
      '..ktiittttritk..',
      '..ktiIttttrItk..',
      '..ktttttiirttk..',
      '..ktttttiIrttk..',
      '..ktiitttttttk..',
      '..ktiItttttttk..',
      '..kttttttttttk..',
      '...kTTTTTTTTk...',
      '...kTTTTTTTTk...',
      '....kkkkkkkk....',
      '................'
    ]
  },
  croissant: {
    label: 'Croissant',
    palette: { k: '#6b3a12', y: '#eba548', Y: '#c27424', h: '#ffd27a' },
    rows: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '....kkkkkkkk....',
      '...kYhhhhhhYk...',
      '..khYhyyyyhYhk..',
      '.khhyYyyyyYyhhk.',
      'kYYyyyyyyyyyyYYk',
      'yyyYyykkkkyyYyyy',
      'yyyykk....kkyyyy',
      'Yyyyk......kyyyY',
      'Yyyyk......kyyyY',
      'kkkk........kkkk',
      '................'
    ]
  },
  muffin: {
    label: 'Blueberry muffin',
    palette: { k: '#4a2c1a', b: '#d39a58', B: '#b07a3e', u: '#3b4fa8', p: '#8cc1e0', P: '#5d9cc4' },
    rows: [
      '................',
      '.........k......',
      '.....kkkkbk.....',
      '...kkbbbbubkk...',
      '..kbbubbbbbbbk..',
      '.kbbbbbbbbbubbk.',
      '.kbubbbubbbbbbk.',
      '.kbbbbbbbbbbubk.',
      'kBBBBBuBBBBBBBBk',
      '.kkkkkkkkkkkkkk.',
      '..kPppPppPppPk..',
      '..kPppPppPppPk..',
      '..kPppPppPppPk..',
      '...kppPppPppk...',
      '...kppPppPppk...',
      '....kkkkkkkk....'
    ]
  },
  bagel: {
    label: 'Bagel',
    palette: { k: '#5a3311', b: '#d9a35b', B: '#b97c35', h: '#efc283', s: '#fff3d6' },
    rows: [
      '................',
      '........k.......',
      '....kkkkskkk....',
      '...khhhhbbbbk...',
      '..khshhbbbbsbk..',
      '.khhhbbbbbbbbbk.',
      'khhhbbkkkkbbbBBk',
      'khhbbk....kbBBBk',
      'khsbbk....kBBsBk',
      'khbbbk....kBBBBk',
      'kbbbbbkkkkBBBBBk',
      '.kbbbbbbBBBBBBk.',
      '..kbbbbBBBsBBk..',
      '...kbbsBBBBBk...',
      '....kkkkkkkk....',
      '................'
    ]
  },
  water: {
    label: 'Water bottle',
    palette: { k: '#22404f', c: '#2f7fd1', C: '#1f5f9f', w: '#bfe6fa', W: '#8fcdee', h: '#ffffff', l: '#ffffff', L: '#2f9be0' },
    rows: [
      '......kkkk......',
      '.....kcccck.....',
      '.....kCCCCk.....',
      '......kwwk......',
      '......kwwk......',
      '.....kwwwwk.....',
      '....kwwwwwwk....',
      '...kwhwwwwwWk...',
      '...kwhwwwwwWk...',
      '...kLLLLLLLLk...',
      '...klllLLlllk...',
      '...kLLLLLLLLk...',
      '...kwhwwwwwWk...',
      '...kwhwwwwwWk...',
      '...kWWWWWWWWk...',
      '....kkkkkkkk....'
    ]
  },
  chips: {
    label: 'Bag of chips',
    palette: { k: '#4d0f0b', r: '#e03b2f', R: '#b52a20', s: '#e6e6e6', S: '#a9a9a9', w: '#ffffff', y: '#f7c948', Y: '#d9a520' },
    rows: [
      '................',
      '...kkkkkkkkkk...',
      '..ksSsSsSsSsSk..',
      '..krrrrrrrrRRk..',
      '..kwwwwwwwwwwk..',
      '..krrrrrrrrRRk..',
      '..krrrryyrrRRk..',
      '..krrryyyyrRRk..',
      '..krryyyyyYRRk..',
      '..krryyyyYYRRk..',
      '..krryyyYYYRRk..',
      '..krrryYYYrRRk..',
      '..krrrrYYrrRRk..',
      '..krrrrrrrrRRk..',
      '..ksSsSsSsSsSk..',
      '...kkkkkkkkkk...'
    ]
  },
  chocolate: {
    label: 'Chocolate bar',
    palette: { k: '#2b160c', c: '#7a4422', D: '#4e2a14', h: '#9a5c34', r: '#c62f3a', R: '#9b1f2a', s: '#d6d6d6', y: '#f2c94c' },
    rows: [
      '................',
      '................',
      '.........kkkkkk.',
      '.kkkkkkkksrrrrRk',
      'khhhDhhhDsrrrrRk',
      'khccDhccDsrrrrRk',
      'khccDhccDsyyyyRk',
      'kDDDDDDDDsyyyyRk',
      'khhhDhhhDsrrrrRk',
      'khccDhccDsrrrrRk',
      'khccDhccDsrrrrRk',
      'kDDDDDDDDsrrrrRk',
      '.kkkkkkkksrrrrRk',
      '.........kkkkkk.',
      '................',
      '................'
    ]
  },
  sandwich: {
    label: 'Sandwich',
    palette: { k: '#4a2a12', b: '#fbf1dc', B: '#c98f45', g: '#6cc24a', G: '#3a8f2f', t: '#e5483e', T: '#ff7b6e', y: '#f9d342', m: '#f4a6a0' },
    rows: [
      '................',
      '..kkkkkkkkkkkk..',
      '.kBBBBBBBBBBBBk.',
      '.kBbbbbbbbbbbBk.',
      '.kBbbbbbbbbbbBk.',
      'kggggggggggggggk',
      'kGGgGGgGGgGGgGGk',
      '.ktttTttttTtttk.',
      'kyyyyyyyyyyyyyyk',
      '.kmmymmmmmmymmk.',
      '.kBbbbbbbbbbbBk.',
      '.kBbbbbbbbbbbBk.',
      '.kBbbbbbbbbbbBk.',
      '.kBBBBBBBBBBBBk.',
      '..kkkkkkkkkkkk..',
      '................'
    ]
  },
  donut: {
    label: 'Donut',
    palette: { k: '#5a2a3a', p: '#f59ac0', b: '#d79a52', x: '#ffffff', X: '#5bc0eb', z: '#ffd23f' },
    rows: [
      '................',
      '.........k......',
      '....kkkkkxkk....',
      '...kppxpppzpk...',
      '..kpxppppppppk..',
      '.kpppXppppppxpk.',
      'kppppppppppppppk',
      'kppxbpkkkkpppbpk',
      'kppbbpkk.kpxpbbk',
      'kpbbbpkXkkppbbbk',
      'kbbbbbppppbbbbbk',
      '.kbbbbbbbbbbbbk.',
      '..kbbbbbbbbbbk..',
      '...kbbbbbbbbk...',
      '....kkkkkkkk....',
      '................'
    ]
  },
  cookie: {
    label: 'Cookie',
    palette: { k: '#5a3311', c: '#e0a95f', d: '#4e2a14' },
    rows: [
      '................',
      '.....kkkkkk.....',
      '...kkcccccck....',
      '..kcccccccck....',
      '..kccdccccck....',
      '.kcccdcccccck...',
      '.kccccccccccckk.',
      'kccccccccdccccck',
      'kcccccdcccccccck',
      'kcccccccccccccck',
      '.kccdccccccdcck.',
      '.kccccccdccdcck.',
      '..kcccccccccck..',
      '..kcccccccccck..',
      '...kkcccccckk...',
      '.....kkkkkk.....'
    ]
  },
  apple: {
    label: 'Apple',
    palette: { k: '#4a0f12', r: '#e2372f', R: '#b3241f', h: '#ff8f7a', s: '#6b3d1c', l: '#4caf50' },
    rows: [
      '................',
      '........slll....',
      '........s.l.....',
      '.......s........',
      '...kkkkkkkkkk...',
      '..krrrrrrrrrrk..',
      '.krrrhrrrrrrrrk.',
      'krrrhrrrrrrrrRRk',
      'krrrhrrrrrrrRRRk',
      'krrrrrrrrrrRRRRk',
      'krrrrrrrrrRRRRRk',
      'krrrrrrrrRRRRRRk',
      '.krrrrrrRRRRRRk.',
      '..krrrrRRRRRRk..',
      '...kkkkkkkkkk...',
      '................'
    ]
  },
  soda: {
    label: 'Soda can',
    palette: { k: '#3a0d0d', r: '#d93a3a', R: '#a92828', h: '#f07070', s: '#e6e6e6', S: '#b0b0b0', w: '#ffffff' },
    rows: [
      '.....kkkkkk.....',
      '....kSSSSSSk....',
      '...kssssssssk...',
      '...krhrrrrRRk...',
      '...krhrrrrRRk...',
      '...krhrrrrRwk...',
      '...krhrrrwwwk...',
      '...krhrwwwwRk...',
      '...krwwwwrRRk...',
      '...kwwwrrrRRk...',
      '...kwhrrrrRRk...',
      '...krhrrrrRRk...',
      '...krhrrrrRRk...',
      '...krhrrrrRRk...',
      '....kSSSSSSk....',
      '.....kkkkkk.....'
    ]
  },
  box: {
    label: 'Box',
    palette: { k: '#4a3015', b: '#d8a865', B: '#e8c088', d: '#b9874a', t: '#c9c2b2' },
    rows: [
      '................',
      '................',
      '..kkkkkkkkkkkk..',
      '.kBBBBBttBBBBBk.',
      '.kBBBBBttBBBBBk.',
      '.kBBBBBttBBBddk.',
      '.kddddddddddddk.',
      '.kbbbbbttbbbddk.',
      '.kbbbbbttbbbddk.',
      '.kbbbbbbbbbbddk.',
      '.kbbdddbbbbbddk.',
      '.kbbbbbbbbbbddk.',
      '.kbbddddddbbddk.',
      '.kbbbbbbbbbbddk.',
      '.kbbbbbbbbbbddk.',
      '..kkkkkkkkkkkk..'
    ]
  }
}

export const ICON_IDS = Object.keys(ICONS) as IconId[]

export interface PixelRun {
  x: number
  y: number
  width: number
  color: string
}

/** Merge horizontal runs of the same colour into single rects (fewer SVG nodes). */
export function iconRuns(id: IconId): PixelRun[] {
  const icon = ICONS[id] ?? ICONS.box
  const runs: PixelRun[] = []
  icon.rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]!
      let end = x + 1
      while (end < row.length && row[end] === ch) end++
      const color = icon.palette[ch]
      if (ch !== '.' && color) runs.push({ x, y, width: end - x, color })
      x = end
    }
  })
  return runs
}

/** Standalone SVG markup for an icon (used for previews and the app icon generator). */
export function iconToSvg(id: IconId, size = 64): string {
  const rects = iconRuns(id)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="1" fill="${r.color}"/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}" width="${size}" height="${size}" shape-rendering="crispEdges">${rects}</svg>`
}
