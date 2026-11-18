import { glow, lg, rng } from './lib.mjs'
import { blur, f, fbm, grain, mixColor, ridge } from './_day-helpers.mjs'

/** Rice Terraces: stacked green paddies curving down a hillside, misty ridges behind, forest on the left. */
export default {
  id: 'rice-terraces',
  draw() {
    const rand = rng(64)
    const n1 = fbm(rand)
    const n2 = fbm(rand)
    const n3 = fbm(rand)
    const n4 = fbm(rand)
    const nt = fbm(rand)
    const mist = '#e9efe4'

    // Misty ridges, far to near.
    const r1 = (x) => 250 + n1(x / 230) * 70 + Math.sin(x / 300) * 20
    const r2 = (x) => 320 + n2(x / 200) * 60
    const r3 = (x) => 390 + n3(x / 260) * 50
    const r4 = (x) => 450 + n4(x / 300) * 40

    // The terraced slope: high on the left, two spurs that the contours bow around.
    const top = (x) => 470 - Math.exp(-(((x + 100) / 520) ** 2)) * 230 + nt(x / 200) * 12
    const spur = (x) =>
      Math.exp(-(((x - 520) / 210) ** 2)) + Math.exp(-(((x - 1260) / 200) ** 2)) * 0.95 - Math.exp(-(((x - 900) / 140) ** 2)) * 0.6
    const K = 36
    const ys = []
    let acc = 0
    for (let k = 0; k <= K; k++) {
      ys.push(acc)
      acc += 7 * 1.062 ** k
    }
    const yOf = (k, x) => top(x) + ys[k] + spur(x) * k * 4.6 + nt(x / 90 + k * 0.7) * (1.5 + k * 0.12)
    const line = (k, dy = 0) => {
      let d = ''
      for (let x = -60; x <= 1660; x += 32) d += `${d ? 'L' : 'M'}${x} ${Math.round(yOf(k, x) + dy)}`
      return d + 'V1100H-60Z'
    }
    // A patch of one paddy between x0 and x1 (water, or a different green).
    const patch = (k, x0, x1, fill) => {
      const th = ys[k + 1] - ys[k]
      const xs = []
      for (let x = x0; x < x1; x += 32) xs.push(x)
      xs.push(x1)
      const up = xs.map((x) => `${x} ${Math.round(yOf(k, x) + 1)}`)
      const dn = xs.reverse().map((x) => `${x} ${Math.round(yOf(k + 1, x) - th * 0.3)}`)
      return `<path d="M${up.join('L')}L${dn.join('L')}Z" fill="${fill}"/>`
    }
    const greens = ['#9cc65a', '#8fbf4f', '#a9cf63', '#b7d66f', '#86b84b', '#a1c95c']
    let terr = ''
    const bunds = []
    for (let k = 0; k < K; k++) {
      const haze = (1 - k / K) ** 2 * 0.6
      const th = ys[k + 1] - ys[k]
      const c = greens[Math.floor(rand() * greens.length)]
      terr += `<path d="${line(k)}" fill="${mixColor(c, mist, haze)}" stroke="${mixColor('#dceda0', mist, haze)}" stroke-width="${f(0.8 + k * 0.06)}"/>`
      for (let j = 0; j < 2; j++) {
        if (rand() < 0.45) {
          const x0 = Math.round(-60 + rand() * 1500)
          const x1 = Math.min(1660, x0 + Math.round(120 + rand() * 420))
          const water = rand() < 0.35
          terr += patch(k, x0, x1, mixColor(water ? '#bcd7cc' : rand() < 0.5 ? '#c3dc7c' : '#86b54a', mist, haze))
          bunds.push([k, x0], [k, x1])
        }
      }
      for (let j = 0; j < 3; j++) bunds.push([k, Math.round(rand() * 1600)])
      let bd = ''
      for (const [kk, x] of bunds.splice(0)) bd += `M${x} ${Math.round(yOf(kk, x))}V${Math.round(yOf(kk + 1, x) - th * 0.3)}`
      terr += `<path d="${bd}" stroke="${mixColor('#6f9a45', mist, haze)}" stroke-width="${f(1 + k * 0.05)}"/>`
      terr += `<path d="${line(k + 1, -th * 0.3)}" fill="${mixColor('#5f8d3c', mist, haze)}"/>`
    }

    // A forested slope on the left (where the drawer sits) and a stand of trees on the right.
    const forest = (x) => 70 + x * 1.5 + n1(x / 40 + 9) * 26 + Math.max(0, x - 200) ** 2 / 300
    let canopy = ''
    for (let i = 0; i < 150; i++) {
      const x = -30 + rand() * 480
      const yTop = forest(x)
      if (yTop > 1040) continue
      const y = yTop + rand() * (1040 - yTop)
      const r = 12 + rand() * 14 + (y - yTop) * 0.01
      const dk = ['#22402b', '#284a31', '#2f5638'][Math.floor(rand() * 3)]
      canopy += `<circle cx="${Math.round(x)}" cy="${Math.round(y)}" r="${Math.round(r)}" fill="${dk}"/><circle cx="${Math.round(x + r * 0.25)}" cy="${Math.round(y - r * 0.35)}" r="${Math.round(r * 0.5)}" fill="#4b7b4e" opacity=".5"/>`
    }
    let right = ''
    for (let i = 0; i < 26; i++) {
      const x = 1440 + rand() * 220
      const y = 880 + rand() * 140 - (x - 1440) * 0.3
      const r = 18 + rand() * 22
      right += `<circle cx="${Math.round(x)}" cy="${Math.round(y)}" r="${Math.round(r)}" fill="${rand() < 0.5 ? '#2f5536' : '#3a6340'}"/>`
    }

    // Two small farmhouses on the terraces.
    const hut = (x, y, s) =>
      `<path d="M${x - 10 * s} ${y}v${-9 * s}h${20 * s}v${9 * s}Z" fill="#b39a7a"/><path d="M${x - 14 * s} ${y - 8 * s}L${x} ${y - 20 * s}L${x + 14 * s} ${y - 8 * s}Z" fill="#6e5a44"/>`

    const gr = grain('gr', 0.05)
    return `<defs>${lg('sky', [
      [0, '#b9d2d6'],
      [0.6, '#e2ebe2'],
      [1, '#f3f1e2'],
    ])}${glow('sun', 0.62, 0.12, 0.5, '#fffbe8', 0.9)}
      ${lg('mist', [
        [0, mist, 0],
        [0.55, mist, 0.85],
        [1, mist, 0],
      ])}
      ${lg('fade', [
        [0, mist, 0.9],
        [1, mist, 0],
      ])}
      ${lg(
        'fr',
        [
          [0, '#21402b'],
          [1, '#13281b'],
        ],
        1,
        0,
      )}
      <radialGradient id="vg" cx=".55" cy=".5" r=".8"><stop offset=".6" stop-color="#173020" stop-opacity="0"/><stop offset="1" stop-color="#173020" stop-opacity=".3"/></radialGradient>
      ${blur('soft', 10)}${blur('b1', 0.8)}${blur('tr', 1.2)}<filter id="leaf" filterUnits="userSpaceOnUse" x="-100" y="-100" width="1800" height="1200"><feTurbulence type="fractalNoise" baseFrequency=".055" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="16" xChannelSelector="R" yChannelSelector="G"/></filter>${gr.def}</defs>
      <rect width="1600" height="1000" fill="url(#sky)"/><rect width="1600" height="1000" fill="url(#sun)"/>
      <path d="${ridge(r1, 50)}" fill="#b2c9c8"/><rect y="270" width="1600" height="120" fill="url(#mist)"/>
      <path d="${ridge(r2, 50)}" fill="#97b5b0"/><rect y="340" width="1600" height="110" fill="url(#mist)"/>
      <path d="${ridge(r3, 50)}" fill="#7fa198"/><rect y="400" width="1600" height="100" fill="url(#mist)"/>
      <path d="${ridge(r4, 50)}" fill="#6a8f7e"/><rect y="450" width="1600" height="90" fill="url(#mist)"/>
      ${terr}
      <rect y="400" width="1600" height="200" fill="url(#mist)" opacity=".5"/>
      <g filter="url(#b1)">${hut(1010, 640, 1.2)}${hut(1050, 652, 1)}${hut(380, 560, 0.9)}</g>
      <g filter="url(#leaf)">${right}</g>
      <g filter="url(#leaf)"><path d="${ridge((x) => Math.min(1100, forest(x)), 20, 1200)}" fill="url(#fr)"/>${canopy}</g>
      <rect width="1600" height="1000" fill="url(#vg)"/>${gr.rect}`
  },
}
