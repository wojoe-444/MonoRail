import type { AppId, MethodCall, MethodResult, SingleId } from '@/ipc/contract'
import { moduleClient } from '@/modules/client'

/** Call a method on an app's backend (electron/apps/<id>) in the Electron main process. */
export function invokeApp<Id extends AppId, C extends MethodCall<`app:${NoInfer<Id>}`>>(
  appId: Id & SingleId<NoInfer<Id>>,
  ...call: C
): Promise<MethodResult<`app:${Id}`, C>> {
  const backendId = `app:${appId}` as `app:${Id}` & SingleId<NoInfer<`app:${Id}`>>
  return moduleClient<`app:${Id}`>(backendId)(...call)
}
