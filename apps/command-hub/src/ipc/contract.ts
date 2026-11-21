import type { AppIpc } from './apps'
import type { ModuleIpc } from './modules'

/** One request payload and its resolved response, shared by all transports. */
export type Rpc<Result, Args = undefined> = { args: Args; result: Result }

type PrefixedApps = { [Id in keyof AppIpc as `app:${Id}`]: AppIpc[Id] }
type Ipc = ModuleIpc & PrefixedApps
export type BackendId = keyof Ipc
export type ModuleId = keyof ModuleIpc
export type AppId = keyof AppIpc
export type Method<Id extends BackendId> = keyof Ipc[Id] & string

export type Args<Id extends BackendId, M extends Method<Id>> = Ipc[Id][M] extends { args: infer A } ? A : never
export type Result<Id extends BackendId, M extends Method<Id>> = Ipc[Id][M] extends { result: infer R } ? R : never
type Payload<A> = undefined extends A ? [args?: A] : [args: A]

// Distribute over method names before building tuples, so a method union can't
// be paired with a payload belonging to a different member of that union.
export type MethodCall<Id extends BackendId, M extends Method<Id> = Method<Id>> = {
  [K in M]: [method: K, ...payload: Payload<Args<Id, K>>]
}[M]

export type MethodResult<Id extends BackendId, C extends MethodCall<Id>> = Result<Id, C[0] & Method<Id>>
export type ScopedRequest<Id extends BackendId, M extends Method<Id>> =
  [method: M, ...unknown[]] & NoInfer<MethodCall<Id, M>>

// Bind to a single backend before choosing a method. A union of IDs would let
// a shared method accept one backend's payload and send it to another.
export type SingleId<Id, All = Id> = Id extends All ? [All] extends [Id] ? Id : never : never

export type BuiltinInvoke = <const Id extends BackendId, const M extends Method<Id>>(
  moduleId: Id & SingleId<NoInfer<Id>>,
  ...call: ScopedRequest<NoInfer<Id>, M>
) => Promise<Result<Id, M>>

/** The unchanged wire envelope, including calls to runtime-installed extensions. */
export type InvokeRequest = { moduleId: string; method: string; args?: unknown }

/** Checked against the access policy, which is independently tested against the live registry. */
export type BackendAccessPolicy = {
  [Id in BackendId]: { phone: readonly Method<Id>[]; desktop: readonly Method<Id>[] }
}

export interface BackendContext {
  dataDir: string
  profile: { id: string; name: string }
  layout: { folder(name: string): string; profileDir: string; machineDir: string }
  profileDir: string
  machineDir: string
  rootDir: string
  isPackaged: boolean
  log(...args: unknown[]): void
  remoteLimits?: { askOnly: boolean }
}

export type ModuleBackend<Id extends ModuleId> = {
  id: Id
  desktopOnly?: readonly Method<Id>[]
  start?(ctx: BackendContext): void
  methods: {
    [M in Method<Id>]: (ctx: BackendContext, args: Args<Id, M>) => Result<Id, M> | Promise<Result<Id, M>>
  }
}
