import { lazy } from 'react'
import { CalendarClock, ListChecks, Workflow } from 'lucide-react'
import type { ModuleDefinition } from '../types'

export const scheduledModule: ModuleDefinition = { id: 'scheduled-home', title: 'Scheduled', description: 'Scheduled work on this computer.', icon: CalendarClock, path: '/scheduled', nav: { section: 'Workspace' }, component: lazy(() => import('./ScheduledHome')) }
export const windowsSchedulerModule: ModuleDefinition = { id: 'scheduled', title: 'Windows Task Scheduler', description: 'View and manage Windows scheduled tasks.', icon: ListChecks, path: '/scheduled/windows', nav: { section: 'Workspace', parent: '/scheduled' }, component: lazy(() => import('./ScheduledPage')), dataMethods: ['list', 'change', 'openScheduler'] }
// Same backend as the Windows page (`scheduled`): its inApp / runInApp methods list the timers MonoRail runs itself.
export const inAppSchedulerModule: ModuleDefinition = { id: 'scheduled-in-app', title: 'In-App', description: 'Jobs MonoRail runs on a schedule while it is open.', icon: Workflow, path: '/scheduled/in-app', nav: { section: 'Workspace', parent: '/scheduled' }, component: lazy(() => import('./InAppPage')), dataMethods: ['inApp', 'runInApp'] }
