// Connections module backend: the page's view of electron/connections.
// Secrets go in through save() and never come back out.

const { connections } = require('../connections/index.cjs')

module.exports = {
  id: 'connections',
  // No start(): nothing checks connections on its own. A connector runs
  // only after the user sets it up, and then when the Connections page is
  // open (or a page that needs it, like Claude Stats for the account type).
  methods: {
    list: () => connections().list(),
    check: (_ctx, args) => connections().check(args?.kind, { force: !!args?.force }),
    save: (_ctx, args) => connections().save(args),
    remove: (_ctx, args) => connections().remove(args),
    runAction: (_ctx, args) => connections().runAction(args),
    getJob: (_ctx, args) => connections().getJob(args),
    cancelJob: (_ctx, args) => connections().cancelJob(args),
    listWindowsCredentials: () => connections().listWindowsCredentials(),
    claudeAccount: () => connections().claudeAccount(),
  },
}
