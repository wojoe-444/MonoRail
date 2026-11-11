import type { DrivesResult, HistorySnapshot, ScanState, StorageHistory } from './types'

const GB = 1024 ** 3
const MB = 1024 ** 2

/** Shown in the browser dev server, where there is no backend. Fictional numbers and paths. */
export const sampleDrives: DrivesResult = {
  platform: 'win32',
  drives: [
    { id: 'C:', path: 'C:\\', total: 476 * GB, free: 6.2 * GB, used: 469.8 * GB, system: true, holdsData: true },
    { id: 'D:', path: 'D:\\', total: 931 * GB, free: 512 * GB, used: 419 * GB, system: false, holdsData: false },
  ],
}

const home = 'C:\\Users\\you'

export const sampleScan: ScanState = {
  state: 'done',
  startedAt: new Date(Date.now() - 120_000).toISOString(),
  finishedAt: new Date(Date.now() - 100_000).toISOString(),
  tookMs: 18_400,
  done: 21,
  total: 21,
  locations: [
    {
      id: 'monorail-data', group: 'monorail', label: 'MonoRail data (in use)', path: `${home}\\AppData\\Roaming\\MonoRail`, advice: 'keep', exists: true,
      note: 'Settings, chat state, caches and extension data. MonoRail never moves or deletes this folder.',
      bytes: 214 * MB, files: 1840, childCount: 9,
      children: [
        { name: 'Cache', bytes: 120 * MB, kind: 'dir' },
        { name: 'modules', bytes: 61 * MB, kind: 'dir' },
        { name: 'apps', bytes: 22 * MB, kind: 'dir' },
        { name: 'extensions', bytes: 11 * MB, kind: 'dir' },
      ],
    },
    { id: 'updater', group: 'monorail', label: 'Downloaded updates', path: `${home}\\AppData\\Local\\command-hub-updater`, advice: 'safe', exists: true, note: 'Installers the updater downloaded. Safe to clear when no update is waiting to install.', bytes: 412 * MB, files: 3 },
    { id: 'install', group: 'monorail', label: 'MonoRail app', path: `${home}\\AppData\\Local\\Programs\\command-hub`, advice: 'keep', exists: true, note: 'The installed program. Remove it with Windows "Installed apps".', bytes: 488 * MB, files: 96 },
    {
      id: 'claude-desktop', group: 'agents', label: 'Claude desktop app', path: `${home}\\AppData\\Roaming\\Claude`, advice: 'review', exists: true,
      note: "Claude desktop's own data, including a local VM image if you use Cowork. Manage it from Claude's settings.",
      bytes: 11.4 * GB, files: 5230, childCount: 14,
      children: [
        { name: 'vm_bundles', bytes: 10.1 * GB, kind: 'dir' },
        { name: 'Cache', bytes: 820 * MB, kind: 'dir' },
        { name: 'IndexedDB', bytes: 310 * MB, kind: 'dir' },
      ],
    },
    {
      id: 'claude-code', group: 'agents', label: 'Claude Code', path: `${home}\\.claude`, advice: 'review', exists: true,
      note: 'Config and session logs. Chat and Claude Stats read the logs in projects/.',
      bytes: 1.9 * GB, files: 4210, childCount: 11,
      children: [
        { name: 'projects', bytes: 1.6 * GB, kind: 'dir' },
        { name: 'file-history', bytes: 210 * MB, kind: 'dir' },
        { name: 'downloads', bytes: 90 * MB, kind: 'dir' },
      ],
    },
    {
      id: 'repos', group: 'agents', label: 'Repos folder', path: `${home}\\Repos`, advice: 'review', exists: true,
      note: 'Your git repos. node_modules and build output inside them can be rebuilt.',
      bytes: 7.3 * GB, files: 182_000, truncated: true, childCount: 6,
      children: [
        { name: 'demo-app', bytes: 4.1 * GB, kind: 'dir' },
        { name: 'notes-site', bytes: 2.2 * GB, kind: 'dir' },
        { name: 'scratch', bytes: 1.0 * GB, kind: 'dir' },
      ],
    },
    { id: 'npm-cache', group: 'dev', label: 'npm cache', path: `${home}\\AppData\\Local\\npm-cache`, advice: 'safe', tip: 'npm cache clean --force', exists: true, bytes: 5.6 * GB, files: 61_000 },
    { id: 'playwright', group: 'dev', label: 'Playwright browsers', path: `${home}\\AppData\\Local\\ms-playwright`, advice: 'review', tip: 'npx playwright uninstall --all', exists: true, bytes: 1.8 * GB, files: 2900 },
    { id: 'electron-cache', group: 'dev', label: 'Electron downloads', path: `${home}\\AppData\\Local\\electron\\Cache`, advice: 'safe', exists: true, bytes: 640 * MB, files: 6 },
    { id: 'temp', group: 'system', label: 'Temporary files', path: `${home}\\AppData\\Local\\Temp`, advice: 'safe', note: 'Windows Settings > System > Storage > Temporary files clears these safely.', exists: true, bytes: 3.2 * GB, files: 14_000, skipped: 12 },
    {
      id: 'downloads', group: 'system', label: 'Downloads', path: `${home}\\Downloads`, advice: 'review', note: 'Old installers and archives often pile up here.', exists: true,
      bytes: 9.8 * GB, files: 410, childCount: 120,
      children: [
        { name: 'big-dataset.zip', bytes: 4.4 * GB, kind: 'file' },
        { name: 'installer-old.exe', bytes: 1.1 * GB, kind: 'file' },
      ],
    },
    { id: 'hiberfil', group: 'system', label: 'Hibernation file', path: 'C:\\hiberfil.sys', kind: 'file', advice: 'keep', note: 'Used by hibernate and Fast Startup. An administrator can remove it with: powercfg /hibernate off', exists: true, bytes: 6.4 * GB, files: 1 },
  ],
}

