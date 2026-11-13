// Flavor palettes for the mochi crew. Each flavor is three numbers (OKLCH
// hue, chroma, lightness shift); expandFlavor() derives every color from
// them, the same way lib/palettes.ts expands a color scheme. The accessory
// color is stepped until it reaches 3:1 contrast against its own tile, and
// dark tiles get a light accessory instead.

export interface MochiPalette {
  t0: string
  t1: string
  b0: string
  b1: string
  acc: string
  pop: string
  onacc: string
}

/** name, hue, chroma, lightness shift. Sorted by hue family, pink to neutrals. */
export const FLAVORS: readonly [name: string, hue: number, chroma: number, light: number][] = [
  ["Sakura", 8, 0.1, 0.04],
  ["Strawberry", 22, 0.15, -0.02],
  ["Raspberry", 2, 0.16, -0.06],
  ["Ume", 350, 0.12, -0.03],
  ["Hibiscus", 335, 0.15, -0.06],
  ["Watermelon", 18, 0.14, 0.02],
  ["Persimmon", 42, 0.15, -0.01],
  ["Mango", 58, 0.14, 0.03],
  ["Peach", 48, 0.09, 0.07],
  ["Apricot", 65, 0.12, 0.04],
  ["Pumpkin", 52, 0.13, -0.05],
  ["Mikan", 68, 0.15, 0.0],
  ["Yuzu", 88, 0.13, 0.07],
  ["Lemon", 100, 0.13, 0.09],
  ["Honey", 78, 0.13, 0.01],
  ["Banana", 95, 0.09, 0.1],
  ["Matcha", 140, 0.08, -0.04],
  ["Pistachio", 128, 0.09, 0.04],
  ["Mint", 165, 0.08, 0.05],
  ["Kiwi", 125, 0.13, -0.02],
  ["Melon", 150, 0.11, 0.03],
  ["Shiso", 158, 0.09, -0.09],
  ["Edamame", 135, 0.11, -0.01],
  ["Ramune", 245, 0.09, -0.01],
  ["Sea salt", 205, 0.06, 0.05],
  ["Butterfly pea", 265, 0.12, -0.06],
  ["Soda", 215, 0.1, 0.02],
  ["Blueberry", 270, 0.1, -0.1],
  ["Yuki", 225, 0.05, 0.08],
  ["Ube", 300, 0.1, -0.03],
  ["Lavender", 295, 0.07, 0.06],
  ["Taro", 315, 0.06, 0.03],
  ["Grape", 310, 0.12, -0.08],
  ["Cassis", 330, 0.1, -0.12],
  ["Kinako", 65, 0.07, -0.01],
  ["Hojicha", 50, 0.06, -0.08],
  ["Chocolate", 40, 0.05, -0.18],
  ["Caramel", 62, 0.09, -0.04],
  ["Kuri", 55, 0.05, 0.03],
  ["Earl grey", 250, 0.02, -0.04],
  ["Black sesame", 240, 0.012, -0.2],
  ["White sesame", 80, 0.015, 0.1],
]

/** The app icon's own colors, kept exact for the Coordinator. */
const CLASSIC: MochiPalette = { t0: '#6f9a72', t1: '#3d6b52', b0: '#f8f1e0', b1: '#dccaa4', acc: '#24503a', pop: '#ffcf7a', onacc: '#ffffff' }

export const FLAVOR_NAMES = ['Classic', ...FLAVORS.map((f) => f[0])]

type RGB = [number, number, number]

function oklchToLinear(L: number, C: number, h: number): RGB {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** Linear sRGB, chroma reduced until it fits the gamut. */
function color(L: number, C: number, h: number): RGB {
  let rgb = oklchToLinear(L, C, h)
  while (!rgb.every((v) => v >= -1e-4 && v <= 1.0001) && C > 0.001) {
    C *= 0.95
    rgb = oklchToLinear(L, C, h)
  }
  return rgb.map((v) => Math.min(1, Math.max(0, v))) as RGB
}

function hex(rgb: RGB): string {
  const enc = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)
  return '#' + rgb.map((v) => Math.round(enc(v) * 255).toString(16).padStart(2, '0')).join('')
}

const lum = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export function expandFlavor(h: number, c: number, dl: number): MochiPalette {
  const t0 = color(0.72 + dl, c, h)
  const t1 = color(0.53 + dl, c * 1.05, h)
  const mid = t0.map((v, i) => (v + t1[i]) / 2) as RGB
  const darkTile = 0.53 + dl < 0.42
  let L = darkTile ? 0.8 : 0.36
  let acc = color(L, Math.max(c * (darkTile ? 0.6 : 0.85), 0.03), h)
  while (contrast(acc, mid) < 3 && L > 0.12 && L < 0.97) {
    L += darkTile ? 0.02 : -0.02
    acc = color(L, Math.max(c * (darkTile ? 0.6 : 0.85), 0.03), h)
  }
  return {
    t0: hex(t0),
    t1: hex(t1),
    b0: hex(color(0.975, Math.min(c * 0.3, 0.04), h)),
    b1: hex(color(0.885, Math.min(c * 0.55, 0.07), h)),
    acc: hex(acc),
    pop: hex(color(0.92, 0.11, c > 0.03 ? (h + 150) % 360 : 85)),
    onacc: darkTile ? '#132a1f' : '#ffffff',
  }
}

const cache = new Map<string, MochiPalette>([['Classic', CLASSIC]])

/** Palette for a flavor name; unknown names fall back to Classic. */
export function palette(name: string): MochiPalette {
  const hit = cache.get(name)
  if (hit) return hit
  const f = FLAVORS.find((x) => x[0] === name)
  if (!f) return CLASSIC
  const p = expandFlavor(f[1], f[2], f[3])
  cache.set(name, p)
  return p
}
