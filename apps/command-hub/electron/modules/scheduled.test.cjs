const { test } = require('node:test')
const assert = require('node:assert/strict')
const backend = require('./scheduled.cjs')

test('Windows scheduler reads tasks and refuses invalid changes', { skip: process.platform !== 'win32', timeout: 120000 }, async () => {
  const report = await backend.methods.list()
  assert.ok(Array.isArray(report.tasks))
  assert.ok(report.tasks.every((task) => !task.path.toLowerCase().startsWith('\\microsoft\\')))
  await assert.rejects(backend.methods.change(null, { action: 'delete', name: '*', path: '\\Microsoft\\Windows\\' }))
  await assert.rejects(backend.methods.change(null, { action: 'delete', name: '*', path: '\\' }), /Task not found/)
  await assert.rejects(backend.methods.change(null, { action: 'unknown', name: 'x', path: '\\' }))
})
