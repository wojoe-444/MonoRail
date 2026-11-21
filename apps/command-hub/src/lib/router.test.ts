import { afterEach, expect, test, vi } from 'vitest'
import { currentPath, navigate } from './router'

afterEach(() => vi.unstubAllGlobals())

test.each([
  ['', '/'],
  ['#/', '/'],
  ['#claude-stats', '/claude-stats'],
  ['#/claude-stats///', '/claude-stats'],
  ['#/apps/github-plus/repo/tree?ref=main', '/apps/github-plus/repo/tree?ref=main'],
])('reads hash %j as route %j', (hash, route) => {
  vi.stubGlobal('window', { location: { hash } })

  expect(currentPath()).toBe(route)
})

test('adds a leading slash on navigation and skips writing the active route', () => {
  const setHash = vi.fn()
  vi.stubGlobal('window', {
    location: {
      get hash() { return '#/claude-stats' },
      set hash(value: string) { setHash(value) },
    },
  })

  navigate('claude-stats')
  expect(setHash).not.toHaveBeenCalled()
  navigate('wiki')
  expect(setHash).toHaveBeenCalledExactlyOnceWith('/wiki')
})
