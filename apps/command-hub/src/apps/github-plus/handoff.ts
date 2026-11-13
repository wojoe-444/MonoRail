import { navigate } from '@/lib/router'

/**
 * Opening a repo in GitHub+ from another app (Tasks' linked repositories).
 * Kept in memory for the next GitHub+ mount only; nothing is stored. The
 * repo opens like one the user picked (it must still be a git repo).
 */
let pending: string | undefined

export function openInGitHubPlus(repoPath: string) {
  pending = repoPath
  navigate('/apps/github-plus/repo/tree')
}

/** Read the pending repo when GitHub+ starts. Cleared after the current render. */
export function takeGitHubPlusHandoff(): string | undefined {
  const p = pending
  if (p) setTimeout(() => {
    if (pending === p) pending = undefined
  }, 0)
  return p
}
