import { lg, rng } from './lib.mjs'
import { blur, blurU, fbm, f0, grainDefs, grainRect, rg, ridge, vignette } from './_mood-helpers.mjs'

/** Ember: a volcanic night, lava rivers between black ridges, smoke lit from below, rising embers. */
export default {
  id: 'ember',
  draw() {
    const rand = rng(666)
    const VX = 1060 // crater
    const VY = 420

    // Smoke plume: billows rising from the crater and leaning left.
    let plume = ''
    for (let i = 0; i < 34; i++) {
      const t = i / 33
      const x = VX - t * 520 - t * t * 300 + (rand() - 0.5) * 120 * (0.3 + t)
      const y = VY - 30 - t * 400 + (rand() - 0.5) * 60
      const r = 50 + t * 190 + rand() * 60
      plume += `<ellipse cx="${f0(x)}" cy="${f0(y)}" rx="${f0(r)}" ry="${f0(r * 0.6)}"/>`
    }
    // Low ash clouds across the sky.
    let ash = ''
    for (let i = 0; i < 12; i++)
      ash += `<ellipse cx="${f0(rand() * 1700 - 50)}" cy="${f0(80 + rand() * 300)}" rx="${f0(220 + rand() * 300)}" ry="${f0(40 + rand() * 50)}" opacity="${(0.4 + rand() * 0.4).toFixed(2)}"/>`

    // The cone.
    const cf = fbm(rand, 8, 3)
    const coneY = (x) => {
      const dx = Math.abs(x - VX)
      const top = VY + 8
      const k = x < VX ? 600 : 470
      let y = dx < 46 ? top + (dx > 30 ? 0 : 7) : top + ((dx - 46) / k) ** 1.3 * 320
      if (x > VX + 180) y -= Math.exp(-(((x - VX - 300) / 90) ** 2)) * 50
      return Math.min(780, y + (cf(x / 1600) - 0.5) * 40 * Math.min(1, dx / 200))
    }
    const cone = ridge(coneY, 10, 1000)

    // Lava down the flanks.
    const ends = []
    const flows = [
      [VX - 18, -1, 0.9],
      [VX + 14, 1, 0.75],
      [VX - 4, -1, 0.35],
      [VX + 6, 1, 0.3],
    ]
      .map(([x0, dir, spread]) => {
        let d = `M${x0} ${VY + 10}`
        let x = x0
        for (let y = VY + 30; y <= 740; y += 16) {
          x += dir * spread * (12 + rand() * 20) + Math.sin(y / 37 + x0) * 9
          d += `L${f0(x)} ${y}`
        }
        ends.push([f0(x), 740])
        return d
      })
      .join('')

    // Black ridges in front, each with a faint red rim.
    const ridges = [
      [700, 90, 3, '#160708', 0.6],
      [790, 60, 4, '#0e0506', 0.4],
      [1000, 60, 5, '#060203', 2.6],
    ].map(([base, amp, n, fill, corner]) => {
      const f = fbm(rand, n, 4)
      const yAt = (x) =>
        base - f(x / 1600) * amp - (Math.max(0, (360 - x) / 360) ** 1.4 + Math.max(0, (x - 1250) / 350) ** 1.4) * amp * corner * 1.6
      let crest = `M-20 ${f0(yAt(-20))}`
      for (let x = -20; x <= 1620; x += 12) crest += `L${x} ${f0(yAt(x))}`
      return [ridge(yAt, 12), crest, fill, yAt]
    })

    // Lava rivers winding through the valleys toward the viewer.
    const river = (pts) => {
      // Catmull-Rom through the points.
      const p = [pts[0], ...pts, pts[pts.length - 1]]
      let d = `M${p[1][0]} ${p[1][1]}`
      for (let i = 1; i < p.length - 2; i++) {
        const [x0, y0] = p[i - 1]
        const [x1, y1] = p[i]
        const [x2, y2] = p[i + 1]
        const [x3, y3] = p[i + 2]
        d += `C${f0(x1 + (x2 - x0) / 6)} ${f0(y1 + (y2 - y0) / 6)} ${f0(x2 - (x3 - x1) / 6)} ${f0(y2 - (y3 - y1) / 6)} ${x2} ${y2}`
      }
      return d
    }
    const r1 = river([
      [ends[2][0], 700],
      [860, 770],
      [700, 810],
      [570, 850],
      [600, 910],
      [500, 970],
      [430, 1040],
    ])
    const r2 = river([
      [ends[1][0], 700],
      [1250, 780],
      [1320, 830],
      [1350, 880],
      [1460, 920],
      [1640, 950],
    ])
    const r3 = river([
      [575, 848],
      [400, 860],
      [240, 900],
      [60, 920],
      [-40, 960],
    ])

    // Embers rising.
    let embers = ''
    let bokeh = ''
    const ec = ['#ffb347', '#ff7a1a', '#ffd27a', '#ff5a1f']
    for (let i = 0; i < 190; i++) {
      const x = rand() * 1600
      const y = 120 + rand() ** 0.7 * 860
      embers += `<circle cx="${f0(x)}" cy="${f0(y)}" r="${(0.7 + rand() * 1.8).toFixed(1)}" fill="${ec[Math.floor(rand() * 4)]}" opacity="${(0.4 + rand() * 0.6).toFixed(2)}"/>`
    }
    for (let i = 0; i < 8; i++) {
      const left = rand() < 0.5
      bokeh += `<circle cx="${f0(left ? rand() * 340 : 1260 + rand() * 340)}" cy="${f0(200 + rand() * 760)}" r="${f0(5 + rand() * 9)}" fill="${ec[Math.floor(rand() * 4)]}" opacity="${(0.45 + rand() * 0.35).toFixed(2)}"/>`
    }

    const lava = (d, w, k = 1) =>
      `<path d="${d}" stroke="#ff4a10" stroke-width="${w * 14}" opacity="${0.22 * k}" filter="url(#b60)"/><path d="${d}" stroke="#c4200c" stroke-width="${w * 5}" opacity="${0.35 * k}" filter="url(#b30)"/><path d="${d}" stroke="#ff5a14" stroke-width="${w * 1.8}" opacity="${0.8 * k}" filter="url(#b6)"/><path d="${d}" stroke="#ff9a2a" stroke-width="${w}"/><path d="${d}" stroke="#ffe08a" stroke-width="${(w * 0.35).toFixed(1)}" opacity=".9"/>`

    return `<defs>${lg('sky', [
      [0, '#040203'],
      [0.3, '#0f0507'],
      [0.5, '#2a0a0a'],
      [0.68, '#5a160c'],
      [0.8, '#2a0a08'],
    ])}<linearGradient id="smoke" gradientUnits="userSpaceOnUse" x1="0" y1="${VY + 20}" x2="0" y2="-40"><stop offset="0" stop-color="#ff7a2a"/><stop offset=".18" stop-color="#b8321a"/><stop offset=".5" stop-color="#4a1410"/><stop offset="1" stop-color="#160708"/></linearGradient>
      ${rg('crater', VX, VY + 10, 420, [
        [0, '#ffb347', 0.8],
        [0.1, '#ff6a1a', 0.5],
        [0.4, '#a8240e', 0.18],
        [1, '#5a160c', 0],
      ])}
      ${rg('valley', 500, 820, 700, [
        [0, '#ff5a14', 0.28],
        [0.5, '#8a1a0c', 0.1],
        [1, '#000', 0],
      ])}
      ${lg(
        'rim',
        [
          [0, '#ff6a2a', 0.0],
          [0.45, '#ff6a2a', 0.7],
          [0.7, '#ff8a3a', 0.5],
          [1, '#ff6a2a', 0.15],
        ],
        1,
        0,
      )}
      ${vignette(0.65, '#020101')}
      <filter id="cloud" filterUnits="userSpaceOnUse" x="-300" y="-400" width="2200" height="1300"><feTurbulence type="fractalNoise" baseFrequency=".007 .01" numOctaves="5" seed="21"/><feDisplacementMap in="SourceGraphic" scale="130" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="9"/></filter>
      ${ridges.map(([d], i) => `<clipPath id="cp${i}"><path d="${d}"/></clipPath>`).join('')}${blurU('b30', 30)}${blurU('b60', 60)}${blur('b6', 6)}${blur('b3', 2.5)}${blurU('b10', 10)}${grainDefs()}</defs>
      <rect width="1600" height="1000" fill="url(#sky)"/>
      <g fill="#2a0c0c" filter="url(#cloud)">${ash}</g>
      <rect width="1600" height="1000" fill="url(#crater)"/>
      <g fill="url(#smoke)" filter="url(#cloud)">${plume}</g>
      <path d="${cone}" fill="#0f0506"/>
      <ellipse cx="${VX}" cy="${VY + 6}" rx="44" ry="10" fill="#ffd27a" filter="url(#b6)"/>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">${lava(flows, 3.5, 0.85)}</g><path d="${cone}" fill="none" stroke="#ff6a2a" stroke-width="2" opacity=".35" filter="url(#b3)"/>
      ${ridges
        .map(
          ([d, crest, fill], i) =>
            `<path d="${d}" fill="${fill}"/><path d="${crest}" fill="none" stroke="url(#rim)" stroke-width="${3 - i * 0.6}" opacity="${0.55 - i * 0.12}" filter="url(#b3)"/>` +
            (i === 1
              ? `<rect width="1600" height="1000" fill="url(#valley)"/><g fill="none" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#cp1)">${lava(r1, 22)}${lava(r3, 15)}${lava(r2, 16, 0.9)}</g>`
              : ''),
        )
        .join('')}
      <g filter="url(#b10)" opacity=".6">${embers}</g>${embers}
      <g filter="url(#b10)">${bokeh}</g>
      <rect width="1600" height="1000" fill="url(#vig)"/>${grainRect(0.05)}`
  },
}
