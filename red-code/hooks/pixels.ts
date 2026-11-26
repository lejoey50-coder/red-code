// A tiny raster: pixels in, SVG runs out. No DOM, no Node, no Claude API.

export type Grid = { w: number; h: number; at: string[] }

export function grid(w: number, h: number): Grid {
  return { w, h, at: new Array<string>(w * h).fill('') }
}

export function set(g: Grid, x: number, y: number, c: string): void {
  if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.at[y * g.w + x] = c
}

export function get(g: Grid, x: number, y: number): string {
  return x >= 0 && y >= 0 && x < g.w && y < g.h ? (g.at[y * g.w + x] ?? '') : ''
}

export function rect(g: Grid, x: number, y: number, w: number, h: number, c: string): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(g, i, j, c)
}

/** A 32 x 16 floor diamond, two across and one up, centred on (cx, cy). Neighbours tile exactly. */
export function diamond(g: Grid, cx: number, cy: number, fill: string, edge?: string, inset = 0): void {
  for (let r = inset; r < 16 - inset; r++) {
    const half = 2 * Math.min(r, 15 - r) + 1 - inset * 2
    if (half <= 0) continue
    for (let x = cx - half; x < cx + half; x++) {
      const rim = edge !== undefined && (x < cx - half + 2 || x >= cx + half - 2) && r >= 8
      set(g, x, cy - 8 + r, rim ? edge : fill)
    }
  }
}

export function disc(g: Grid, cx: number, cy: number, r: number, c: string, inner = -1): void {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y
      if (d <= r * r + r * 0.6 && d > inner * inner + (inner > 0 ? inner * 0.6 : -2)) set(g, cx + x, cy + y, c)
    }
}

export function line(g: Grid, x0: number, y0: number, x1: number, y1: number, c: string, thick = 1): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let k = 0; k <= n; k++) {
    const x = Math.round(x0 + ((x1 - x0) * k) / n)
    const y = Math.floor(y0 + ((y1 - y0) * k) / n)
    for (let t = 0; t < thick; t++) set(g, x, y + t, c)
  }
}

export function stamp(g: Grid, rows: readonly string[], x: number, y: number): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = row[i]
      if (c !== undefined && c !== '.' && c !== ' ') set(g, x + i, y + j, c)
    }
  })
}

export function mirror(g: Grid): Grid {
  const m = grid(g.w, g.h)
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) set(m, g.w - 1 - x, y, get(g, x, y))
  return m
}

/** A filled shape, its corners in order. */
export function poly(g: Grid, pts: ReadonlyArray<readonly [number, number]>, c: string): void {
  const ys = pts.map(p => p[1])
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs: number[] = []
    pts.forEach((p, k) => {
      const q = pts[(k + 1) % pts.length] ?? p
      const m = y + 0.5
      if ((p[1] <= m && q[1] > m) || (q[1] <= m && p[1] > m)) xs.push(p[0] + ((m - p[1]) / (q[1] - p[1])) * (q[0] - p[0]))
    })
    xs.sort((m, n) => m - n)
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k] ?? 0); x < Math.round(xs[k + 1] ?? 0); x++) set(g, x, y, c)
  }
}

/** A cell something later covers: it needs no colour, and a run may pass through it. */
export const HIDDEN = '*'

/**
 * One path for each colour, the commonest first, each a list of 1px-high runs. A run passes under any
 * colour drawn after it, so it needs no break there. A column one pixel wide is one stroke down.
 * `ink` maps a cell's key to a colour.
 */
export function paths(g: Grid, ink: (key: string) => string | undefined = k => k): string {
  const cells = g.at.map(key => (key === '' || key === HIDDEN ? key : (ink(key) ?? '')))
  const count = new Map<string, number>()
  for (const c of cells) if (c !== '' && c !== HIDDEN) count.set(c, (count.get(c) ?? 0) + 1)
  const order = [...count].sort((a, b) => b[1] - a[1]).map(([c]) => c)
  const rank = new Map(order.map((c, k) => [c, k]))
  const at = cells.map(c => (c === HIDDEN ? Infinity : c === '' ? -1 : (rank.get(c) ?? -1)))
  let out = ''
  /** A step, written short: no leading zero. */
  const num = (v: number) => String(v).replace(/^(-?)0\./, '$1.')
  const used = new Uint8Array(cells.length)
  order.forEach((c, r) => {
    let d = ''
    let px = 0
    let py = 0
    const go = (x: number, y: number) => {
      d += d === '' ? `M${num(x)} ${num(y)}` : `m${num(x - px)}${y - py < 0 ? '' : ' '}${num(y - py)}`
    }
    // A column one pixel wide and three or more tall is one stroke down, not a run for every row.
    // So is each column of a block two wide and four or more tall: once the first is taken, the second stands alone.
    const mine = (x: number, y: number) => x >= 0 && x < g.w && at[y * g.w + x] === r && used[y * g.w + x] === 0
    const width = (x: number, y: number) => (mine(x, y) ? 1 + (mine(x - 1, y) ? 1 + (mine(x - 2, y) ? 1 : 0) : 0) + (mine(x + 1, y) ? 1 + (mine(x + 2, y) ? 1 : 0) : 0) : 9)
    used.fill(0)
    for (let x = 0; x < g.w; x++) {
      for (let y = 0; y < g.h; y++) {
        const wide = width(x, y)
        if (wide > 2) continue
        let n = 1
        while (y + n < g.h && width(x, y + n) === wide) n += 1
        if (n > wide + 1) {
          go(x + 0.5, y)
          d += `v${n}`
          px = x + 0.5
          py = y + n
          for (let k = 0; k < n; k++) used[(y + k) * g.w + x] = 1
        }
        y += n
      }
    }
    for (let y = 0; y < g.h; y++) {
      let x = 0
      while (x < g.w) {
        if (at[y * g.w + x] !== r || used[y * g.w + x] === 1) {
          x += 1
          continue
        }
        let end = x + 1
        for (let k = x + 1; k < g.w; k++) {
          const v = at[y * g.w + k] ?? -1
          if (v < r) break
          if (v === r && used[y * g.w + k] === 0) end = k + 1
        }
        go(x, y + 0.5)
        d += `h${end - x}`
        px = end
        py = y + 0.5
        x = end
      }
    }
    out += `<path stroke="${c}" d="${d}"/>`
  })
  return out
}