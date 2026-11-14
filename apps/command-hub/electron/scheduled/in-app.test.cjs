const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const inApp = require('./in-app.cjs')

beforeEach(() => inApp.clearProviders())

const row = (over = {}) => ({ id: 'a', title: 'A', group: 'G', schedule: 'Every hour', state: 'Ready', ...over })

test('rows are namespaced by provider and cleaned', async () => {
  inApp.registerProvider({ id: 'p', list: async () => [row({ nextRun: '2026-01-01T00:00:00Z', lastRun: 'nonsense', result: 'weird', state: 'Odd' })] })
  const { jobs, problems } = await inApp.list()
  assert.deepEqual(problems, [])
  assert.equal(jobs[0].id, 'p:a')
  assert.equal(jobs[0].state, 'Ready')
  assert.equal(jobs[0].lastRun, null)
  assert.equal(jobs[0].result, null)
  assert.equal(jobs[0].nextRun, '2026-01-01T00:00:00.000Z')
})

test('a disabled job has no next run and cannot be run', async () => {
  inApp.registerProvider({ id: 'p', list: async () => [row({ state: 'Disabled', nextRun: '2026-01-01T00:00:00Z' })], run: async () => assert.fail('must not run') })
  const { jobs } = await inApp.list()
  assert.equal(jobs[0].nextRun, null)
  assert.equal(jobs[0].runnable, false)
  await assert.rejects(inApp.run('p:a'), /cannot be run now/)
})

test('a provider that throws is reported and does not hide the others', async () => {
  inApp.registerProvider({ id: 'bad', title: 'Bad one', list: async () => { throw new Error('broken\nsecond line') } })
  inApp.registerProvider({ id: 'good', list: async () => [row()] })
  const { jobs, problems } = await inApp.list()
  assert.equal(jobs.length, 1)
  assert.deepEqual(problems, [{ source: 'Bad one', error: 'broken' }])
})

test('run only starts jobs the provider lists as runnable, passing the local id', async () => {
  const ran = []
  inApp.registerProvider({
    id: 'p',
    list: async () => [row({ id: 'C:\\repo' }), row({ id: 'no', runnable: false }), row({ id: 'busy', state: 'Running' })],
    run: async (id) => ran.push(id),
  })
  await inApp.run('p:C:\\repo')
  assert.deepEqual(ran, ['C:\\repo'])
  await assert.rejects(inApp.run('p:no'), /cannot be run now/)
  await assert.rejects(inApp.run('p:busy'), /already running/)
  await assert.rejects(inApp.run('p:missing'), /not found/)
  await assert.rejects(inApp.run('nope:a'), /cannot be run/)
  await assert.rejects(inApp.run(42), /cannot be run/)
})

test('a provider without run() offers no Run now', async () => {
  inApp.registerProvider({ id: 'p', list: async () => [row()] })
  assert.equal((await inApp.list()).jobs[0].runnable, false)
  await assert.rejects(inApp.run('p:a'), /cannot be run/)
})

test('provider ids may not contain a colon', () => {
  assert.throws(() => inApp.registerProvider({ id: 'a:b', list: async () => [] }))
})

test('every() and timesPer() read as plain English', () => {
  assert.equal(inApp.every(60_000), 'Every minute')
  assert.equal(inApp.every(15 * 60_000), 'Every 15 minutes')
  assert.equal(inApp.every(3_600_000), 'Every hour')
  assert.equal(inApp.every(4 * 3_600_000), 'Every 4 hours')
  assert.equal(inApp.every(86_400_000), 'Every day')
  assert.equal(inApp.timesPer({ times: 1, unit: 'day' }), 'Once per day')
  assert.equal(inApp.timesPer({ times: 3, unit: 'week' }), '3 times per week')
})