/** Fictional history: a drive sample every 6 hours over two weeks, C: filling up, with three scans. */
export const sampleHistory: StorageHistory = (() => {
  const step = 6 * 3600_000
  const n = 14 * 4
  const end = Date.now() - 100_000
  const snapshots: HistorySnapshot[] = []
  for (let i = 0; i < n; i++) {
    const t = end - (n - 1 - i) * step
    const cFree = Math.max(5.5, 38 - i * 0.6 + Math.sin(i / 3) * 1.5) * GB
    const drives = [
      { id: 'C:', total: 476 * GB, free: i === n - 1 ? 6.2 * GB : cFree },
      { id: 'D:', total: 931 * GB, free: (530 - i * 0.3) * GB },
    ]
    const scanAt = i === 4 || i === 30 || i === n - 1
    if (!scanAt) {
      snapshots.push({ takenAt: new Date(t).toISOString(), kind: 'drives', drives })
      continue
    }
    const grow = i / (n - 1)
    snapshots.push({
      takenAt: new Date(t).toISOString(),
      kind: 'scan',
      drives,
      locations: (sampleScan.locations ?? []).map((l) => ({
        id: l.id,
        label: l.label,
        group: l.group,
        truncated: !!l.truncated,
        bytes: l.bytes === undefined ? undefined : l.id === 'claude-desktop' || l.id === 'npm-cache' ? l.bytes * (0.35 + 0.65 * grow) : l.bytes * (0.9 + 0.1 * grow),
      })),
    })
  }
  return { sampleEveryMs: step, snapshots }
})()

/** The scan before the latest one, for the change column. */
sampleScan.previous = (() => {
  const scans = sampleHistory.snapshots.filter((s) => s.kind === 'scan')
  const prev = scans.at(-2)
  return prev && { takenAt: prev.takenAt, sizes: Object.fromEntries((prev.locations ?? []).filter((l) => l.bytes !== undefined).map((l) => [l.id, l.bytes as number])) }
})()
