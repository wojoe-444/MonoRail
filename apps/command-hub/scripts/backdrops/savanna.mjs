import { rng } from './lib.mjs'
import { f1, grainFilter, lgu, mix, rg, ridgePts, smooth } from './_art-helpers.mjs'

/** Savanna: golden grassland, flat-topped acacias and a huge low sun swimming in heat haze. */

const ri = (v) => Math.round(v)

/** A flat-topped acacia: forked trunk under a layered, wind-flattened canopy. */
function acacia(rand, x, base, s, color, tall = 1, rim = null) {
  let g = ''
  const trunkH = 150 * s * tall
  const canopyY = base - trunkH - 40 * s
  // trunk and forks
  const forks = 4 + Math.floor(rand() * 2)
  let twigs = ''
  let branches = `M${ri(x)} ${ri(base)}C${ri(x - 4 * s)} ${ri(base - trunkH * 0.4)} ${ri(x + 6 * s)} ${ri(base - trunkH * 0.6)} ${ri(x)} ${ri(base - trunkH * 0.7)}`
  const tw = s > 1 ? 1.6 : 1
  g += `<path d="M${ri(x - 9 * s * tw)} ${ri(base)}Q${ri(x - 3 * s)} ${ri(base - trunkH * 0.5)} ${ri(x - 4 * s * tw)} ${ri(base - trunkH * 0.72)}L${ri(x + 5 * s * tw)} ${ri(base - trunkH * 0.72)}Q${ri(x + 4 * s)} ${ri(base - trunkH * 0.5)} ${ri(x + 10 * s * tw)} ${ri(base)}Z" fill="${color}"/>`
  for (let i = 0; i < forks; i++) {
    const t = (i / (forks - 1)) * 2 - 1
    const ex = x + t * 150 * s + (rand() - 0.5) * 30 * s
    const ey = canopyY + 2 * s + rand() * 5 * s
    const mx = x + t * 40 * s
    const my = base - trunkH * (0.75 + rand() * 0.15)
    branches += `M${ri(x)} ${ri(base - trunkH * 0.68)}Q${ri(mx)} ${ri(my)} ${ri(ex)} ${ri(ey)}`
    // a thinner fork near the crown
    const fx = mx + (ex - mx) * 0.55
    const fy = my + (ey - my) * 0.55
    twigs += `M${ri(fx)} ${ri(fy)}Q${ri(fx + (ex - x) * 0.3)} ${ri(fy - 6 * s)} ${ri(ex + (ex >= x ? 1 : -1) * (25 + rand() * 30) * s)} ${ri(ey)}`
  }
  g += `<path d="${branches}" fill="none" stroke="${color}" stroke-width="${f1(5.5 * s * tw)}" stroke-linecap="round"/>`
  g += `<path d="${twigs}" fill="none" stroke="${color}" stroke-width="${f1(3 * s * tw)}" stroke-linecap="round"/>`
  // canopy: a flat top made of many small overlapping lobes in three tiers
  const span = 210 * s
  const lobes = []
  const tops = []
  for (let tier = 0; tier < 3; tier++) {
    const w = span * [1, 0.86, 0.62][tier]
    const n = Math.max(4, Math.round([16, 13, 9][tier] * Math.min(1, 0.45 + s * 0.5)))
    for (let i = 0; i < n; i++) {
      const lx = x - w + (2 * w * (i + 0.5)) / n + (rand() - 0.5) * 14 * s
      const edge = 1 - Math.abs(lx - x) / (w + 20 * s)
      const ly = canopyY - tier * 15 * s + (1 - edge) * 5 * s + (rand() - 0.5) * 5 * s
      const rx = (20 + rand() * 18) * s * (n < 8 ? 1.6 : 1)
      const ry = (8 + rand() * 6) * s * (0.7 + edge * 0.4)
      lobes.push(`<ellipse cx="${ri(lx)}" cy="${ri(ly)}" rx="${ri(rx)}" ry="${Math.max(1, ri(ry))}"/>`)
      if (tier === 2 || (tier === 1 && Math.abs(lx - x) > w * 0.62) || (tier === 0 && Math.abs(lx - x) > w * 0.8))
        tops.push([lx, ly - ry, rx])
    }
  }
  g += `<g fill="${color}">${lobes.join('')}</g>`
  if (rim) {
    // backlit rim along the top of the crown
    const arcs = tops
      .map(([tx, ty, rx]) => `M${ri(tx - rx * 0.7)} ${ri(ty + 3 * s)}Q${ri(tx)} ${ri(ty - s)} ${ri(tx + rx * 0.7)} ${ri(ty + 3 * s)}`)
      .join('')
    g += `<path d="${arcs}" fill="none" stroke="${rim}" stroke-width="${f1(2.2 * s)}" stroke-linecap="round" opacity=".5"/>`
  }
  return g
}

