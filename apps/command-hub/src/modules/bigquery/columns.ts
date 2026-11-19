import type { BqCell, BqField } from './types'

export interface Column {
  label: string
  type: string
  get: (row: BqCell[]) => BqCell | undefined
}

/** Columns with non-repeated records spread into dotted sub-columns, as the console shows them. */
export function flatColumns(fields: BqField[]): Column[] {
  const out: Column[] = []
  const walk = (fs: BqField[], prefix: string, pick: (row: BqCell[]) => (BqCell | undefined)[]) => {
    fs.forEach((f, i) => {
      const get = (row: BqCell[]) => pick(row)[i]
      if ((f.type === 'RECORD' || f.type === 'STRUCT') && f.mode !== 'REPEATED' && f.fields?.length) {
        walk(f.fields, `${prefix}${f.name}.`, (row) => {
          const v = get(row)
          return f.fields!.map((sf) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, BqCell>)[sf.name] : null))
        })
      } else out.push({ label: `${prefix}${f.name}`, type: f.mode === 'REPEATED' ? `ARRAY<${f.type}>` : f.type, get })
    })
  }
  walk(fields, '', (row) => row)
  return out
}
