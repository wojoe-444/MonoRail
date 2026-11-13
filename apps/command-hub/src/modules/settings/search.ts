import type { ModuleDefinition } from '../types'

/**
 * What the Settings search looks through. Every Settings page is found by
 * its title and description (from the module registry, so extension
 * settings pages are included); the entries below add the cards and options
 * inside the built-in pages. `anchor` is the id of the element to scroll to
 * on that page. Add an entry when you add a card or an option to a Settings
 * page, so people can find it by name.
 */
export interface SearchEntry {
  label: string
  /** Shown under the label: what it is, or where on the page. */
  detail: string
  path: string
  anchor?: string
  /** Extra words that should find it. */
  keywords?: string
}

export const SEARCH_ENTRIES: SearchEntry[] = [
  // General
  { label: 'Updates', detail: 'Check for a newer version, download and restart', path: '/settings/general', anchor: 'settings-updates', keywords: 'update upgrade version release new install restart' },
  { label: "What's new", detail: 'Changes in the next version', path: '/settings/general', anchor: 'settings-updates', keywords: 'release notes changelog' },
  { label: 'About', detail: 'Version, Electron, local data folder', path: '/settings/general', anchor: 'settings-about', keywords: 'version electron appdata data folder location' },
  { label: 'Profile', detail: 'Whose settings and data MonoRail uses', path: '/settings/general', anchor: 'settings-profile', keywords: 'user person account name' },
  { label: 'Spending limit', detail: 'A daily or monthly cap on what Chat may spend', path: '/settings/general', anchor: 'settings-spending', keywords: 'budget cost money limit cap spend dollars' },
  { label: 'Developer Mode', detail: 'Element inspector, F12 DevTools, New User profile', path: '/settings/general', anchor: 'settings-developer', keywords: 'devtools inspector debug f12 test new user' },
  // Appearance
  { label: 'Color scheme', detail: 'Sand & Ink, Botanical, Indigo Ink and more', path: '/settings/appearance', keywords: 'palette theme colour color look' },
  { label: 'Light or dark mode', detail: 'Appearance', path: '/settings/appearance', keywords: 'dark mode light mode night theme' },
  // Backups
  { label: 'Global backup folder', detail: 'One folder every page backs up into', path: '/settings/backups', keywords: 'backup onedrive folder copy bundle' },
  { label: 'Backup frequency', detail: 'Times per hour, day or week, and how many to keep', path: '/settings/backups', keywords: 'schedule how often keep prune' },
  { label: 'Back up before updating', detail: 'Back up Tasks, Notes and Flashcards before an update installs', path: '/settings/backups', anchor: 'settings-backup-before-update', keywords: 'update upgrade safety backup install before' },
  { label: 'Back up now', detail: 'Run every included backup', path: '/settings/backups', keywords: 'run backup' },
  // Connections (connector names; their rows have ids `connection-<kind>`)
  { label: 'Google Cloud', detail: 'Connections: gcloud login and Application Default Credentials', path: '/connections', anchor: 'connection-gcloud', keywords: 'gcloud gcp adc sign in' },
  { label: 'Atlassian', detail: 'Connections: Jira Cloud site, email and API token', path: '/connections', anchor: 'connection-atlassian', keywords: 'jira token api credential manager' },
  { label: 'Claude', detail: 'Connections: Claude Code login and account type', path: '/connections', anchor: 'connection-claude', keywords: 'claude code anthropic subscription api enterprise login' },
  { label: 'OpenAI', detail: 'Connections: API key and Codex CLI', path: '/connections', anchor: 'connection-openai', keywords: 'openai codex chatgpt api key token' },
  { label: 'pi', detail: 'Connections: pi coding agent and scoped models', path: '/connections', anchor: 'connection-pi', keywords: 'pi scoped models' },
  { label: 'Playwright browser', detail: 'Connections: pi drives your own Chrome or Edge tabs', path: '/connections', anchor: 'connection-pi-playwright', keywords: 'chrome edge browser extension playwright' },
  { label: 'Playwright browser', detail: 'Connections: Claude Code uses your own Chrome or Edge tabs', path: '/connections', anchor: 'connection-claude-playwright', keywords: 'chrome edge browser extension playwright mcp claude code' },
  { label: 'Git', detail: 'Connections: version, commit identity, credential helper', path: '/connections', anchor: 'connection-git', keywords: 'git user.name user.email' },
  { label: 'Docker', detail: 'Connections: your own Docker and lazydocker (optional)', path: '/connections', anchor: 'connection-docker', keywords: 'docker lazydocker containers compose' },
  { label: 'GitHub', detail: 'Connections: your github.com account for GitHub+', path: '/connections', anchor: 'connection-github', keywords: 'github gh token cli' },
  // Agent access
  { label: 'Connect an agent', detail: 'Agent access: add MonoRail to Claude Code and others', path: '/mcp', keywords: 'mcp server claude code setup' },
  { label: 'Write tools per agent', detail: 'Agent access: what each agent may change', path: '/mcp', keywords: 'consent permission allow write tools' },
  { label: 'Activity', detail: 'Agent access: every tool call agents made', path: '/mcp', keywords: 'audit log history' },
  // Remote access
  { label: 'Use MonoRail from your phone', detail: 'Remote access: over Tailscale, never public', path: '/settings/remote', keywords: 'phone mobile tailscale remote tablet away' },
  { label: 'Pair a phone', detail: 'Remote access: scan a code with the phone', path: '/settings/remote', keywords: 'qr code pair device phone' },
  { label: 'Paired devices', detail: 'Remote access: rename or revoke a phone', path: '/settings/remote', keywords: 'revoke sign out device phone tablet' },
  { label: 'Agent mode from the phone', detail: 'Remote access: let phone chats use Agent mode', path: '/settings/remote', keywords: 'ask agent mode phone permissions' },
  // Extensions
  { label: 'Install an extension', detail: 'Extensions: from a folder, a .zip or GitHub', path: '/settings/extensions', keywords: 'add install zip github release' },
  { label: 'Extension permissions', detail: 'Extensions: what each extension may access', path: '/settings/extensions', keywords: 'permissions approve folders network' },
]

export interface SearchHit extends SearchEntry {
  page: string
}

/** Every page and entry that matches all words of the query, best first. */
export function searchSettings(query: string, pages: ModuleDefinition[]): SearchHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const titleOf = (path: string) => pages.find((p) => p.path === path)?.title ?? 'Settings'
  const all: SearchHit[] = [
    ...pages.map((p) => ({ label: p.title, detail: p.description, path: p.path, page: p.title })),
    ...SEARCH_ENTRIES.filter((e) => pages.some((p) => p.path === e.path)).map((e) => ({ ...e, page: titleOf(e.path) })),
  ]
  const scored = all
    .map((h) => {
      const label = h.label.toLowerCase()
      const hay = `${label} ${h.detail} ${h.keywords ?? ''} ${h.page}`.toLowerCase()
      if (!words.every((w) => hay.includes(w))) return undefined
      const score = (label.startsWith(words[0]) ? 0 : label.includes(words[0]) ? 1 : 2) + (h.anchor || h.page !== h.label ? 0.5 : 0)
      return { h, score }
    })
    .filter((x): x is { h: SearchHit; score: number } => !!x)
  return scored.sort((a, b) => a.score - b.score).map((x) => x.h)
}
