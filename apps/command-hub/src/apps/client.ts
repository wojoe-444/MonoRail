import { ModuleUnavailableError } from '@/modules/client'

/** Call a method on an app's backend (electron/apps/<id>) in the Electron main process. */
export async function invokeApp<T>(appId: string, method: string, args?: unknown): Promise<T> {
  if (!window.commandHub) throw new ModuleUnavailableError()
  return window.commandHub.invoke<T>(`app:${appId}`, method, args)
}
