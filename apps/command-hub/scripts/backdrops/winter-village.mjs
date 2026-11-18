import { rng } from './lib.mjs'
import { f1, grainFilter, lgu, mix, rg, ridgePts, smooth } from './_art-helpers.mjs'

/** Winter Village: snowy rolling hills, little cabins with lit windows and chimney smoke, snowy pines. */

const ri = (v) => Math.round(v)

/** A conifer with snow resting on each tier. */
function snowPine(rand, x, base, h, color, snow = '#f4f8fc', snowAmt = 1) {
  const tiers = 5
  const w = h * 0.34
  let s = `<rect x="${ri(x - h * 0.025)}" y="${ri(base - h * 0.12)}" width="${ri(h * 0.05)}" height="${ri(h * 0.12)}" fill="${mix(color, '#000000', 0.25)}"/>`
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers
    const top = base - h + h * 0.86 * t0 * 0.92
    const bot = base - h * 0.1 - (h * 0.86 * (tiers - 1 - i)) / tiers / 1.25
    const ww = w * (0.35 + 0.65 * ((i + 1) / tiers))
    const sag = h * 0.03
    s += `<path d="M${ri(x)} ${ri(top)}L${ri(x + ww)} ${ri(bot)}Q${ri(x)} ${ri(bot - sag)} ${ri(x - ww)} ${ri(bot)}Z" fill="${color}"/>`
    if (snowAmt > 0) {
      // snow on the upper part of the tier with a scalloped lower edge
      const k = 0.42 + rand() * 0.12
      const sy = top + (bot - top) * k
      const sw = ww * k
      s += `<path d="M${ri(x)} ${ri(top)}L${ri(x + sw * 1.05)} ${ri(sy)}Q${ri(x + sw * 0.55)} ${ri(sy + h * 0.035)} ${ri(x + sw * 0.15)} ${ri(sy - h * 0.005)}Q${ri(x - sw * 0.3)} ${ri(sy + h * 0.03)} ${ri(x - sw * 1.05)} ${ri(sy)}Z" fill="${snow}" opacity="${snowAmt}"/>`
    }
  }
  return s
}

