// Fictional sessions for the browser dev server, where there is no backend.
import type { AllowedFolders, ComposerInfo, SessionList, SessionTranscript } from './types'

const now = Date.now()
const min = 60_000

export const sampleSessions: SessionList = {
  sources: [
    { id: 'claude', label: 'Claude Code', found: true },
    { id: 'pi', label: 'pi', found: true },
  ],
  sessions: [
    {
      id: 'claude:demo-1',
      source: 'claude',
      sessionId: 'demo-1',
      title: 'Add a dark mode toggle to the settings page',
      preview: 'Add a dark mode toggle to the settings page',
      project: 'garden-planner',
      cwd: '/home/demo/garden-planner',
      branch: 'feature/dark-mode',
      model: 'claude-sonnet-demo',
      startedAt: now - 42 * min,
      updatedAt: now - 12 * min,
      sizeBytes: 48_000,
      repo: { name: 'garden-planner', path: '/home/demo/Repos/garden-planner' },
    },
    {
      id: 'pi:demo-2',
      source: 'pi',
      sessionId: 'demo-2',
      title: 'Why does the seed import skip rows with empty dates?',
      preview: 'Why does the seed import skip rows with empty dates?',
      project: 'seed-catalog',
      cwd: '/home/demo/seed-catalog',
      model: 'demo-model-large',
      startedAt: now - 5 * 60 * min,
      updatedAt: now - 4 * 60 * min,
      sizeBytes: 21_000,
      repo: { name: 'seed-catalog', path: '/home/demo/Repos/seed-catalog' },
    },
    {
      id: 'claude:demo-3',
      source: 'claude',
      sessionId: 'demo-3',
      title: 'Write release notes for 0.4',
      preview: 'Write release notes for 0.4',
      project: 'garden-planner',
      cwd: '/home/demo/garden-planner',
      branch: 'main',
      model: 'claude-haiku-demo',
      startedAt: now - 26 * 60 * min,
      updatedAt: now - 25 * 60 * min,
      sizeBytes: 9_000,
      repo: { name: 'garden-planner', path: '/home/demo/Repos/garden-planner' },
    },
  ],
  limits: { scanned: 3, totalLogs: 3, kept: 3, dropped: 0, outsideAllowed: 0 },
  folders: { reposRoot: '/home/demo/Repos', reposRootFound: true, repoCount: 2 },
}

export const sampleFolders: AllowedFolders = {
  reposRoot: '/home/demo/Repos',
  reposRootFound: true,
  rootIsDefault: true,
  repos: [
    { path: '/home/demo/Repos/garden-planner', name: 'garden-planner', source: 'root' },
    { path: '/home/demo/Repos/seed-catalog', name: 'seed-catalog', source: 'root' },
  ],
  added: [],
}

export const sampleTranscripts: Record<string, SessionTranscript> = {
  'claude:demo-1': {
    id: 'claude:demo-1',
    messages: [
      { role: 'user', ts: now - 42 * min, blocks: [{ type: 'text', text: 'Add a dark mode toggle to the settings page' }] },
      {
        role: 'assistant',
        ts: now - 41 * min,
        model: 'claude-sonnet-demo',
        blocks: [
          { type: 'thinking', text: 'I should find where settings are rendered and how the theme is stored.' },
          { type: 'text', text: "I'll start by finding the settings page and the current theme handling." },
          { type: 'tool', name: 'Grep', summary: 'theme', input: '{\n  "pattern": "theme"\n}', result: 'src/settings/SettingsPage.tsx\nsrc/lib/theme.ts' },
          { type: 'tool', name: 'Read', summary: 'src/lib/theme.ts', input: '{\n  "file_path": "src/lib/theme.ts"\n}', result: 'export function applyTheme(mode) { … }' },
        ],
      },
      {
        role: 'assistant',
        ts: now - 38 * min,
        model: 'claude-sonnet-demo',
        blocks: [
          {
            type: 'text',
            text: 'There is already an `applyTheme` helper, so the toggle only needs to call it and remember the choice:\n\n```tsx\n<Switch checked={dark} onCheckedChange={(v) => setMode(v ? "dark" : "light")} />\n```\n\nI added it under **Appearance** and saved the choice in local storage.',
          },
          { type: 'tool', name: 'Bash', summary: 'npm test', input: 'npm test', result: '12 passing', isError: false },
        ],
      },
      { role: 'user', ts: now - 14 * min, blocks: [{ type: 'text', text: 'Looks good. Can you also follow the system setting by default?' }] },
      {
        role: 'assistant',
        ts: now - 12 * min,
        model: 'claude-sonnet-demo',
        blocks: [{ type: 'text', text: 'Done. With no saved choice the app now reads `prefers-color-scheme` and updates when it changes.' }],
      },
    ],
  },
  'pi:demo-2': {
    id: 'pi:demo-2',
    messages: [
      { role: 'user', ts: now - 5 * 60 * min, blocks: [{ type: 'text', text: 'Why does the seed import skip rows with empty dates?' }] },
      {
        role: 'assistant',
        ts: now - 5 * 60 * min + min,
        model: 'demo-model-large',
        blocks: [
          { type: 'tool', name: 'read', summary: 'import/seeds.py', input: '{\n  "path": "import/seeds.py"\n}', result: 'if not row["sown"]:\n    continue' },
          { type: 'text', text: 'Line 41 skips any row without a `sown` date. Rows from the 2019 sheet leave it blank, so they are dropped.' },
        ],
      },
      { role: 'system', ts: now - 4 * 60 * min, blocks: [{ type: 'text', text: 'Model changed to demo-model-small' }] },
    ],
  },
  'claude:demo-3': {
    id: 'claude:demo-3',
    messages: [
      { role: 'user', ts: now - 26 * 60 * min, blocks: [{ type: 'text', text: 'Write release notes for 0.4' }] },
      {
        role: 'assistant',
        ts: now - 25 * 60 * min,
        model: 'claude-haiku-demo',
        blocks: [{ type: 'text', text: '## 0.4\n\n- Dark mode\n- Faster seed import\n- Fixed the frost date calculation for southern gardens' }],
      },
    ],
  },
}

/** The browser preview cannot run agents. */
export const sampleComposer: ComposerInfo = {
  sdks: [
    { id: 'claude', label: 'Claude', ready: false, reason: 'Sending works in the desktop app.' },
    { id: 'pi', label: 'pi', ready: false, reason: 'Sending works in the desktop app.' },
  ],
  models: [
    { id: 'default', label: 'Default' },
    { id: 'claude-opus-5-5', label: 'Opus 5.5' },
    { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  ],
  piModels: [
    { id: 'default', label: 'Default' },
    { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  ],
  efforts: ['default', 'low', 'medium', 'high', 'xhigh', 'max'],
  repos: sampleFolders.repos.map((r) => ({ name: r.name, path: r.path })),
}
