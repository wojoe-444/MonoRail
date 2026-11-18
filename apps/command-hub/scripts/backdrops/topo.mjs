/** Field Map: a pen-drawn contour map on survey paper; a blueprint at night. */
export default {
  id: 'topo',
  dark: true,
  draw(dark) {
    const paper = dark ? '#0f2236' : '#f3eee2'
    const grid = dark ? '#1b3651' : '#e0d6c0'
    const line = dark ? '#4e79a3' : '#b9a383'
    const mark = dark ? '#f0a35e' : '#d0702f'
    let g = ''
    for (let x = 0; x <= 1600; x += 80) g += `<path d="M${x} 0V1000" stroke="${grid}"/>`
    for (let y = 0; y <= 1000; y += 80) g += `<path d="M0 ${y}H1600" stroke="${grid}"/>`
    let c = ''
    const peaks = [
      [420, 380, 15, 1.3, 0.4],
      [1180, 300, 13, 1.5, 2.1],
      [900, 820, 11, 1.2, 4.2],
      [80, 900, 8, 1.1, 1.0],
    ]
    for (const [cx, cy, n, sx, ph] of peaks) {
      for (let k = 1; k <= n; k++) {
        let d = ''
        for (let a = 0; a <= 72; a++) {
          const t = (a / 72) * Math.PI * 2
          const rr = k * 26 * (1 + 0.2 * Math.sin(3 * t + ph + k * 0.18) + 0.1 * Math.sin(5 * t + ph * 2 + k * 0.11))
          d += `${a ? 'L' : 'M'}${(cx + Math.cos(t) * rr * sx).toFixed(1)} ${(cy + Math.sin(t) * rr).toFixed(1)}`
        }
        const index = k % 5 === 0
        c += `<path d="${d}Z" fill="none" stroke="${line}" stroke-width="${index ? 2.4 : 1.2}" opacity="${index ? 0.9 : 0.6}"/>`
      }
    }
    const pin = (x, y) =>
      `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${mark}" stroke-width="3"/><path d="M${x - 14} ${y}h-10M${x + 14} ${y}h10M${x} ${y - 14}v-10M${x} ${y + 14}v10" stroke="${mark}" stroke-width="2.5"/>`
    return `<rect width="1600" height="1000" fill="${paper}"/>${g}${c}${pin(420, 380)}${pin(1180, 300)}`
  },
}
