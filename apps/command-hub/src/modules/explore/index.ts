import { lazy } from 'react'
import { Compass } from 'lucide-react'
import type { ModuleDefinition } from '../types'

export const exploreModule: ModuleDefinition = {
  id: 'explore', title: 'Explore', description: 'Browse everything MonoRail knows, sorted by the MonoRail standard.',
  icon: Compass, path: '/explore', nav: { section: '', order: 1 },
  component: lazy(() => import('./ExplorePage')),
}
