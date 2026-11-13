import type { RemoteStatus } from './types'

const now = Date.now()
const ago = (min: number) => new Date(now - min * 60_000).toISOString()

/** Shown in the browser dev server, where there is no backend. Fictional names. */
export const sampleStatus: RemoteStatus = {
  settings: { enabled: true, port: 5170, allowedLogins: ['you@example.com'], agentFromPhone: false },
  settingsDamaged: false,
  listening: true,
  tailscale: { state: 'running', login: 'you@example.com', dnsName: 'monorail-pc.tail0000.ts.net', serve: 'ok', funnel: false },
  checkedAt: now - 60_000,
  address: 'https://monorail-pc.tail0000.ts.net',
  devices: [
    { id: 'd1', name: 'Phone', agent: 'Chrome on Android', pairedAt: ago(600), lastSeen: ago(0) },
    { id: 'd2', name: 'Tablet', agent: 'Safari on iPadOS', pairedAt: ago(900), lastSeen: ago(180) },
  ],
  devicesDamaged: false,
  pairing: null,
  audit: [
    { at: ago(1), device: 'Phone', module: 'agent-chat', method: 'startTurn', outcome: 'ok', ms: 40 },
    { at: ago(3), device: 'Phone', module: 'backups', method: 'pickFolder', outcome: 'refused', ms: 0, reason: 'Do this on your PC: it needs the PC screen.' },
    { at: ago(5), device: 'Phone', module: 'remote', method: 'pair', outcome: 'ok', ms: 0 },
  ],
}
