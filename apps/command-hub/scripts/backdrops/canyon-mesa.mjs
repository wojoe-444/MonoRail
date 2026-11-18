import { stars, rng } from './lib.mjs'
import { f1, grainFilter, lgu, mix, rg, ridgePts, smooth } from './_art-helpers.mjs'

/** Canyon Mesa: red-rock mesas and buttes in receding layers under a warm sky; moonlit at night. */

const DAY = {
  sky: [
    [0, '#5d6c9e'],
    [0.38, '#b7909f'],
    [0.62, '#eeb08a'],
    [0.8, '#f8d4a4'],
  ],
  sun: '#fff1d0',
  haze: '#f6c9a0',
  layers: ['#d9a597', '#cf8466', '#bc5d3e', '#9a4129', '#6e2a1c'],
  rim: '#ffd9a8',
  shadow: '#4a1c22',
  floor: ['#b25c3c', '#6e2c1d'],
  scrub: '#4a3a22',
}

const NIGHT = {
  sky: [
    [0, '#070c22'],
    [0.45, '#14204a'],
    [0.75, '#2c3c6e'],
    [0.86, '#3c4c7c'],
  ],
  sun: '#e8eeff',
  haze: '#4c5d92',
  layers: ['#4a5585', '#3f4673', '#353a62', '#2a2c4f', '#1b1b36'],
  rim: '#b8c6f0',
  shadow: '#0a0a1c',
  floor: ['#2e2d50', '#18182e'],
  scrub: '#0e1020',
}

/** A mesa or butte: talus skirts, near-vertical cliffs, a flat caprock. */
function mesa(rand, cx, w, top, base) {
  const h = base - top
  const tal = w * (0.14 + rand() * 0.14) + h * 0.12
  const shoulder = base - h * (0.2 + rand() * 0.1)
  const left = []
  const right = []
  // talus, base to shoulder
  for (let i = 0; i <= 4; i++) {
    const t = i / 4
    left.push([cx - w / 2 - tal * (1 - t) ** 1.15, base - (base - shoulder) * t])
    right.unshift([cx + w / 2 + tal * (1 - t) ** 1.15 + rand() * 4, base - (base - shoulder) * t])
  }
  // cliff, shoulder to cap, with ledges
  const steps = 3 + Math.floor(rand() * 3)
  for (let i = 1; i <= steps; i++) {
    const y = shoulder - (shoulder - top - 6) * (i / steps)
    const jl = (rand() - 0.3) * w * 0.05
    const jr = (rand() - 0.3) * w * 0.05
    left.push([cx - w / 2 + jl + w * 0.02 * i, y + 4], [cx - w / 2 + jl + w * 0.02 * i - 3, y])
    right.unshift([cx + w / 2 - jr - w * 0.02 * i + 3, y], [cx + w / 2 - jr - w * 0.02 * i, y + 4])
  }
  // caprock overhang and flat top
  const lx = left[left.length - 1][0]
  const rx = right[0][0]
  const capL = [
    [lx - 4, top + 6],
    [lx - 3, top],
  ]
  const topPts = []
  const n = 4 + Math.floor(rand() * 4)
  for (let i = 1; i < n; i++) topPts.push([lx + ((rx - lx) * i) / n, top - rand() * 3])
  const capR = [
    [rx + 3, top],
    [rx + 4, top + 6],
  ]
  const all = [...left, ...capL, ...topPts, ...capR, ...right]
  return { pts: all, top, base, lx: lx - 3, rx: rx + 3 }
}

const poly = (pts) => pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ')

/** Horizontal strata as a hard-stop gradient between top and base. */
function strata(id, rand, top, base, color, px = [10, 34]) {
  const stops = []
  let o = 0
  let k = 0
  const h = base - top
  while (o < 1) {
    const band = (px[0] + rand() * (px[1] - px[0])) / h
    const r = rand()
    const shade =
      r < 0.12
        ? mix(color, '#fff4e6', 0.12 + rand() * 0.06)
        : r < 0.45
          ? mix(color, '#ffffff', 0.03)
          : r < 0.8
            ? color
            : mix(color, '#000000', 0.04 + rand() * 0.05)
    stops.push([o, shade], [Math.min(1, o + band), shade])
    o += band
    k++
  }
  return lgu(id, top, base, stops)
}

