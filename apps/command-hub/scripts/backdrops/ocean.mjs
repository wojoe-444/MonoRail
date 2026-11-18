import { lg, wave } from './lib.mjs'

/** Ocean Swell: rows of swells with foam lines under a pale sky. */
export default {
  id: 'ocean',
  draw() {
    const layers = [
      [470, 10, 140, '#79b4c0'],
      [540, 16, 190, '#5a9fb1'],
      [620, 22, 240, '#3f879e'],
      [710, 30, 300, '#2d6e88'],
      [810, 40, 380, '#1f5671'],
      [910, 52, 460, '#16405a'],
    ]
    const body = layers
      .map(
        ([y, a, l, c], i) =>
          `<g transform="translate(${-i * 37} 0)"><path d="${wave(y, a, l)}" fill="${c}"/><path d="${wave(y, a, l, false)}" fill="none" stroke="#fff" stroke-width="${1.5 + i * 0.6}" opacity=".45"/></g>`,
      )
      .join('')
    return `<defs>${lg('sky', [
      [0, '#fde7d3'],
      [0.5, '#d7edee'],
      [1, '#b9dde2'],
    ])}</defs>
      <rect width="1600" height="1000" fill="url(#sky)"/><circle cx="420" cy="290" r="130" fill="#fff4e2" opacity=".25"/><circle cx="420" cy="290" r="72" fill="#fff4e2" opacity=".9"/>
      <path d="M1180 230 q40 -30 80 0 q30 -25 60 5 q35 0 30 30 h-200 q-5 -30 30 -35Z" fill="#fff" opacity=".7"/>
      <rect y="420" width="1600" height="580" fill="#8cc1cb"/>${body}`
  },
}
