import { glow, lg, rng } from './lib.mjs'
import { blur, f, grain, taper } from './_day-helpers.mjs'

const int = (d) => d.replace(/-?d+.d+/g, (m) => String(Math.round(+m)))

/** Cherry Blossom: ink-wash branches in bloom over cream and blush paper, petals drifting. */
export default {
  id: 'cherry-blossom',
  draw() {
    const rand = rng(88)
    const branches = []
    const blooms = []
    const dots = []

    // A branch grows in short kinked segments, tapering, and forks into twigs that end in blossom.
    const grow = (x, y, ang, len, w, depth, bend) => {
      const segs = depth === 0 ? 9 : depth === 1 ? 6 : 4
      const pts = [[x, y, w]]
      for (let i = 1; i <= segs; i++) {
        ang += (rand() - 0.5) * (depth === 0 ? 0.42 : 0.75) + bend
        const l = len / segs
        x += Math.cos(ang) * l
        y += Math.sin(ang) * l
        const ww = w * (1 - (i / segs) * 0.7) * (0.85 + rand() * 0.3)
        pts.push([x, y, ww])
        if (depth < 3 && i < segs && rand() < (depth === 0 ? 0.62 : 0.45)) {
          const side = rand() < 0.5 ? -1 : 1
          // Keep the middle of the window (where the page sits) light: twigs there stay short.
          const room = Math.min(1, Math.max(0.3, Math.hypot((x - 850) / 1.4, y - 520) / 480))
          grow(x, y, ang + side * (0.45 + rand() * 0.6), len * (0.35 + rand() * 0.3) * room, ww * 0.7, depth + 1, bend * 0.5 + side * 0.03)
        }
        if (depth >= 1 && rand() < 0.4) blooms.push([x + (rand() - 0.5) * 24, y + (rand() - 0.5) * 24, depth])
        if (rand() < 0.35) dots.push([x + (rand() - 0.5) * ww, y + (rand() - 0.5) * ww, 1.5 + rand() * ww * 0.12])
      }
      branches.push([pts, depth])
      // A cluster of flowers at the tip.
      const n = depth >= 2 ? 4 + Math.floor(rand() * 4) : 2
      for (let k = 0; k < n; k++) blooms.push([x + (rand() - 0.5) * 80, y + (rand() - 0.5) * 64, depth])
    }
    grow(-40, 150, 0.08, 1100, 40, 0, 0.012)
    grow(-30, 420, -0.5, 420, 22, 1, 0.03)
    grow(1650, 700, Math.PI + 0.32, 760, 36, 0, -0.018)
    const near = branches.map(([pts]) => `<path d="${int(taper(pts))}"/>`).join('')
    const dry = branches
      .filter(([, d]) => d <= 1)
      .map(([pts]) => `<path d="${int(taper(pts.map(([x, y, w]) => [x - w * 0.1, y - w * 0.16, w * 0.32])))}"/>`)
      .join('')
    const nearBlooms = blooms.splice(0)

    // A faint far branch in thin, pale ink for depth.
    const nb = branches.length
    grow(1660, 90, Math.PI - 0.1, 620, 16, 1, -0.02)
    const far = branches
      .slice(nb)
      .map(([pts]) => `<path d="${int(taper(pts))}"/>`)
      .join('')
    const farBlooms = blooms.splice(0)

    const pinks = ['#f4b6c2', '#f7c8d1', '#efa3b5', '#fbdfe4', '#f9d2da', '#ffffff']
    const bloomGroup = (list, attrs = '') => {
      const by = {}
      for (const b of list) {
        const [c, s] = flower(b)
        by[c] = (by[c] || '') + s
      }
      return `<g${attrs}>${Object.entries(by)
        .map(([c, s]) => `<g fill="${c}">${s}</g>`)
        .join('')}</g>`
    }
    const flower = ([x, y, d]) => {
      const s = (d >= 2 ? 1.55 : 1.8) * (0.7 + rand() * 0.6)
      const kind = rand()
      const c = pinks[Math.floor(rand() * pinks.length)]
      return kind < 0.18
        ? [
            c,
            `<use href="#bud" transform="translate(${Math.round(x)} ${Math.round(y)}) rotate(${Math.round(rand() * 360)}) scale(${f(s)})"/>`,
          ]
        : [
            c,
            `<use href="#fl" transform="translate(${Math.round(x)} ${Math.round(y)}) rotate(${Math.round(rand() * 72)}) scale(${f(s)})"/>`,
          ]
    }
    // Some blossoms sit behind the branch, most in front.
    const back = nearBlooms.filter(() => rand() < 0.3)
    const front = nearBlooms.filter((b) => !back.includes(b))

    let petals = ''
    for (let i = 0; i < 54; i++) {
      const x = rand() * 1600
      const y = rand() * 1000
      // Fewer petals in the middle where the page sits.
      if (Math.abs(x - 860) < 420 && Math.abs(y - 520) < 280 && rand() < 0.7) continue
      petals += `<use href="#pt" transform="translate(${f(x)} ${f(y)}) rotate(${Math.round(rand() * 360)}) scale(${f(0.8 + rand() * 1.1)} ${f(0.6 + rand() * 0.6)})" fill="${pinks[Math.floor(rand() * 5)]}" opacity="${f(0.55 + rand() * 0.4)}"/>`
    }

    let washes = ''
    for (const [x, y, rx, ry, c, o] of [
      [1250, 260, 520, 300, '#f5c9cc', 0.45],
      [300, 820, 600, 260, '#f2d3c8', 0.4],
      [900, 520, 500, 260, '#fbeee4', 0.5],
      [1450, 900, 400, 200, '#efc2c6', 0.35],
    ])
      washes += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" opacity="${o}"/>`

    const petal = 'M0 0C-5.5 -2.5 -7 -9.5 -2.6 -11.2L0 -9.4L2.6 -11.2C7 -9.5 5.5 -2.5 0 0Z'
    const gr = grain('gr', 0.07, 0.75, '0.35 0.25 0.2')
    return `<defs>${lg('paper', [
      [0, '#f8f0e3'],
      [0.6, '#f6e8dc'],
      [1, '#f2dcd2'],
    ])}${glow('sun', 0.77, 0.25, 0.12, '#e98f86', 0.42)}
      <symbol id="fl" overflow="visible"><g>${[0, 72, 144, 216, 288].map((r) => `<path d="${petal}" transform="rotate(${r})"/>`).join('')}</g><g stroke="#b2455e" stroke-width=".6" stroke-linecap="round">${[0, 40, 80, 120, 160, 200, 240, 280, 320].map((r) => `<path d="M0 0L0 -4.6" transform="rotate(${r})"/>`).join('')}</g><circle r="1.6" fill="#c2405e"/></symbol>
      <symbol id="bud" overflow="visible"><path d="M0 0C-3 -2 -3.5 -7 0 -9C3.5 -7 3 -2 0 0Z"/><path d="M0 0L-2 2.5M0 0L2 2.5" stroke="#5b4a40" stroke-width="1"/></symbol>
      <symbol id="pt" overflow="visible"><path d="M0 5C-5 2 -5 -4 -1.5 -5.5L0 -4.2L1.5 -5.5C5 -4 5 2 0 5Z"/></symbol>
      ${blur('wash', 60, 60)}${blur('bleed', 2.6)}${blur('far', 3)}${blur('soft', 0.5)}${blur('mtn', 14)}${blur('pb', 1.2)}${gr.def}<g id="br">${near}</g>
      <filter id="ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".04 .3" numOctaves="3" seed="8"/><feDisplacementMap in="SourceGraphic" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter></defs>
      <rect width="1600" height="1000" fill="url(#paper)"/>
      <g filter="url(#wash)">${washes}</g>
      <circle cx="1230" cy="250" r="105" fill="#ec9a90" opacity=".3" filter="url(#pb)"/><rect width="1600" height="1000" fill="url(#sun)"/>
      <g filter="url(#mtn)" fill="#8e8f98"><path d="M300 1000 L520 760 Q560 720 600 760 L760 880 L900 780 Q940 750 980 790 L1200 1000Z" opacity=".12"/><path d="M700 1000 L980 830 Q1020 810 1060 840 L1300 960 L1450 870 Q1480 860 1510 880 L1700 1000Z" opacity=".1"/></g>
      <g fill="#7b6f6c" opacity=".35" filter="url(#far)">${far}</g>
      ${bloomGroup(farBlooms, ' opacity=".45" filter="url(#far)"')}
      ${bloomGroup(back, ' filter="url(#soft)" opacity=".85"')}
      <use href="#br" fill="#2e2523" opacity=".35" filter="url(#bleed)"/>
      <use href="#br" fill="#3a2f2b" filter="url(#ink)"/><g fill="#a08e84" opacity=".55" filter="url(#ink)">${dry}</g>
      <g fill="#1e1715">${dots.map(([x, y, r]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 1.4)}" ry="${f(r)}"/>`).join('')}</g>
      ${bloomGroup(front, ' filter="url(#soft)"')}
      <g filter="url(#soft)">${petals}</g>${gr.rect}`
  },
}
