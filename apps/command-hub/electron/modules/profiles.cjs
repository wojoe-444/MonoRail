// Profiles module backend: the active profile, for Settings > Profile.
//
// The logic lives in electron/profiles (no Electron there, so it is tested
// under Node). Reading never writes anything; the first rename creates
// profiles.json in the data folder (machine scope). There is no create or
// delete yet: see docs/profiles.md for the phases. Switching exists for
// Developer Mode's hidden New User profile (and back): it takes effect after a
// restart, because every backend reads the active profile when it starts.

const { NEW_USER_ID, SCOPES, profiles } = require('../profiles/index.cjs')

function view() {
  const list = profiles().list()
  const scopes = { profile: [], machine: [] }
  for (const [folder, scope] of Object.entries(SCOPES)) scopes[scope].push(folder)
  return { ...list, machineDir: profiles().machineDir, scopes }
}

module.exports = {
  id: 'profiles',
  // Methods that act on this PC's own screen (a dialog, Explorer, a terminal,
  // a restart). Remote access never runs them (electron/bridge/desktop-only.cjs).
  desktopOnly: ['switchTo', 'restart'],
  methods: {
    getProfiles: () => view(),
    async rename(_ctx, args) {
      if (typeof args?.id !== 'string') throw new Error('Which profile?')
      await profiles().rename(args.id, args.name ?? '')
      return view()
    },
    /**
     * Make a profile active from the next start. Today only Developer Mode
     * uses it: to the New User test profile (wiped blank at that start) and
     * back to the profile it came from. Call restart() afterwards.
     */
    async switchTo(_ctx, args) {
      const id = args?.id
      const { activeId, previousId } = profiles().list()
      if (id !== NEW_USER_ID && id !== previousId && id !== 'default') throw new Error('Only the New User test profile and your own profile can be switched to.')
      if (id === activeId && id !== NEW_USER_ID) return view()
      await profiles().switchTo(id)
      return view()
    },
    /** Restart MonoRail so the active profile takes effect everywhere. */
    restart() {
      const { app, BrowserWindow, session } = require('electron')
      // The browser dev bridge has no window to restart into.
      if (BrowserWindow.getAllWindows().length === 0) return { restarting: false }
      // Let the reply reach the page, save its local storage, then restart.
      setTimeout(() => {
        session.defaultSession.flushStorageData()
        app.relaunch()
        app.quit()
      }, 150)
      return { restarting: true }
    },
  },
}
