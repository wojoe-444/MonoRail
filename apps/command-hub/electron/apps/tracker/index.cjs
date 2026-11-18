// Tracker backend (Tools > Tracker): issues, projects, cycles and initiatives
// in MonoRail's local database. The model is in model.cjs; this file only
// opens the database and hands the page's calls to it. Nothing leaves the PC
// and the app keeps no files of its own (its data folder stays empty; the
// entities live in the profile's local database).

const { createTracker } = require('./model.cjs')

let tracker
const t = (deps) => (tracker ??= createTracker(deps?.db ?? require('../../localdb/index.cjs').localDb()))

/** For tests: a backend over a given entity store. */
function createBackend(deps) {
  let own
  const get = () => (deps ? (own ??= createTracker(deps.db, deps)) : t())
  const call = (fn) => async (_ctx, args) => fn(get(), args ?? {})
  return {
    id: 'tracker',
    methods: {
      snapshot: call((x) => x.snapshot()),
      createTeam: call((x, a) => x.createTeam(a)),
      updateTeam: call((x, a) => x.updateTeam(a)),
      createIssue: call((x, a) => x.createIssue(a)),
      updateIssues: call((x, a) => x.updateIssues(a)),
      deleteIssues: call((x, a) => x.deleteIssues(a)),
      restoreIssues: call((x, a) => x.restoreIssues(a)),
      issueDetail: call((x, a) => x.issueDetail(a)),
      addProjectUpdate: call((x, a) => x.addProjectUpdate(a)),
      scheduleCycles: call((x, a) => x.scheduleCycles(a)),
      addExample: call((x) => x.addExample()),
      save: call((x, a) => x.save(a)),
      remove: call((x, a) => x.remove(a)),
    },
  }
}

module.exports = { ...createBackend(), createBackend }
