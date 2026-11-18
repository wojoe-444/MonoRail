import { useState } from 'react'
import { prefs } from '@/lib/prefs'

/** Open/closed state of a card, remembered per person (prefs). */
export function useCollapsed(key: string): [boolean, () => void] {
  const k = `commandHub.githubPlus.collapsed.${key}`
  const [closed, setClosed] = useState(() => prefs.getItem(k) === '1')
  const toggle = () => {
    const next = !closed
    if (next) prefs.setItem(k, '1')
    else prefs.removeItem(k)
    setClosed(next)
  }
  return [closed, toggle]
}
