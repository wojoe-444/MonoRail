import { rng } from './lib.mjs'
import { f1 } from './_art-helpers.mjs'

/** Watercolor: loose abstract washes that bloom and pool at their edges, on cold-press paper. */

/** A closed, irregular blob around (cx, cy), smoothed through noisy radial points. */
function blob(rand, cx, cy, rx, ry, rot = 0, n = 14, wobble = 0.28) {
  const p = []
  const ph = rand() * 6.28
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 1 + (rand() - 0.5) * wobble * 2 + Math.sin(a * 3 + ph) * wobble * 0.5
    const x = Math.cos(a) * rx * k
    const y = Math.sin(a) * ry * k
    p.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)])
  }
  let d = `M${f1(p[0][0])} ${f1(p[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n]
    const p1 = p[i]
    const p2 = p[(i + 1) % n]
    const p3 = p[(i + 2) % n]
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`
  }
  return d + 'Z'
}

/** The wash filter: ragged displaced edge, soft body, darker pooled rim and pigment granulation. */
const washFilter = (id, seed, freq, scale, erode, bodyAlpha) =>
  `<filter id="${id}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">` +
  `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="4" seed="${seed}" result="t"/>` +
  `<feDisplacementMap in="SourceGraphic" in2="t" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
  `<feGaussianBlur in="d" stdDeviation="2.2" result="soft"/>` +
  `<feMorphology in="d" operator="erode" radius="${erode}" result="er"/>` +
  `<feGaussianBlur in="er" stdDeviation="${erode * 1.6}" result="erb"/>` +
  `<feComposite in="soft" in2="erb" operator="out" result="rim"/>` +
  `<feComponentTransfer in="soft" result="body"><feFuncA type="linear" slope="${bodyAlpha}"/></feComponentTransfer>` +
  `<feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="${seed + 7}" result="g"/>` +
  `<feColorMatrix in="g" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -.9 1.2" result="gm"/>` +
  `<feComposite in="body" in2="gm" operator="in" result="gb"/>` +
  `<feComponentTransfer in="rim" result="rim2"><feFuncA type="linear" slope=".75"/></feComponentTransfer>` +
  `<feMerge><feMergeNode in="gb"/><feMergeNode in="rim2"/></feMerge></filter>`

