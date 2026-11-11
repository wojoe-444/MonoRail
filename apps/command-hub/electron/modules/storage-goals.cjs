// Free-space goals for the Storage page: "keep at least N GB free on C:".
//
// One small file, goals.json in the Storage data folder (machine scope, like
// the drives it describes): { version: 1, goals: { "C:": { freeBytes, setAt } } }.
// Numbers and drive ids only. Written only when the user sets or clears a
// goal, atomically, and never over a damaged file. Kept apart from
// storage.cjs, which must stay free of write calls (a test checks).

const path = require('node:path')
const fs = require('node:fs/promises')
const { writeJsonAtomic } = require('../cache/files.cjs')

const GOALS_FILE = 'goals.json'
const VERSION = 1
/** A goal above this (1 PB) is a typo, not a goal. */
const MAX_GOAL_BYTES = 1024 ** 5

/** Read the goals; `{}` when there is no file. Throws when the file is damaged. */
async function readGoals(dir) {
  let text
  try {
    text = await fs.readFile(path.join(dir, GOALS_FILE), 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return {}
    throw e
  }
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('The saved free-space goals are damaged, so they were left as they are.')
  }
  const out = {}
  for (const [id, g] of Object.entries(data?.goals ?? {})) {
    if (g && Number.isFinite(g.freeBytes) && g.freeBytes > 0) out[id] = { freeBytes: g.freeBytes, setAt: typeof g.setAt === 'string' ? g.setAt : undefined }
  }
  return out
}

/** Goals for the page; a damaged file reads as no goals plus an error to show. */
async function goalsView(dir) {
  try {
    return { goals: await readGoals(dir) }
  } catch (e) {
    return { goals: {}, goalsError: e.message }
  }
}

/**
 * Set (freeBytes > 0) or clear (freeBytes null) the goal of one drive.
 * `driveIds` are the drives listed right now: a goal is only set for one of them.
 */
async function setGoal(dir, { drive, freeBytes }, driveIds, { now = new Date() } = {}) {
  if (typeof drive !== 'string' || !driveIds.includes(drive)) throw new Error('That drive is not connected.')
  if (freeBytes !== null && !(Number.isFinite(freeBytes) && freeBytes > 0 && freeBytes <= MAX_GOAL_BYTES)) {
    throw new Error('Enter how much free space you want, for example 50 GB.')
  }
  const goals = await readGoals(dir) // throws on a damaged file: never overwrite it
  if (freeBytes === null) delete goals[drive]
  else goals[drive] = { freeBytes: Math.round(freeBytes), setAt: now.toISOString() }
  await writeJsonAtomic(path.join(dir, GOALS_FILE), { version: VERSION, goals })
  return goals
}

module.exports = { GOALS_FILE, readGoals, goalsView, setGoal, MAX_GOAL_BYTES }
