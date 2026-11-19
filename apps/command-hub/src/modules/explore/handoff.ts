import { navigate } from '@/lib/router'

/**
 * Opening Explore at one entity type from elsewhere (the command palette).
 * Module routes are exact paths, so the type is handed over in memory for the
 * next Explore mount only; nothing is stored.
 */
let pending: string | undefined

export function openInExplore(type: string) {
  pending = type
  navigate('/explore')
}

/**
 * The type to open, read once when Explore mounts. It is cleared after the
 * current render (React may call a state initializer twice in development).
 */
export function takeExploreHandoff(): string | undefined {
  const t = pending
  if (t) setTimeout(() => {
    if (pending === t) pending = undefined
  }, 0)
  return t
}