export default {
  id: 'watercolor',
  draw() {
    const rand = rng(303)
    let defs = ''
    defs += washFilter('wA', 3, 0.009, 90, 8, 0.62)
    defs += washFilter('wB', 11, 0.016, 60, 6, 0.55)
    defs += washFilter('wC', 19, 0.03, 34, 4, 0.5)
    // wet-into-wet: a soft, feathered wash with no hard edge
    defs += `<filter id="wS" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="4" seed="23" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="150" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="13"/></filter>`
    defs += `<filter id="spl" x="-50%" y="-50%" width="200%" height="200%"><feTurbulence type="fractalNoise" baseFrequency=".2" numOctaves="2" seed="5" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>`
    // cold-press paper: a lit, bumpy relief
    defs += `<filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="5" seed="6" result="n"/><feDiffuseLighting in="n" surfaceScale="2.2" lighting-color="#fff" result="l"><feDistantLight azimuth="225" elevation="52"/></feDiffuseLighting><feColorMatrix in="l" values="0 0 0 0 .35 0 0 0 0 .3 0 0 0 0 .25 -1 0 0 0 .92"/></filter>`
    defs += `<filter id="fine" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="2"/><feColorMatrix values="0 0 0 0 .3 0 0 0 0 .25 0 0 0 0 .2 0 0 0 1.2 -.55"/></filter>`
    const grad = (id, a, b, x2 = 1, y2 = 1) =>
      `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`
    defs += grad('gBlue', '#2f5f9a', '#7a6ab8')
    defs += grad('gTeal', '#3f9a96', '#2f6f9a', 1, 0)
    defs += grad('gRose', '#e38a8a', '#c76a9a')
    defs += grad('gOchre', '#e6b04e', '#e08a52', 0, 1)
    defs += grad('gViolet', '#8a6fb8', '#d58aa0', 1, 0)
    defs += grad('gSage', '#8fb39a', '#5f9a8a')

    const mul = ' style="mix-blend-mode:multiply"'
    const wash = (d, fill, f, op = 1) => `<path d="${d}" fill="${fill}" filter="url(#${f})" opacity="${op}"${mul}/>`

    let body = `<rect width="1600" height="1000" fill="#f8f3ea"/>`
    // first, broad pale glazes
    body += wash(blob(rand, 240, 180, 480, 300, -0.3, 16), 'url(#gBlue)', 'wS', 0.75)
    body += wash(blob(rand, 1400, 880, 500, 300, 0.25, 16), 'url(#gViolet)', 'wS', 0.7)
    body += wash(blob(rand, 1440, 140, 400, 240, 0.4, 14), 'url(#gOchre)', 'wS', 0.75)
    body += wash(blob(rand, 160, 880, 420, 260, 0.2, 14), 'url(#gTeal)', 'wS', 0.7)
    body += wash(blob(rand, 820, 520, 560, 320, -0.15, 16, 0.22), 'url(#gRose)', 'wS', 0.18)
    // a long diagonal sweep of colour, laid on dry paper
    body += wash(blob(rand, 1180, 520, 420, 70, -0.55, 18, 0.2), 'url(#gTeal)', 'wA', 0.35)
    body += wash(blob(rand, 420, 470, 380, 60, -0.5, 18, 0.2), 'url(#gRose)', 'wA', 0.3)
    // stronger, smaller washes glazed over them
    body += wash(blob(rand, 140, 340, 230, 170, 0.6), 'url(#gBlue)', 'wB', 0.7)
    body += wash(blob(rand, 420, 90, 260, 120, -0.2), 'url(#gViolet)', 'wB', 0.45)
    body += wash(blob(rand, 1250, 300, 220, 140, 0.5), 'url(#gRose)', 'wB', 0.55)
    body += wash(blob(rand, 1520, 620, 200, 260, 0.1), 'url(#gRose)', 'wB', 0.5)
    body += wash(blob(rand, 1180, 940, 300, 140, -0.1), 'url(#gTeal)', 'wB', 0.55)
    body += wash(blob(rand, 330, 700, 240, 150, -0.4), 'url(#gSage)', 'wB', 0.6)
    body += wash(blob(rand, 60, 620, 160, 200, 0), 'url(#gOchre)', 'wB', 0.5)
    body += wash(blob(rand, 760, 40, 300, 90, 0.05), 'url(#gTeal)', 'wB', 0.35)
    body += wash(blob(rand, 820, 980, 320, 90, 0), 'url(#gBlue)', 'wB', 0.35)
    // concentrated pigment where washes meet
    body += wash(blob(rand, 90, 250, 120, 90, 0.3), '#284f86', 'wC', 0.5)
    body += wash(blob(rand, 1500, 900, 160, 90, 0.2), '#5b4a90', 'wC', 0.45)
    body += wash(blob(rand, 1520, 120, 120, 80, -0.3), '#d77a3c', 'wC', 0.45)
    body += wash(blob(rand, 240, 960, 150, 70, 0.1), '#2f7f7a', 'wC', 0.5)
    // blooms: paper-coloured backruns inside the wet washes
    const bloom = (x, y, r) =>
      `<path d="${blob(rand, x, y, r, r * 0.8, rand() * 3, 12, 0.35)}" fill="#f8f3ea" filter="url(#wB)" opacity=".4"/>`
    body += bloom(250, 230, 70) + bloom(1400, 840, 80) + bloom(1440, 190, 55) + bloom(170, 880, 60) + bloom(1280, 330, 40)
    // a few splatters
    const sr = rng(91)
    let sp = ''
    const cols = ['#2f5f9a', '#c76a9a', '#3f9a96', '#e08a52']
    for (let i = 0; i < 46; i++) {
      const edge = sr() < 0.5
      const x = edge ? (sr() < 0.5 ? sr() * 380 : 1220 + sr() * 380) : sr() * 1600
      const y = edge ? sr() * 1000 : sr() < 0.5 ? sr() * 160 : 840 + sr() * 160
      const r = 1.5 + sr() ** 3 * 9
      sp += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${cols[i % 4]}" opacity="${f1(0.35 + sr() * 0.4)}"/>`
    }
    body += `<g filter="url(#spl)"${mul}>${sp}</g>`
    body += `<rect width="1600" height="1000" filter="url(#paper)" opacity=".42"${mul}/><rect width="1600" height="1000" filter="url(#fine)" opacity=".5"/>`
    return `<defs>${defs}</defs>${body}`
  },
}
