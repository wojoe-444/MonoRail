// Small helpers for reading and changing the parsed config object.

import type { ObjectValue, Value } from './parse'

export function setEntry(obj: ObjectValue, key: string, value: Value | undefined): ObjectValue {
  const has = obj.entries.some((e) => e.key === key)
  if (value === undefined) return { ...obj, entries: obj.entries.filter((e) => e.key !== key) }
  if (has) return { ...obj, entries: obj.entries.map((e) => (e.key === key ? { key, value } : e)) }
  return { ...obj, entries: [...obj.entries, { key, value }] }
}

export const str = (v: string, like?: Value): Value => ({ t: 'string', v, q: like?.t === 'string' ? like.q : undefined })

export const objectAt = (config: ObjectValue, key: string): ObjectValue | undefined => {
  const v = config.entries.find((e) => e.key === key)?.value
  return v?.t === 'object' ? v : undefined
}

/** How many rules the assertions object holds (one per column, condition or key). */
export function countTests(config: ObjectValue | undefined): number {
  const a = config && objectAt(config, 'assertions')
  if (!a) return 0
  let n = 0
  for (const e of a.entries) {
    if (e.key === 'uniqueKey') n += e.value.t === 'array' && e.value.items.length ? 1 : 0
    else if (e.value.t === 'array') n += e.value.items.length
    else n += 1
  }
  return n
}

export function countColumns(config: ObjectValue | undefined): number {
  return (config && objectAt(config, 'columns')?.entries.length) ?? 0
}
