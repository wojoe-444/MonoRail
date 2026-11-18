/**
 * Color schemes, ported from the Bot Dashboard in wojoe-444/MC-Player
 * (dashboard/web/src/theme.ts) so both apps share one look and one picker.
 *
 * Each palette is a handful of parameters; `tokens()` expands it into the
 * full set of MonoRail CSS variables (the ones `index.css` defines) for light
 * or dark mode. Status colors (success / warning / info / destructive) keep
 * the same hues in every palette so their meaning never changes, and the
 * chart series (`--series-*`) are not part of a palette at all: they stay the
 * validated fixed order in index.css.
 */


export type SidebarStyle = 'dark' | 'light' | 'bold'

export interface Palette {
  id: string
  name: string
  blurb: string
  /** Primary: hue and chroma. */
  ph: number
  pc: number
  /** Neutral tint: hue and chroma for backgrounds, borders and text. */
  nh: number
  nc: number
  sidebar: SidebarStyle
  /** Hue for the drawer when it is dark or bold (defaults to the neutral hue). */
  sh?: number
  /** Neutral palettes cut the fixed tint on text, muted text and drawer so grays stay gray. */
  neutral?: boolean
  /**
   * Hand-tuned tokens laid over the generated ones (e.g. a softer card or a
   * second brand hue). Only override names `tokens()` already produces, so
   * switching palettes never leaves a stale variable behind.
   */
  tune?: (dark: boolean) => Record<string, string>
  /** `pill`: fully rounded inputs, buttons and selects, rounder cards (CSS keyed off `data-shape` on <html>). */
  shape?: 'pill'
  /**
   * A faint frond drawn in the drawer (CSS keyed off `data-texture` on <html>):
   * `leaf` in white for a dark or bold drawer, `leaf-ink` in green ink for a light one.
   */
  texture?: 'leaf' | 'leaf-ink'
  /** A picture behind the whole app; the page, cards and drawer turn to frosted glass over it. */
  backdrop?: Backdrop
}

/**
 * A picture theme's backdrop. The pictures are drawings in scripts/backdrops/,
 * rendered by `npm run backdrops` into WebP files in src/assets/backdrops/.
 * theme.ts puts it on <html> as `data-backdrop` plus `--backdrop-*`
 * variables, and the rules at the end of index.css lay the glass out.
 */
export interface Backdrop {
  /** The picture's URL. */
  src: string
  /** A small blurred copy, shown through the frosted glass (the app never blurs live). */
  blur: string
  /** A small sharp copy for the swatch in Settings. */
  thumb: string
  /** A night version, with its own blurred copy and thumbnail. Without one, dark mode dims `src` by `dim`. */
  dark?: { src: string; blur: string; thumb: string }
  /**
   * `panel`: the drawer sits right on the picture and the page is one frosted sheet.
   * `glass`: the drawer, top bar and page float as separate frosted pieces.
   * `liquid`: the `glass` layout in clearer, heavier glass with lit edges, a
   * sheen and fine grain; made for moody, dark pictures.
   */
  layout: 'panel' | 'glass' | 'liquid'
  /** How far dark mode darkens the picture, 0 to 1. */
  dim: number
  /** Shown while the picture loads. */
  color: string
}

/** Every rendered backdrop file, by path. */
const BACKDROP_FILES = import.meta.glob<string>('../assets/backdrops/*.webp', { eager: true, query: '?url', import: 'default' })

/** A drawing's files: the picture, its blurred copy and thumbnail, and the night version when it has one. */
function picture(name: string): Pick<Backdrop, 'src' | 'blur' | 'thumb' | 'dark'> {
  const url = (file: string) => BACKDROP_FILES[`../assets/backdrops/${file}.webp`]
  const files = (n: string) => ({ src: url(n), blur: url(`${n}-blur`), thumb: url(`${n}-thumb`) })
  if (!url(name)) throw new Error(`No backdrop "${name}": run npm run backdrops.`)
  return { ...files(name), dark: url(`${name}-dark`) ? files(`${name}-dark`) : undefined }
}

const BACKDROPS = {
  alpine: { ...picture('alpine'), layout: 'panel', dim: 0.42, color: 'oklch(0.78 0.04 235)' },
  dunes: { ...picture('dunes'), layout: 'glass', dim: 0.48, color: 'oklch(0.78 0.1 55)' },
  aurora: { ...picture('aurora'), layout: 'panel', dim: 0.15, color: 'oklch(0.2 0.04 245)' },
  ocean: { ...picture('ocean'), layout: 'glass', dim: 0.5, color: 'oklch(0.75 0.06 210)' },
  autumn: { ...picture('autumn'), layout: 'panel', dim: 0.5, color: 'oklch(0.8 0.08 75)' },
  topo: { ...picture('topo'), layout: 'glass', dim: 0, color: 'oklch(0.95 0.02 85)' },
  cherryBlossom: { ...picture('cherry-blossom'), layout: 'glass', dim: 0.45, color: 'oklch(0.93 0.025 40)' },
  lagoon: { ...picture('lagoon'), layout: 'glass', dim: 0.5, color: 'oklch(0.75 0.09 210)' },
  lavenderFields: { ...picture('lavender-fields'), layout: 'glass', dim: 0.45, color: 'oklch(0.7 0.08 310)' },
  riceTerraces: { ...picture('rice-terraces'), layout: 'panel', dim: 0.45, color: 'oklch(0.8 0.08 140)' },
  coralReef: { ...picture('coral-reef'), layout: 'panel', dim: 0.3, color: 'oklch(0.5 0.08 225)' },
  meadow: { ...picture('meadow'), layout: 'glass', dim: 0.45, color: 'oklch(0.78 0.08 200)' },
  canyonMesa: { ...picture('canyon-mesa'), layout: 'panel', dim: 0, color: 'oklch(0.57 0.06 25)' },
  winterVillage: { ...picture('winter-village'), layout: 'glass', dim: 0.45, color: 'oklch(0.84 0.02 257)' },
  savanna: { ...picture('savanna'), layout: 'panel', dim: 0.45, color: 'oklch(0.64 0.1 50)' },
  paperCut: { ...picture('paper-cut'), layout: 'glass', dim: 0.4, color: 'oklch(0.75 0.05 17)' },
  bauhaus: { ...picture('bauhaus'), layout: 'glass', dim: 0.5, color: 'oklch(0.75 0.03 73)' },
  watercolor: { ...picture('watercolor'), layout: 'glass', dim: 0.45, color: 'oklch(0.74 0.03 320)' },
  neonRain: { ...picture('neon-rain'), layout: 'liquid', dim: 0.1, color: 'oklch(0.2 0.07 305)' },
  mistyPines: { ...picture('misty-pines'), layout: 'liquid', dim: 0.15, color: 'oklch(0.25 0.03 220)' },
  stormSea: { ...picture('storm-sea'), layout: 'liquid', dim: 0.12, color: 'oklch(0.22 0.02 230)' },
  moonlitLake: { ...picture('moonlit-lake'), layout: 'liquid', dim: 0.15, color: 'oklch(0.25 0.07 275)' },
  ember: { ...picture('ember'), layout: 'liquid', dim: 0.1, color: 'oklch(0.2 0.07 30)' },
  nebula: { ...picture('nebula'), layout: 'liquid', dim: 0.08, color: 'oklch(0.2 0.08 290)' },
} satisfies Record<string, Backdrop>

