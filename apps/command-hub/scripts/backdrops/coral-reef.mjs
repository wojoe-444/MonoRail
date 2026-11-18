import { glow, lg, rng } from './lib.mjs'
import { blur, f, fbm, grain, ridge, taper } from './_day-helpers.mjs'

/** Coral Reef: sunlit water from teal to deep blue, light rays, coral silhouettes and a few fish. */
export default {
  id: 'coral-reef',
  draw() {
    const rand = rng(19)
    const r = (n) => Math.round(n)

    // Branching coral: forks with round-capped strokes, thinner each level.
    const branchy = (x, y, h, color, spread = 0.5) => {
      const byW = {}
      const go = (x0, y0, ang, len, w, d) => {
        const x1 = x0 + Math.cos(ang) * len
        const y1 = y0 + Math.sin(ang) * len
        const k = Math.max(1, Math.round(w))
        byW[k] =
          (byW[k] || '') + `M${r(x0)} ${r(y0)}Q${r((x0 + x1) / 2 + (rand() - 0.5) * len * 0.3)} ${r((y0 + y1) / 2)} ${r(x1)} ${r(y1)}`
        if (d < 3) {
          const n = 2 + (rand() < 0.5 ? 1 : 0)
          for (let i = 0; i < n; i++)
            go(x1, y1, ang + (i - (n - 1) / 2) * spread + (rand() - 0.5) * 0.35, len * (0.7 + rand() * 0.2), w * 0.78, d + 1)
        }
      }
      for (let s = -1; s <= 1; s++)
        go(x + s * h * 0.06, y, -Math.PI / 2 + s * 0.5 + (rand() - 0.5) * 0.3, h * 0.3, h * 0.085, s === 0 ? 0 : 1)
      return (
        Object.entries(byW)
          .map(([w, d]) => `<path d="${d}" stroke-width="${w}"/>`)
          .join('')
          .replace(/^/, `<g fill="none" stroke="${color}" stroke-linecap="round">`) + '</g>'
      )
    }

    // Sea fan: a flat fan of fine branches over a faint web.
    const fan = (x, y, w, h, color) => {
      let d = ''
      const go = (x0, y0, ang, len, dd) => {
        const x1 = x0 + Math.cos(ang) * len
        const y1 = y0 + Math.sin(ang) * len
        d += `M${r(x0)} ${r(y0)}L${r(x1)} ${r(y1)}`
        if (dd < 6) for (const s of [-1, 1]) go(x1, y1, ang + s * (0.16 + rand() * 0.2), len * 0.8, dd + 1)
      }
      go(x, y, -Math.PI / 2 + (rand() - 0.5) * 0.2, h * 0.22, 0)
      return `<path d="${d}" stroke="${color}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`
    }

    // Kelp: a swaying stem with long blades on alternate sides.
    const kelp = (x, y, h, color, phase) => {
      const pts = []
      for (let i = 0; i <= 12; i++) {
        const q = i / 12
        pts.push([x + Math.sin(q * 3.2 + phase) * 40 * q, y - h * q, 7 * (1 - q * 0.6)])
      }
      let leaves = ''
      for (let i = 2; i < 12; i++) {
        const [px, py] = pts[i]
        const s = i % 2 ? 1 : -1
        const ang = s * (35 + rand() * 20) + Math.cos((i / 12) * 3.2 + phase) * 20
        const L = h * (0.07 + 0.03 * Math.sin((i / 12) * Math.PI))
        leaves += `<ellipse cx="${r(px)}" cy="${r(py - L)}" rx="${r(L * 0.22)}" ry="${r(L)}" transform="rotate(${r(ang)} ${r(px)} ${r(py)})"/>`
      }
      return `<g fill="${color}"><path d="${taper(pts)}"/>${leaves}</g>`
    }

    // Boulder coral: a lumpy mound of overlapping bumps.
    const dome = (x, y, rx, ry, color, hi) => {
      let o = `<ellipse cx="${r(x)}" cy="${r(y)}" rx="${r(rx)}" ry="${r(ry)}"/>`
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.05 + rand() * 0.9)
        const rr = Math.min(rx, ry) * (0.35 + rand() * 0.3)
        o += `<circle cx="${r(x + Math.cos(a) * rx * 0.75)}" cy="${r(y + Math.sin(a) * ry * 0.8)}" r="${r(rr)}"/>`
      }
      return `<g fill="${color}">${o}</g>${hi ? `<ellipse cx="${r(x - rx * 0.2)}" cy="${r(y - ry * 0.55)}" rx="${r(rx * 0.45)}" ry="${r(ry * 0.2)}" fill="${hi}" opacity=".35"/>` : ''}`
    }

    const tubes = (x, y, s, color, inner) => {
      let o = ''
      for (const [dx, h, w] of [
        [-16, 90, 22],
        [6, 130, 26],
        [30, 70, 20],
      ]) {
        o += `<rect x="${r(x + dx * s - (w * s) / 2)}" y="${r(y - h * s)}" width="${r(w * s)}" height="${r(h * s + 10)}" rx="${r((w * s) / 2)}" fill="${color}"/><ellipse cx="${r(x + dx * s)}" cy="${r(y - h * s + 5 * s)}" rx="${r(w * s * 0.32)}" ry="${r(3 * s)}" fill="${inner}"/>`
      }
      return o
    }

    // Reef floor lines, far to near.
    const n1 = fbm(rand)
    const n2 = fbm(rand)
    const n3 = fbm(rand)
    const far = (x) => 760 + n1(x / 160) * 40
    const mid = (x) => 840 + n2(x / 200) * 45
    const near = (x) => 935 + n3(x / 180) * 35 - Math.max(0, 380 - x) * 0.9

    let farReef = ''
    for (let i = 0; i < 18; i++) {
      const x = rand() * 1600
      farReef +=
        rand() < 0.5
          ? branchy(x, far(x) + 10, 70 + rand() * 60, '#2e8fa6')
          : dome(x, far(x) + 8, 30 + rand() * 30, 18 + rand() * 12, '#2e8fa6')
    }
    let midReef = ''
    for (let i = 0; i < 22; i++) {
      const x = rand() * 1600
      const c = ['#1f6f8c', '#2a6a8e', '#256e86', '#3a6f96', '#2f7c8e'][i % 5]
      midReef +=
        rand() < 0.5
          ? branchy(x, mid(x) + 14, 110 + rand() * 80, c, 0.55)
          : dome(x, mid(x) + 12, 40 + rand() * 40, 26 + rand() * 16, c, '#1a5f7a')
    }
    // Warm accents in the mid-ground, softened by the water.
    midReef +=
      branchy(1180, mid(1180) + 16, 150, '#c87a86', 0.55) +
      fan(960, mid(960) + 14, 120, 160, '#d08a72') +
      branchy(520, mid(520) + 18, 120, '#b07aa6', 0.5) +
      dome(760, mid(760) + 16, 60, 34, '#6f8a82', '#d8f0d0') +
      branchy(1380, mid(1380) + 16, 110, '#d0866e', 0.5) +
      dome(1240, mid(1240) + 22, 50, 28, '#7a6a9e', '#e0b8ff')

    // Foreground: a tall dark outcrop up the left edge, fans and kelp on the right.
    const left = (x) => 330 + x * 1.9 + n1(x / 60 + 4) * 30 + Math.max(0, x - 180) ** 2 / 160
    let fg = ''
    fg += kelp(60, 1000, 640, '#0a3550', 0.4) + kelp(150, 1000, 520, '#0c3b57', 1.6) + kelp(230, 1010, 380, '#0b3852', 2.6)
    fg += `<path d="${ridge((x) => Math.min(1100, left(x)), 20, 1200)}" fill="#08304a"/>`
    fg +=
      dome(90, 560, 90, 60, '#0b3a56', '#2a6a88') +
      dome(210, 760, 110, 70, '#0a3752', '#2a6a88') +
      dome(40, 860, 120, 80, '#0b3a56', '#2a6a88')
    fg += branchy(130, 470, 250, '#0b3a56', 0.55) + branchy(300, 860, 200, '#0a3550', 0.6) + tubes(380, 990, 1.3, '#0b3a56', '#062538')
    fg += `<path d="${ridge(near, 40, 1200)}" fill="#0a3550"/>`
    fg += fan(1440, 940, 300, 380, '#0c3d5a') + kelp(1560, 1010, 560, '#0a3550', 3.3) + kelp(1500, 1010, 420, '#0c3b57', 0.9)
    fg +=
      branchy(1300, 980, 220, '#0b3a56', 0.5) + dome(1120, 990, 130, 70, '#0a3550', '#2a6a88') + tubes(820, 1000, 1, '#0b3a56', '#062538')
    fg += branchy(640, 1000, 160, '#0b3a56', 0.6)

    // Fish: a far school, a few nearer ones.
    const fish = 'M0 0C7 -7 19 -7 26 0C19 7 7 7 0 0ZM25 0L34 -7L32 0L34 7Z'
    let school = ''
    for (let i = 0; i < 46; i++) {
      const a = rand() * Math.PI * 2
      const d = Math.sqrt(rand())
      const x = 1080 + Math.cos(a) * d * 210
      const y = 420 + Math.sin(a) * d * 90 + (x - 1080) * -0.15
      school += `<use href="#fish" transform="translate(${r(x)} ${r(y)}) scale(${f(-0.45 - rand() * 0.15)} .5)"/>`
    }
    let schoolL = ''
    for (let i = 0; i < 18; i++) {
      schoolL += `<use href="#fish" transform="translate(${r(560 + rand() * 180)} ${r(600 + rand() * 60)}) scale(${f(0.4 + rand() * 0.1)} .45)"/>`
    }
    const accents = [
      [700, 700, 1, '#f2b45a'],
      [744, 726, 0.8, '#f2b45a'],
      [1290, 760, 0.9, '#f08a6a'],
      [420, 520, 1.3, '#6fd6e6'],
    ]
      .map(([x, y, s, c]) => `<use href="#fish" transform="translate(${x} ${y}) scale(${s})" fill="${c}"/>`)
      .join('')

    let snow = ''
    for (let i = 0; i < 90; i++) snow += `<circle cx="${r(rand() * 1600)}" cy="${r(rand() * 950)}" r="${f(0.8 + rand() * 1.8)}"/>`
    let bubbles = ''
    for (const [bx, by] of [
      [250, 700],
      [1380, 640],
    ]) {
      for (let i = 0; i < 12; i++) {
        bubbles += `<circle cx="${r(bx + Math.sin(i * 1.7) * 12)}" cy="${r(by - i * 52 - rand() * 20)}" r="${f(2 + rand() * 5)}"/>`
      }
    }

    // Light rays fanning down from the surface.
    let rays = ''
    for (let i = 0; i < 9; i++) {
      const x0 = 700 + i * 90 + rand() * 40
      const w0 = 20 + rand() * 40
      const spread = (x0 - 1000) * 0.9
      const w1 = w0 * 4
      rays += `<path d="M${r(x0)} -20L${r(x0 + w0)} -20L${r(x0 + spread + w1)} 1000L${r(x0 + spread)} 1000Z" opacity="${f(0.3 + rand() * 0.5)}"/>`
    }

    let surf = ''
    for (let i = 0; i < 6; i++) {
      let d = `M-40 ${r(18 + i * 14)}`
      for (let x = -40; x < 1660;) {
        const w = 50 + r(rand() * 70)
        d += `q${r(w / 2)} ${r(-5 - rand() * 9)} ${w} 0`
        x += w
      }
      surf += `<path d="${d}" stroke-width="${f(2 + rand() * 3)}"/>`
    }

    const gr = grain('gr', 0.05)
    return `<defs>${lg('water', [
      [0, '#7fe0d6'],
      [0.18, '#3cbccb'],
      [0.45, '#1a8db0'],
      [0.75, '#0f5f8f'],
      [1, '#0a3a66'],
    ])}${glow('sun', 0.62, -0.05, 0.6, '#e9fff6', 0.75)}
      ${lg('ray', [
        [0, '#f2fff8', 0.55],
        [0.6, '#e6fff8', 0.12],
        [1, '#e6fff8', 0],
      ])}
      ${lg('depth', [
        [0, '#0a3a66', 0],
        [1, '#062a4c', 0.55],
      ])}
      <symbol id="fish" overflow="visible"><path d="${fish}"/></symbol>
      <radialGradient id="vg" cx=".55" cy=".35" r=".85"><stop offset=".5" stop-color="#04203a" stop-opacity="0"/><stop offset="1" stop-color="#04203a" stop-opacity=".45"/></radialGradient>
      ${blur('rays', 16, 20)}${blur('far', 3)}${blur('mid', 1.4)}${blur('surf', 3)}${blur('b1', 0.6)}<filter id="org" filterUnits="userSpaceOnUse" x="-100" y="-100" width="1800" height="1200"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="5"/><feDisplacementMap in="SourceGraphic" scale="9" xChannelSelector="R" yChannelSelector="G"/></filter>${gr.def}</defs>
      <rect width="1600" height="1000" fill="url(#water)"/><rect width="1600" height="1000" fill="url(#sun)"/>
      <g fill="none" stroke="#f4fff9" opacity=".22" filter="url(#surf)">${surf}</g>
      <g fill="url(#ray)" filter="url(#rays)">${rays}</g>
      <g fill="#1d7898" opacity=".55" filter="url(#far)">${school}</g>
      <path d="${ridge(far, 50)}" fill="#3297ae" opacity=".7" filter="url(#far)"/>
      <g opacity=".7" filter="url(#far)">${farReef}</g>
      <rect y="600" width="1600" height="400" fill="url(#depth)"/>
      <path d="${ridge(mid, 50)}" fill="#1e6d8c"/>
      <g filter="url(#mid)"><g filter="url(#org)">${midReef}</g></g>
      <g fill="#155f80" opacity=".8">${schoolL}</g>
      <g filter="url(#b1)">${accents}</g>
      <g fill="#dffcff" opacity=".35">${snow}</g>
      <g fill="none" stroke="#e8fdff" stroke-width="1.5" opacity=".55">${bubbles}</g>
      <g filter="url(#org)">${fg}</g>
      <rect width="1600" height="1000" fill="url(#vg)"/>${gr.rect}`
  },
}