/** A tuft of grass blades. */
function tuft(rand, x, y, h, n = 7) {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = (rand() - 0.5) * 1.1
    const hh = h * (0.55 + rand() * 0.45)
    const tx = x + Math.sin(a) * hh
    const ty = y - Math.cos(a) * hh
    const bx = x + (rand() - 0.5) * h * 0.18
    d += `M${ri(bx - 2)} ${ri(y)}Q${ri(bx + (tx - bx) * 0.3)} ${ri(y - hh * 0.6)} ${ri(tx)} ${ri(ty)}Q${ri(bx + (tx - bx) * 0.35 + 3)} ${ri(y - hh * 0.55)} ${ri(bx + 2)} ${ri(y)}`
  }
  return d
}

export default {
  id: 'savanna',
  draw() {
    const SUN = [1040, 640]
    let defs = lgu('sky', 0, 720, [
      [0, '#6b3a5a'],
      [0.3, '#b9535a'],
      [0.62, '#ec8a4a'],
      [0.88, '#fac46c'],
      [1, '#ffdf96'],
    ])
    defs += rg('sunGlow', SUN[0], SUN[1], 900, [
      [0, '#fff3c4', 0.95],
      [0.22, '#ffd27e', 0.6],
      [0.55, '#f7a050', 0.2],
      [1, '#f7a050', 0],
    ])
    defs += rg('sunDisc', SUN[0], SUN[1] - 60, 260, [
      [0, '#fffbe6'],
      [0.75, '#ffeab0'],
      [1, '#ffd98a'],
    ])
    defs += `<filter id="haze" x="-5%" y="-30%" width="110%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.09" numOctaves="2" seed="8"/><feDisplacementMap in="SourceGraphic" scale="14" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="1.2"/></filter>`
    defs += `<filter id="blur20" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="20"/></filter>`
    defs += `<filter id="blur4" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>`
    defs += grainFilter('grain', 0.7, 0.07, 2, '0.25 0.12 0.05')

    let body = `<rect width="1600" height="1000" fill="url(#sky)"/><rect width="1600" height="1000" fill="url(#sunGlow)"/>`
    // long thin clouds lit from below
    body += `<g filter="url(#blur4)">`
    const cl = rng(4)
    for (let i = 0; i < 9; i++) {
      const y = 120 + cl() * 330
      const x = cl() * 1600
      const w = 200 + cl() * 420
      const lit = (y - 100) / 400
      body += `<ellipse cx="${ri(x)}" cy="${ri(y)}" rx="${ri(w)}" ry="${ri(4 + cl() * 7)}" fill="${mix('#8a4566', '#ffc58a', lit)}" opacity="${f1(0.45 + cl() * 0.3)}"/>`
    }
    body += `</g>`
    // the sun, half sunk and wobbling in the heat
    body += `<circle cx="${SUN[0]}" cy="${SUN[1] - 60}" r="250" fill="url(#sunDisc)" opacity=".96"/>`
    // birds
    const br = rng(12)
    let birds = ''
    for (let i = 0; i < 7; i++) {
      const bx = 1180 + br() * 260
      const by = 250 + br() * 120
      const w = 6 + br() * 6
      birds += `M${f1(bx - w)} ${f1(by - w * 0.3)}Q${f1(bx - w * 0.4)} ${f1(by - w * 0.5)} ${f1(bx)} ${f1(by)}Q${f1(bx + w * 0.4)} ${f1(by - w * 0.5)} ${f1(bx + w)} ${f1(by - w * 0.3)}`
    }
    body += `<path d="${birds}" fill="none" stroke="#5a2a3a" stroke-width="2" stroke-linecap="round" opacity=".7"/>`

    // horizon band under heat haze: far hills, distant trees, a glowing strip
    let far = ''
    const fh = ridgePts(rng(21), { y: 690, amp: 14, step: 60, waves: 3, minLen: 300, maxLen: 1200 })
    far += `<path d="${smooth(fh)}" fill="#c87556" opacity=".75"/>`
    const r2 = rng(33)
    for (const [x, sc] of [
      [150, 0.22],
      [420, 0.16],
      [640, 0.19],
      [770, 0.12],
      [1330, 0.2],
      [1480, 0.15],
      [1560, 0.12],
    ]) {
      far += acacia(r2, x, 712, sc, '#a8594a')
    }
    far += `<path d="${smooth(ridgePts(rng(22), { y: 712, amp: 6, step: 80 }))}" fill="#d98a52"/>`
    body += `<g filter="url(#haze)">${far}</g>`
    body += `<rect y="660" width="1600" height="80" fill="#ffd690" opacity=".35" filter="url(#blur20)"/>`
    // shimmer lines
    let sh = ''
    const sr = rng(55)
    for (let i = 0; i < 26; i++) {
      const y = 700 + sr() * 30
      sh += `<rect x="${ri(sr() * 1600)}" y="${ri(y)}" width="${ri(40 + sr() * 160)}" height="1.6" fill="#fff2c0" opacity="${f1(0.3 + sr() * 0.4)}"/>`
    }
    body += `<g filter="url(#blur4)">${sh}</g>`

    // grass plains, back to front
    const bands = [
      [728, 8, ['#e8a650', '#d98f42'], 41],
      [770, 14, ['#d99440', '#c27a34'], 42],
      [840, 20, ['#c27a32', '#9c5a26'], 43],
      [930, 26, ['#8f4f22', '#5e3018'], 44],
    ]
    bands.forEach(([y, amp, [c0, c1], seed], i) => {
      const pts = ridgePts(rng(seed), { y, amp, step: 60, waves: 3, minLen: 400, maxLen: 1600 })
      defs += lgu(`g${i}`, y - amp, y + 120, [
        [0, c0],
        [1, c1],
      ])
      body += `<path d="${smooth(pts)}" fill="url(#g${i})"/>`
      // sun-lit grass tips along the crest
      body += `<path d="${smooth(pts, false)}" fill="none" stroke="#ffd58a" stroke-width="${2 + i}" opacity="${f1(0.5 - i * 0.08)}" filter="url(#blur4)"/>`
      // tufts along the crest, bigger in front
      const tr = rng(seed * 3)
      let d = ''
      const n = [0, 80, 60, 40][i]
      for (let k = 0; k < n; k++) {
        const x = tr() * 1680 - 40
        const j = Math.max(0, Math.min(pts.length - 2, Math.floor((x + 80) / 60)))
        const t = (x - pts[j][0]) / 60
        const yy = pts[j][1] * (1 - t) + pts[j + 1][1] * t + 4 + i * 2
        d += tuft(tr, x, yy, [0, 10, 20, 40][i], [0, 3, 4, 6][i])
      }
      body += `<path d="${d}" fill="${mix(c0, '#3a1e12', 0.15 + i * 0.1)}"/>`
      if (i === 1) {
        // mid-ground trees stand on the second band
        const r3 = rng(77)
        body += acacia(r3, 1370, pts[24][1] + 10, 0.66, '#55292a', 1.15, '#ffc27a')
        body += acacia(r3, 820, pts[15][1] + 10, 0.32, '#8a4434')
      }
    })

    // a big acacia anchoring the left edge, darker under the drawer
    body += acacia(rng(8), 190, 1010, 1.55, '#2a1414', 2.1, '#ffb070')
    // foreground grass silhouettes
    const fr = rng(909)
    let fg = ''
    for (let k = 0; k < 38; k++) fg += tuft(fr, fr() * 1680 - 40, 1004, 70 + fr() * 70, 6)
    body += `<path d="${fg}" fill="#3c1e14"/>`
    // vignette and grain
    defs += `<radialGradient id="vig" cx=".66" cy=".55" r=".85"><stop offset=".55" stop-color="#3a1424" stop-opacity="0"/><stop offset="1" stop-color="#3a1424" stop-opacity=".45"/></radialGradient>`
    body += `<rect width="1600" height="1000" fill="url(#vig)"/><rect width="1600" height="1000" filter="url(#grain)"/>`
    return `<defs>${defs}</defs>${body}`
  },
}
