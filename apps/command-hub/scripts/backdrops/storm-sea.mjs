import { lg, rng } from './lib.mjs'
import { blur, fbm, f0, grainDefs, grainRect, rg, ridge, vignette } from './_mood-helpers.mjs'

/** Storm Sea: heavy clouds over a dark sea, a lighthouse beam and a pale break at the horizon. */
export default {
  id: 'storm-sea',
  draw() {
    const rand = rng(909)
    const H = 600 // horizon
    const BX = 620 // centre of the light break

    // Cloud masses: blobs pushed around by turbulence. [cx, cy, rx, ry, fill, opacity]
    const blobs = (n, y0, y1, rx0, rx1, fills, op) => {
      let s = ''
      for (let i = 0; i < n; i++) {
        const x = -100 + rand() * 1800
        const y = y0 + rand() * (y1 - y0)
        s += `<ellipse cx="${f0(x)}" cy="${f0(y)}" rx="${f0(rx0 + rand() * (rx1 - rx0))}" ry="${f0((rx0 + rand() * (rx1 - rx0)) * 0.32)}" fill="${fills[Math.floor(rand() * fills.length)]}" opacity="${op}"/>`
      }
      return s
    }
    const cloudsHigh = blobs(18, -80, 220, 240, 460, ['#101a22', '#15222b', '#0c151c'], 1)
    const _ = 0
    const cloudsMid = blobs(18, 180, 400, 200, 380, ['#1d2c35', '#24353f', '#17252e'], 1)
    // Lit underbellies just above the break.
    const bellies = blobs(12, 390, 450, 140, 300, ['#8a877a', '#6e7472', '#a59a80'], 0.6)
    const roll = blobs(12, 330, 410, 200, 360, ['#182630', '#1d2c36'], 1)
    // Thin dark streaks of low cloud across the break.
    let low = ''
    for (let i = 0; i < 9; i++)
      low += `<ellipse cx="${f0(rand() * 1600)}" cy="${f0(515 + rand() * 60)}" rx="${f0(120 + rand() * 260)}" ry="${f0(5 + rand() * 9)}" fill="#1c272d" opacity="${(0.5 + rand() * 0.4).toFixed(2)}"/>`

    // Sea: rows of swells, closer together toward the horizon.
    const N = 26
    let sea = ''
    let rowDefs = ''
    for (let j = 0; j < N; j++) {
      const t = (j + 1) / N
      const y = H + 6 + t ** 1.9 * 420
      const amp = 2 + t ** 1.6 * 34
      const f = fbm(rand, 6 + Math.floor((1 - t) * 10), 3)
      const ph = rand() * 10
      const yAt = (x) => y - amp * (f(x / 1600) * 1.4 + 0.5 * Math.sin(x / (40 + t * 160) + ph))
      const d = ridge(yAt, t < 0.4 ? 16 : 10)
      const lit = Math.round(13 + (1 - t) * 22)
      rowDefs += `<linearGradient id="w${j}" gradientUnits="userSpaceOnUse" x1="0" y1="${f0(y - amp * 1.6)}" x2="0" y2="${f0(y + amp * 1.2 + 8)}"><stop offset="0" stop-color="rgb(${lit},${lit + 14},${lit + 17})"/><stop offset="1" stop-color="#060b0e"/></linearGradient>`
      const fill = `url(#w${j})`
      // Crest highlight: broken pale strokes, brighter under the break.
      let crest = `M-20 ${f0(yAt(-20))}`
      for (let x = -20; x <= 1620; x += 14) crest += `L${x} ${f0(yAt(x))}`
      const dash = `${f0(20 + rand() * 90 * t)} ${f0(40 + rand() * 160)}`
      sea += `<path d="${d}" fill="${fill}"/><path d="${crest}" fill="none" stroke="url(#crest)" stroke-width="${(0.8 + t * 2.2).toFixed(1)}" stroke-dasharray="${dash}" opacity="${(0.08 + t ** 2 * 0.4).toFixed(2)}"/>`
    }

    // Glitter of the break on the water.
    let glit = ''
    for (let i = 0; i < 140; i++) {
      const t = rand() ** 1.6
      const y = H + 4 + t * 240
      const spread = 90 + t * 300
      const x = BX + (rand() - 0.5) * 2 * spread * (0.4 + rand() * 0.6)
      glit += `<path d="M${f0(x)} ${f0(y)}h${f0(6 + rand() * (24 + t * 40))}"/>`
    }

    // Rain curtains hanging from the clouds.
    let curtains = ''
    for (let i = 0; i < 18; i++) {
      const x = (i < 10 ? 60 + rand() * 380 : 980 + rand() * 260) | 0
      curtains += `<path d="M${x} ${f0(320 + rand() * 80)}l${f0(-40 - rand() * 30)} ${f0(260 + rand() * 60)}"/>`
    }

    // Headland and lighthouse on the right.
    const hf = fbm(rand, 5, 3)
    const cliffY = (x) => 650 - Math.min(1, Math.max(0, (x - 1130) / 150)) ** 0.6 * 140 + (hf(x / 1600) - 0.5) * 50
    let cliff = `M1010 1000`
    for (let y = 1000; y > 660; y -= 20) cliff += `L${f0(1010 + ((1000 - y) / 340) ** 0.8 * 100 + (hf(y / 1000) - 0.5) * 40)} ${y}`
    for (let x = 1110; x <= 1620; x += 8) cliff += `L${x} ${f0(cliffY(x))}`
    cliff += 'L1620 1000Z'
    const LX = 1360
    const LB = f0(cliffY(LX)) + 4
    const LT = LB - 130
    const tower = `<path d="M${LX - 17} ${LB}L${LX - 11} ${LT}L${LX + 11} ${LT}L${LX + 17} ${LB}Z" fill="#0b1015"/><rect x="${LX - 15}" y="${LT - 6}" width="30" height="6" fill="#0b1015"/><path d="M${LX - 10} ${LT - 6}V${LT - 26}H${LX + 10}V${LT - 6}" fill="#3a3320"/><path d="M${LX - 13} ${LT - 26}L${LX} ${LT - 40}L${LX + 13} ${LT - 26}Z" fill="#0b1015"/><rect x="${LX - 2}" y="${LB - 70}" width="4" height="7" fill="#e0c88a" opacity=".6"/>`
    const LY = LT - 16
    let rocks = ''
    for (let i = 0; i < 5; i++) {
      const rx = 930 + rand() * 90
      const ry = 660 + rand() * 50
      const rw = 8 + rand() * 22
      rocks += `M${f0(rx - rw)} ${f0(ry + 4)}Q${f0(rx - rw * 0.7)} ${f0(ry - rw * 0.55)} ${f0(rx)} ${f0(ry - rw * 0.5)}T${f0(rx + rw)} ${f0(ry + 4)}Z`
    }
    // Spray where the sea meets the rocks.
    let spray = ''
    for (let i = 0; i < 9; i++)
      spray += `<ellipse cx="${f0(1110 + rand() * 260)}" cy="${f0(720 + rand() * 120)}" rx="${f0(30 + rand() * 60)}" ry="${f0(10 + rand() * 20)}" fill="#9fb0b4" opacity="${(0.12 + rand() * 0.15).toFixed(2)}"/>`

    return `<defs>${lg('sky', [
      [0, '#05080c'],
      [0.3, '#111a21'],
      [0.45, '#2a353b'],
      [0.52, '#6f726a'],
      [0.58, '#dcc89e'],
      [0.6, '#f4e2b8'],
      [0.601, '#2a383d'],
      [1, '#05090c'],
    ])}${lg(
      'beam',
      [
        [0, '#fff4d0', 0],
        [0.55, '#fff0c4', 0.22],
        [1, '#fff6dc', 0.85],
      ],
      1,
      0,
    )}${lg(
      'crest',
      [
        [0, '#7d8c8c'],
        [BX / 1600, '#f1e4c0'],
        [0.85, '#6f8080'],
        [1, '#56686a'],
      ],
      1,
      0,
    )}${rg(
      'break',
      BX,
      H - 20,
      620,
      [
        [0, '#ffe9bd', 0.9],
        [0.15, '#f0d8a6', 0.5],
        [0.45, '#8f927f', 0.12],
        [1, '#5c645f', 0],
      ],
      ' gradientTransform="translate(0 ' + (H - 20) * 0.75 + ') scale(1 .25)"',
    )}
      ${rg('lamp', LX, LY, 160, [
        [0, '#fffbe8', 1],
        [0.08, '#ffe9a8', 0.8],
        [0.35, '#ffd27a', 0.18],
        [1, '#ffd27a', 0],
      ])}
      ${rg(
        'seaglow',
        BX,
        H + 10,
        520,
        [
          [0, '#d8ccaa', 0.35],
          [0.4, '#7b8278', 0.1],
          [1, '#000', 0],
        ],
        ' gradientTransform="translate(0 ' + (H + 10) * 0.6 + ') scale(1 .4)"',
      )}
      ${vignette(0.6, '#020406')}
      <filter id="cloud" filterUnits="userSpaceOnUse" x="-300" y="-300" width="2200" height="1200"><feTurbulence type="fractalNoise" baseFrequency=".005 .011" numOctaves="5" seed="8"/><feDisplacementMap in="SourceGraphic" scale="120" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="11"/></filter>
      ${blur('b40', 40)}${blur('b12', 12)}${blur('b4', 3)}${blur('b20', 20)}${grainDefs()}</defs>
      <rect width="1600" height="1000" fill="url(#sky)"/>
      <rect width="1600" height="${H}" fill="url(#break)"/>
      <g filter="url(#cloud)">${cloudsMid}</g>
      <g filter="url(#cloud)">${bellies}</g>
      <g filter="url(#cloud)">${roll}${cloudsHigh}</g>
      <g filter="url(#b4)">${low}</g>
      <g stroke="#3a4850" stroke-width="40" opacity=".35" filter="url(#b20)">${curtains}</g>
      
      <rect y="${H}" width="1600" height="${1000 - H}" fill="#0b1418"/><defs>${rowDefs}</defs>
      <rect y="${H}" width="1600" height="400" fill="url(#seaglow)"/>
      ${sea}<ellipse cx="${BX}" cy="${H + 90}" rx="170" ry="110" fill="#e8dcb8" opacity=".14" filter="url(#b40)"/>
      <g stroke="#f4e8c8" stroke-width="2" opacity=".4" filter="url(#b4)">${glit}</g>
      <rect y="${H - 2}" width="1600" height="4" fill="#e9dcb4" opacity=".5" filter="url(#b4)"/>
      <path d="M${LX} ${LY}L-40 ${LY - 190}L-40 ${LY + 60}Z" fill="url(#beam)" filter="url(#b12)" opacity=".7"/>
      <path d="M${LX} ${LY}L-40 ${LY - 110}L-40 ${LY - 10}Z" fill="url(#beam)" filter="url(#b4)" opacity=".5"/>
      <g filter="url(#b12)">${spray}</g>
      <path d="${rocks}" fill="#080c0f"/><path d="${cliff}" fill="#070b0e"/><path d="${cliff}" fill="none" stroke="#3c4644" stroke-width="2" opacity=".5" filter="url(#b4)"/>${tower}
      <circle cx="${LX}" cy="${LY}" r="160" fill="url(#lamp)"/>
      <rect width="1600" height="1000" fill="url(#vig)"/>${grainRect(0.05)}`
  },
}