export const DEFAULT_PALETTE = 'sand-ink'

export const PALETTES: Palette[] = [
  { id: 'indigo-ink', name: 'Indigo Ink', blurb: 'Navy chrome, indigo primary', ph: 277, pc: 0.23, nh: 265, nc: 0.01, sidebar: 'dark' },
  { id: 'paper-indigo', name: 'Paper Indigo', blurb: 'Light drawer, indigo primary, very MUI', ph: 277, pc: 0.23, nh: 265, nc: 0.008, sidebar: 'light' },
  { id: 'indigo-bold', name: 'Indigo Bold', blurb: 'The drawer itself is the brand color', ph: 272, pc: 0.21, nh: 270, nc: 0.01, sidebar: 'bold' },
  { id: 'ocean-teal', name: 'Ocean Teal', blurb: 'Deep sea chrome with a teal accent', ph: 192, pc: 0.12, nh: 220, nc: 0.01, sidebar: 'dark', sh: 225 },
  { id: 'emerald-forest', name: 'Emerald Forest', blurb: 'Green-black chrome, emerald primary', ph: 158, pc: 0.15, nh: 165, nc: 0.01, sidebar: 'dark', sh: 170 },
  { id: 'grass-block', name: 'Grass Block', blurb: 'Grass green on warm earth', ph: 140, pc: 0.17, nh: 75, nc: 0.014, sidebar: 'dark', sh: 60 },
  { id: 'redstone', name: 'Redstone', blurb: 'Charcoal chrome, redstone-red primary', ph: 25, pc: 0.2, nh: 20, nc: 0.006, sidebar: 'dark', sh: 20 },
  { id: 'sunset-amber', name: 'Sunset Amber', blurb: 'Warm charcoal, orange-amber primary', ph: 52, pc: 0.17, nh: 60, nc: 0.012, sidebar: 'dark', sh: 55 },
  { id: 'rose-quartz', name: 'Rose Quartz', blurb: 'Plum chrome, rose primary', ph: 350, pc: 0.2, nh: 350, nc: 0.01, sidebar: 'dark', sh: 335 },
  { id: 'violet-dusk', name: 'Violet Dusk', blurb: 'Deep purple chrome, violet primary', ph: 305, pc: 0.22, nh: 300, nc: 0.012, sidebar: 'dark', sh: 295 },
  { id: 'slate-mono', name: 'Slate Mono', blurb: 'Quiet graphite, almost no color', ph: 255, pc: 0.035, nh: 255, nc: 0.008, sidebar: 'dark', sh: 255 },
  { id: 'graphite-light', name: 'Graphite Light', blurb: 'Neutral gray with a cool blue accent, light drawer', ph: 245, pc: 0.17, nh: 250, nc: 0.005, sidebar: 'light' },
  { id: 'cobalt-sand', name: 'Cobalt Sand', blurb: 'Cobalt blue on warm sand neutrals', ph: 258, pc: 0.2, nh: 80, nc: 0.012, sidebar: 'dark', sh: 70 },
  { id: 'lime-circuit', name: 'Lime Circuit', blurb: 'Electric lime on olive-gray', ph: 125, pc: 0.19, nh: 125, nc: 0.008, sidebar: 'dark', sh: 130 },
  { id: 'copper', name: 'Copper', blurb: 'Burnished copper on brown-gray', ph: 45, pc: 0.15, nh: 55, nc: 0.012, sidebar: 'dark', sh: 45 },
  { id: 'magenta-pop', name: 'Magenta Pop', blurb: 'Hot magenta on neutral warm gray', ph: 335, pc: 0.24, nh: 25, nc: 0.005, sidebar: 'dark', sh: 25 },
  { id: 'sky-day', name: 'Sky Day', blurb: 'Light drawer, clear sky blue', ph: 235, pc: 0.14, nh: 232, nc: 0.006, sidebar: 'light' },
  { id: 'mint-light', name: 'Mint Light', blurb: 'Light drawer, fresh mint', ph: 172, pc: 0.12, nh: 175, nc: 0.007, sidebar: 'light' },
  { id: 'gold-rush', name: 'Gold Rush', blurb: 'Golden yellow on bronze-black', ph: 85, pc: 0.15, nh: 90, nc: 0.012, sidebar: 'dark', sh: 85 },
  { id: 'coral-reef', name: 'Coral Reef', blurb: 'Coral primary on teal-gray chrome', ph: 15, pc: 0.18, nh: 200, nc: 0.006, sidebar: 'dark', sh: 205 },
  { id: 'lavender-mist', name: 'Lavender Mist', blurb: 'Soft lavender, light drawer', ph: 295, pc: 0.15, nh: 290, nc: 0.006, sidebar: 'light' },
  { id: 'teal-bold', name: 'Teal Bold', blurb: 'Drawer in saturated teal', ph: 185, pc: 0.13, nh: 195, nc: 0.007, sidebar: 'bold', sh: 190 },
  { id: 'crimson-bold', name: 'Crimson Bold', blurb: 'Drawer in deep crimson', ph: 20, pc: 0.2, nh: 20, nc: 0.006, sidebar: 'bold', sh: 20 },
  { id: 'forest-bold', name: 'Forest Bold', blurb: 'Drawer in forest green', ph: 150, pc: 0.14, nh: 150, nc: 0.007, sidebar: 'bold', sh: 150 },
  { id: 'warm-stone', name: 'Warm Stone', blurb: 'Stone gray with a warm lean, muted clay accent', ph: 55, pc: 0.06, nh: 70, nc: 0.008, sidebar: 'dark', sh: 65, neutral: true },
  { id: 'sage', name: 'Sage', blurb: 'Gray-green neutrals, quiet sage accent', ph: 150, pc: 0.05, nh: 145, nc: 0.007, sidebar: 'dark', sh: 150, neutral: true },
  { id: 'true-gray', name: 'True Gray', blurb: 'Pure neutral gray, no tint at all', ph: 0, pc: 0, nh: 0, nc: 0, sidebar: 'dark', sh: 0, neutral: true },
  { id: 'sand-ink', name: 'Sand & Ink', blurb: 'Default. Cream paper, khaki accent, light drawer', ph: 80, pc: 0.07, nh: 85, nc: 0.01, sidebar: 'light', neutral: true },
  {
    id: 'botanical',
    name: 'Botanical',
    blurb: 'Forest drawer, sage paper, off-white cards, pill inputs',
    ph: 145, pc: 0.085, nh: 140, nc: 0.012, sidebar: 'bold', sh: 148,
    shape: 'pill',
    texture: 'leaf',
    tune: (dark) => botanicalTune(dark),
  },
  {
    id: 'botanical-linen',
    name: 'Botanical Linen',
    blurb: 'Cream linen, muted sage accent, clay highlight, light drawer',
    ph: 148, pc: 0.06, nh: 88, nc: 0.012, sidebar: 'light',
    neutral: true,
    texture: 'leaf-ink',
    tune: (dark) => botanicalLinenTune(dark),
  },
  {
    id: 'botanical-sand',
    name: 'Botanical Sand',
    blurb: 'Sand & Ink paper with the Botanical forest drawer and pill inputs',
    ph: 145, pc: 0.08, nh: 85, nc: 0.01, sidebar: 'bold', sh: 148,
    neutral: true,
    shape: 'pill',
    texture: 'leaf',
    tune: (dark) => botanicalSandTune(dark),
  },

  // Hues the sets above skip. These also tint the page, wells and lines (see `wash`).
  {
    id: 'glacier',
    name: 'Glacier',
    blurb: 'Icy cyan page and drawer, white cards, coral highlight',
    ph: 218, pc: 0.13, nh: 218, nc: 0.01, sidebar: 'light',
    tune: (dark) => ({
      ...wash(218, 0.025, dark),
      ...(dark
        ? { sidebar: o(0.19, 0.028, 218), 'sidebar-accent': o(0.3, 0.06, 218) }
        : { sidebar: o(0.955, 0.025, 218), 'sidebar-accent': o(0.895, 0.055, 218), 'sidebar-accent-foreground': o(0.32, 0.08, 225), 'sidebar-border': o(0.9, 0.03, 218) }),
    }),
  },
  {
    id: 'orchid',
    name: 'Orchid',
    blurb: 'Fuchsia-purple drawer, lilac paper',
    ph: 322, pc: 0.2, nh: 320, nc: 0.01, sidebar: 'bold', sh: 318,
    tune: (dark) => wash(320, 0.018, dark),
  },
  {
    id: 'apricot',
    name: 'Apricot',
    blurb: 'Peach page and drawer, tangerine primary, teal highlight',
    ph: 52, pc: 0.16, nh: 62, nc: 0.01, sidebar: 'light',
    tune: (dark) => ({
      ...wash(62, 0.03, dark),
      ...(dark
        ? { sidebar: o(0.19, 0.03, 60), 'sidebar-accent': o(0.3, 0.06, 55) }
        : { primary: o(0.58, 0.16, 46), sidebar: o(0.935, 0.04, 62), 'sidebar-accent': o(0.88, 0.075, 58), 'sidebar-accent-foreground': o(0.35, 0.09, 50), 'sidebar-border': o(0.9, 0.04, 62) }),
    }),
  },
  {
    id: 'moss',
    name: 'Moss',
    blurb: 'Olive drawer, khaki-green paper, rust highlight',
    ph: 118, pc: 0.12, nh: 105, nc: 0.01, sidebar: 'dark', sh: 120,
    tune: (dark) => ({
      ...wash(105, 0.022, dark),
      ...(dark
        ? { highlight: o(0.72, 0.13, 48), 'highlight-foreground': o(0.2, 0.04, 48), 'highlight-soft': o(0.3, 0.05, 48), 'highlight-soft-foreground': o(0.86, 0.08, 48), sidebar: o(0.16, 0.03, 120) }
        : { primary: o(0.5, 0.12, 120), highlight: o(0.58, 0.14, 45), 'highlight-soft': o(0.94, 0.035, 50), 'highlight-soft-foreground': o(0.44, 0.1, 45), sidebar: o(0.27, 0.045, 120), 'sidebar-accent': o(0.35, 0.07, 120) }),
    }),
  },
  {
    id: 'raspberry',
    name: 'Raspberry',
    blurb: 'Wine drawer, blush paper, raspberry primary',
    ph: 2, pc: 0.2, nh: 355, nc: 0.01, sidebar: 'dark', sh: 355,
    tune: (dark) => ({
      ...wash(355, 0.02, dark),
      ...(dark ? { sidebar: o(0.17, 0.04, 355) } : { sidebar: o(0.26, 0.07, 355), 'sidebar-accent': o(0.34, 0.09, 358) }),
    }),
  },
  {
    id: 'periwinkle',
    name: 'Periwinkle',
    blurb: 'Periwinkle drawer, blue-lilac paper, gold highlight',
    ph: 284, pc: 0.15, nh: 280, nc: 0.01, sidebar: 'bold', sh: 282,
    tune: (dark) => ({
      ...wash(280, 0.022, dark),
      ...(dark
        ? { highlight: o(0.8, 0.13, 85), 'highlight-foreground': o(0.2, 0.04, 85), 'highlight-soft': o(0.3, 0.05, 85), 'highlight-soft-foreground': o(0.88, 0.08, 85) }
        : { sidebar: o(0.5, 0.15, 282), 'sidebar-accent': o(0.58, 0.15, 282), highlight: o(0.7, 0.14, 80), 'highlight-foreground': o(0.25, 0.05, 80), 'highlight-soft': o(0.95, 0.04, 85), 'highlight-soft-foreground': o(0.45, 0.1, 75) }),
    }),
  },

  // Pictures: a drawing behind the app, frosted glass on top (see `Backdrop`).
  {
    id: 'alpine-dawn',
    name: 'Alpine Dawn',
    blurb: 'Mountains and a lake; drawer on the picture, page on a frosted sheet',
    ph: 232, pc: 0.12, nh: 228, nc: 0.012, sidebar: 'dark',
    backdrop: BACKDROPS.alpine,
  },
  {
    id: 'dune-sunset',
    name: 'Dune Sunset',
    blurb: 'Warm dunes at dusk; every piece floats as frosted glass',
    ph: 40, pc: 0.14, nh: 50, nc: 0.012, sidebar: 'dark', sh: 35,
    backdrop: BACKDROPS.dunes,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    blurb: 'Northern lights over pines; a night picture for either mode',
    ph: 168, pc: 0.12, nh: 230, nc: 0.015, sidebar: 'dark',
    backdrop: BACKDROPS.aurora,
  },
  {
    id: 'ocean-swell',
    name: 'Ocean Swell',
    blurb: 'Layered swells under a pale sky; floating frosted glass',
    ph: 222, pc: 0.12, nh: 215, nc: 0.012, sidebar: 'dark', sh: 225,
    backdrop: BACKDROPS.ocean,
  },
  {
    id: 'autumn-hills',
    name: 'Autumn Hills',
    blurb: 'Storybook hills and trees; page on a frosted sheet',
    ph: 42, pc: 0.13, nh: 70, nc: 0.012, sidebar: 'dark',
    backdrop: BACKDROPS.autumn,
    tune: (dark): Record<string, string> => (dark ? {} : { highlight: o(0.55, 0.1, 125), 'highlight-soft': o(0.94, 0.04, 120), 'highlight-soft-foreground': o(0.42, 0.08, 125) }),
  },
  {
    id: 'field-map',
    name: 'Field Map',
    blurb: 'Pen-drawn contour map; a blueprint in dark mode',
    ph: 158, pc: 0.09, nh: 85, nc: 0.01, sidebar: 'dark', sh: 160,
    backdrop: BACKDROPS.topo,
    tune: (dark): Record<string, string> =>
      dark
        ? { highlight: o(0.74, 0.14, 55), 'highlight-foreground': o(0.2, 0.04, 55), glass: o(0.2, 0.035, 245, 0.56), card: o(0.21, 0.04, 245, 0.62), sidebar: o(0.17, 0.04, 245, 0.6) }
        : { highlight: o(0.62, 0.16, 48), 'highlight-foreground': o(0.99, 0.01, 50) },
  },
  // Pictures: daytime
  {
    id: 'cherry-blossom',
    name: 'Cherry Blossom',
    blurb: 'Ink-wash branches in bloom on blush paper; floating frosted glass',
    ph: 355, pc: 0.13, nh: 35, nc: 0.012, sidebar: 'dark', sh: 350,
    backdrop: BACKDROPS.cherryBlossom,
  },
  {
    id: 'lagoon',
    name: 'Lagoon',
    blurb: 'Turquoise shallows, cumulus and palms; floating frosted glass',
    ph: 200, pc: 0.12, nh: 210, nc: 0.012, sidebar: 'dark', sh: 215,
    backdrop: BACKDROPS.lagoon,
  },
  {
    id: 'lavender-fields',
    name: 'Lavender Fields',
    blurb: 'Lavender rows to a golden horizon; floating frosted glass',
    ph: 300, pc: 0.14, nh: 300, nc: 0.012, sidebar: 'dark', sh: 300,
    backdrop: BACKDROPS.lavenderFields,
  },
  {
    id: 'rice-terraces',
    name: 'Rice Terraces',
    blurb: 'Green terraces under misty ridges; drawer on the forest edge',
    ph: 130, pc: 0.13, nh: 145, nc: 0.012, sidebar: 'dark',
    backdrop: BACKDROPS.riceTerraces,
  },
  {
    id: 'sunlit-reef',
    name: 'Sunlit Reef',
    blurb: 'Light rays over a reef; drawer on the dark coral, page on a sheet',
    ph: 30, pc: 0.14, nh: 220, nc: 0.014, sidebar: 'dark', sh: 230,
    backdrop: BACKDROPS.coralReef,
  },
  {
    id: 'meadow',
    name: 'Meadow',
    blurb: 'Rolling hills, wildflowers and a big sky; floating frosted glass',
    ph: 245, pc: 0.13, nh: 120, nc: 0.01, sidebar: 'dark', sh: 235,
    backdrop: BACKDROPS.meadow,
  },

  // Pictures: illustrated
  {
    id: 'canyon-mesa',
    name: 'Canyon Mesa',
    blurb: 'Red-rock mesas at sunset, moonlit at night; drawer on the picture',
    ph: 38, pc: 0.14, nh: 30, nc: 0.012, sidebar: 'dark', sh: 25,
    backdrop: BACKDROPS.canyonMesa,
  },
  {
    id: 'winter-village',
    name: 'Winter Village',
    blurb: 'Snowy hills, lit cabins and pines; floating frosted glass',
    ph: 245, pc: 0.12, nh: 250, nc: 0.012, sidebar: 'dark', sh: 235,
    backdrop: BACKDROPS.winterVillage,
  },
  {
    id: 'savanna',
    name: 'Savanna',
    blurb: 'Acacias under a huge low sun; drawer on the picture',
    ph: 50, pc: 0.15, nh: 45, nc: 0.012, sidebar: 'dark', sh: 30,
    backdrop: BACKDROPS.savanna,
  },
  {
    id: 'paper-cut',
    name: 'Paper Cut',
    blurb: 'Layered paper-cut hills in a dusk ramp; floating frosted glass',
    ph: 350, pc: 0.13, nh: 330, nc: 0.012, sidebar: 'dark', sh: 310,
    backdrop: BACKDROPS.paperCut,
  },
  {
    id: 'bauhaus',
    name: 'Bauhaus',
    blurb: 'Modernist circles and bars on grainy paper; floating glass',
    ph: 252, pc: 0.12, nh: 75, nc: 0.01, sidebar: 'dark', sh: 60,
    backdrop: BACKDROPS.bauhaus,
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    blurb: 'Soft watercolour washes on cold-press paper; floating glass',
    ph: 265, pc: 0.13, nh: 300, nc: 0.01, sidebar: 'dark', sh: 280,
    backdrop: BACKDROPS.watercolor,
  },

  // Moody (liquid glass)
  {
    id: 'neon-rain',
    name: 'Neon Rain',
    blurb: 'A rainy city at night; neon glows on wet streets',
    ph: 340, pc: 0.19, nh: 300, nc: 0.014, sidebar: 'dark', sh: 295,
    backdrop: BACKDROPS.neonRain,
  },
  {
    id: 'misty-pines',
    name: 'Misty Pines',
    blurb: 'Pine ridges in blue-hour fog; one warm light in the trees',
    ph: 65, pc: 0.14, nh: 215, nc: 0.012, sidebar: 'dark', sh: 215,
    backdrop: BACKDROPS.mistyPines,
  },
  {
    id: 'storm-sea',
    name: 'Storm Sea',
    blurb: 'Storm clouds over a dark sea; a lighthouse beam, pale horizon',
    ph: 85, pc: 0.12, nh: 225, nc: 0.01, sidebar: 'dark', sh: 225,
    backdrop: BACKDROPS.stormSea,
  },
  {
    id: 'moonlit-lake',
    name: 'Moonlit Lake',
    blurb: 'A full moon over a misty lake; the shore mirrored below',
    ph: 270, pc: 0.12, nh: 270, nc: 0.014, sidebar: 'dark', sh: 268,
    backdrop: BACKDROPS.moonlitLake,
  },
  {
    id: 'ember',
    name: 'Ember',
    blurb: 'Volcanic night; lava rivers, embers and smoke lit from below',
    ph: 45, pc: 0.18, nh: 25, nc: 0.012, sidebar: 'dark', sh: 20,
    backdrop: BACKDROPS.ember,
  },
  {
    id: 'nebula',
    name: 'Nebula',
    blurb: 'Violet, teal and rose nebula over stars; a dark planet edge',
    ph: 295, pc: 0.17, nh: 285, nc: 0.014, sidebar: 'dark', sh: 285,
    backdrop: BACKDROPS.nebula,
  },
]

