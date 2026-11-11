// Connections module backend: the page's view of electron/connections.
// Secrets go in through save() and never come back out.

const { connections } = require('../connections/index.cjs')

module.exports = {
  id: 'connections',
  /**
   * Check every added connection once, shortly after startup, so the status
   * summary (Home, MCP server) is there without opening the page. A check
   * reuses a fresh result (declared 'connections.sign-in').
   */
  start(ctx) {
    setTimeout(async () => {
      try {
        const { connections: added } = await connections().list()
        for (const c of added) await connections().check(c.kind)
      } catch (e) {
        ctx.log('startup check failed:', e.message)
      }
    }, 20_000).unref?.()
  },
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
