/**
 * Per-profile preferences kept in the renderer's localStorage (appearance,
 * nav groups, Chat's composer choices, ...). See docs/profiles.md.
 *
 * localStorage belongs to the whole data folder, so a preference is scoped to
 * a profile by its key. The default profile uses the keys MonoRail has always
 * used (`commandHub.palette`, `monorail.email.account`, ...), so every
 * existing preference is read in place and nothing is copied or renamed.
 * Another profile (later) gets the same key under a prefix:
 * `commandHub.profile.<id>.<key>`.
 *
 * Use `prefs.getItem` / `prefs.setItem` instead of `localStorage` for anything
 * that belongs to the person. Machine-wide renderer state may still use
 * localStorage directly (there is none today).
 */

export const DEFAULT_PROFILE_ID = 'default'
/** Machine-wide: which profile this window shows. Absent = the default profile. */
const ACTIVE_KEY = 'commandHub.activeProfile'

export function activeProfileId(): string {
  try {
    const v = localStorage.getItem(ACTIVE_KEY)
    return v && /^[a-z0-9][a-z0-9-]{0,39}$/.test(v) ? v : DEFAULT_PROFILE_ID
  } catch {
    return DEFAULT_PROFILE_ID
  }
}

/** The localStorage key for a preference in a profile. */
export function profileKey(key: string, profileId: string = activeProfileId()): string {
  return profileId === DEFAULT_PROFILE_ID ? key : `commandHub.profile.${profileId}.${key}`
}

export const prefs = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(profileKey(key))
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(profileKey(key), value)
    } catch {
      /* storage unavailable: keep it for this session */
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(profileKey(key))
    } catch {
      /* ignore */
    }
  },
}