export interface PaletteGroup {
  id: string
  label: string
  /** One line under the set's name: what the schemes in it share. */
  blurb: string
  /** Palette ids, in display order. Every palette is in exactly one group. */
  ids: string[]
}

/** Display sets for the picker in Settings > Appearance, grouped by character and hue family. */
export const PALETTE_GROUPS: PaletteGroup[] = [
  {
    id: 'paper',
    label: 'Paper',
    blurb: 'Light drawers on calm, bright pages',
    ids: ['sand-ink', 'paper-indigo', 'graphite-light', 'sky-day', 'mint-light', 'lavender-mist'],
  },
  {
    id: 'nature',
    label: 'Nature',
    blurb: 'Greens and earth: botanicals, forests, moss and lime',
    ids: ['botanical', 'botanical-linen', 'botanical-sand', 'sage', 'emerald-forest', 'forest-bold', 'grass-block', 'lime-circuit'],
  },
  {
    id: 'ocean-night',
    label: 'Ocean & Night',
    blurb: 'Blues, teals and violets on deep chrome',
    ids: ['indigo-ink', 'indigo-bold', 'ocean-teal', 'teal-bold', 'cobalt-sand', 'violet-dusk'],
  },
  {
    id: 'warm',
    label: 'Warm',
    blurb: 'Reds, ambers, golds and pinks',
    ids: ['redstone', 'crimson-bold', 'sunset-amber', 'copper', 'gold-rush', 'coral-reef', 'rose-quartz', 'magenta-pop'],
  },
  {
    id: 'neutrals',
    label: 'Neutrals',
    blurb: 'Grays with almost no color',
    ids: ['slate-mono', 'warm-stone', 'true-gray'],
  },
  {
    id: 'hues',
    label: 'Hues',
    blurb: 'Cyan, orchid, apricot, moss, raspberry and periwinkle, with tinted pages',
    ids: ['glacier', 'orchid', 'apricot', 'moss', 'raspberry', 'periwinkle'],
  },
  {
    id: 'pictures',
    label: 'Pictures',
    blurb: 'A drawing behind the app, with frosted glass on top',
    ids: ['alpine-dawn', 'dune-sunset', 'aurora', 'ocean-swell', 'autumn-hills', 'field-map'],
  },
  {
    id: 'pictures-daytime',
    label: 'Pictures: daytime',
    blurb: 'Bright outdoor scenes under frosted glass',
    ids: ['cherry-blossom', 'lagoon', 'lavender-fields', 'rice-terraces', 'sunlit-reef', 'meadow'],
  },
  {
    id: 'pictures-illustrated',
    label: 'Pictures: illustrated',
    blurb: 'Stylized art: paper cut, Bauhaus, watercolor and more',
    ids: ['canyon-mesa', 'winter-village', 'savanna', 'paper-cut', 'bauhaus', 'watercolor'],
  },
  {
    id: 'moody',
    label: 'Moody',
    blurb: 'Dark, cinematic pictures under clear liquid glass; best in dark mode',
    ids: ['neon-rain', 'misty-pines', 'storm-sea', 'moonlit-lake', 'ember', 'nebula'],
  },
]

