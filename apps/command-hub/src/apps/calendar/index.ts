import { lazy } from 'react'
import { CalendarDays } from 'lucide-react'
import type { AppDefinition } from '../types'

export const calendarApp: AppDefinition = {
  id: 'calendar', title: 'Calendar', description: 'See your schedule at a glance.', icon: CalendarDays,
  path: '/apps/calendar', placement: 'workspace', component: lazy(() => import('./CalendarApp')),
}
