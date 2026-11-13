/**
 * What the element inspector says about a DOM element: the React components
 * that rendered it, its tag and shadcn `data-slot`, its text and size.
 *
 * React keeps its fiber on every DOM node it created (`__reactFiber$<id>`);
 * walking `fiber.return` gives the components above the element. Component
 * names survive the production build because vite.config.ts sets
 * `esbuild.keepNames`. Only names are read: no props, state or text from
 * other nodes.
 */

export interface Inspection {
  /** The closest named component, e.g. "StatTile". */
  component?: string
  /** Named components from the outside in, closest last (at most 6). */
  chain: string[]
  tag: string
  /** shadcn's data-slot on the element or its closest ancestor with one ("card-header"). */
  slot?: string
  /** True when the slot is the element's own, false when it is an ancestor's. */
  ownSlot: boolean
  /** aria-label, title or the start of the element's text. */
  text?: string
  width: number
  height: number
}

type Fiber = { type?: unknown; return?: Fiber | null }

/** Radix and React internals that say nothing about the page. */
const NOISE =
  /^(Primitive\..*|Slot|SlotClone|Slottable|Presence|Portal|DismissableLayer|DismissableLayerBranch|FocusScope|RemoveScroll.*|Popper.*|Collection.*|RovingFocusGroup.*|Arrow|VisuallyHidden|Suspense|StrictMode|Fragment|.*Provider|.*Context|.*Consumer|ErrorBoundary.*|Anonymous|Unknown|App|RouteView|TooltipRoot)$/

function fiberOf(el: Element): Fiber | undefined {
  for (const key of Object.keys(el)) {
    if (key.startsWith('__reactFiber$')) return (el as unknown as Record<string, Fiber>)[key]
  }
  return undefined
}

function nameOf(type: unknown, depth = 0): string | undefined {
  if (!type || typeof type === 'string' || depth > 3) return undefined
  if (typeof type === 'function') {
    const f = type as { displayName?: string; name?: string }
    return f.displayName || f.name || undefined
  }
  if (typeof type === 'object') {
    const o = type as { displayName?: string; type?: unknown; render?: unknown }
    return o.displayName || nameOf(o.type, depth + 1) || nameOf(o.render, depth + 1)
  }
  return undefined
}

function meaningful(name: string | undefined): name is string {
  // Lower-case or one/two-letter names are hooks' helpers or minified leftovers.
  return !!name && name.length > 2 && /^[A-Z]/.test(name) && !NOISE.test(name)
}

/** Named components above an element, closest first. */
export function componentsOf(el: Element, max = 6): string[] {
  const out: string[] = []
  let f: Fiber | null | undefined = fiberOf(el)
  let guard = 0
  while (f && out.length < max && guard++ < 400) {
    const n = nameOf(f.type)
    if (meaningful(n) && out[out.length - 1] !== n) out.push(n)
    f = f.return
  }
  return out
}

function textOf(el: Element): string | undefined {
  const label = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder')
  const raw = label || (el as HTMLElement).innerText || el.textContent || ''
  const t = raw.replace(/\s+/g, ' ').trim()
  if (!t) return undefined
  return t.length > 48 ? `${t.slice(0, 47)}…` : t
}

export function inspect(el: Element): Inspection {
  const closest = componentsOf(el)
  const slotEl = el.closest('[data-slot]')
  const r = el.getBoundingClientRect()
  return {
    component: closest[0],
    chain: [...closest].reverse(),
    tag: el.tagName.toLowerCase(),
    slot: slotEl?.getAttribute('data-slot') ?? undefined,
    ownSlot: slotEl === el,
    text: textOf(el),
    width: Math.round(r.width),
    height: Math.round(r.height),
  }
}

/** One line for each fact, ready to paste into feedback. */
export function describe(i: Inspection, page: string): string {
  const lines = [
    i.component ? `${i.component}${i.chain.length > 1 ? `  (in ${i.chain.slice(0, -1).join(' › ')})` : ''}` : `<${i.tag}>`,
    `Element: ${elementLine(i)}`,
  ]
  if (i.text) lines.push(`Text: "${i.text}"`)
  lines.push(`Page: ${page}`)
  return lines.join('\n')
}

/** `<button data-slot="button"> 96×32`, or `<span> in card 118×16` when the slot is an ancestor's. */
export function elementLine(i: Inspection): string {
  const tag = i.slot && i.ownSlot ? `<${i.tag} data-slot="${i.slot}">` : `<${i.tag}>${i.slot ? ` in ${i.slot}` : ''}`
  return `${tag}  ${i.width}×${i.height}`
}