/** The palettes of a group, in its display order. */
export function groupPalettes(g: PaletteGroup): Palette[] {
  return g.ids.map((id) => PALETTES.find((p) => p.id === id)).filter((p): p is Palette => !!p)
}

/** The group a palette is shown in. */
export function groupOf(id: string): PaletteGroup | undefined {
  return PALETTE_GROUPS.find((g) => g.ids.includes(id))
}

export function findPalette(id: string | null | undefined): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES.find((p) => p.id === DEFAULT_PALETTE)!
}

const r = (n: number) => Math.round(n * 10000) / 10000
const o = (l: number, c: number, h: number, a?: number) =>
  `oklch(${r(l)} ${r(c)} ${r(((h % 360) + 360) % 360)}${a !== undefined ? ` / ${a}` : ''})`

/** Fixed status hues, shared by every palette. */
const STATUS = { success: 158, warning: 75, info: 235, destructive: 17 }

/** Every MonoRail color token for a palette in light or dark mode (names without the leading `--`). */
export function tokens(p: Palette, dark: boolean): Record<string, string> {
  const { ph, pc, nh, nc } = p
  const sh = p.sh ?? nh
  const k = p.neutral ? 0.15 : 1
  const low = pc < 0.08 // near-gray primaries need a darker / lighter step to keep contrast
  // Highlight, the second brand color: the palette's complementary hue (the Bot Dashboard's chart-2).
  const hh = ph + 150

  const t: Record<string, string> = dark
    ? {
        background: o(0.165, nc * 3, nh),
        foreground: o(0.95, 0.01, nh),
        card: o(0.205, nc * 3.5, nh),
        'card-foreground': o(0.95, 0.01, nh),
        popover: o(0.22, nc * 3.5, nh),
        'popover-foreground': o(0.95, 0.01, nh),
        primary: o(low ? 0.8 : 0.7, pc * 0.85, ph),
        'primary-foreground': o(0.16, 0.04, ph),
        'primary-soft': o(0.3, Math.max(pc * 0.35, 0.01), ph),
        'primary-soft-foreground': o(0.87, Math.max(pc * 0.4, 0.02), ph),
        secondary: o(0.27, nc * 4, nh),
        'secondary-foreground': o(0.95, 0.01, nh),
        muted: o(0.25, nc * 3.5, nh),
        'muted-foreground': o(0.7, 0.025 * k, nh),
        accent: o(0.3, pc * 0.3, ph),
        'accent-foreground': o(0.95, 0.03, ph),
        highlight: o(0.74, 0.11, hh),
        'highlight-foreground': o(0.18, 0.03, hh),
        'highlight-soft': o(0.3, 0.05, hh),
        'highlight-soft-foreground': o(0.86, 0.07, hh),
        border: o(1, 0, 0, 0.09),
        input: o(1, 0, 0, 0.13),
        ring: o(0.66, pc * 0.8, ph, 0.5),
        destructive: o(0.7, 0.19, STATUS.destructive),
        'destructive-foreground': o(0.16, 0.02, STATUS.destructive),
        success: o(0.74, 0.16, STATUS.success),
        warning: o(0.82, 0.15, 78),
        info: o(0.74, 0.13, 232),
      }
    : {
        background: o(0.975, nc * 0.7, nh),
        foreground: o(0.23, 0.03 * k + nc, nh),
        card: o(1, 0, 0),
        'card-foreground': o(0.23, 0.03 * k + nc, nh),
        popover: o(1, 0, 0),
        'popover-foreground': o(0.23, 0.03 * k + nc, nh),
        primary: o(low ? 0.42 : 0.52, pc, ph),
        'primary-foreground': o(0.985, 0.01, ph),
        'primary-soft': o(0.95, Math.max(pc * 0.18, 0.008), ph),
        'primary-soft-foreground': o(low ? 0.38 : 0.42, Math.max(pc * 0.8, 0.03), ph),
        secondary: o(0.955, nc * 1.5, nh),
        'secondary-foreground': o(0.3, 0.06 * k, nh),
        muted: o(0.945, nc * 1.2, nh),
        'muted-foreground': o(0.5, 0.03 * k, nh),
        accent: o(0.945, pc * 0.15, ph),
        'accent-foreground': o(0.36, pc * 0.65, ph),
        highlight: o(0.6, 0.12, hh),
        'highlight-foreground': o(0.99, 0.01, hh),
        'highlight-soft': o(0.95, 0.03, hh),
        'highlight-soft-foreground': o(0.42, 0.09, hh),
        border: o(0.915, nc * 1.2, nh),
        input: o(0.9, nc * 1.4, nh),
        ring: o(0.6, pc * 0.85, ph, 0.5),
        destructive: o(0.56, 0.22, STATUS.destructive),
        'destructive-foreground': o(1, 0, 0),
        success: o(0.56, 0.15, STATUS.success),
        warning: o(0.78, 0.16, STATUS.warning),
        info: o(0.58, 0.15, STATUS.info),
      }

  // Soft (tinted surface) variant of each status color, for badges and chips.
  for (const [name, h] of Object.entries(STATUS)) {
    t[`${name}-soft`] = dark ? o(0.3, 0.05, h) : o(0.95, 0.035, h)
    t[`${name}-soft-foreground`] = dark ? o(0.86, 0.1, h) : o(0.43, 0.11, h)
  }

  // Navigation drawer
  if (p.sidebar === 'light') {
    Object.assign(
      t,
      dark
        ? {
            sidebar: o(0.19, nc * 3, nh),
            'sidebar-foreground': o(0.82, 0.02 * k, nh),
            'sidebar-muted-foreground': o(0.62, 0.02 * k, nh),
            'sidebar-primary': t.primary,
            'sidebar-primary-foreground': t['primary-foreground'],
            'sidebar-accent': o(0.27, pc * 0.25, ph),
            'sidebar-accent-foreground': o(0.97, 0.01, nh),
            'sidebar-border': o(1, 0, 0, 0.08),
            'sidebar-ring': t.ring,
          }
        : {
            sidebar: o(1, 0, 0),
            'sidebar-foreground': o(0.38, 0.03 * k, nh),
            'sidebar-muted-foreground': o(0.56, 0.03 * k, nh),
            'sidebar-primary': t.primary,
            'sidebar-primary-foreground': t['primary-foreground'],
            'sidebar-accent': o(0.955, pc * 0.12 + nc, ph),
            'sidebar-accent-foreground': o(0.25, 0.04 * k, nh),
            'sidebar-border': t.border,
            'sidebar-ring': t.ring,
          },
    )
  } else if (p.sidebar === 'bold') {
    Object.assign(t, {
      sidebar: dark ? o(0.3, pc * 0.8, sh) : o(0.42, pc, sh),
      'sidebar-foreground': o(0.93, 0.03, sh),
      'sidebar-muted-foreground': o(0.8, 0.05, sh),
      'sidebar-primary': o(0.99, 0, 0),
      'sidebar-primary-foreground': o(0.3, pc, sh),
      'sidebar-accent': dark ? o(0.38, pc * 0.8, sh) : o(0.5, pc, sh),
      'sidebar-accent-foreground': o(0.99, 0.01, sh),
      'sidebar-border': o(1, 0, 0, 0.15),
      'sidebar-ring': o(0.9, 0.05, sh),
    })
  } else {
    Object.assign(t, {
      sidebar: dark ? o(0.14, 0.03 * k, sh) : o(0.2, 0.05 * k, sh),
      'sidebar-foreground': o(0.86, 0.02 * k, sh),
      'sidebar-muted-foreground': o(0.66, 0.03 * k, sh),
      'sidebar-primary': o(low ? 0.46 : 0.53, Math.max(pc * 0.95, 0.04), ph),
      'sidebar-primary-foreground': o(0.99, 0, 0),
      'sidebar-accent': o(0.28, 0.06 * k, sh),
      'sidebar-accent-foreground': o(0.98, 0.01, sh),
      'sidebar-border': dark ? o(1, 0, 0, 0.08) : o(0.3, 0.04 * k, sh),
      'sidebar-ring': o(0.64, pc * 0.9, ph),
    })
  }
  // The frosted sheet behind a picture theme's page; plain palettes never show it.
  t.glass = t.background
  if (p.backdrop) Object.assign(t, glass(p, p.backdrop, dark))
  return p.tune ? Object.assign(t, p.tune(dark)) : t
}

