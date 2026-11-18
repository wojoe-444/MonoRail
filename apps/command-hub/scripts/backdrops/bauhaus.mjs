import { rng } from './lib.mjs'

/** Bauhaus: a flat modernist composition of circles, quarter-circles and bars on a grid, printed on grainy paper. */

const PAPER = '#eee6d6'
const INK = '#23211f'
const RED = '#c8462f'
const OCHRE = '#dca23a'
const BLUE = '#2e5d8c'
const SAGE = '#9aa88f'

/** A quarter disc with its corner at (cx, cy), opening towards (dx, dy) = (±1, ±1). */
const quarter = (cx, cy, r, dx, dy, fill, extra = '') => {
  const sweep = dx * dy > 0 ? 1 : 0
  return `<path d="M${cx} ${cy}L${cx + dx * r} ${cy}A${r} ${r} 0 0 ${sweep} ${cx} ${cy + dy * r}Z" fill="${fill}"${extra}/>`
}
/** A half disc on the diameter through (cx, cy); `dir` is up, down, left or right. */
const half = (cx, cy, r, dir, fill, extra = '') => {
  const d = {
    up: `M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}Z`,
    down: `M${cx - r} ${cy}A${r} ${r} 0 0 0 ${cx + r} ${cy}Z`,
    left: `M${cx} ${cy - r}A${r} ${r} 0 0 0 ${cx} ${cy + r}Z`,
    right: `M${cx} ${cy - r}A${r} ${r} 0 0 1 ${cx} ${cy + r}Z`,
  }[dir]
  return `<path d="${d}" fill="${fill}"${extra}/>`
}

export default {
  id: 'bauhaus',
  draw() {
    const mul = ' style="mix-blend-mode:multiply"'
    let defs = ''
    // paper: warm mottling, fibres and fine speckle
    defs += `<filter id="mottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".004" numOctaves="3" seed="21"/><feColorMatrix values="0 0 0 0 .55 0 0 0 0 .45 0 0 0 0 .3 0 0 0 .55 -.2"/></filter>`
    defs += `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 .2 0 0 0 0 .17 0 0 0 0 .12 1.6 0 0 0 -.78"/></filter>`
    defs += `<filter id="fleck" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="9"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 .98 0 0 0 0 .94 -2.2 0 0 0 1.25"/></filter>`
    // printed ink is never quite even: knock tiny holes out of the shapes
    defs += `<filter id="ink" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -4.5 3.6" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>`

    let body = `<rect width="1600" height="1000" fill="${PAPER}"/><rect width="1600" height="1000" filter="url(#mottle)"/>`
    // construction grid
    let grid = ''
    for (let x = 100; x < 1600; x += 100) grid += `M${x} 0V1000`
    for (let y = 100; y < 1000; y += 100) grid += `M0 ${y}H1600`
    body += `<path d="${grid}" stroke="${INK}" stroke-width="1" opacity=".07"/>`

    let art = ''
    // large forms
    art += `<circle cx="1200" cy="400" r="300" fill="${BLUE}"/>`
    art += quarter(0, 1000, 420, 1, -1, RED)
    art += half(600, 0, 200, 'down', OCHRE)
    art += quarter(1600, 1000, 300, -1, -1, OCHRE, mul)
    art += `<rect x="1300" y="0" width="300" height="200" fill="${SAGE}"${mul}/>`
    art += `<circle cx="1270" cy="330" r="118" fill="${OCHRE}"/><circle cx="1270" cy="330" r="118" fill="none" stroke="${INK}" stroke-width="6"/>`
    // bars
    art += `<rect x="880" y="100" width="40" height="800" fill="${INK}"/>`
    art += `<rect x="200" y="700" width="1100" height="24" fill="${INK}"/>`
    art += `<rect x="100" y="180" width="320" height="60" fill="${INK}"/>`
    art += `<rect x="1400" y="600" width="24" height="320" fill="${RED}"/>`
    // semicircles and dots
    art += half(500, 700, 120, 'up', BLUE, mul)
    art += half(500, 724, 120, 'down', INK)
    art += `<circle cx="300" cy="420" r="70" fill="${OCHRE}"/>`
    art += `<circle cx="300" cy="420" r="26" fill="${INK}"/>`
    art += `<circle cx="1060" cy="840" r="44" fill="${RED}"/>`
    art += quarter(1100, 700, 200, 1, 1, BLUE, mul)
    // concentric arcs
    let arcs = ''
    for (let r = 40; r <= 160; r += 30) arcs += `M${700 - r} 520A${r} ${r} 0 0 1 ${700 + r} 520`
    art += `<path d="${arcs}" fill="none" stroke="${INK}" stroke-width="10"/>`
    // stripe block
    for (let i = 0; i < 6; i++) art += `<rect x="1460" y="${300 + i * 26}" width="140" height="10" fill="${INK}"/>`
    for (let i = 0; i < 5; i++) art += `<rect x="${130 + i * 28}" y="800" width="12" height="200" fill="${PAPER}"/>`
    // a scatter of small marks
    const r = rng(14)
    for (let i = 0; i < 7; i++)
      art += `<circle cx="${1000 + Math.round(r() * 5) * 40}" cy="${80 + Math.round(r() * 2) * 40}" r="7" fill="${INK}"/>`
    art += `<path d="M200 560l60 -60M230 560l60 -60M260 560l60 -60" stroke="${RED}" stroke-width="8"/>`

    body += `<g filter="url(#ink)">${art}</g>`
    body += `<rect width="1600" height="1000" filter="url(#fleck)" opacity=".5"/><rect width="1600" height="1000" filter="url(#grain)" opacity=".4"/>`
    return `<defs>${defs}</defs>${body}`
  },
}
