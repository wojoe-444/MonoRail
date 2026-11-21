// Compiled by tsc -b. These functions exist only to exercise call-site inference.
import { REMOTE_METHODS } from '../../electron/remote/policy.cjs'
import { invokeApp } from '@/apps/client'
import type { UsageReport } from '@/modules/claude-stats/types'
import { invokeModule, useModuleQuery } from '@/modules/client'
import type { CommandHubBridge } from '@/modules/types'
import type { BackendId, Method } from './contract'

type MissingPolicyMethods = {
  [Id in BackendId]: Exclude<Method<Id>, (typeof REMOTE_METHODS)[Id]['phone' | 'desktop'][number]>
}[BackendId]
type AssertNever<T extends never> = T
// The policy test in electron/remote/remote.test.cjs compares these same
// names with the actual module, app, and extension-management registry.
export type AllContractMethodsAreRegistered = AssertNever<MissingPolicyMethods>

export function checkInvoke(bridge: CommandHubBridge, id: string, method: string, fileMethod: 'list' | 'rename') {
  const report: Promise<UsageReport> = invokeModule('claude-stats', 'getUsage')
  void report
  void invokeModule('claude-stats', 'getUsage', { refresh: true })
  void invokeModule('notes', 'get', { id: 'note' })
  void invokeApp('email', 'getThread', { accountId: 'a', threadId: 't' })
  void bridge.invoke('app:tracker', 'snapshot')
  const extensionResult: Promise<unknown> = bridge.invokeExtension(id, method, { arbitrary: 1 })
  void extensionResult

  // @ts-expect-error Installed extension methods use invokeExtension.
  void bridge.invoke('ext:example', method)
  // @ts-expect-error Runtime string pairs cannot dispatch built-ins.
  void bridge.invoke(id, method)
  // @ts-expect-error Built-in methods must exist on the named backend.
  void bridge.invoke('notes', 'getUsage')
  // @ts-expect-error A correlated union cannot be called with a list-only payload.
  void invokeModule('files', fileMethod, { path: 'sample' })
  // @ts-expect-error A misspelled optional field cannot silently be ignored.
  void invokeModule('mcp', 'getAudit', { limit: 10, limt: 20 })
  // @ts-expect-error The payload is required.
  void invokeModule('notes', 'get')
  // @ts-expect-error A no-arg method takes no object.
  void invokeModule('notes', 'flush', {})
  // @ts-expect-error The caller cannot choose an unrelated response type.
  void invokeModule<string>('notes', 'list')
  // @ts-expect-error App IDs also select their own method set.
  void invokeApp('email', 'getSettings')
  // @ts-expect-error This app method requires both IDs.
  void invokeApp('email', 'getThread', { accountId: 'a' })
}

export function useCheckQuery() {
  const report = useModuleQuery('claude-stats', 'getUsage')
  const note = useModuleQuery('notes', 'get', { id: 'note' }, { enabled: false })
  const profile = useModuleQuery('profiles', 'getProfiles', undefined, { enabled: true })
  void report.refresh({ refresh: true })
  void note.reload({ id: 'other' })
  void note.refresh()
  void profile.reload()
  // @ts-expect-error A required payload is still required when the query is disabled.
  useModuleQuery('notes', 'get', undefined, { enabled: false })
  // @ts-expect-error Initial query payloads also reject unrecognized fields.
  useModuleQuery('notes', 'get', { id: 'note', unknown: true })
  // @ts-expect-error Refresh overrides use the method's payload type.
  void report.refresh({ force: true })
  // @ts-expect-error The method takes no payload, including on reload.
  void profile.reload({ id: 'profile' })
}
