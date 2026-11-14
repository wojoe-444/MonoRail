// Remote access (Settings > Remote access, docs/remote-access.md): use
// MonoRail from a phone over the PC's private Tailscale address. Off by
// default; the state and the server live in electron/remote/service.cjs.
// Every method here is refused for remote devices (electron/remote/policy.cjs),
// so only the PC's own window can pair, revoke or change anything.

const { remoteService } = require('../remote/service.cjs')
const inApp = require('../scheduled/in-app.cjs')

module.exports = {
  id: 'remote',
  methods: {
    getStatus: () => remoteService().status(),
    setEnabled: async (_ctx, args) => {
      await remoteService().setEnabled(args?.enabled === true)
      return remoteService().status()
    },
    check: async () => {
      await remoteService().check()
      return remoteService().status()
    },
    setupServe: async () => {
      await remoteService().setupServe()
      return remoteService().status()
    },
    startPairing: async () => remoteService().startPairing(),
    cancelPairing: async () => remoteService().cancelPairing(),
    setAgentFromPhone: async (_ctx, args) => {
      await remoteService().setAgentFromPhone(args?.on === true)
      return remoteService().status()
    },
    setLogins: async (_ctx, args) => {
      await remoteService().setLogins(args?.logins)
      return remoteService().status()
    },
    renameDevice: async (_ctx, args) => {
      await remoteService().renameDevice(String(args?.id ?? ''), args?.name)
      return remoteService().status()
    },
    revokeDevice: async (_ctx, args) => {
      await remoteService().revokeDevice(String(args?.id ?? ''))
      return remoteService().status()
    },
    clearAudit: async () => {
      await remoteService().clearAudit()
      return remoteService().status()
    },
  },
  /** Opens the store; starts the server again only if the person left it on. */
  start(ctx) {
    const service = remoteService()
    inApp.registerProvider({
      id: 'remote',
      title: 'Remote access',
      async list() {
        const { on, everyMs, checkedAt } = service.scheduleInfo()
        return [
          {
            id: 'tailscale',
            title: 'Check the Tailscale address',
            description: 'Confirms the private address your phone uses is still private. If it turns public, Remote access stops until it is private again.',
            group: 'Connections',
            schedule: inApp.every(everyMs),
            state: on ? 'Ready' : 'Disabled',
            lastRun: checkedAt,
            nextRun: checkedAt ? new Date(Date.parse(checkedAt) + everyMs).toISOString() : new Date().toISOString(),
            result: checkedAt ? 'ok' : null,
            note: on ? '' : 'Remote access is off.',
            where: { label: 'Remote access', path: '/settings/remote' },
            runnable: false,
          },
        ]
      },
    })
    void service
      .init(ctx.dataDir)
      .then(() => service.resume())
      .catch((err) => ctx.log('could not start:', err.message))
  },
}
