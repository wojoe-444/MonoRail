/** What the `remote` backend's getStatus returns (electron/remote/service.cjs). */
export interface RemoteSettings {
  enabled: boolean
  port: number
  allowedLogins: string[]
  agentFromPhone: boolean
}

export interface TailscaleCheck {
  state: 'missing' | 'stopped' | 'running' | 'error'
  login?: string
  dnsName?: string
  backendState?: string
  serve?: 'ok' | 'missing' | 'other'
  funnel?: boolean
  host?: string
  error?: string
}

export interface RemoteDevice {
  id: string
  name: string
  agent: string
  pairedAt: string
  lastSeen: string
}

export interface RemoteAuditEntry {
  at: string
  device: string
  deviceId?: string
  module: string
  method: string
  outcome: 'ok' | 'refused' | 'error'
  ms: number
  reason?: string
}

export interface RemoteStatus {
  settings: RemoteSettings
  settingsDamaged: boolean
  listening: boolean
  serverError?: string
  blocked?: 'public'
  tailscale: TailscaleCheck | null
  checkedAt: number | null
  address: string | null
  devices: RemoteDevice[]
  devicesDamaged: boolean
  pairing: { expiresAt: number } | null
  audit: RemoteAuditEntry[]
}
