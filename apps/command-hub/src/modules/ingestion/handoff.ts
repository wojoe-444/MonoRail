import { navigate } from '@/lib/router'

/**
 * Opening Services from another page (the OpenMetadata page's empty state)
 * straight to a data service's Add ingestion dialog. Kept in memory for the
 * next Services page mount only; nothing is stored.
 */
let pending: string | undefined

/** Open Services with the Add ingestion dialog of the local service `kind` (a connector kind such as `sqlite`). */
export function openAddIngestion(kind: string) {
  pending = kind
  navigate('/services')
}

/**
 * Read the pending service kind when the Services page mounts. It is cleared
 * after the current render (React may call a state initializer twice in
 * development).
 */
export function takeAddIngestion(): string | undefined {
  const k = pending
  if (k) {
    setTimeout(() => {
      if (pending === k) pending = undefined
    }, 0)
  }
  return k
}
