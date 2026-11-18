import { lg, pine, rng, stars } from './lib.mjs'

/** Aurora: northern lights and stars over a pine ridge. Already a night picture, so it dims very little. */
export default {
  id: 'aurora',
  draw() {
    const rand = rng(42)
    const sky = stars(rand, 170)
    let trees = ''
    for (let i = 0; i < 40; i++) trees += pine(rand() * 1600, 1000 - rand() * 60, 70 + rand() * 130, '#040a12')
    return `<defs>${lg('sky', [
      [0, '#050d1c'],
      [0.6, '#0c2236'],
      [1, '#14384c'],
    ])}${lg(
      'au',
      [
        [0, '#5cf2b0'],
        [0.5, '#3cc7d6'],
        [1, '#9a72f2'],
      ],
      1,
      0,
    )}
      <filter id="blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="22"/></filter></defs>
      <rect width="1600" height="1000" fill="url(#sky)"/>${sky}
      <g filter="url(#blur)" fill="none" stroke="url(#au)" stroke-linecap="round">
        <path d="M-100 430 C300 250 620 500 920 330 S1420 210 1700 330" stroke-width="95" opacity=".55"/>
        <path d="M-100 330 C260 200 560 360 860 250 S1380 160 1700 240" stroke-width="40" opacity=".45"/>
        <path d="M200 520 C500 420 800 520 1100 430 S1500 380 1700 420" stroke-width="30" opacity=".3"/></g>
      <path d="M0 760 L180 640 L300 700 L460 560 L600 680 L760 600 L900 720 L1080 590 L1220 690 L1380 610 L1600 700 V1000 H0Z" fill="#0b1828"/>
      <path d="M0 870 Q400 790 800 860 T1600 840 V1000 H0Z" fill="#07101a"/>${trees}`
  },
}
