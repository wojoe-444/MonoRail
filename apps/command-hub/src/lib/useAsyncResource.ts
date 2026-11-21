import { useEffect, useState } from 'react'

type Resource<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error' }

/** Load on mount, ignore results after unmount, and allow a failed load to be retried. */
export function useAsyncResource<T>(load: () => Promise<T>) {
  const [resource, setResource] = useState<Resource<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    void load().then(
      (data) => live && setResource({ status: 'ready', data }),
      () => live && setResource({ status: 'error' }),
    )
    return () => { live = false }
  }, [load, attempt])

  function retry() {
    setResource({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  return [resource, retry, attempt > 0] as const
}
