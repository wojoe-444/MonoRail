export type InAppJob = {
  id: string
  title: string
  description: string
  group: string
  schedule: string
  state: 'Ready' | 'Running' | 'Disabled'
  lastRun: string | null
  nextRun: string | null
  result: 'ok' | 'failed' | null
  note: string
  where: { label: string; path: string } | null
  runnable: boolean
}
export type InAppReport = { jobs: InAppJob[]; problems: { source: string; error: string }[]; readAt: string }

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const job = (j: Partial<InAppJob> & Pick<InAppJob, 'id' | 'title' | 'group' | 'schedule'>): InAppJob => ({
  description: '',
  state: 'Ready',
  lastRun: null,
  nextRun: null,
  result: null,
  note: '',
  where: null,
  runnable: false,
  ...j,
})

/** Fictional jobs for the browser dev server, where no backend exists. */
export const SAMPLE_REPORT: InAppReport = {
  readAt: new Date().toISOString(),
  problems: [],
  jobs: [
    job({ id: 'sample:report', title: 'Sample usage report', group: 'Reports', schedule: 'Every 15 minutes', description: 'Rebuilds a sample report.', lastRun: ago(6), nextRun: ago(-9), result: 'ok', runnable: true }),
    job({ id: 'sample:backup', title: 'Back up Sample notes', group: 'Backups', schedule: 'Once per day', description: 'Writes a sample backup file.', lastRun: ago(600), nextRun: ago(-840), result: 'failed', note: 'The sample backup folder is full.', runnable: true }),
    job({ id: 'sample:updates', title: 'Check for updates', group: 'Updates', schedule: 'Every 4 hours', state: 'Disabled', note: 'Updates work in the installed app, not in development.' }),
  ],
}