/**
 * Tinted surfaces: the page, wells and lines take the palette's hue instead
 * of near-white or near-black, and cards keep a trace of it.
 */
function wash(h: number, c: number, dark: boolean): Record<string, string> {
  return dark
    ? { background: o(0.19, c * 1.1, h), card: o(0.235, c * 1.2, h), muted: o(0.28, c * 1.2, h), secondary: o(0.29, c * 1.3, h), 'muted-foreground': o(0.74, c * 1.4, h) }
    : { background: o(0.955, c, h), card: o(0.995, c * 0.12, h), muted: o(0.93, c * 1.1, h), secondary: o(0.93, c * 1.2, h), border: o(0.9, c * 1.1, h), input: o(0.87, c * 1.3, h), 'muted-foreground': o(0.48, c * 1.6, h) }
}

/**
 * Glass surfaces for a picture theme: the page is see-through, cards, wells
 * and lines are translucent, and the drawer is clear (`panel`) or smoked
 * (`glass`) with white text. Popovers and dialogs stay solid.
 */
function glass(p: Palette, b: Backdrop, dark: boolean): Record<string, string> {
  const { nh, ph, pc } = p
  const sh = p.sh ?? nh
  const panel = b.layout === 'panel'
  if (b.layout === 'liquid') {
    return {
      background: 'transparent',
      ...(dark
        ? {
            glass: o(0.16, 0.025, nh, 0.38),
            card: o(0.2, 0.025, nh, 0.34),
            border: o(1, 0, 0, 0.09),
            input: o(1, 0, 0, 0.14),
            muted: o(1, 0, 0, 0.06),
            secondary: o(1, 0, 0, 0.1),
            sidebar: o(0.14, 0.025, sh, 0.36),
          }
        : {
            glass: o(0.975, 0.008, nh, 0.62),
            card: o(1, 0, 0, 0.52),
            border: o(1, 0, 0, 0.5),
            input: o(0.3, 0.03, nh, 0.16),
            muted: o(0.3, 0.03, nh, 0.07),
            secondary: o(0.3, 0.03, nh, 0.09),
            sidebar: o(0.16, 0.025, sh, 0.34),
          }),
      'sidebar-foreground': o(0.98, 0.005, nh),
      'sidebar-muted-foreground': o(0.98, 0, 0, 0.66),
      'sidebar-accent': o(1, 0, 0, 0.1),
      'sidebar-accent-foreground': o(1, 0, 0),
      'sidebar-primary': o(1, 0, 0, 0.92),
      'sidebar-primary-foreground': o(0.28, pc, ph),
      'sidebar-border': o(1, 0, 0, 0.12),
      'sidebar-ring': o(1, 0, 0, 0.6),
    }
  }
  return {
    background: 'transparent',
    ...(dark
      ? {
          glass: o(0.17, 0.02, nh, panel ? 0.74 : 0.56),
          card: panel ? o(0.27, 0.02, nh, 0.5) : o(0.19, 0.02, nh, 0.58),
          border: o(1, 0, 0, 0.1),
          input: o(1, 0, 0, 0.16),
          muted: o(1, 0, 0, 0.07),
          secondary: o(1, 0, 0, 0.1),
          sidebar: panel ? 'transparent' : o(0.13, 0.02, sh, 0.55),
        }
      : {
          glass: panel ? o(0.975, 0.01, nh, 0.8) : o(0.99, 0.006, nh, 0.6),
          card: panel ? o(1, 0, 0, 0.58) : o(0.99, 0.006, nh, 0.62),
          border: o(0.35, 0.03, nh, 0.12),
          input: o(0.35, 0.03, nh, 0.2),
          muted: o(0.35, 0.03, nh, 0.08),
          secondary: o(0.35, 0.03, nh, 0.1),
          sidebar: panel ? 'transparent' : o(0.22, 0.03, sh, 0.48),
        }),
    'sidebar-foreground': o(0.98, 0.005, nh),
    'sidebar-muted-foreground': o(0.98, 0, 0, 0.72),
    'sidebar-accent': o(1, 0, 0, 0.16),
    'sidebar-accent-foreground': o(1, 0, 0),
    'sidebar-primary': o(0.99, 0, 0),
    'sidebar-primary-foreground': o(0.32, pc, ph),
    'sidebar-border': o(1, 0, 0, 0.14),
    'sidebar-ring': o(1, 0, 0, 0.6),
  }
}

