/** Words of a query, lower case. */
export const words = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean)

/** 0 when the label starts with the first word, 1 when it contains it, 2 otherwise. */
export function rank(label: string, ws: string[]) {
  const l = label.toLowerCase()
  return !ws.length ? 0 : l.startsWith(ws[0]) ? 0 : l.includes(ws[0]) ? 1 : 2
}

export const matchesAll = (hay: string, ws: string[]) => {
  const h = hay.toLowerCase()
  return ws.every((w) => h.includes(w))
}