/** A small cabin: log walls, a deep snowy roof, warm windows, a chimney. Returns [svg, chimney top]. */
function cabin(x, base, s, wall, flip = false) {
  const w = 120 * s
  const h = 62 * s
  const roofH = 58 * s
  const eave = 16 * s
  const l = x - w / 2
  let g = ''
  // shadow on snow
  g += `<ellipse cx="${f1(x + (flip ? -1 : 1) * 14 * s)}" cy="${f1(base + 3 * s)}" rx="${f1(w * 0.72)}" ry="${f1(9 * s)}" fill="#8ea3c0" opacity=".45"/>`
  g += `<rect x="${f1(l)}" y="${f1(base - h)}" width="${f1(w)}" height="${f1(h)}" fill="${wall}"/>`
  // log lines
  for (let i = 1; i < 5; i++)
    g += `<rect x="${f1(l)}" y="${f1(base - h + (h * i) / 5)}" width="${f1(w)}" height="${f1(1.4 * s)}" fill="#000" opacity=".16"/>`
  // gable end shading on one side
  g += `<rect x="${f1(flip ? l : x + w * 0.18)}" y="${f1(base - h)}" width="${f1(w * 0.32)}" height="${f1(h)}" fill="#000" opacity=".14"/>`
  // windows with glow
  const win = (wx, wy, ww, wh) =>
    `<circle cx="${f1(wx + ww / 2)}" cy="${f1(wy + wh / 2)}" r="${f1(ww * 1.6)}" fill="url(#winGlow)"/><rect x="${f1(wx)}" y="${f1(wy)}" width="${f1(ww)}" height="${f1(wh)}" rx="${f1(1.5 * s)}" fill="#ffd27a"/><rect x="${f1(wx + ww / 2 - 0.8 * s)}" y="${f1(wy)}" width="${f1(1.6 * s)}" height="${f1(wh)}" fill="${wall}" opacity=".8"/><rect x="${f1(wx)}" y="${f1(wy + wh / 2 - 0.8 * s)}" width="${f1(ww)}" height="${f1(1.6 * s)}" fill="${wall}" opacity=".8"/>`
  g += win(l + w * 0.14, base - h * 0.72, w * 0.17, h * 0.36)
  g += win(l + w * 0.66, base - h * 0.72, w * 0.17, h * 0.36)
  // door
  g += `<rect x="${f1(x - w * 0.08)}" y="${f1(base - h * 0.62)}" width="${f1(w * 0.16)}" height="${f1(h * 0.62)}" fill="${mix(wall, '#000000', 0.35)}"/>`
  // chimney
  const cx = x + (flip ? -1 : 1) * w * 0.26
  g += `<rect x="${f1(cx - 7 * s)}" y="${f1(base - h - roofH * 0.95)}" width="${f1(14 * s)}" height="${f1(roofH * 0.8)}" fill="${mix(wall, '#3a2a2a', 0.5)}"/><rect x="${f1(cx - 9 * s)}" y="${f1(base - h - roofH * 0.95 - 5 * s)}" width="${f1(18 * s)}" height="${f1(6 * s)}" rx="${f1(3 * s)}" fill="#f6f9fd"/>`
  // roof: dark underside then a thick, rounded snow layer
  g += `<path d="M${f1(l - eave)} ${f1(base - h + 4 * s)}L${f1(x)} ${f1(base - h - roofH)}L${f1(l + w + eave)} ${f1(base - h + 4 * s)}Z" fill="${mix(wall, '#000000', 0.45)}"/>`
  g += `<path d="M${f1(l - eave - 4 * s)} ${f1(base - h + 1 * s)}L${f1(x)} ${f1(base - h - roofH - 8 * s)}L${f1(l + w + eave + 4 * s)} ${f1(base - h + 1 * s)}Q${f1(l + w + eave)} ${f1(base - h + 9 * s)} ${f1(l + w + eave - 10 * s)} ${f1(base - h + 3 * s)}Q${f1(x + w * 0.2)} ${f1(base - h + 8 * s)} ${f1(x)} ${f1(base - h + 2 * s)}Q${f1(x - w * 0.3)} ${f1(base - h + 9 * s)} ${f1(l - eave)} ${f1(base - h + 5 * s)}Z" fill="#f8fbff"/>`
  g += `<path d="M${f1(x)} ${f1(base - h - roofH - 8 * s)}L${f1(l + w + eave + 4 * s)} ${f1(base - h + 1 * s)}L${f1(x + w * 0.1)} ${f1(base - h + 2 * s)}Z" fill="#c9d6e8" opacity=".55"/>`
  return [g, [cx, base - h - roofH * 0.95 - 6 * s]]
}

