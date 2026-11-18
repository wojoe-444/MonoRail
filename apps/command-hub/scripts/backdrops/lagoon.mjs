import { glow, lg, rng } from './lib.mjs'
import { bigCloud, blur, cloud, cloudFilter, f, fbm, grain, smooth, taper } from './_day-helpers.mjs'

const pt = (p) => `${f(p[0])} ${f(p[1])}`

/** One frond: a drooping spine with a row of hanging, pointed leaflets on each side. */
function frond(rand, tx, ty, a, size, color) {
  const len = size * (0.4 + rand() * 0.16)
  const droop = size * (0.16 + rand() * 0.12)
  const spine = []
  for (let i = 0; i <= 6; i++) {
    const t = i / 6
    spine.push([tx + Math.cos(a) * len * t, ty + Math.sin(a) * len * t + droop * t * t])
  }
  const sides = [1, -1].map((side) => {
    const out = []
    for (let i = 0; i < spine.length - 1; i++) {
      const [px, py] = spine[i]
      const [x, y] = spine[i + 1]
      const dx = x - px
      const dy = y - py
      const l = Math.hypot(dx, dy)
      const ux = dx / l
      const uy = dy / l
      const nx = -uy * side
      const ny = ux * side
      for (let s = 0; s < 2; s++) {
        const q = s / 2
        const t = (i + q + 0.25) / (spine.length - 1)
        const sx = px + dx * q
        const sy = py + dy * q
        const lower = ny > -0.2 ? 1 : 0.7
        const ll = size * (0.2 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.92)) + 0.015) * lower
        let vx = nx * 0.65 + ux * 0.5
        let vy = ny * 0.65 + uy * 0.5 + 0.7
        const vl = Math.hypot(vx, vy)
        vx /= vl
        vy /= vl
        out.push([sx, sy], [sx + dx * 0.25 + vx * ll, sy + dy * 0.25 + vy * ll])
      }
    }
    return out
  })
  const end = spine[spine.length - 1]
  return `<path d="M${pt(spine[0])}L${sides[0].map(pt).join(' ')} ${pt(end)} ${sides[1].reverse().map(pt).join(' ')}Z"/><path d="${smooth(spine)}" fill="none" stroke="${color}" stroke-width="${f(size * 0.009)}"/>`
}

/** A palm: curved trunk from the ground to a crown of drooping fronds. */
function palm(rand, bx, by, tx, ty, size, color, rings = true, back = color) {
  const bend = (tx - bx) * 0.35
  const at = (t) => [bx + (tx - bx) * t + Math.sin(t * Math.PI) * bend, by + (ty - by) * t]
  const trunk = []
  for (let i = 0; i <= 10; i++) trunk.push([...at(i / 10), size * (0.06 - 0.03 * (i / 10))])
  let ring = ''
  if (rings) {
    for (let i = 1; i < 30; i++) {
      const [x, y] = at(i / 30)
      const w = size * (0.06 - 0.03 * (i / 30)) * 0.5
      ring += `M${f(x - w)} ${f(y)}q${f(w)} ${f(size * 0.01)} ${f(w * 2)} 0`
    }
  }
  let fronds = ''
  const n = rings ? 11 : 6
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + ((k / (n - 1)) * 2 - 1) * Math.PI * 0.95 + (rand() - 0.5) * 0.3
    const fr = frond(rand, tx, ty, a, size * (Math.abs(Math.cos(a)) * 0.35 + 0.75), k % 2 ? back : color)
    fronds = k % 2 ? `<g fill="${back}">${fr}</g>` + fronds : fronds + fr
  }
  const nuts = [0, 1, 2, 3]
    .map(
      (i) =>
        `<circle cx="${f(tx + (i - 1.5) * size * 0.02)}" cy="${f(ty + size * 0.028 + (i % 2) * size * 0.012)}" r="${f(size * 0.018)}"/>`,
    )
    .join('')
  return `<g fill="${color}"><path d="${taper(trunk)}"/>${nuts}${fronds}</g>${ring ? `<path d="${ring}" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="${f(size * 0.004)}"/>` : ''}`
}

