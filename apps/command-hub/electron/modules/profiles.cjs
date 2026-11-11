// Profiles module backend: the active profile, for Settings > Profile.
//
// The logic lives in electron/profiles (no Electron there, so it is tested
// under Node). Reading never writes anything; the first rename creates
// profiles.json in the data folder (machine scope). There is no create,
// switch or delete yet: see docs/profiles.md for the phases.

const { SCOPES, profiles } = require('../profiles/index.cjs')

function view() {
  const list = profiles().list()
  const scopes = { profile: [], machine: [] }
  for (const [folder, scope] of Object.entries(SCOPES)) scopes[scope].push(folder)
  return { ...list, machineDir: profiles().machineDir, scopes }
}

module.exports = {
  id: 'profiles',
  methods: {
    getProfiles: () => view(),
    async rename(_ctx, args) {
      if (typeof args?.id !== 'string') throw new Error('Which profile?')
      await profiles().rename(args.id, args.name ?? '')
      return view()
    },
  },
}
