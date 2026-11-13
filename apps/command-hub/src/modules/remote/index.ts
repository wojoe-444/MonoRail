import { lazy } from 'react'
import { Smartphone } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Remote access: use MonoRail from your own phone over Tailscale
 * (electron/remote, docs/remote-access.md). Off by default; managed only
 * from the PC's own window.
 */
export const remoteModule: ModuleDefinition = {
  id: 'remote',
  title: 'Remote access',
  description: 'Use MonoRail from your phone over Tailscale. Never public.',
  icon: Smartphone,
  path: '/settings/remote',
  nav: { section: 'Settings', group: 'Accounts & access', order: 115 },
  component: lazy(() => import('./RemoteAccessPage')),
  dataMethods: ['getStatus', 'setEnabled', 'check', 'setupServe', 'startPairing', 'cancelPairing', 'setAgentFromPhone', 'setLogins', 'renameDevice', 'revokeDevice', 'clearAudit'],
}
