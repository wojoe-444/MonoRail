import { lg, rng } from './lib.mjs'
import { blur, f0, grainDefs, grainRect, rg, vignette } from './_mood-helpers.mjs'

/** Neon Rain: a city at night in the rain, neon glows on wet streets. */
export default {
  id: 'neon-rain',
  draw() {
    const rand = rng(1337)
    const MAG = '#ff3fb4'
    const CYA = '#38e6ff'
    const AMB = '#ffb347'
    const VIO = '#9d6bff'

    // A skyline as one staircase path; returns the path and the buildings for windows.
    const skyline = (base, minH, maxH, minW, maxW, x0 = -20, x1 = 1620) => {
      const b = []
      let d = `M${x0} 1000L${x0} ${base}`
      for (let x = x0; x < x1;) {
        const w = minW + rand() * (maxW - minW)
        const top = base - (minH + rand() * (maxH - minH))
        d += `L${f0(x)} ${f0(top)}`
        if (rand() < 0.18) {
          const ax = f0(x + w * (0.3 + rand() * 0.4))
          d += `L${ax - 2} ${f0(top)}L${ax - 2} ${f0(top - 30 - rand() * 50)}L${ax + 2} ${f0(top - 30 - rand() * 50)}L${ax + 2} ${f0(top)}`
        }
        d += `L${f0(x + w)} ${f0(top)}`
        b.push([x, top, w])
        x += w + (rand() < 0.3 ? rand() * 10 : 0)
        d += `L${f0(x)} ${f0(top)}L${f0(x)} ${base}`
      }
      return [d + `L${x1} ${base}L${x1} 1000Z`, b]
    }

    const windows = (bs, base, density, colors, op, size = 4) => {
      let s = ''
      for (const [x, top, w] of bs) {
        const cols = Math.floor((w - 8) / (size * 2.5))
        const rows = Math.floor((base - top - 10) / (size * 3))
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) {
            if (rand() > density) continue
            s += `<rect x="${f0(x + 6 + c * size * 2.5)}" y="${f0(top + 8 + r * size * 3)}" width="${size}" height="${f0(size * 1.4)}" fill="${colors[Math.floor(rand() * colors.length)]}" opacity="${(op * (0.5 + rand() * 0.5)).toFixed(2)}"/>`
          }
      }
      return s
    }

    const [far, farB] = skyline(800, 200, 520, 50, 130)
    const [mid, midB] = skyline(830, 70, 320, 70, 170, 300, 1310)
    const farWin = windows(farB, 800, 0.05, ['#ffd9a0', '#bfe9ff'], 0.45, 3)
    const midWin = windows(midB, 830, 0.06, ['#ffcf8a', '#9fe8ff', '#ffb0de'], 0.75, 4)

    // Near towers framing the edges.
    const nearL = `M-20 832L-20 40L150 40L150 -20L250 -20L250 110L330 110L330 832Z`
    const nearR = `M1620 832L1620 60L1480 60L1480 -20L1390 -20L1390 170L1290 170L1290 832Z`
    const nearWin =
      windows(
        [
          [-10, 60, 150],
          [160, 120, 90],
        ],
        820,
        0.16,
        ['#ffcf8a', '#ffe2b5', '#ff9fd6'],
        0.55,
        6,
      ) +
      windows(
        [
          [1480, 80, 130],
          [1300, 190, 80],
        ],
        820,
        0.16,
        ['#a8ecff', '#ffe2b5'],
        0.5,
        6,
      )
    let floors = ''
    for (let y = 60; y < 830; y += 18) floors += `M-20 ${y}H330M1290 ${y}H1620`
    let mullions = ''
    for (let x = 20; x < 330; x += 46) mullions += `M${x} 40V830`
    for (let x = 1310; x < 1620; x += 46) mullions += `M${x} 60V830`

    // Neon signs: shapes only, no text. [svg markup, color, glow center x, y, glow radius]
    const signs = [
      [`<rect x="268" y="250" width="34" height="300" rx="10"/>`, MAG, 285, 400, 260],
      [`<rect x="190" y="610" width="120" height="44" rx="14"/><path d="M210 632h80"/>`, CYA, 250, 632, 170],
      [`<circle cx="1340" cy="330" r="34"/><circle cx="1340" cy="330" r="16"/>`, CYA, 1340, 330, 230],
      [
        `<rect x="1316" y="430" width="48" height="230" rx="12"/><path d="M1328 470h24M1328 520h24M1328 570h24M1328 620h24"/>`,
        AMB,
        1340,
        545,
        230,
      ],
      [`<path d="M560 650l26 -26l26 26l26 -26l26 26"/>`, MAG, 612, 640, 150],
      [`<rect x="950" y="600" width="110" height="34" rx="12"/>`, AMB, 1005, 617, 160],
      [`<rect x="760" y="560" width="22" height="120" rx="8"/>`, VIO, 771, 620, 140],
      [`<path d="M1130 690h90"/><path d="M1130 708h60"/>`, CYA, 1170, 700, 130],
    ]
    let glowDefs = ''
    let glows = ''
    let halos = ''
    let tubes = ''
    let refl = ''
    signs.forEach(([shape, col, gx, gy, gr], i) => {
      glowDefs += rg(`g${i}`, gx, gy, gr, [
        [0, col, 0.55],
        [0.35, col, 0.18],
        [1, col, 0],
      ])
      glows += `<circle cx="${gx}" cy="${gy}" r="${gr}" fill="url(#g${i})"/>`
      halos += `<g stroke="${col}" stroke-width="16" opacity=".55">${shape}</g>`
      tubes += `<g stroke="${col}" stroke-width="6">${shape}</g><g stroke="#fff" stroke-width="2" opacity=".85">${shape}</g>`
      // Reflection on the wet street: a tall, soft streak under the sign.
      const rw = gr * 0.22
      refl += `<rect x="${f0(gx - rw / 2)}" y="836" width="${f0(rw)}" height="${f0(120 + gr * 0.3)}" fill="url(#rf${i})"/>`
      glowDefs += lg(`rf${i}`, [
        [0, col, 0.75],
        [0.5, col, 0.35],
        [1, col, 0],
      ])
    })

    // Soft lit billboards: colour masses that bloom through the glass.
    const boards = `<rect x="1010" y="470" width="150" height="80" fill="${CYA}" opacity=".22"/><rect x="440" y="520" width="90" height="130" fill="${MAG}" opacity=".2"/><rect x="840" y="440" width="70" height="60" fill="${AMB}" opacity=".18"/>`
    let smog = ''
    for (let i = 0; i < 9; i++)
      smog += `<ellipse cx="${f0(rand() * 1600)}" cy="${f0(120 + rand() * 360)}" rx="${f0(220 + rand() * 260)}" ry="${f0(50 + rand() * 60)}" fill="${rand() < 0.5 ? '#6a2a8a' : '#3a2a7a'}" opacity="${(0.18 + rand() * 0.2).toFixed(2)}"/>`

    // Bokeh in the street: car lights and lamps, soft discs.
    let bokeh = ''
    const bcol = [AMB, '#ff5a5a', MAG, CYA, '#ffe0a8']
    for (let i = 0; i < 26; i++) {
      const x = 380 + rand() * 860
      const y = 820 + rand() * 60
      const r = 6 + rand() * 18
      bokeh += `<circle cx="${f0(x)}" cy="${f0(y)}" r="${f0(r)}" fill="${bcol[Math.floor(rand() * bcol.length)]}" opacity="${(0.25 + rand() * 0.45).toFixed(2)}"/>`
    }

    // Wet-street ripple lines that break the reflections.
    let ripples = ''
    for (let i = 0; i < 46; i++) {
      const y = 860 + rand() * 140
      const x = rand() * 1600
      ripples += `<path d="M${f0(x)} ${f0(y)}h${f0(60 + rand() * 260)}"/>`
    }

    // Rain.
    let rain = ''
    let rainB = ''
    for (let i = 0; i < 420; i++) {
      const x = rand() * 1700 - 50
      const y = rand() * 1000
      const l = 18 + rand() * 46
      const seg = `M${f0(x)} ${f0(y)}l${f0(-l * 0.18)} ${f0(l)}`
      if (rand() < 0.2) rainB += seg
      else rain += seg
    }

    return `<defs>${lg('sky', [
      [0, '#05040f'],
      [0.3, '#140b30'],
      [0.55, '#2c1250'],
      [0.75, '#5a1d6c'],
      [1, '#2a0f3a'],
    ])}${lg('street', [
      [0, '#1c0c2a'],
      [0.4, '#0d0718'],
      [1, '#05030a'],
    ])}${lg('farf', [
      [0, '#36215e'],
      [1, '#5e2a78'],
    ])}${lg('midf', [
      [0, '#1a0f30'],
      [1, '#26123a'],
    ])}${lg('haze', [
      [0, MAG, 0],
      [0.5, MAG, 0.22],
      [1, VIO, 0],
    ])}${rg('city', 800, 780, 700, [
      [0, '#ff4fa8', 0.35],
      [0.5, '#8a2a9a', 0.15],
      [1, '#2a0f45', 0],
    ])}${glowDefs}${vignette(0.6, '#030208')}${blur('b6', 6)}${blur('b14', 14)}${blur('b30', 30)}${blur('b3', 2.5)}<filter id="bs" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation="12 6"/></filter>${grainDefs()}</defs>
      <rect width="1600" height="1000" fill="url(#sky)"/>
      <rect width="1600" height="1000" fill="url(#city)"/><g filter="url(#b30)">${smog}</g>
      <path d="${far}" fill="url(#farf)" opacity=".85"/>${farWin}
      <rect y="560" width="1600" height="300" fill="url(#haze)" filter="url(#b30)"/>
      <path d="${mid}" fill="url(#midf)"/><g filter="url(#b6)">${boards}</g>${midWin}
      <rect y="830" width="1600" height="170" fill="url(#street)"/><rect y="830" width="1600" height="60" fill="url(#haze)" opacity=".8" filter="url(#b14)"/>
      <g filter="url(#bs)">${refl}</g>
      <g filter="url(#b14)">${bokeh}</g>
      <g stroke="#05030a" stroke-width="4" opacity=".6" filter="url(#b3)">${ripples}</g>
      <path d="${nearL}" fill="#08050f"/><path d="${nearR}" fill="#08050f"/><g fill="none"><path d="${floors}" stroke="#2a1840" stroke-width="1.5" opacity=".55"/><path d="${mullions}" stroke="#000" stroke-width="6" opacity=".35"/></g>${nearWin}<g filter="url(#b6)" stroke-width="5"><path d="M332 120V832" stroke="${MAG}" opacity=".55"/><path d="M1288 180V832" stroke="${CYA}" opacity=".5"/></g>
      ${glows}
      <g fill="none" stroke-linecap="round" stroke-linejoin="round"><g filter="url(#b14)">${halos}</g><g filter="url(#b3)">${tubes}</g></g>
      <path d="M0 833H1600" fill="none" stroke="#ff7ac8" stroke-width="2" opacity=".25" filter="url(#b3)"/>
      <path d="${rain}" stroke="#d8d4ff" stroke-width="1.2" opacity=".18" stroke-linecap="round"/>
      <path d="${rainB}" stroke="#ffffff" stroke-width="1.6" opacity=".32" stroke-linecap="round"/>
      <rect width="1600" height="1000" fill="url(#vig)"/>${grainRect(0.05)}`
  },
}
