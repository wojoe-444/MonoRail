import { lg, rng } from './lib.mjs'
import { blurU, f0, grainDefs, grainRect, rg, vignette } from './_mood-helpers.mjs'

/** Nebula: layered clouds of violet, teal and rose over dense stars, a dark planet lit along one edge. */
export default {
  id: 'nebula',
  draw() {
    const rand = rng(31337)
    const VIO = '#7c4dff'
    const TEAL = '#1fc8c8'
    const ROSE = '#ff4f93'

    // The nebula runs in a band from the upper left to the right.
    const band = (t) => [-100 + t * 1800, 640 - t * 520 + Math.sin(t * 5) * 60]
    const blobs = (n, color, r0, r1, t0, t1, off = 0, op = 1) => {
      let s = ''
      for (let i = 0; i < n; i++) {
        const [x, y] = band(t0 + rand() * (t1 - t0))
        const r = r0 + rand() * (r1 - r0)
        s += `<ellipse cx="${f0(x + (rand() - 0.5) * off)}" cy="${f0(y + (rand() - 0.5) * off * 0.6)}" rx="${f0(r)}" ry="${f0(r * (0.45 + rand() * 0.3))}" fill="${color}" opacity="${(op * (0.5 + rand() * 0.5)).toFixed(2)}"/>`
      }
      return s
    }
    const vio = blobs(12, VIO, 160, 340, 0, 1, 260)
    const teal = blobs(8, TEAL, 120, 260, 0.45, 0.95, 200)
    const rose = blobs(8, ROSE, 120, 260, 0.05, 0.5, 220)
    const core = blobs(5, '#ffd6ec', 50, 110, 0.4, 0.62, 120, 0.8)
    const dust = blobs(14, '#020309', 90, 220, 0, 1, 200)

    // Stars: fine dust everywhere, denser along the band; a few bright ones with spikes.
    const tints = ['#ffffff', '#dfe7ff', '#cfe0ff', '#fff1dc', '#ffe3f0']
    let fine = ''
    for (let i = 0; i < 620; i++) {
      let x
      let y
      if (rand() < 0.55) {
        const [bx, by] = band(rand())
        x = bx + (rand() - 0.5) * 500
        y = by + (rand() + rand() - 1) * 260
      } else {
        x = rand() * 1600
        y = rand() * 1000
      }
      fine += `<circle cx="${f0(x)}" cy="${f0(y)}" r="${(0.5 + rand() ** 3 * 1.3).toFixed(1)}" fill="${tints[Math.floor(rand() * 5)]}" opacity="${(0.35 + rand() * 0.6).toFixed(2)}"/>`
    }
    let bright = ''
    let brightGlow = ''
    for (let i = 0; i < 12; i++) {
      const x = f0(80 + rand() * 1440)
      const y = f0(60 + rand() * 640)
      const s = 5 + rand() * 12
      const c = tints[Math.floor(rand() * 5)]
      bright += `<circle cx="${x}" cy="${y}" r="${(1.4 + rand()).toFixed(1)}" fill="#fff"/><path d="M${f0(x - s)} ${y}h${f0(2 * s)}M${x} ${f0(y - s)}v${f0(2 * s)}" stroke="${c}" stroke-width=".7" opacity=".45"/>`
      brightGlow += `<circle cx="${x}" cy="${y}" r="${f0(s * 0.6)}" fill="${c}" opacity=".35"/>`
    }

    // The planet: bottom right, lit from the upper left.
    const PX = 1380
    const PY = 1230
    const PR = 560
    let bands = ''
    for (let i = 0; i < 9; i++) {
      const y = PY - PR + 40 + i * 70 + rand() * 30
      bands += `<ellipse cx="${PX}" cy="${f0(y)}" rx="${PR + 40}" ry="${f0(8 + rand() * 20)}" fill="${rand() < 0.5 ? '#1a2440' : '#0d1328'}" opacity=".6"/>`
    }

    const nebulaFilter = (id, seed, freq, gain, cut) =>
      `<filter id="${id}" filterUnits="userSpaceOnUse" x="-200" y="-200" width="2000" height="1400"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="5" seed="${seed}"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${gain} 0 0 0 ${-cut}" result="a"/><feGaussianBlur in="SourceGraphic" stdDeviation="40" result="s"/><feComposite in="s" in2="a" operator="in"/></filter>`

    return `<defs>${lg(
      'space',
      [
        [0, '#05051a'],
        [0.5, '#0a0820'],
        [1, '#02030a'],
      ],
      1,
      1,
    )}${nebulaFilter('n1', 4, 0.0032, 2.2, 0.75)}${nebulaFilter('n2', 11, 0.0045, 2.6, 1)}${nebulaFilter('n3', 23, 0.006, 3, 1.25)}${nebulaFilter('nd', 37, 0.005, 3, 1.3)}
      ${rg('atmo', PX, PY, PR + 46, [
        [0, '#000', 0],
        [PR / (PR + 46) - 0.004, '#6fe3ff', 0.9],
        [PR / (PR + 46) + 0.02, '#4aa8ff', 0.35],
        [1, '#4a6cff', 0],
      ])}
      ${rg('pfill', PX - 260, PY - 380, PR * 1.25, [
        [0, '#1c2a4c'],
        [0.35, '#0b1124'],
        [1, '#03050c'],
      ])}
      <linearGradient id="lit" gradientUnits="userSpaceOnUse" x1="${PX - 480}" y1="${PY - 480}" x2="${PX + 80}" y2="${PY - 520}"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient>
      <mask id="litside"><rect x="${PX - PR - 60}" y="${PY - PR - 60}" width="${2 * PR + 120}" height="${2 * PR + 120}" fill="url(#lit)"/></mask>
      <clipPath id="pclip"><circle cx="${PX}" cy="${PY}" r="${PR}"/></clipPath>
      ${vignette(0.6, '#010106')}${blurU('b60', 60)}${blurU('b90', 90)}${blurU('b4', 2)}${blurU('b8', 8)}${blurU('b14', 14)}${blurU('b20', 22)}${grainDefs()}</defs>
      <rect width="1600" height="1000" fill="url(#space)"/>
      <g filter="url(#b90)" opacity=".35">${vio}${rose}${teal}</g>
      <g filter="url(#n1)" opacity=".9">${vio}</g>
      <g filter="url(#n2)" opacity=".85">${rose}</g>
      <g filter="url(#n2)" opacity=".8">${teal}</g>
      <g filter="url(#n3)" opacity=".7">${core}${teal}</g>
      <g filter="url(#b60)" opacity=".5">${core}</g>
      <g filter="url(#nd)" opacity=".85">${dust}</g>
      ${fine}<g filter="url(#b8)">${brightGlow}</g>${bright}
      <g mask="url(#litside)"><circle cx="${PX}" cy="${PY}" r="${PR + 10}" fill="none" stroke="#3fb8ff" stroke-width="50" opacity=".35" filter="url(#b20)"/><circle cx="${PX}" cy="${PY}" r="${PR + 46}" fill="url(#atmo)"/></g>
      <circle cx="${PX}" cy="${PY}" r="${PR}" fill="url(#pfill)"/>
      <g clip-path="url(#pclip)"><g filter="url(#b20)" opacity=".7">${bands}</g>
                <g mask="url(#litside)"><circle cx="${PX}" cy="${PY}" r="${PR - 4}" fill="none" stroke="#bff3ff" stroke-width="6" filter="url(#b4)"/></g>
        <circle cx="${PX + 30}" cy="${PY + 36}" r="${PR - 6}" fill="#03050c" opacity=".75" filter="url(#b14)"/></g>
      <rect width="1600" height="1000" fill="url(#vig)"/>${grainRect(0.04)}`
  },
}
