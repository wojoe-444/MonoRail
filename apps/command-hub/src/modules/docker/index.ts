import { lazy } from 'react'
import { Container } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Docker: a lazydocker-style look at what Docker runs on this computer.
 * Read-only, and only once the user has added the Docker connection
 * (electron/modules/docker.cjs).
 */
export const dockerModule: ModuleDefinition = {
  id: 'docker',
  title: 'Docker',
  description: 'Containers, their logs and load, images and volumes, from your own Docker.',
  icon: Container,
  path: '/docker',
  nav: { section: 'Utilities' },
  component: lazy(() => import('./DockerPage')),
  dataMethods: ['getOverview', 'getStats', 'getLogs', 'getContainer', 'openLazydocker', 'openLazydockerPage'],
}