/**
 * Botanical: deep forest and sage greens. Light mode is a sage-tinted page
 * with warm off-white cards, sage-filled inputs and a dark green primary;
 * the highlight is a fresh leaf green instead of the complementary hue.
 * Dark mode is a deep forest night with sage text and a lighter leaf primary.
 */
function botanicalTune(dark: boolean): Record<string, string> {
  return dark
    ? {
        background: o(0.19, 0.022, 152),
        card: o(0.235, 0.028, 150),
        popover: o(0.25, 0.028, 150),
        foreground: o(0.95, 0.012, 130),
        'card-foreground': o(0.95, 0.012, 130),
        'popover-foreground': o(0.95, 0.012, 130),
        muted: o(0.27, 0.026, 150),
        'muted-foreground': o(0.74, 0.03, 140),
        secondary: o(0.29, 0.03, 150),
        input: o(0.85, 0.06, 145, 0.16),
        primary: o(0.74, 0.12, 140),
        'primary-foreground': o(0.2, 0.04, 150),
        'primary-soft': o(0.31, 0.05, 145),
        'primary-soft-foreground': o(0.88, 0.07, 140),
        accent: o(0.31, 0.035, 145),
        highlight: o(0.78, 0.16, 135),
        'highlight-foreground': o(0.2, 0.05, 140),
        'highlight-soft': o(0.31, 0.06, 135),
        'highlight-soft-foreground': o(0.88, 0.1, 135),
        ring: o(0.7, 0.1, 140, 0.5),
        sidebar: o(0.27, 0.05, 150),
        'sidebar-accent': o(0.33, 0.055, 150),
        'sidebar-primary-foreground': o(0.27, 0.06, 150),
      }
    : {
        background: o(0.955, 0.012, 140),
        card: o(0.99, 0.004, 95),
        popover: o(0.99, 0.004, 95),
        foreground: o(0.25, 0.035, 150),
        'card-foreground': o(0.25, 0.035, 150),
        'popover-foreground': o(0.25, 0.035, 150),
        muted: o(0.93, 0.014, 140),
        'muted-foreground': o(0.5, 0.035, 145),
        secondary: o(0.92, 0.018, 140),
        'secondary-foreground': o(0.3, 0.05, 148),
        border: o(0.9, 0.016, 140),
        input: o(0.915, 0.016, 140),
        primary: o(0.42, 0.085, 145),
        'primary-foreground': o(0.985, 0.01, 130),
        'primary-soft': o(0.92, 0.035, 140),
        'primary-soft-foreground': o(0.38, 0.08, 145),
        accent: o(0.92, 0.025, 140),
        'accent-foreground': o(0.32, 0.07, 145),
        highlight: o(0.62, 0.15, 138),
        'highlight-foreground': o(0.99, 0.01, 135),
        'highlight-soft': o(0.93, 0.05, 135),
        'highlight-soft-foreground': o(0.42, 0.11, 138),
        ring: o(0.55, 0.09, 145, 0.5),
        sidebar: o(0.42, 0.075, 148),
        'sidebar-accent': o(0.48, 0.075, 148),
        'sidebar-primary-foreground': o(0.32, 0.075, 148),
      }
}

