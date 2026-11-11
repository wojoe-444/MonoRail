import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { navigate } from '@/lib/router'
import { invokeModule } from '@/modules/client'

import { requestExtensionSettings } from './store'

import type { ExtensionSummary } from './types'

/**
 * Hosts one extension page in a sandboxed iframe on its own origin
 * (monorail-ext://<id>/). The page cannot reach MonoRail's window, the
 * preload bridge, other extensions or the network. It talks to the hub only
 * through postMessage, and the hub only forwards what this extension may do:
 * call its own backend, ask the user for a folder, open an https link.
 *
 * Bridge protocol v1 (see packages/extension-sdk/client.js):
 *   frame -> hub  { monorail: 1, type: 'hello' }
 *   hub -> frame  { monorail: 1, type: 'init', theme, apiVersion, extension, contribution }
 *   frame -> hub  { monorail: 1, type: 'request', id, op: 'invoke' | 'pickFolder' | 'openExternal' | 'getSettings' | 'openSettings', ... }
 *   hub -> frame  { monorail: 1, type: 'response', id, ok, value | error }   error = { code, message, details? }
 *   frame -> hub  { monorail: 1, type: 'resize', height }   (modules only: page height)
 *   hub -> frame  { monorail: 1, type: 'theme', theme } | { monorail: 1, type: 'event', channel, payload }
 */

const BRIDGE = 1

/** What the "extensions" backend's call() returns (see electron/extensions/errors.cjs). */
type CallResult = { ok: true; value: unknown } | { ok: false; error: { code: string; message: string; details?: unknown } }

interface ExtensionFrameProps {
  ext: ExtensionSummary
  contribution: { id: string; title: string; entry: string }
  kind: 'module' | 'app'
  apiVersion: string
}

function entryUrl(ext: ExtensionSummary, entry: string): string {
  const [file, hash] = entry.split('#')
  return `monorail-ext://${ext.id}/${file}?r=${ext.revision}${hash ? `#${hash}` : ''}`
}

export function ExtensionFrame({ ext, contribution, kind, apiVersion }: ExtensionFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [theme] = useTheme()
  const [height, setHeight] = useState(480)
  const [error, setError] = useState<string>()
  const origin = `monorail-ext://${ext.id}`
  const src = entryUrl(ext, contribution.entry)

  // Keep the latest values for the message handler without re-binding it.
  const live = useRef({ theme, ext, apiVersion })
  useEffect(() => {
    live.current = { theme, ext, apiVersion }
  })

  // Only talk to the frame once its page said hello: before that it may still be about:blank.
  const connected = useRef(false)
  const post = (msg: Record<string, unknown>) => {
    if (connected.current) frame.current?.contentWindow?.postMessage({ monorail: BRIDGE, ...msg }, origin)
  }

  // A new src (reload or update) is a new page: wait for its hello.
  useEffect(() => {
    connected.current = false
  }, [src])

  useEffect(() => {
    post({ type: 'theme', theme })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow || e.origin !== origin) return
      const msg = e.data
      if (!msg || typeof msg !== 'object' || msg.monorail !== BRIDGE) return
      const { ext: x } = live.current
      switch (msg.type) {
        case 'hello':
          connected.current = true
          post({
            type: 'init',
            theme: live.current.theme,
            apiVersion: live.current.apiVersion,
            extension: { id: x.id, name: x.name, version: x.version },
            contribution: { id: contribution.id, kind },
          })
          break
        case 'resize':
          if (kind === 'module' && typeof msg.height === 'number' && msg.height > 0) setHeight(Math.min(Math.ceil(msg.height), 100000))
          break
        case 'request':
          void handleRequest(msg)
          break
      }
    }

    async function handleRequest(msg: { id: unknown; op: unknown; method?: unknown; args?: unknown; write?: unknown; url?: unknown }) {
      const id = live.current.ext.id
      try {
        let value: unknown
        if (msg.op === 'invoke') {
          if (typeof msg.method !== 'string') throw new Error('invoke needs a method name')
          const res = await invokeModule<CallResult>('extensions', 'call', { id, method: msg.method, args: msg.args })
          if (!res.ok) {
            post({ type: 'response', id: msg.id, ok: false, error: res.error })
            return
          }
          value = res.value
        } else if (msg.op === 'pickFolder') {
          value = await invokeModule('extensions', 'requestFolder', { id, write: msg.write === true })
        } else if (msg.op === 'openExternal') {
          value = await invokeModule('extensions', 'openExternal', { url: msg.url })
        } else if (msg.op === 'getSettings') {
          const snap = await invokeModule<{ values: unknown; secrets: unknown }>('extensions', 'getSettings', { id })
          value = { values: snap.values, secrets: snap.secrets }
        } else if (msg.op === 'openSettings') {
          requestExtensionSettings(id)
          navigate('/settings/extensions')
          value = null
        } else throw new Error(`Unknown request ${String(msg.op)}`)
        post({ type: 'response', id: msg.id, ok: true, value })
      } catch (err) {
        post({ type: 'response', id: msg.id, ok: false, error: { code: 'EXT_HOST_ERROR', message: cleanError(err) } })
      }
    }

    window.addEventListener('message', onMessage)
    const off = window.commandHub?.on?.('extension:event', (p) => {
      const ev = p as { id: string; channel: string; payload: unknown }
      if (ev?.id === live.current.ext.id) post({ type: 'event', channel: ev.channel, payload: ev.payload })
    })
    return () => {
      window.removeEventListener('message', onMessage)
      off?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, contribution.id, kind])

  return (
    <div className={cn('relative', kind === 'app' ? 'h-full' : 'w-full')}>
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </div>
      )}
      <iframe
        ref={frame}
        key={src}
        src={src}
        title={contribution.title}
        // Scripts run on the extension's own origin; no popups, no top navigation.
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads"
        allow=""
        referrerPolicy="no-referrer"
        onError={() => setError(`${ext.name} could not be loaded.`)}
        className={cn('block w-full border-0 bg-transparent', kind === 'app' && 'h-full')}
        style={kind === 'module' ? { height } : undefined}
      />
    </div>
  )
}

/** IPC errors arrive as "Error invoking remote method 'module:invoke': Error: <message>". */
function cleanError(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  return text.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