export default {
  id: 'canyon-mesa',
  dark: true,
  draw(dark) {
    const P = dark ? NIGHT : DAY
    const rand = rng(911)
    let defs = lgu(
      'sky',
      0,
      1000,
      P.sky.map(([o, c]) => [o, c]),
    )
    defs += dark
      ? rg('sun', 1180, 230, 420, [
          [0, P.sun, 0.5],
          [0.15, P.sun, 0.18],
          [1, P.sun, 0],
        ])
      : rg('sun', 1150, 470, 650, [
          [0, P.sun, 1],
          [0.12, P.sun, 0.75],
          [0.45, '#ffd29a', 0.25],
          [1, '#ffd29a', 0],
        ])
    defs += `<linearGradient id="side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${P.shadow}" stop-opacity=".55"/><stop offset=".42" stop-color="${P.shadow}" stop-opacity=".12"/><stop offset=".7" stop-color="${P.shadow}" stop-opacity="0"/><stop offset="1" stop-color="${P.rim}" stop-opacity=".16"/></linearGradient>`
    defs += `<linearGradient id="foot" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="${P.shadow}" stop-opacity="0"/><stop offset="1" stop-color="${P.shadow}" stop-opacity=".45"/></linearGradient>`
    defs += `<filter id="soft" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>`
    defs += `<filter id="soft2" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter>`
    defs += grainFilter('grain', 0.75, dark ? 0.05 : 0.07, 2)

    let body = `<rect width="1600" height="1000" fill="url(#sky)"/>`
    if (dark) {
      const sr = rng(5)
      body += stars(sr, 220, 560)
      // a few brighter stars with a soft halo
      for (let i = 0; i < 14; i++) {
        const x = f1(sr() * 1600)
        const y = f1(sr() * 420)
        body += `<circle cx="${x}" cy="${y}" r="5" fill="#cfd8ff" opacity=".12"/><circle cx="${x}" cy="${y}" r="1.6" fill="#fff"/>`
      }
      body += `<rect width="1600" height="1000" fill="url(#sun)"/><circle cx="1180" cy="230" r="46" fill="#f4f1e6"/><circle cx="1166" cy="220" r="9" fill="#d9d6cc" opacity=".6"/><circle cx="1194" cy="246" r="6" fill="#d9d6cc" opacity=".5"/>`
    } else {
      body += `<rect width="1600" height="1000" fill="url(#sun)"/><circle cx="1150" cy="470" r="62" fill="#fff6e2"/>`
      // long soft clouds
      body += `<g filter="url(#soft)" fill="#fde3c4"><ellipse cx="380" cy="250" rx="340" ry="26" opacity=".55"/><ellipse cx="900" cy="330" rx="420" ry="20" opacity=".5"/><ellipse cx="1350" cy="180" rx="300" ry="22" opacity=".45"/></g>`
      body += `<g filter="url(#soft)" fill="#a77f98"><ellipse cx="520" cy="150" rx="380" ry="30" opacity=".35"/><ellipse cx="1260" cy="110" rx="340" ry="26" opacity=".3"/></g>`
    }

    // mesas in three receding layers: [cx, width, height] standing on `base`
    const specs = [
      {
        base: 600,
        li: 0,
        list: [
          [110, 420, 66],
          [560, 300, 48],
          [930, 460, 84],
          [1330, 280, 58],
          [1600, 340, 76],
        ],
      },
      {
        base: 690,
        li: 1,
        list: [
          [260, 360, 150],
          [700, 170, 200],
          [1060, 400, 128],
          [1470, 260, 168],
        ],
      },
      {
        base: 790,
        li: 2,
        list: [
          [520, 240, 250],
          [880, 120, 210],
          [1270, 200, 270],
        ],
      },
    ]
    let gi = 0
    specs.forEach((s, layer) => {
      const color = P.layers[s.li]
      const gp = ridgePts(rand, { y: s.base - 4, amp: 8, step: 80 })
      body += `<path d="${smooth(gp)}" fill="${mix(color, P.shadow, 0.1)}"/>`
      for (const [cx, w, h] of s.list) {
        const top = s.base - h
        const m = mesa(rand, cx, w, top, s.base + 4)
        const id = `st${gi++}`
        defs += strata(id, rand, top, s.base, color, layer === 0 ? [5, 14] : [7, 24])
        const pp = poly(m.pts)
        body += `<polygon points="${pp}" fill="url(#${id})"/><polygon points="${pp}" fill="url(#side)"/><polygon points="${pp}" fill="url(#foot)"/>`
        body += `<path d="M${f1(m.lx)} ${f1(top + 1)}H${f1(m.rx)}" stroke="${P.rim}" stroke-width="${2.6 - layer * 0.4}" opacity="${dark ? 0.35 : 0.6}"/>`
      }
      defs += lgu(`hz${layer}`, s.base - 300, s.base + 30, [
        [0, P.haze, 0],
        [0.7, P.haze, [0.22, 0.2, 0.12][layer]],
        [1, P.haze, [0.36, 0.3, 0.16][layer]],
      ])
      body += `<rect y="${s.base - 300}" width="1600" height="330" fill="url(#hz${layer})"/>`
    })

    // canyon floor: low dunes and a dry wash
    defs += lgu('floor', 780, 1000, [
      [0, P.floor[0]],
      [1, P.floor[1]],
    ])
    const fl = ridgePts(rng(31), { y: 830, amp: 16, step: 80 })
    body += `<path d="${smooth(fl)}" fill="url(#floor)"/>`
    const fl2 = ridgePts(rng(37), { y: 905, amp: 22, step: 80 })
    body += `<path d="${smooth(fl2)}" fill="${P.floor[1]}" opacity=".6"/>`
    body += `<path d="M640 1010 C760 960 900 930 840 890 S960 852 1110 846" fill="none" stroke="${dark ? '#46538a' : '#d39a6a'}" stroke-width="12" stroke-linecap="round" opacity=".4" filter="url(#soft2)"/>`

    // terraced canyon walls framing both sides: [inner x of the ledge, ledge y]
    const blocks = (steps, side, seed, color) => {
      const r = rng(seed)
      const edge = side === 'L' ? -20 : 1620
      const dir = side === 'L' ? 1 : -1
      let draw = ''
      steps.forEach(([x, y], i) => {
        const last = i === steps.length - 1
        const next = last ? [x + dir * 260, 1000] : steps[i + 1]
        const cliffBot = next[1] - (last ? 70 : 34)
        const pts = [
          [edge, 1010],
          [edge, y],
        ]
        for (let k = 1; k <= 4; k++) pts.push([edge + ((x - edge) * k) / 5, y - r() * 3])
        // cliff face with small ledges
        const face = []
        const jag = 5 + Math.floor(r() * 3)
        for (let k = 0; k <= jag; k++) {
          const t = k / jag
          face.push([x + dir * (t * 18 + (k % 2 ? (r() - 0.5) * 8 : 0)), y + (cliffBot - y) * t])
        }
        // talus down to the next ledge
        const tal = []
        for (let k = 1; k <= 4; k++) {
          const t = k / 4
          tal.push([
            x + dir * (18 + (Math.abs(next[0] - x) + (last ? 0 : 10) - 18) * t ** 1.3),
            cliffBot + (next[1] + 8 - cliffBot) * t ** 0.8,
          ])
        }
        pts.push(...face, ...tal, [tal[tal.length - 1][0], 1010])
        const id = `w${side}${i}`
        defs += strata(id, r, y, next[1] + 10, mix(color, P.shadow, i * 0.04), [8, 26])
        const pp = poly(pts)
        const sh = side === 'L' ? 'wshade' : 'wshadeR'
        draw += `<polygon points="${pp}" fill="url(#${id})"/><polygon points="${pp}" fill="url(#${sh})"/>`
        // the side face turned towards the canyon: sunlit on the left wall, shaded on the right
        const fw = 34 + r() * 20
        const sideFace = [[x - dir * fw, y], ...face, [x - dir * fw + dir * 12, cliffBot]]
        draw += `<polygon points="${poly(sideFace)}" fill="${side === 'L' ? P.rim : P.shadow}" opacity="${side === 'L' ? (dark ? 0.1 : 0.16) : 0.22}"/>`
        draw += `<polygon points="${poly([face[face.length - 1], ...tal, [x, next[1] + 8]])}" fill="${P.shadow}" opacity=".2"/>`
        draw += `<path d="M${edge} ${f1(y)}H${f1(x)}" stroke="${P.rim}" stroke-width="3" opacity="${dark ? 0.32 : 0.5}"/>`
        for (let k = 0; k < 3; k++) {
          const jx = edge + (x - edge) * (0.25 + r() * 0.65)
          const jr = 5 + r() * 6
          draw += `<ellipse cx="${f1(jx)}" cy="${f1(y - jr * 0.5)}" rx="${f1(jr * 1.3)}" ry="${f1(jr)}" fill="${P.scrub}" opacity=".85"/>`
        }
      })
      return draw
    }
    const nearC = P.layers[3]
    defs += `<linearGradient id="wshade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${P.shadow}" stop-opacity=".55"/><stop offset=".7" stop-color="${P.shadow}" stop-opacity=".2"/><stop offset=".92" stop-color="${P.shadow}" stop-opacity=".05"/><stop offset="1" stop-color="${P.rim}" stop-opacity=".12"/></linearGradient>`
    defs += `<linearGradient id="wshadeR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="${P.shadow}" stop-opacity=".4"/><stop offset=".7" stop-color="${P.shadow}" stop-opacity=".1"/><stop offset="1" stop-color="${P.rim}" stop-opacity=".14"/></linearGradient>`
    body += blocks(
      [
        [190, 300],
        [290, 450],
        [390, 600],
        [470, 740],
      ],
      'L',
      77,
      nearC,
    )
    body += blocks(
      [
        [1440, 390],
        [1350, 530],
        [1260, 660],
        [1180, 780],
      ],
      'R',
      99,
      mix(nearC, P.layers[2], 0.3),
    )

    // scrub on the canyon floor
    const sr = rng(123)
    for (let i = 0; i < 26; i++) {
      const x = 560 + sr() * 620
      const y = 860 + sr() * 130
      const r = 3 + sr() * 4 + (y - 860) * 0.035
      body += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r * 1.5)}" ry="${f1(r)}" fill="${P.scrub}" opacity="${f1(0.4 + sr() * 0.25)}"/>`
    }
    // a soft vignette keeps the edges rich under the glass
    defs += `<radialGradient id="vig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="${P.shadow}" stop-opacity="0"/><stop offset="1" stop-color="${P.shadow}" stop-opacity=".35"/></radialGradient>`
    body += `<rect width="1600" height="1000" fill="url(#vig)"/>`
    body += `<rect width="1600" height="1000" filter="url(#grain)" opacity=".9"/>`
    return `<defs>${defs}</defs>${body}`
  },
}
