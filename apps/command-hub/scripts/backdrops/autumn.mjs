import { lg, rng } from './lib.mjs'

/** Autumn Hills: storybook rolling hills with round and cypress trees. */
export default {
  id: 'autumn',
  draw() {
    const rand = rng(11)
    const cols = ['#c4602f', '#dca048', '#8b8a3e', '#b4522c', '#e2b24f']
    const f = (n) => n.toFixed(1)
    let trees = ''
    for (let i = 0; i < 22; i++) {
      const x = rand() * 1600
      const y = 640 + rand() * 170
      const s = 0.6 + (y - 620) / 260
      trees +=
        rand() < 0.35
          ? `<rect x="${f(x - 2)}" y="${f(y - 10)}" width="4" height="${f(24 * s)}" fill="#4a3624"/><ellipse cx="${f(x)}" cy="${f(y - 50 * s)}" rx="${f(13 * s)}" ry="${f(46 * s)}" fill="#4f5a2e"/>`
          : `<rect x="${f(x - 2.5)}" y="${f(y - 12)}" width="5" height="${f(30 * s)}" fill="#4a3624"/><circle cx="${f(x)}" cy="${f(y - 30 * s)}" r="${f(24 * s)}" fill="${cols[i % cols.length]}"/>`
    }
    const birds = [
      [300, 220],
      [340, 240],
      [372, 212],
      [1320, 330],
      [1350, 316],
    ]
      .map(
        ([x, y]) => `<path d="M${x} ${y} q8 -8 16 0 q8 -8 16 0" fill="none" stroke="#7a5a3a" stroke-width="2.5" stroke-linecap="round"/>`,
      )
      .join('')
    return `<defs>${lg('sky', [
      [0, '#f7ecd6'],
      [1, '#f0d4a6'],
    ])}</defs>
      <rect width="1600" height="1000" fill="url(#sky)"/><circle cx="1200" cy="250" r="140" fill="#f7cf82" opacity=".35"/><circle cx="1200" cy="250" r="80" fill="#f4bf62"/>${birds}
      <path d="M0 560 C300 470 600 520 900 540 S1400 460 1600 500 V1000 H0Z" fill="#dfc191"/>
      <path d="M0 640 C250 560 520 600 780 650 S1300 560 1600 620 V1000 H0Z" fill="#d29c60"/>
      <path d="M0 730 C300 650 650 700 950 740 S1400 680 1600 710 V1000 H0Z" fill="#b97b42"/>
      <path d="M0 830 C350 760 700 810 1050 840 S1450 790 1600 810 V1000 H0Z" fill="#8c6a3a"/>${trees}
      <path d="M0 930 C400 880 800 920 1200 945 S1500 925 1600 930 V1000 H0Z" fill="#5e4630"/>`
  },
}
