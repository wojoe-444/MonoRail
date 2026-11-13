// Home backend: reads the small summary files modules write after each build
// (electron/cache, tier 'summary'). Loading Home never starts a read or a scan.

const cache = require('../cache/index.cjs')

module.exports = {
  id: 'home',
  methods: {
    /** { [summaryId]: { builtAt, ageMs, ttlMs, stale, summary } } for every summary that exists. */
    async getSummaries(ctx) {
      return cache.readSummaries(ctx.layout ?? ctx.rootDir)
    },
  },
}
