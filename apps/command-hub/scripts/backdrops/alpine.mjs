import { glow, lg, pine, rng } from './lib.mjs'

/** Alpine Dawn: snowy ridges, a still lake and pines either side. */
export default {
  id: 'alpine',
  draw() {
    const rand = rng(7)
    let trees = ''
    for (let i = 0; i < 16; i++) trees += pine(rand() * 330, 1010, 220 + rand() * 230, i % 2 ? '#24393b' : '#2d4648')
    for (let i = 0; i < 12; i++) trees += pine(1290 + rand() * 330, 1010, 200 + rand() * 260, i % 2 ? '#24393b' : '#2d4648')
    const caps = [
      [330, 380],
      [520, 340],
      [960, 330],
      [1180, 300],
      [720, 360],
    ]
      .map(
        ([x, y]) =>
          `<path d="M${x - 34} ${y + 36} L${x} ${y} L${x + 36} ${y + 38} L${x + 18} ${y + 30} L${x + 4} ${y + 44} L${x - 12} ${y + 30}Z" fill="#fff" opacity=".85"/>`,
      )
      .join('')
    let ripples = ''
    for (let i = 0; i < 26; i++) {
      ripples += `<rect x="${(300 + rand() * 1000).toFixed(0)}" y="${(790 + rand() * 80).toFixed(0)}" width="${(30 + rand() * 90).toFixed(0)}" height="2" rx="1" fill="#fff" opacity=".35"/>`
    }
    return `<defs>${lg('sky', [
      [0, '#87adc6'],
      [0.55, '#d5e4eb'],
      [1, '#f5e8d8'],
    ])}${glow('sun', 0.68, 0.4, 0.4, '#fff5df', 0.95)}</defs>
      <rect width="1600" height="1000" fill="url(#sky)"/><rect width="1600" height="1000" fill="url(#sun)"/>
      <path d="M0 560 L120 470 L210 520 L330 380 L420 450 L520 340 L610 430 L720 360 L840 470 L960 330 L1060 420 L1180 300 L1290 410 L1400 350 L1500 440 L1600 400 V1000 H0Z" fill="#a7bdcd"/>${caps}
      <path d="M0 650 L150 530 L260 600 L380 505 L520 615 L640 525 L780 630 L900 545 L1040 640 L1180 525 L1320 620 L1460 545 L1600 600 V1000 H0Z" fill="#7d9cb1"/>
      <path d="M0 735 Q200 650 380 712 T760 700 T1140 712 T1600 690 V1000 H0Z" fill="#4e7083"/>
      <rect y="770" width="1600" height="230" fill="#98b9c9"/>${ripples}
      <path d="M0 772 Q400 752 800 776 T1600 766 V786 Q1200 800 800 790 T0 792Z" fill="#3c5a5e"/>
      <path d="M0 905 Q300 865 700 910 T1600 895 V1000 H0Z" fill="#33504a"/>${trees}`
  },
}
