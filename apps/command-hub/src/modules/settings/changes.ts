import type { AppStatus, ReleaseChanges } from './types'

// Flattens the release notes the settings backend returned (see WhatsNew.tsx).

export type ChangeItem = ReleaseChanges['items'][number] & { key: string }

/** Every noted change, newest release first. */
export function changeItems(status: AppStatus): ChangeItem[] {
  const out: ChangeItem[] = []
  for (const release of status.changes ?? [])
    release.items.forEach((item, i) => out.push({ ...item, key: `${release.version}-${i}` }))
  if (out.length || status.changes) return out
  // Notes from the updater alone (the release list could not be read): latest release only.
  const text = status.releaseNotes ? stripHtml(status.releaseNotes) : ''
  if (!text || /^Built from [0-9a-f]+\.?$/i.test(text)) return out
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((title, i) => ({ title, text: '', key: `notes-${i}` }))
}

/** Release notes may arrive as HTML; show plain text. */
function stripHtml(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? ''
}
