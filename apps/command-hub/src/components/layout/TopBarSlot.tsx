import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/*
 * A slot in the top bar that a page can fill (ported from monorail-ui's
 * header style A). App.tsx hosts it; TopBar renders the target element and
 * hides the breadcrumb while a page has claimed it.
 */

interface TopBarSlotValue {
  target: HTMLElement | null
  setTarget: (el: HTMLElement | null) => void
  /** Hide the breadcrumb until the returned function is called. */
  claim: () => () => void
  claimed: boolean
}

const TopBarSlotContext = createContext<TopBarSlotValue | null>(null)

export function TopBarSlotProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [claims, setClaims] = useState(0)
  const claim = useCallback(() => {
    setClaims((c) => c + 1)
    return () => setClaims((c) => c - 1)
  }, [])
  const value = useMemo(() => ({ target, setTarget, claim, claimed: claims > 0 }), [target, claim, claims])
  return <TopBarSlotContext.Provider value={value}>{children}</TopBarSlotContext.Provider>
}

/** TopBar's side: where to put the slot element, and whether a page took the breadcrumb's place. */
export function useTopBarSlot() {
  return useContext(TopBarSlotContext)
}

interface TopBarPortalProps {
  children: ReactNode
  /** Take the breadcrumb's place (default). Pass `false` to sit beside it. */
  replaceBreadcrumb?: boolean
}

/**
 * Renders its children inside the top bar, where the breadcrumb is, for as
 * long as the page is mounted. `PageCommandBar` uses it. The slot is a flex
 * row with `gap-3`.
 */
export function TopBarPortal({ children, replaceBreadcrumb = true }: TopBarPortalProps) {
  const slot = useContext(TopBarSlotContext)
  const claim = slot?.claim
  useEffect(() => (claim && replaceBreadcrumb ? claim() : undefined), [claim, replaceBreadcrumb])
  if (!slot?.target) return null
  return createPortal(children, slot.target)
}
