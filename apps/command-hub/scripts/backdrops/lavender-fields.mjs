import { glow, lg, rng } from './lib.mjs'
import { blur, cloudFilter, f, fbm, grain, ridge } from './_day-helpers.mjs'

/** Lavender Fields: rows of lavender running to the horizon in warm late-afternoon light, a farmhouse and a lone tree far off. */
export default {
  id: 'lavender-fields',
  draw() {
    const rand = rng(23)
    const H = 585
    const vx = 820
    const n1 = fbm(rand)
    const n2 = fbm(rand)

    // Rows converge on a point a little above the horizon line.
    const vy = H - 60
    const at = (bx, t) => [vx + (bx - vx) * t, vy + (1000 - vy) * t]
    const t0 = (H - 13 - vy) / (1000 - vy)
    let rows = ''
    let lit = ''
    let shade = ''
    const sp = 128
    for (let i = -64; i <= 64; i++) {
      const b0 = vx + i * sp
      const strip = (a, b) => {
        const p = [at(b0 + sp * a, t0), at(b0 + sp * b, t0), at(b0 + sp * b, 1.06), at(b0 + sp * a, 1.06)]
        if (p[2][0] < -60 || p[3][0] > 1660) {
          // Clip to the window so far-off rows don't cost bytes.
          if (Math.max(p[0][0], p[1][0]) < -60 || Math.min(p[0][0], p[1][0]) > 1660) return ''
        }
        return `M${p.map(([x, y]) => `${Math.round(x)} ${f(y)}`).join('L')}Z`
      }
      rows += strip(0.12, 0.88)
      lit += strip(0.5, 0.82)
      shade += strip(0.12, 0.3)
    }

    // Distant hills and trees.
    const far = (x) => H - 70 + n1(x / 340) * 40 - Math.sin((x + 200) / 600) * 26
    const mid = (x) => H - 26 + n2(x / 260) * 18
    let poplars = ''
    for (const [x, h] of [
      [585, 44],
      [600, 52],
      [612, 40],
      [1300, 30],
      [1314, 36],
    ])
      poplars += `<ellipse cx="${x}" cy="${H - 12 - h / 2}" rx="${f(h * 0.14)}" ry="${f(h / 2)}" fill="#6c5d72"/>`

    // Foreground: out-of-focus lavender spikes in the bottom corners.
    let spikes = ''
    for (let i = 0; i < 34; i++) {
      const left = i % 2 === 0
      const x = left ? rand() * 330 - 20 : 1290 + rand() * 330
      const base = 1010
      const h = 140 + rand() * 200
      const lean = (rand() - 0.5) * 50 + (left ? 16 : -16)
      const top = [x + lean, base - h]
      spikes += `<path d="M${f(x)} ${base}Q${f(x + lean * 0.3)} ${f(base - h * 0.5)} ${f(top[0])} ${f(top[1])}" stroke="#3e5532" stroke-width="3" fill="none"/>`
      for (let k = 0; k < 7; k++) {
        const q = k / 7
        const px = top[0] - lean * 0.12 * q
        const py = top[1] + q * h * 0.32
        spikes += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(5 + q * 2)}" ry="${f(8 + q * 2)}" fill="${k % 2 ? '#5f3f96' : '#7d58b4'}"/>`
      }
    }

    const gr = grain('gr', 0.05)
    return `<defs>${lg('sky', [
      [0, '#8a9fd0'],
      [0.35, '#c4b9da'],
      [0.7, '#f3c9b2'],
      [1, '#fbd9a4'],
    ])}${glow('sun', 0.78, 0.48, 0.5, '#fff1c8', 0.95)}${glow('sunL', 0.78, 0.5, 0.8, '#ffb070', 0.4)}
      ${lg('field', [
        [0, '#a993a8'],
        [0.2, '#6e5868'],
        [1, '#33293a'],
      ])}
      ${lg('rows', [
        [0, '#b69bc4'],
        [0.2, '#8d68b8'],
        [1, '#6a3fa0'],
      ])}
      ${lg('lit', [
        [0, '#e7c6d8'],
        [0.25, '#c39be0'],
        [1, '#a979d6'],
      ])}
      ${lg('fh', [
        [0, '#b4a7c8'],
        [1, '#d6bfc6'],
      ])}
      ${lg('mh', [
        [0, '#8f8aa0'],
        [1, '#a99aa8'],
      ])}
      ${lg('ff', [
        [0, '#eecdbb', 0.8],
        [1, '#eecdbb', 0],
      ])}
      ${lg('haze', [
        [0, '#fbd9b0', 0],
        [0.5, '#fbd9b0', 0.75],
        [1, '#fbd9b0', 0],
      ])}
      <radialGradient id="vg" cx=".5" cy=".5" r=".8"><stop offset=".55" stop-color="#2a1640" stop-opacity="0"/><stop offset="1" stop-color="#2a1640" stop-opacity=".32"/></radialGradient>
      ${cloudFilter('cl', 40, 0.012, 6, 5)}${blur('soft', 2)}${blur('fg', 6, 40)}${blur('fg2', 2.5, 40)}${blur('b1', 0.8)}
      <filter id="rag" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".05 .16" numOctaves="2" seed="6"/><feDisplacementMap in="SourceGraphic" scale="12" xChannelSelector="R" yChannelSelector="G"/></filter>
      <filter id="speck" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".11 .05" numOctaves="2" seed="2"/><feColorMatrix values="0 0 0 0 .86 0 0 0 0 .74 0 0 0 0 .97 0 0 0 7 -4"/><feComposite in2="SourceAlpha" operator="in"/><feGaussianBlur stdDeviation=".6"/></filter>${gr.def}</defs>
      <rect width="1600" height="1000" fill="url(#sky)"/><rect width="1600" height="1000" fill="url(#sunL)"/><rect width="1600" height="1000" fill="url(#sun)"/>
      <g filter="url(#cl)" fill="#fff4ec" opacity=".55"><ellipse cx="300" cy="220" rx="260" ry="26"/><ellipse cx="520" cy="300" rx="200" ry="16"/><ellipse cx="1120" cy="170" rx="300" ry="22"/><ellipse cx="1500" cy="300" rx="180" ry="14"/></g>
      <circle cx="1250" cy="${H - 108}" r="60" fill="#fff3d2" opacity=".5" filter="url(#fg)"/><circle cx="1250" cy="${H - 108}" r="30" fill="#fff8e4"/>
      <path d="${ridge(far, 50)}" fill="url(#fh)"/>
      <rect y="${H - 70}" width="1600" height="90" fill="url(#haze)"/>
      <path d="${ridge(mid, 50)}" fill="url(#mh)"/>
      <g filter="url(#b1)">${poplars}
        <path d="M1060 ${H - 8}v-22" stroke="#5c4c5e" stroke-width="3"/><circle cx="1060" cy="${H - 38}" r="16" fill="#5c4c5e"/><circle cx="1050" cy="${H - 32}" r="11" fill="#5c4c5e"/><circle cx="1071" cy="${H - 33}" r="12" fill="#5c4c5e"/>
        <path d="M624 ${H - 12}v-20h34v20Z" fill="#e7c7a8"/><path d="M620 ${H - 32}l20 -10l22 10Z" fill="#b5735e"/><path d="M658 ${H - 12}v-13h16v13Z" fill="#d9b394"/><path d="M656 ${H - 25}l10 -5l10 5Z" fill="#a8685a"/><rect x="634" y="${H - 24}" width="4" height="5" fill="#6a5560"/><rect x="646" y="${H - 24}" width="4" height="5" fill="#6a5560"/></g>
      <rect y="${H - 14}" width="1600" height="440" fill="url(#field)"/>
      <g filter="url(#rag)"><path d="${rows}" fill="url(#rows)"/>
      <path d="${shade}" fill="#2c1850" opacity=".35"/>
      <path d="${lit}" fill="url(#lit)" opacity=".75"/></g>
      <path d="${lit}" fill="#000" filter="url(#speck)" opacity=".45"/>
      <rect y="${H - 30}" width="1600" height="110" fill="url(#haze)" opacity=".85"/><rect y="${H - 14}" width="1600" height="120" fill="url(#ff)"/>
      <rect width="1600" height="1000" fill="url(#sunL)" opacity=".5"/>
      <g filter="url(#fg2)">${spikes}</g>
      <rect width="1600" height="1000" fill="url(#vg)"/>${gr.rect}`
  },
}
