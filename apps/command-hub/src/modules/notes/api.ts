import { invokeModule, isDesktop } from '@/modules/client'

import { sampleInvoke } from './sample'

/** Call the Notes backend; in the browser dev server, the in-memory sample. */
export function call<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  return isDesktop() ? invokeModule<T>('notes', method, args) : sampleInvoke<T>(method, args)
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
