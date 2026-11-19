/** Helpers for forms that keep a draft and save it with `SaveBar` (components/ui/save-bar.tsx). */

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** How many fields of `draft` differ from `saved`: nested objects count per field, arrays and values as one (compared as JSON). */
export function countChanges(saved: object | undefined | null, draft: object | undefined | null): number {
  if (!saved || !draft) return 0
  const a = saved as Record<string, unknown>
  const b = draft as Record<string, unknown>
  let n = 0
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (isRecord(a[k]) && isRecord(b[k])) n += countChanges(a[k], b[k])
    else if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) n++
  }
  return n
}

/** The `savedAt` stamp for `SaveBar`: call it once the backend has confirmed the write. */
export const savedNow = (): number => Date.now()
