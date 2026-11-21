import { expect, test } from 'vitest'
import { adopted, GROUPS, typeIcon, typeInfo } from './catalog'

test('resolves catalog types and falls back to the table icon for unknown types', () => {
  const assets = GROUPS.find((group) => group.id === 'assets')
  const table = assets?.types.find((type) => type.type === 'table')

  expect(table?.plural).toBe('Tables')
  expect(typeInfo('table')).toBe(table)
  expect(typeInfo('llmModel')?.name).toBe('LLM model')
  expect(typeInfo('column')).toBeUndefined()
  expect(typeInfo(undefined)).toBeUndefined()
  expect(typeIcon('column')).toBe(table?.icon)
  expect(typeIcon('database')).toBe(typeInfo('database')?.icon)
})

test('returns adopted OpenMetadata field definitions and excludes MonoRail-only entities', () => {
  const table = adopted('table')

  expect(table?.origin).toBe('openmetadata')
  expect(table?.fields).toContainEqual(expect.objectContaining({ name: 'columns' }))
  expect(adopted('savedQuery')).toBeUndefined()
  expect(adopted('column')).toBeUndefined()
})
