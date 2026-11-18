import { lg, rng } from './lib.mjs'
import { blur, blurU, fbm, f0, fir, grainDefs, grainRect, rg, ridge, vignette } from './_mood-helpers.mjs'

/** Misty Pines: layered pine ridges in blue-hour fog, a warm light deep in the trees. */
export default {
  id: 'misty-pines',
  draw() {
    const rand = rng(2024)

    // One forest layer: a rolling ridge with firs standing on it, as a single path.
    const layer = (base, amp, n, hMin, hMax, tiers, x0 = -40, x1 = 1640, skip = null) => {
      const f = fbm(rand, 3, 3)
      const yAt = (x) => base - f(x / 1600) * amp
      let d = ridge(yAt, 20)
      for (let i = 0; i < n; i++) {
        const x = x0 + ((i + rand() * 0.9) / n) * (x1 - x0)
        if (skip && skip(x)) continue
        const h = hMin + rand() * (hMax - hMin)
        d += fir(rand, x, yAt(x) + h * 0.06, h, h * (0.3 + rand() * 0.12), tiers)
      }
      return d
    }

    const L1 = layer(560, 70, 110, 16, 40, 3)
    const L2 = layer(640, 80, 80, 34, 80, 4)
    const L3 = layer(730, 70, 56, 70, 150, undefined)
    const L4 = layer(830, 60, 34, 130, 260, undefined)
    // Near: tall firs crowding the edges, a clearing in the middle.
    const L5 =
      layer(960, 40, 9, 420, 760, undefined, -60, 380) +
      layer(970, 40, 8, 380, 720, undefined, 1240, 1680) +
      layer(1000, 30, 10, 90, 180, undefined, 380, 1240)

    // Fog bands between the layers.
    const fog = (y, h, op, n) => {
      let s = ''
      for (let i = 0; i < n; i++)
        s += `<ellipse cx="${f0(rand() * 1600)}" cy="${f0(y + (rand() - 0.5) * h)}" rx="${f0(260 + rand() * 320)}" ry="${f0(h * (0.4 + rand() * 0.4))}" fill="#b9d4d6" opacity="${(op * (0.6 + rand() * 0.6)).toFixed(2)}"/>`
      return s
    }

    let stars = ''
    for (let i = 0; i < 70; i++)
      stars += `<circle cx="${f0(rand() * 1600)}" cy="${f0(rand() * 300)}" r="${(0.5 + rand() * 1.1).toFixed(1)}" fill="#e8f2ff" opacity="${(0.2 + rand() * 0.5).toFixed(2)}"/>`

    // Warm light deep in the trees: a cabin window and its glow in the fog.
    const LX = 1090
    const LY = 715
    const light = `<rect x="${LX - 9}" y="${LY - 8}" width="7" height="9" fill="#ffd28a"/><rect x="${LX + 2}" y="${LY - 8}" width="7" height="9" fill="#ffc370"/>`

    return `<defs>${lg('sky', [
      [0, '#040b17'],
      [0.3, '#0a1c2e'],
      [0.5, '#163445'],
      [0.6, '#2a5562'],
      [1, '#1a3640'],
    ])}${lg('l1', [
      [0, '#2c5560'],
      [1, '#2c5560'],
    ])}${lg('l2', [
      [0, '#1f424c'],
      [1, '#1f424c'],
    ])}${lg('l3', [
      [0, '#15323b'],
      [1, '#15323b'],
    ])}${lg('l4', [
      [0, '#0c242b'],
      [1, '#0c242b'],
    ])}${rg('dusk', 520, 560, 720, [
      [0, '#7fb0b4', 0.35],
      [0.5, '#3f7480', 0.12],
      [1, '#1b3d4e', 0],
    ])}
      ${rg('warm', LX, LY, 460, [
        [0, '#ffb35c', 0.7],
        [0.12, '#ff9a4a', 0.38],
        [0.4, '#c86a3a', 0.12],
        [1, '#c86a3a', 0],
      ])}
      ${rg('warmcore', LX, LY, 60, [
        [0, '#ffd9a0', 0.9],
        [1, '#ffb35c', 0],
      ])}
      ${['#4f7e86:.85', '#3a6670:.8', '#2b535c:.75', '#1e4048:.7']
        .map((c, i) =>
          lg(`mist${i}`, [
            [0, c.split(':')[0], 0],
            [0.3, c.split(':')[0], +c.split(':')[1]],
            [1, c.split(':')[0], +c.split(':')[1] * 0.9],
          ]),
        )
        .join(
          '',
        )}${vignette(0.55, '#020a10')}${blurU('fog', 28)}${blurU('fog2', 40)}${blur('soft', 1.6)}${blur('b8', 8)}${grainDefs()}</defs>
      <rect width="1600" height="1000" fill="url(#sky)"/><rect width="1600" height="1000" fill="url(#dusk)"/>${stars}
      <path d="${L1}" fill="url(#l1)" filter="url(#soft)"/>
      <rect y="480" width="1600" height="520" fill="url(#mist0)"/><g filter="url(#fog2)">${fog(600, 50, 0.16, 8)}</g>
      <path d="${L2}" fill="url(#l2)"/>
      <rect y="560" width="1600" height="440" fill="url(#mist1)"/><g filter="url(#fog2)">${fog(680, 50, 0.14, 8)}</g>
      <path d="${L3}" fill="url(#l3)"/>
      <rect y="620" width="1600" height="380" fill="url(#mist2)"/><rect width="1600" height="1000" fill="url(#warm)"/>
      <g filter="url(#b8)" opacity=".9">${light}</g>${light}
      <circle cx="${LX}" cy="${LY}" r="60" fill="url(#warmcore)"/>
      <g filter="url(#fog)">${fog(770, 60, 0.12, 9)}</g>
      <path d="${L4}" fill="url(#l4)"/>
      <rect y="720" width="1600" height="280" fill="url(#mist3)"/><g filter="url(#fog)">${fog(890, 70, 0.1, 8)}</g>
      <path d="${L5}" fill="#061418"/>
      <rect width="1600" height="1000" fill="url(#vig)"/>${grainRect(0.045)}`
  },
}
