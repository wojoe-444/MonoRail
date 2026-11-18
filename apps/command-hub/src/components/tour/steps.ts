/**
 * The steps of the new user tour, in order. `target` names an element marked
 * `data-tour="<target>"` (rail buttons are `nav:<path>`); a step without one,
 * or whose element is not on screen, shows its card in the middle.
 * Plain language for people using the app: no file names or internals.
 */
export interface TourStep {
  id: string
  target?: string
  /** Where the card sits next to the element. Default: right of it (rail icons). */
  side?: 'right' | 'bottom'
  title: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to MonoRail',
    body: 'One place for the AI agents you already use: talk to them, see what they cost and look after the work they produce. It runs on this computer and keeps what it learns here. This tour takes about a minute.',
  },
  {
    id: 'rail',
    target: 'rail',
    title: 'Everything is in the rail',
    body: 'Every page lives in this strip. Hover over an icon to see its name. Icons with a small arrow open a panel of subpages.',
  },
  {
    id: 'home',
    target: 'nav:/',
    title: 'Home',
    body: 'Your starting point: what your agents are up to, what they cost, and short guides to get going.',
  },
  {
    id: 'bots',
    target: 'nav:/agents',
    title: 'Bots',
    body: 'Chat with Claude Code and pi, carry on earlier conversations, and see runs and spending on the Dashboard.',
  },
  {
    id: 'tools',
    target: 'nav:/tools',
    title: 'Tools',
    body: 'Your workspace: browse the repositories on this computer, keep tasks, read email, take notes and study flashcards.',
  },
  {
    id: 'wiki',
    target: 'nav:/wiki',
    title: 'Wiki',
    body: 'Plain-language guides for every page. Links jump from page to page, so you can follow whatever catches your eye.',
  },
  {
    id: 'settings',
    target: 'nav:/settings',
    title: 'Settings',
    body: 'Pick a color scheme, connect your accounts, and turn on backups and updates. A dot on this button means something needs you.',
  },
  {
    id: 'breadcrumb',
    target: 'breadcrumb',
    side: 'bottom',
    title: 'Where you are',
    body: 'The bar at the top names the section and page you are on. When you are on a subpage, click its parent to go back up.',
  },
  {
    id: 'fullscreen',
    target: 'fullscreen',
    side: 'bottom',
    title: 'Full screen',
    body: 'Give a page the whole screen with this button or F11. Press it again to come back.',
  },
  {
    id: 'done',
    title: 'You are all set',
    body: 'Nothing runs until you ask: MonoRail only signs in to the accounts you add yourself. You can take this tour again any time from Home or Settings > General.',
  },
]