/** A soft rising curl of smoke. */
function smoke(rand, x, y, s) {
  let g = ''
  let cx = x
  let cy = y
  for (let i = 0; i < 9; i++) {
    const r = (11 + i * 4.6) * s
    cx += (Math.sin(i * 0.9 + rand()) * 9 + 6) * s
    cy -= (i ? 13 + i * 3 : 4) * s
    g += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="#b4c0d3" opacity="${f1(0.85 - i * 0.085)}"/>`
  }
  return g
}

export default {
  id: 'winter-village',
  draw() {
    let defs = lgu('sky', 0, 760, [
      [0, '#7d9cc2'],
      [0.4, '#b4c6de'],
      [0.72, '#e8dfe6'],
      [1, '#f9dccb'],
    ])
    defs += rg('sun', 470, 420, 520, [
      [0, '#fff8ea', 0.95],
      [0.18, '#fff1dc', 0.6],
      [1, '#fde9d6', 0],
    ])
    defs += `<radialGradient id="winGlow"><stop offset="0" stop-color="#ffc766" stop-opacity=".55"/><stop offset="1" stop-color="#ffc766" stop-opacity="0"/></radialGradient>`
    defs += `<filter id="blur8" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8"/></filter>`
    defs += `<filter id="blur5" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6"/></filter>`
    defs += `<filter id="blur3" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>`
    defs += `<filter id="blur30" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>`
    defs += grainFilter('grain', 0.8, 0.05, 2, '0.3 0.35 0.5')

    let body = `<rect width="1600" height="1000" fill="url(#sky)"/><rect width="1600" height="1000" fill="url(#sun)"/><circle cx="470" cy="420" r="44" fill="#fffaf0" opacity=".9"/>`
    // soft cloud banks
    body += `<g filter="url(#blur30)"><ellipse cx="1200" cy="200" rx="420" ry="60" fill="#f1f3f7" opacity=".6"/><ellipse cx="300" cy="150" rx="380" ry="50" fill="#e9eef5" opacity=".5"/><ellipse cx="900" cy="320" rx="500" ry="40" fill="#fbf1ea" opacity=".55"/></g>`

    // distant mountains with snow
    const mt = [
      [-80, 560],
      [80, 470],
      [210, 520],
      [360, 430],
      [520, 505],
      [700, 455],
      [860, 520],
      [1010, 440],
      [1170, 400],
      [1320, 480],
      [1460, 430],
      [1680, 520],
    ]
    defs += lgu('mtn', 400, 600, [
      [0, '#b6c3da'],
      [1, '#d4dbe8'],
    ])
    body += `<path d="M${mt.map(([x, y]) => `${x} ${y}`).join('L')}V1000H-80Z" fill="url(#mtn)"/>`
    // snow faces on the lit (left) side of each peak
    for (let i = 1; i < mt.length - 1; i++) {
      const [x, y] = mt[i]
      if (y > mt[i - 1][1] || y > mt[i + 1][1]) continue
      const [px, py] = mt[i - 1]
      const [nx, ny] = mt[i + 1]
      const k = 0.5
      body += `<path d="M${x} ${y}L${f1(px + (x - px) * (1 - k))} ${f1(py + (y - py) * (1 - k))}L${f1(x - 6)} ${f1(y + (py - y) * k * 0.7)}L${f1(x + (nx - x) * 0.2)} ${f1(y + (ny - y) * 0.3)}Z" fill="#eef2f8" opacity=".85"/>`
    }
    body += `<rect y="380" width="1600" height="260" fill="url(#haze0)"/>`
    defs += lgu('haze0', 380, 640, [
      [0, '#f3ece8', 0],
      [1, '#f3ece8', 0.7],
    ])

    const fr0 = ridgePts(rng(9), { y: 560, amp: 26, step: 50, waves: 4, minLen: 200, maxLen: 900 })
    defs += lgu('ridge', 520, 620, [
      [0, '#9fb0c9'],
      [1, '#c5d0e1'],
    ])
    body += `<path d="${smooth(fr0)}" fill="url(#ridge)"/>`
    {
      const r9 = rng(19)
      let t = ''
      for (const [x, y] of fr0)
        for (let k = 0; k < 4; k++) {
          const xx = x + r9() * 50
          const hh = 12 + r9() * 16
          t += `<path d="M${ri(xx)} ${ri(y - hh + 10)}l${ri(hh * 0.3)} ${ri(hh)}h${ri(-hh * 0.6)}Z"/>`
        }
      body += `<g fill="#91a3be">${t}</g>`
    }
    // rolling snow hills, back to front: [y, amp, top colour, bottom colour, seed]
    const hills = [
      [585, 22, '#eef2f8', '#c6d2e5', 11],
      [660, 30, '#f7f5f6', '#c0cee3', 12],
      [760, 38, '#fdfbfa', '#bccbe1', 13],
      [880, 34, '#ffffff', '#c8d6ea', 14],
    ]
    const hillPts = []
    hills.forEach(([y, amp, c0, c1, seed], i) => {
      const pts = ridgePts(rng(seed), { y, amp, step: 60, waves: 3, minLen: 500, maxLen: 1600 })
      hillPts.push(pts)
      defs += lgu(`h${i}`, y - amp * 1.5, y + 160, [
        [0, c0],
        [1, c1],
      ])
      // a soft blue shadow just above the crest falls on the hill behind
      body += `<path d="${smooth(
        pts.map(([x, yy]) => [x, yy - 4]),
        false,
      )}" fill="none" stroke="#9fb3cf" stroke-width="10" opacity=".35" filter="url(#blur8)"/>`
      body += `<path d="${smooth(pts)}" fill="url(#h${i})"/>`
      body += `<path d="${smooth(pts, false)}" fill="none" stroke="#ffffff" stroke-width="2" opacity=".9"/>`
      // pines on the hill, smaller and paler further away
      const scale = [0.28, 0.45, 0.7, 1][i]
      const col = mix('#2c4650', '#c3cfdf', [0.62, 0.42, 0.18, 0][i])
      const count = [16, 14, 10, 0][i]
      const r2 = rng(seed * 7)
      const yAt = (x) => {
        const j = Math.max(0, Math.min(pts.length - 2, Math.floor((x + 80) / 60)))
        const t = (x - pts[j][0]) / 60
        return pts[j][1] * (1 - t) + pts[j + 1][1] * t
      }
      // trees grow in clumps
      const clumps = [
        [60, 420],
        [880, 1180],
        [1350, 1580],
      ].slice(0, i === 2 ? 3 : 2)
      let trees = []
      for (let k = 0; k < count; k++) {
        const [a, b] = clumps[k % clumps.length]
        const x = a + r2() * (b - a) + (i === 1 ? 240 : 0)
        trees.push([x, yAt(x) + 6 + r2() * 14, (90 + r2() * 90) * scale])
      }
      trees.sort((p, q) => p[1] - q[1])
      for (const [x, b, h] of trees)
        body +=
          `<ellipse cx="${f1(x + h * 0.32)}" cy="${f1(b)}" rx="${f1(h * 0.38)}" ry="${f1(h * 0.045)}" fill="#93a8c8" opacity=".4"/>` +
          snowPine(r2, x, b, h, col, '#f4f8fc', i < 2 ? 0.8 : 1)
      // cabins sit on the third and fourth hills
      if (i === 1) {
        const [g] = cabin(1240, yAt(1240) + 22, 0.42, '#7b4636')
        body += g
        body += `<g filter="url(#blur5)">${smoke(rng(3), 1240 + 0.42 * 31, yAt(1240) + 22 - 0.42 * 124, 0.42)}</g>`
      }
      if (i === 2) {
        const spots = [
          [300, 0.78, '#8a4a36', false],
          [560, 0.6, '#6f3f35', true],
          [1120, 0.7, '#7d3e33', false],
        ]
        let smokes = ''
        let houses = ''
        for (const [x, s, wall, flip] of spots) {
          const [g, [cx, cy]] = cabin(x, yAt(x) + 26 * s, s, wall, flip)
          houses += g
          smokes += smoke(rng(x), cx, cy, s)
        }
        body += `<g filter="url(#blur5)">${smokes}</g>${houses}`
      }
    })

    // foreground pines framing the edges
    const fr = rng(808)
    let fg = ''
    const edgeTrees = [
      [-10, 1040, 420],
      [90, 1030, 340],
      [170, 1050, 260],
      [1450, 1040, 380],
      [1560, 1030, 450],
      [1360, 1050, 240],
    ]
    for (const [x, b, h] of edgeTrees) fg += snowPine(fr, x, b, h, '#26404a', '#f2f6fb', 1)
    // a footpath winding to the village
    body += `<path d="M700 1010 C690 950 800 925 745 885 S625 835 598 803 L606 801 C640 832 770 880 790 925 S780 980 830 1010Z" fill="#a9bbd6" opacity=".55" filter="url(#blur3)"/>`
    body += fg

    // falling snow
    let flakes = ''
    const sr = rng(77)
    for (let i = 0; i < 150; i++) {
      const r = 0.8 + sr() ** 3 * 3.4
      flakes += `<circle cx="${f1(sr() * 1600)}" cy="${f1(sr() * 1000)}" r="${f1(r)}" fill="#fff" opacity="${f1(0.45 + sr() * 0.5)}"/>`
    }
    body += flakes
    body += `<rect width="1600" height="1000" filter="url(#grain)"/>`
    return `<defs>${defs}</defs>${body}`
  },
}
