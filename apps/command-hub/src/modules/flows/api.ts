import { moduleClient } from '@/modules/client'

import { sampleInvoke } from './sample'

/** Call the Flows backend; in the browser dev server, the in-memory sample. */
export const call = moduleClient('flows', sampleInvoke)

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