/**
 * Botanical Linen: the quieter, office-ready sibling of Botanical. Light mode
 * is warm cream linen with near-white cards, a light linen drawer, a muted
 * sage primary and a soft clay highlight; standard corners, and the frond is
 * a faint green ink in the drawer. Dark mode is warm espresso-olive with the
 * same sage and clay, lifted for contrast.
 */
function botanicalLinenTune(dark: boolean): Record<string, string> {
  return dark
    ? {
        background: o(0.2, 0.011, 85),
        card: o(0.235, 0.013, 85),
        popover: o(0.25, 0.013, 85),
        foreground: o(0.94, 0.014, 90),
        'card-foreground': o(0.94, 0.014, 90),
        'popover-foreground': o(0.94, 0.014, 90),
        muted: o(0.27, 0.013, 85),
        'muted-foreground': o(0.72, 0.02, 100),
        secondary: o(0.29, 0.015, 88),
        'secondary-foreground': o(0.94, 0.014, 90),
        input: o(0.9, 0.03, 90, 0.14),
        primary: o(0.75, 0.07, 145),
        'primary-foreground': o(0.2, 0.03, 150),
        'primary-soft': o(0.31, 0.035, 145),
        'primary-soft-foreground': o(0.87, 0.05, 140),
        accent: o(0.3, 0.02, 125),
        'accent-foreground': o(0.94, 0.02, 120),
        highlight: o(0.75, 0.085, 62),
        'highlight-foreground': o(0.2, 0.03, 60),
        'highlight-soft': o(0.31, 0.04, 62),
        'highlight-soft-foreground': o(0.86, 0.06, 65),
        ring: o(0.7, 0.06, 145, 0.5),
        sidebar: o(0.18, 0.011, 85),
        'sidebar-foreground': o(0.85, 0.015, 90),
        'sidebar-muted-foreground': o(0.64, 0.018, 100),
        'sidebar-primary': o(0.75, 0.07, 145),
        'sidebar-primary-foreground': o(0.2, 0.03, 150),
        'sidebar-accent': o(0.26, 0.02, 130),
        'sidebar-accent-foreground': o(0.96, 0.012, 90),
        'sidebar-ring': o(0.7, 0.06, 145, 0.5),
      }
    : {
        background: o(0.968, 0.012, 88),
        card: o(0.993, 0.005, 90),
        popover: o(0.995, 0.004, 90),
        foreground: o(0.27, 0.022, 150),
        'card-foreground': o(0.27, 0.022, 150),
        'popover-foreground': o(0.27, 0.022, 150),
        muted: o(0.945, 0.013, 88),
        'muted-foreground': o(0.5, 0.022, 120),
        secondary: o(0.935, 0.016, 90),
        'secondary-foreground': o(0.32, 0.035, 145),
        border: o(0.9, 0.015, 88),
        input: o(0.885, 0.017, 88),
        primary: o(0.46, 0.06, 150),
        'primary-foreground': o(0.985, 0.008, 90),
        'primary-soft': o(0.93, 0.024, 138),
        'primary-soft-foreground': o(0.38, 0.06, 150),
        accent: o(0.93, 0.02, 115),
        'accent-foreground': o(0.34, 0.045, 145),
        highlight: o(0.6, 0.09, 58),
        'highlight-foreground': o(0.99, 0.01, 70),
        'highlight-soft': o(0.94, 0.028, 68),
        'highlight-soft-foreground': o(0.44, 0.08, 55),
        ring: o(0.55, 0.06, 150, 0.5),
        sidebar: o(0.952, 0.016, 88),
        'sidebar-foreground': o(0.36, 0.028, 140),
        'sidebar-muted-foreground': o(0.54, 0.024, 115),
        'sidebar-primary': o(0.46, 0.06, 150),
        'sidebar-primary-foreground': o(0.985, 0.008, 90),
        'sidebar-accent': o(0.915, 0.022, 115),
        'sidebar-accent-foreground': o(0.27, 0.03, 150),
        'sidebar-border': o(0.895, 0.016, 88),
        'sidebar-ring': o(0.55, 0.06, 150, 0.5),
      }
}

