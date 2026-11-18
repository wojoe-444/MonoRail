import { glow, lg, rng } from './lib.mjs'
import { bigCloud, blur, blurU, cloud, cloudFilter, f, fbm, grain, ridge } from './_day-helpers.mjs'

/** Meadow: rolling green hills under a big soft sky, wildflowers thick in the foreground. */
export default {
  id: 'meadow',
  draw() {
    const rand = rng(57)
    const n1 = fbm(rand)
    const n2 = fbm(rand)
    const n3 = fbm(rand)
    const n4 = fbm(rand)
    const n5 = fbm(rand)
    const field = fbm(rand)

    const clouds = [
      [330, 340, 540, 260, 1],
      [1230, 320, 600, 290, 1],
      [820, 470, 300, 70, 2],
      [1560, 500, 260, 60, 2],
      [80, 520, 260, 54, 2],
      [620, 545, 240, 36, 3],
      [1060, 548, 220, 32, 3],
    ]
      .map(([x, y, w, h, d], i) =>
        (d === 1 ? bigCloud : cloud)(
          rand,
          x,
          y,
          w,
          h,
          '#fffef9',
          d === 1 ? '#bccde0' : d === 2 ? '#d0dce8' : '#dde6ec',
          d === 1 ? 'mb2' : `mb${d}`,
          `mc${i}`,
        ),
      )
      .join('')
    let cirrus = ''
    for (let i = 0; i < 7; i++) {
      cirrus += `<ellipse cx="${f(500 + rand() * 900)}" cy="${f(70 + rand() * 120)}" rx="${f(120 + rand() * 180)}" ry="${f(4 + rand() * 5)}" transform="rotate(${f(-4 + rand() * 4)})"/>`
    }

    // Hill lines, far to near.
    const far = (x) => 585 + n1(x / 300) * 34 - Math.sin(x / 520) * 12
    const back = (x) => 625 + n2(x / 260) * 40 + Math.sin(x / 400 + 1) * 18
    const mid = (x) => 690 + n3(x / 320) * 55 + Math.cos(x / 500) * 20
    const near = (x) => 775 + n4(x / 380) * 60 + Math.sin(x / 600 + 2) * 30
    const fore = (x) => 870 + n5(x / 420) * 45

    // Tree clumps along the back and mid hills.
    let trees = ''
    const clump = (x, y, s, dark, lit) => {
      let c = ''
      for (let k = 0; k < 4; k++) {
        const dx = (rand() - 0.5) * s * 1.6
        const r = s * (0.55 + rand() * 0.4)
        c += `<circle cx="${f(x + dx)}" cy="${f(y - r * 0.9)}" r="${f(r)}" fill="${dark}"/><circle cx="${f(x + dx - r * 0.18)}" cy="${f(y - r * 1.1)}" r="${f(r * 0.7)}" fill="${lit}"/>`
      }
      return c
    }
    for (let i = 0; i < 26; i++) {
      const x = rand() * 1600
      trees += clump(x, back(x) + 4, 6 + rand() * 5, '#7b9a83', '#8fae8c')
    }
    for (const x of [180, 260, 1130, 1190, 1420]) trees += clump(x, mid(x) + 6, 16 + rand() * 8, '#4f7a45', '#6c9650')

    // Flowers: dense swaths on the near slopes, larger toward the bottom.
    const cols = ['#fffaf0', '#fffaf0', '#f7d64a', '#f4a6bf', '#a991e6', '#ffffff', '#f7d64a', '#e85d4e']
    const bucket = {}
    const put = (c, s) => (bucket[c] = (bucket[c] || '') + s)
    let flowers = ''
    let stems = ''
    for (let i = 0; i < 760; i++) {
      const x = rand() * 1640 - 20
      const top = near(x)
      const y = top + 8 + rand() ** 0.8 * (1010 - top)
      const t = (y - 760) / 240
      if (field(x / 220 + y / 160) + rand() * 0.9 < 0.15 + (1 - t) * 0.2) continue
      const r = 1 + Math.max(0, t) ** 1.6 * 6 + rand()
      const c = cols[Math.floor(rand() * cols.length)]
      if (r > 3.5) stems += `M${f(x)} ${f(y)}v${f(r * 2.2)}`
      flowers +=
        r > 4.2 && (c === '#fffaf0' || c === '#ffffff')
          ? `<use href="#daisy" transform="translate(${f(x)} ${f(y)}) scale(${f(r / 6)} ${f(r / 9)})"/>`
          : (put(c, `<circle cx="${Math.round(x)}" cy="${Math.round(y)}" r="${f(r)}"/>`), '')
    }
    let mids = ''
    for (let i = 0; i < 160; i++) {
      const x = rand() * 1600
      const top = mid(x)
      const y = top + 10 + rand() * 90
      if (y > near(x) - 4) continue
      put(cols[Math.floor(rand() * 6)], `<circle cx="${Math.round(x)}" cy="${Math.round(y)}" r="${f(0.8 + rand() * 1.2)}"/>`)
    }

    flowers += Object.entries(bucket)
      .map(([c, s]) => `<g fill="${c}">${s}</g>`)
      .join('')

    // Soft cloud shadows on the slopes.
    const shadows = [
      [520, 760, 260, 30],
      [1240, 700, 220, 18],
      [980, 820, 300, 34],
    ]
      .map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`)
      .join('')

    // Grass blades along the bottom.
    const blades = ['', '', '']
    for (let i = 0; i < 420; i++) {
      const x = rand() * 1640 - 20
      const y = 1004
      const h = 40 + rand() * 90 * (0.6 + Math.abs(field(x / 90)))
      const lean = (rand() - 0.5) * 60
      blades[i % 3] += `M${f(x)} ${y}q${f(lean * 0.3)} ${f(-h * 0.6)} ${f(lean)} ${f(-h)}`
    }

    // Out-of-focus blossoms in the bottom corners.
    let bokeh = ''
    for (const [x, y, r, c] of [
      [90, 930, 30, '#fffaf0'],
      [190, 975, 22, '#f7d64a'],
      [30, 860, 18, '#e85d4e'],
      [1500, 950, 34, '#fffaf0'],
      [1405, 985, 20, '#f4a6bf'],
      [1575, 860, 20, '#a991e6'],
    ]) {
      bokeh += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".85"/><circle cx="${x}" cy="${y}" r="${f(r * 0.32)}" fill="#e9b53a" opacity=".9"/>`
    }

    const gr = grain('gr', 0.05)
    return `<defs>${lg('sky', [
      [0, '#5f9fd8'],
      [0.45, '#9dc6e9'],
      [0.85, '#e4eee6'],
      [1, '#f3f0dc'],
    ])}${glow('sun', 0.78, 0.08, 0.6, '#fffbe3', 0.85)}
      ${lg('hf', [
        [0, '#a9c1c4'],
        [1, '#bccfc4'],
      ])}
      ${lg('hb', [
        [0, '#9ebd96'],
        [1, '#a6c29a'],
      ])}
      ${lg('hm', [
        [0, '#b2d46c'],
        [0.5, '#8fb853'],
        [1, '#76a446'],
      ])}
      ${lg('hn', [
        [0, '#98c657'],
        [0.5, '#73a843'],
        [1, '#548c34'],
      ])}
      <clipPath id="cm"><path d="${ridge(mid, 50)}"/></clipPath><clipPath id="cn"><path d="${ridge(near, 50)}"/></clipPath>
      <symbol id="daisy" overflow="visible"><g fill="#fffdf6">${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<ellipse cy="-3.6" rx="1.6" ry="3.6" transform="rotate(${k * 45})"/>`).join('')}</g><circle r="1.9" fill="#f2c230"/></symbol>
      ${lg('ho', [
        [0, '#6fa443'],
        [1, '#3f7a2c'],
      ])}
      ${lg('mist', [
        [0, '#f1f3e2', 0],
        [0.6, '#f1f3e2', 0.55],
        [1, '#f1f3e2', 0],
      ])}
      <radialGradient id="vg" cx=".5" cy=".45" r=".85"><stop offset=".6" stop-color="#1d3a2a" stop-opacity="0"/><stop offset="1" stop-color="#1d3a2a" stop-opacity=".22"/></radialGradient>
      ${cloudFilter('mb1', 80, 0.009, 2)}${cloudFilter('mb2', 50, 0.014, 2.5, 7)}${cloudFilter('mb3', 30, 0.02, 2.5, 9)}${blurU('cir', 10)}${blur('soft', 8)}${blur('bk', 7, 60)}${blur('b1', 0.6)}${gr.def}</defs>
      <rect width="1600" height="1000" fill="url(#sky)"/><rect width="1600" height="1000" fill="url(#sun)"/>
      <g fill="#fff" opacity=".35" filter="url(#cir)">${cirrus}</g>${clouds}
      <path d="${ridge(far, 50)}" fill="url(#hf)"/>
      <rect y="560" width="1600" height="80" fill="url(#mist)"/>
      <path d="${ridge(back, 50)}" fill="url(#hb)"/>
      <g filter="url(#b1)">${trees}</g>
      <rect y="620" width="1600" height="70" fill="url(#mist)" opacity=".6"/>
      <path d="${ridge(mid, 50)}" fill="url(#hm)"/><g clip-path="url(#cm)"><path d="${ridge((x) => mid(x) + 16, 50)}" fill="none" stroke="#e2f2a0" stroke-width="26" opacity=".4" filter="url(#soft)"/><g fill="#3e6a2c" opacity=".16" filter="url(#soft)">${shadows}</g></g>${mids}
      <path d="${ridge(near, 50)}" fill="url(#hn)"/><g clip-path="url(#cn)"><path d="${ridge((x) => near(x) + 18, 50)}" fill="none" stroke="#d5ec8c" stroke-width="30" opacity=".35" filter="url(#soft)"/></g>
      <path d="${ridge(fore, 50)}" fill="url(#ho)" opacity=".85"/>
      <path d="${stems}" stroke="#3f7a2c" stroke-width="1.5"/>${flowers}
      <g fill="none" stroke-linecap="round"><path d="${blades[0]}" stroke="#3a7029" stroke-width="2.4"/><path d="${blades[1]}" stroke="#528a35" stroke-width="2"/><path d="${blades[2]}" stroke="#6fa448" stroke-width="1.6"/></g>
      <g filter="url(#bk)">${bokeh}</g>
      <rect width="1600" height="1000" fill="url(#vg)"/>${gr.rect}`
  },
}
