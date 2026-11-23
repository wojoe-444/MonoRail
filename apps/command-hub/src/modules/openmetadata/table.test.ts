import { expect, test } from 'vitest'

import { columnLineage, filledShare, firstLine, flattenColumns, parseEntityLink, percentText, rowTrend, shortColumn, tableTests, testCounts, typeKind } from './table'
import type { OmEntity, OmLineage } from './types'

const TABLE: OmEntity = {
  id: 't',
  name: 'fct_orders',
  fullyQualifiedName: 'svc.db.marts.fct_orders',
  tableConstraints: [{ constraintType: 'UNIQUE', columns: ['customer_id'] }],
  columns: [
    { name: 'order_id', dataType: 'STRING', constraint: 'PRIMARY_KEY', fullyQualifiedName: 'svc.db.marts.fct_orders.order_id' },
    { name: 'customer_id', dataType: 'STRING', tags: [{ tagFQN: 'PII.Sensitive', source: 'Classification' }, { tagFQN: 'Tier.Tier1' }] },
    { name: 'address', dataType: 'STRUCT', children: [{ name: 'city', dataType: 'STRING', tags: [{ tagFQN: 'Business.City', source: 'Glossary' }] }] },
  ],
}

test('flattens nested columns and attaches profiles, keys, terms and tags', () => {
  const cols = flattenColumns(TABLE, { timestamp: 1, columns: [{ name: 'order_id', nullCount: 0 }, { name: 'city', nullProportion: 0.5 }] })
  expect(cols.map((c) => [c.path, c.depth, c.key])).toEqual([
    ['order_id', 0, 'Primary key'],
    ['customer_id', 0, 'Unique'],
    ['address', 0, undefined],
    ['address.city', 1, undefined],
  ])
  expect(cols[0].fqn).toBe('svc.db.marts.fct_orders.order_id')
  expect(cols[3].fqn).toBe('svc.db.marts.fct_orders.address.city')
  expect(cols[0].profile?.nullCount).toBe(0)
  expect(cols[3].profile?.nullProportion).toBe(0.5)
  expect(cols[1].tags.map((t) => t.tagFQN)).toEqual(['PII.Sensitive'])
  expect(cols[3].terms.map((t) => t.tagFQN)).toEqual(['Business.City'])
})

test('works out how full a column is from any profile shape, without rounding gaps away', () => {
  expect(filledShare({ name: 'a', nullProportion: 0.25 })).toBe(0.75)
  expect(filledShare({ name: 'a', valuesCount: 809, nullCount: 3 })).toBeCloseTo(809 / 812)
  expect(filledShare({ name: 'a', nullCount: 10 }, 100)).toBe(0.9)
  expect(filledShare({ name: 'a' })).toBeUndefined()
  expect(filledShare(undefined)).toBeUndefined()
  expect(percentText(809 / 812)).toBe('99.6%')
  expect(percentText(0.004)).toBe('0.4%')
  expect(percentText(0.38)).toBe('38%')
  expect(percentText(1)).toBe('100%')
  expect(percentText(undefined)).toBe('–')
})

test('names the kind of value from the data type', () => {
  expect(['STRING', 'VARCHAR', 'NUMERIC', 'INT64', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'STRUCT', 'ARRAY', 'BYTES', 'GEOGRAPHY', undefined].map(typeKind)).toEqual([
    'text', 'text', 'number', 'number', 'date', 'time', 'boolean', 'struct', 'array', 'binary', 'other', 'other',
  ])
})

test('lists tests failing first, with the column a column test checks', () => {
  const tests = tableTests([
    { id: '1', name: 'b_ok', entityLink: '<#E::table::svc.db.marts.fct_orders::columns::order_id>', testCaseResult: { testCaseStatus: 'Success', timestamp: 5, result: 'Found 0 nulls.' } },
    { id: '2', name: 'a_rows', entityLink: '<#E::table::svc.db.marts.fct_orders>', testCaseResult: { testCaseStatus: 'Failed', timestamp: 9 } },
    { id: '3', name: 'c_new', entityLink: '<#E::table::svc.db.marts.fct_orders>' },
  ])
  expect(tests.map((t) => [t.entity.name, t.status, t.column])).toEqual([
    ['a_rows', 'Failed', undefined],
    ['b_ok', 'Success', 'order_id'],
    ['c_new', undefined, undefined],
  ])
  expect(testCounts(tests)).toEqual({ total: 3, passed: 1, failed: 1, other: 1, lastRun: 9 })
  expect(testCounts([])).toEqual({ total: 0, passed: 0, failed: 0, other: 0, lastRun: undefined })
  expect(parseEntityLink('<#E::table::a.b::columns::c>')).toEqual({ type: 'table', fqn: 'a.b', column: 'c' })
  expect(parseEntityLink(42)).toBeUndefined()
})

test('row trend, column lineage and display helpers', () => {
  expect(rowTrend([{ timestamp: 1, rowCount: 1 }])).toBeUndefined()
  expect(rowTrend([{ timestamp: 1, rowCount: 610 }, { timestamp: 2, rowCount: 812 }])).toMatchObject({ change: 202, delta: 202 / 610 })
  const data: OmLineage = {
    entity: { id: 't', type: 'table' },
    nodes: [],
    upstreamEdges: [{ fromEntity: 's', toEntity: 't', lineageDetails: { columnsLineage: [{ fromColumns: ['s.amount', 's.discount'], toColumn: 'svc.db.marts.fct_orders.net' }] } }],
    downstreamEdges: [{ fromEntity: 't', toEntity: 'd', lineageDetails: { columnsLineage: [{ fromColumns: ['svc.db.marts.fct_orders.net'], toColumn: 'd.revenue' }] } }],
  }
  expect(columnLineage(data, 'svc.db.marts.fct_orders.net')).toEqual({ from: ['s.amount', 's.discount'], to: ['d.revenue'] })
  expect(columnLineage(undefined, 'x')).toEqual({ from: [], to: [] })
  expect(shortColumn('svc.db.marts.fct_orders.net')).toBe('fct_orders.net')
  expect(firstLine('\n# One row per **order**.\nMore.')).toBe('One row per order.')
  expect(firstLine('See [the docs](https://example.com) first')).toBe('See the docs first')
})
