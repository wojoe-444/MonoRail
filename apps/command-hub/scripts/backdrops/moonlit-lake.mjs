import { lg, rng } from './lib.mjs'
import { blur, blurU, fbm, f0, fir, grainDefs, grainRect, rg, ridge, vignette } from './_mood-helpers.mjs'

/** Moonlit Lake: a full moon over a still, misty lake; the shore and its reflection. */
export default {
  id: 'moonlit-lake',
  draw() {
    const rand = rng(4711)
    const W = 640 // waterline
    const MX = 1140
    const MY = 250
    const MR = 58

    let stars = ''
    for (let i = 0; i < 220; i++) {
      const x = rand() * 1600
      const y = rand() * 560
      const dm = Math.hypot(x - MX, y - MY)
      if (dm < 230 || rand() < 0.4 * (1 - y / 560)) continue
      const r = 0.5 + rand() * 1.2
      stars += `<circle cx="${f0(x)}" cy="${f0(y)}" r="${r.toFixed(1)}" fill="#eef1ff" opacity="${(0.25 + rand() * 0.6 * Math.min(1, dm / 600)).toFixed(2)}"/>`
    }

    // Shore: hazy far hills, then a dark wooded shore; all closed to the waterline.
    const hill = (base, amp, n) => {
      const f = fbm(rand, n, 4)
      return (x) => base - f(x / 1600) * amp
    }
    const farY = hill(W - 8, 120, 3)
    const far = ridge(farY, 16, W)
    const midY = (x) => hill(W - 4, 70, 4)(x)
    const nearF = fbm(rand, 3, 3)
    const nearY = (x) => W - 6 - nearF(x / 1600) * 50 - Math.max(0, (420 - x) / 420) * 130 - Math.max(0, (x - 1350) / 250) * 60
    let mid = ridge(midY, 16, W)
    for (let i = 0; i < 90; i++) {
      const x = rand() * 1640 - 20
      const h = 14 + rand() * 26
      mid += fir(rand, x, midY(x) + 3, h, h * 0.35, 3)
    }
    let near = ridge(nearY, 12, W)
    for (let i = 0; i < 110; i++) {
      const x = rand() ** 1.6 * 1640 - 20
      const x2 = rand() < 0.35 ? 1640 - (x + 20) : x
      const edge = Math.min(1, Math.max(0, (480 - x2) / 200, (x2 - 1300) / 200))
      const h = (22 + edge * 30) * (1 + rand() * (1.2 + edge * 1.2))
      near += fir(rand, x2, nearY(x2) + 4, h, h * 0.34)
    }

    // Moon's path on the water.
    let path = ''
    for (let i = 0; i < 120; i++) {
      const t = rand()
      const y = W + 4 + t * (1000 - W)
      const spread = 30 + t * 170
      const x = MX + (rand() - 0.5) * 2 * spread * (0.3 + rand() * 0.7)
      path += `<path d="M${f0(x)} ${f0(y)}h${f0(6 + rand() * (14 + t * 46))}"/>`
    }
    // Faint ripples across the lake.
    let rip = ''
    for (let i = 0; i < 40; i++) rip += `<path d="M${f0(rand() * 1600)} ${f0(W + 10 + rand() ** 1.5 * 350)}h${f0(80 + rand() * 300)}"/>`

    // Wisps of cloud and mist.
    const wisps = (n, y0, y1, op, fill) => {
      let s = ''
      for (let i = 0; i < n; i++)
        s += `<ellipse cx="${f0(rand() * 1700 - 50)}" cy="${f0(y0 + rand() * (y1 - y0))}" rx="${f0(180 + rand() * 340)}" ry="${f0(8 + rand() * 22)}" fill="${fill}" opacity="${(op * (0.5 + rand() * 0.7)).toFixed(2)}"/>`
      return s
    }

    // Reeds in the near corners.
    let reeds = ''
    for (let i = 0; i < 46; i++) {
      const left = i < 28
      const x = left ? -10 + rand() * 280 : 1360 + rand() * 260
      const h = 60 + rand() * 170
      const bend = (rand() - 0.3) * 40 * (left ? 1 : -1)
      reeds += `<path d="M${f0(x)} 1010Q${f0(x + bend * 0.3)} ${f0(1010 - h * 0.6)} ${f0(x + bend)} ${f0(1010 - h)}" stroke-width="${(1.5 + rand() * 2.5).toFixed(1)}"/>`
      if (rand() < 0.25)
        reeds += `<ellipse cx="${f0(x + bend)}" cy="${f0(1010 - h + 14)}" rx="3" ry="12" fill="#03050e" stroke="none" transform="rotate(${f0(bend * 0.4)} ${f0(x + bend)} ${f0(1010 - h + 14)})"/>`
    }

    return `<defs>${lg('sky', [
      [0, '#04061a'],
      [0.3, '#0c1234'],
      [0.52, '#1f2a5c'],
      [0.64, '#3a477c'],
    ])}${lg('water', [
      [0, '#2c3870'],
      [0.12, '#1c2552'],
      [0.5, '#0d1335'],
      [1, '#05071a'],
    ])}${lg('fade', [
      [0, '#fff', 0.9],
      [1, '#fff', 0.2],
    ])}<mask id="rmask"><rect y="${W}" width="1600" height="${1000 - W}" fill="url(#fade)"/></mask>
      ${rg('halo', MX, MY, 560, [
        [0, '#cfd8ff', 0.5],
        [0.12, '#a9b6f0', 0.28],
        [0.4, '#6f7dc4', 0.1],
        [1, '#3a477c', 0],
      ])}
      ${rg('halo2', MX, MY, 190, [
        [0.3, '#eef1ff', 0.55],
        [0.5, '#dde3ff', 0.22],
        [0.75, '#c7d0ff', 0.07],
        [1, '#c7d0ff', 0],
      ])}
      ${rg('disc', MX - 18, MY - 18, MR * 1.3, [
        [0, '#ffffff'],
        [0.6, '#eef0fa'],
        [1, '#c9d0e6'],
      ])}
      ${rg(
        'wglow',
        MX,
        W + 160,
        380,
        [
          [0, '#c7d0ff', 0.32],
          [1, '#5a68b0', 0],
        ],
        ` gradientTransform="translate(${MX * 0.55} 0) scale(.45 1)"`,
      )}
      ${vignette(0.6, '#020310')}${blurU('b40', 40)}${blurU('b18', 18)}${blur('b6', 6)}${blur('b2', 1.5)}${blur('b3', 3)}${grainDefs()}
      <g id="shore"><path d="${far}" fill="#1c2656"/><path d="${mid}" fill="#111840"/><path d="${near}" fill="#060a20"/></g></defs>
      <rect width="1600" height="${W}" fill="url(#sky)"/>
      <rect width="1600" height="${W}" fill="url(#halo)"/>${stars}
      <g filter="url(#b18)">${wisps(8, 120, 460, 0.18, '#8c98d8')}</g>
      <circle cx="${MX}" cy="${MY}" r="190" fill="url(#halo2)"/>
      <circle cx="${MX}" cy="${MY}" r="${MR}" fill="url(#disc)"/>
      <g fill="#a3abc9" opacity=".16" filter="url(#b6)"><ellipse cx="${MX - 16}" cy="${MY - 12}" rx="22" ry="14"/><ellipse cx="${MX + 16}" cy="${MY + 8}" rx="15" ry="18"/><ellipse cx="${MX - 8}" cy="${MY + 26}" rx="13" ry="8"/><ellipse cx="${MX + 12}" cy="${MY - 28}" rx="10" ry="7"/></g>
      <g filter="url(#b18)">${wisps(4, MY - 30, MY + 40, 0.22, '#dfe5ff')}</g>
      <rect y="${W}" width="1600" height="${1000 - W}" fill="url(#water)"/>
      <rect y="${W}" width="1600" height="${1000 - W}" fill="url(#wglow)"/>
      <g mask="url(#rmask)"><use href="#shore" transform="matrix(1 0 0 -1 0 ${2 * W})" filter="url(#b2)"/></g>
      <use href="#shore"/>
      <g filter="url(#b40)">${wisps(10, W - 30, W + 20, 0.32, '#aab4e6')}</g>
      <g stroke="#eef1ff" stroke-width="2" opacity=".55" filter="url(#b2)">${path}</g>
      <ellipse cx="${MX}" cy="${W + 180}" rx="60" ry="180" fill="#dfe5ff" opacity=".12" filter="url(#b40)"/>
      <g stroke="#8a96d0" stroke-width="1.5" opacity=".12">${rip}</g>
      <g filter="url(#b40)">${wisps(8, W + 60, W + 200, 0.16, '#9aa6dc')}</g>
      <g fill="none" stroke="#03050e" stroke-linecap="round">${reeds}</g>
      <rect width="1600" height="1000" fill="url(#vig)"/>${grainRect(0.045)}`
  },
}
