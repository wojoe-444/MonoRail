// Tests for the backend, run with `npm test` (plain Node, no MonoRail needed).
// loadBackend() reads monorail.json, gives the backend a temporary data folder
// and runs migrate() and start(); invoke() behaves like monorail.invoke() on a
// page. The sandbox is not simulated: check permissions by loading the folder
// in MonoRail.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { loadBackend } from '../monorail-sdk/testing.mjs'

test('adds, lists and deletes notes, and tells open pages', async (t) => {
  const b = await loadBackend()
  t.after(() => b.close())

  assert.deepEqual(await b.invoke('listNotes'), [])
  const [note] = await b.invoke('addNote', { text: '  first  ' })
  assert.equal(note.text, 'first')
  assert.deepEqual(b.events.filter((e) => e.channel === 'notes').at(-1).payload, [note])

  assert.deepEqual(await b.invoke('deleteNote', { id: note.id }), [])
})

test('errors carry a code the page can check', async (t) => {
  const b = await loadBackend()
  t.after(() => b.close())

  await assert.rejects(b.invoke('addNote', { text: ' ' }), { code: 'EMPTY_NOTE' })
  await assert.rejects(b.invoke('listFolder', { folder: '/somewhere' }), { code: 'NO_FOLDER' })
  await assert.rejects(b.invoke('nope'), { code: 'EXT_UNKNOWN_METHOD' })
})

test('migrate runs after an update', async (t) => {
  const b = await loadBackend({ previousVersion: '0.9.0' })
  t.after(() => b.close())
  assert.ok(b.logs.some((l) => l.line.includes('last used by 0.9.0')))
})
