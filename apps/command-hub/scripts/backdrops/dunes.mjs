import { glow, lg } from './lib.mjs'

/** Dune Sunset: layered dunes under a low sun. */
export default {
  id: 'dunes',
  draw() {
    let rip = ''
    for (let i = 0; i < 9; i++) {
      rip += `<path d="M${200 + i * 60} ${860 - i * 6} q160 -40 330 -6" fill="none" stroke="#f6c9a0" stroke-width="2" opacity=".45"/>`
    }
    return `<defs>${lg('sky', [
      [0, '#f8deb0'],
      [0.45, '#f3b383'],
      [0.7, '#e48d6e'],
    ])}${glow('sun', 0.69, 0.43, 0.3, '#fff4d8')}${lg('near', [
      [0, '#c9784a'],
      [1, '#a95d36'],
    ])}</defs>
      <rect width="1600" height="1000" fill="url(#sky)"/><rect width="1600" height="1000" fill="url(#sun)"/><circle cx="1100" cy="430" r="105" fill="#fff1d2" opacity=".92"/>
      <path d="M0 600 C200 540 400 560 600 590 S1000 520 1200 560 S1500 600 1600 570 V1000 H0Z" fill="#eaa97a"/>
      <path d="M0 690 C250 600 500 620 700 690 S1100 640 1350 660 S1550 700 1600 690 V1000 H0Z" fill="#d98b5a"/>
      <path d="M700 690 C820 650 960 640 1100 650 C980 690 860 720 700 690Z" fill="#c4744a" opacity=".7"/>
      <path d="M0 830 C300 700 600 760 820 830 S1300 760 1600 800 V1000 H0Z" fill="url(#near)"/>${rip}
      <path d="M0 935 C400 865 900 905 1200 955 S1500 945 1600 935 V1000 H0Z" fill="#8f4e2f"/>`
  },
}