/** Lagoon: turquoise shallows fading to deep blue, cumulus over a far island, palms framing either side. */
export default {
  id: 'lagoon',
  draw() {
    const rand = rng(31)
    const H = 540
    const clouds = [
      [280, 370, 440, 220, 1],
      [1240, 360, 560, 250, 1],
      [760, 420, 300, 70, 2],
      [1520, 440, 260, 60, 2],
      [530, 480, 210, 38, 3],
      [1010, 488, 260, 40, 3],
      [80, 470, 220, 50, 2],
    ]
      .map(([x, y, w, h, d], i) =>
        (d === 1 ? bigCloud : cloud)(
          rand,
          x,
          y,
          w,
          h,
          '#ffffff',
          d === 1 ? '#b9cfe2' : d === 2 ? '#d0e0ea' : '#dde9ef',
          d === 1 ? 'cb2' : `cb${d}`,
          `lc${i}`,
          -1,
        ),
      )
      .join('')

    // Sea: shallow and deep patches over the gradient, then glints that shrink with distance.
    let patches = ''
    for (let i = 0; i < 18; i++) {
      const t = rand()
      const y = H + 110 + t * 280
      patches += `<ellipse cx="${f(rand() * 1600)}" cy="${f(y)}" rx="${f(90 + t * 260 + rand() * 120)}" ry="${f(6 + t * 36)}" fill="${rand() < 0.45 ? '#1c86ad' : '#86ecd9'}" opacity="${f(0.25 + rand() * 0.3)}"/>`
    }
    let glint = ''
    for (let i = 0; i < 110; i++) {
      const t = rand() ** 1.8
      const y = H + 4 + t * 300
      const w = 4 + t * 34 * (0.5 + rand())
      glint += `M${f(rand() * 1600)} ${f(y)}h${f(w)}`
    }
    const shore = fbm(rand)
    const sand = []
    for (let x = -60; x <= 1660; x += 60) sand.push([x, 905 + shore(x / 260) * 22 + (x - 800) ** 2 / 40000])
    const wet = sand.map(([x, y]) => [x, y + 10 + shore(x / 90 + 5) * 6])

    const island = `<path d="M940 ${H} C1000 ${H - 16} 1050 ${H - 34} 1110 ${H - 38} C1170 ${H - 42} 1215 ${H - 28} 1255 ${H - 22} C1305 ${H - 16} 1340 ${H - 6} 1400 ${H}Z" fill="#79a7aa"/><path d="M880 ${H} Q930 ${H - 7} 990 ${H - 6} L1430 ${H - 4} Q1460 ${H - 2} 1490 ${H}Z" fill="#94bfba"/>`
    let tiny = ''
    for (const [x, h] of [
      [1080, 40],
      [1112, 50],
      [1150, 44],
      [1230, 34],
      [1290, 28],
    ])
      tiny += palm(rand, x, H - 28, x + 6, H - 28 - h, h * 1.4, '#6c9ca3', false)

    const gr = grain('gr', 0.05)
    return `<defs>${lg('sky', [
      [0, '#3b8bcd'],
      [0.5, '#8fc8ea'],
      [1, '#eaf5f1'],
    ])}${lg('sea', [
      [0, '#2a6da6'],
      [0.12, '#1f7aae'],
      [0.36, '#1fa0bf'],
      [0.62, '#38c8c5'],
      [0.84, '#86e6d3'],
      [1, '#c6f0da'],
    ])}${lg('sand', [
      [0, '#f2e4c2'],
      [1, '#e0c597'],
    ])}${lg('haze', [
      [0, '#eef7f3', 0],
      [0.85, '#eef7f3', 0.75],
      [1, '#eef7f3', 0],
    ])}${glow('sun', 0.6, 0.12, 0.55, '#fffbe6', 0.8)}
      <radialGradient id="vg" cx=".5" cy=".55" r=".8"><stop offset=".6" stop-color="#0d3a55" stop-opacity="0"/><stop offset="1" stop-color="#0d3a55" stop-opacity=".25"/></radialGradient>
      ${cloudFilter('cb1', 80, 0.009, 2)}${cloudFilter('cb2', 50, 0.014, 2.5, 7)}${cloudFilter('cb3', 30, 0.02, 2.5, 9)}${cloudFilter('surf', 30, 0.02, 2.5, 9)}${blur('soft', 12)}${blur('b2', 1.5)}${gr.def}</defs>
      <rect width="1600" height="${H}" fill="url(#sky)"/><rect width="1600" height="1000" fill="url(#sun)"/>${clouds}
      <rect y="${H - 46}" width="1600" height="60" fill="url(#haze)"/>${island}${tiny}
      <rect y="${H}" width="1600" height="460" fill="url(#sea)"/>
      <g filter="url(#soft)">${patches}</g>
      <path d="${glint}" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".4" filter="url(#b2)"/>
      <rect y="${H}" width="1600" height="2" fill="#fff" opacity=".55"/>
      <path d="${smooth(sand)}L1660 1000L-60 1000Z" fill="#d6e6c8"/>
      <path d="${smooth(sand)}" fill="none" stroke="#fff" stroke-width="12" opacity=".75" filter="url(#surf)"/>
      <path d="${smooth(wet)}L1660 1000L-60 1000Z" fill="url(#sand)"/>
      ${palm(rand, -30, 1060, 120, 380, 470, '#1f4642', true, '#2f5e58')}${palm(rand, 50, 1060, 330, 250, 620, '#163936', true, '#2a5550')}
      ${palm(rand, 1610, 1070, 1380, 290, 560, '#163936', true, '#2a5550')}
      <rect width="1600" height="1000" fill="url(#vg)"/>${gr.rect}`
  },
}
