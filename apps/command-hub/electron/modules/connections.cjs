// Connections module backend: the page's view of electron/connections.
// Secrets go in through save() and never come back out.

const { connections } = require('../connections/index.cjs')

module.exports = {
  id: 'connections',
  methods: {
    list: () => connections().list(),
    check: (_ctx, args) => connections().check(args?.kind, { force: !!args?.force }),
    save: (_ctx, args) => connections().save(args),
    remove: (_ctx, args) => connections().remove(args),
    runAction: (_ctx, args) => connections().runAction(args),
    getJob: (_ctx, args) => connections().getJob(args),
    cancelJob: (_ctx, args) => connections().cancelJob(args),
    listWindowsCredentials: () => connections().listWindowsCredentials(),
  },
}
