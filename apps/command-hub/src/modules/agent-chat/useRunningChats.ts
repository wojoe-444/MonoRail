import { useEffect, useState } from 'react'

import { invokeModule } from '@/modules/client'

const sampleWorking = ['claude:demo-1']

export function useRunningChats(desktop: boolean) {
  // Working: chats with a turn running in the main process, from this page or
  // the phone. The backend list is polled while the page is open.
  const [backendRunning, setBackendRunning] = useState<string[]>([])
  useEffect(() => {
    if (!desktop) return
    let stopped = false
    const read = () =>
      invokeModule<string[]>('agent-chat', 'runningChats').then(
        (ids) => {
          if (!stopped) setBackendRunning((prev) => (prev.join() === ids.join() ? prev : ids))
        },
        () => {},
      )
    void read()
    const timer = setInterval(read, 5000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [desktop])
  return desktop ? backendRunning : sampleWorking
}