/**
 * Botanical Sand: Sand & Ink meets Botanical. The page, cards and text are
 * Sand & Ink's cream paper and warm ink; the drawer, pill shape and leaf frond
 * are Botanical's, with a forest green primary and Sand & Ink's khaki as the
 * highlight. Dark mode is warm ink with a deep forest drawer.
 */
function botanicalSandTune(dark: boolean): Record<string, string> {
  return dark
    ? {
        background: o(0.185, 0.012, 80),
        card: o(0.22, 0.014, 80),
        popover: o(0.235, 0.014, 80),
        foreground: o(0.95, 0.012, 85),
        'card-foreground': o(0.95, 0.012, 85),
        'popover-foreground': o(0.95, 0.012, 85),
        muted: o(0.26, 0.014, 80),
        'muted-foreground': o(0.72, 0.02, 85),
        secondary: o(0.28, 0.016, 80),
        input: o(0.9, 0.03, 85, 0.15),
        primary: o(0.74, 0.11, 142),
        'primary-foreground': o(0.2, 0.04, 150),
        'primary-soft': o(0.31, 0.045, 145),
        'primary-soft-foreground': o(0.88, 0.06, 140),
        accent: o(0.3, 0.025, 120),
        highlight: o(0.78, 0.08, 82),
        'highlight-foreground': o(0.2, 0.03, 80),
        'highlight-soft': o(0.31, 0.035, 82),
        'highlight-soft-foreground': o(0.87, 0.05, 82),
        ring: o(0.7, 0.09, 142, 0.5),
        sidebar: o(0.26, 0.05, 150),
        'sidebar-accent': o(0.32, 0.055, 150),
        'sidebar-primary-foreground': o(0.27, 0.06, 150),
      }
    : {
        background: o(0.97, 0.01, 85),
        card: o(0.995, 0.003, 85),
        popover: o(0.995, 0.003, 85),
        foreground: o(0.25, 0.03, 90),
        'card-foreground': o(0.25, 0.03, 90),
        'popover-foreground': o(0.25, 0.03, 90),
        muted: o(0.945, 0.012, 85),
        'muted-foreground': o(0.5, 0.025, 85),
        secondary: o(0.94, 0.015, 85),
        'secondary-foreground': o(0.3, 0.035, 90),
        border: o(0.91, 0.013, 85),
        input: o(0.925, 0.014, 85),
        primary: o(0.42, 0.08, 145),
        'primary-foreground': o(0.985, 0.01, 90),
        'primary-soft': o(0.93, 0.03, 140),
        'primary-soft-foreground': o(0.38, 0.075, 145),
        accent: o(0.93, 0.02, 100),
        'accent-foreground': o(0.34, 0.05, 120),
        highlight: o(0.52, 0.07, 80),
        'highlight-foreground': o(0.985, 0.01, 85),
        'highlight-soft': o(0.94, 0.025, 82),
        'highlight-soft-foreground': o(0.42, 0.06, 80),
        ring: o(0.55, 0.08, 145, 0.5),
        sidebar: o(0.4, 0.07, 148),
        'sidebar-accent': o(0.47, 0.07, 148),
        'sidebar-primary-foreground': o(0.32, 0.075, 148),
      }
}
