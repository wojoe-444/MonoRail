import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ExternalLink, Eraser, Globe, Home, Loader2, Plus, RotateCw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { prefs } from '@/lib/prefs'
import { cn } from '@/lib/utils'
import { invokeModule } from '@/modules/client'

import { toAddress } from './address'

/** The parts of Electron's <webview> element this page uses. */
interface WebviewElement extends HTMLElement {
  loadURL(url: string): Promise<void>
  getURL(): string
  getTitle(): string
  goBack(): void
  goForward(): void
  canGoBack(): boolean
  canGoForward(): boolean
  reload(): void
  stop(): void
  isLoading(): boolean
}

/** React only knows allowpopups as a boolean, which it would drop; the webview reads the attribute's presence. */
const WEBVIEW_ATTRS = { allowpopups: 'true' } as object

const HOME = 'https://www.google.com/'
const TABS_KEY = 'commandHub.browser.tabs'
const MAX_TABS = 20

interface Tab {
  id: number
  /** Address the tab was opened with (the webview's first src; later pages load with loadURL). */
  start: string
  url: string
  title: string
  loading: boolean
  canBack: boolean
  canForward: boolean
  error?: string
}

let nextId = 1
function newTab(url: string): Tab {
  return { id: nextId++, start: url, url, title: '', loading: true, canBack: false, canForward: false }
}

function savedTabs(): { tabs: Tab[]; active: number } {
  try {
    const raw = JSON.parse(prefs.getItem(TABS_KEY) ?? 'null') as { urls?: unknown; active?: unknown } | null
    const urls = Array.isArray(raw?.urls) ? raw.urls.filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u)).slice(0, MAX_TABS) : []
    if (urls.length) {
      const tabs = urls.map(newTab)
      const i = typeof raw?.active === 'number' && raw.active >= 0 && raw.active < tabs.length ? raw.active : 0
      return { tabs, active: tabs[i].id }
    }
  } catch {
    // Damaged pref: start fresh.
  }
  const tab = newTab(HOME)
  return { tabs: [tab], active: tab.id }
}

/** Only MonoRail's own desktop window has <webview>; the dev bridge and Remote access do not. */
function inDesktopWindow(): boolean {
  const bridge = typeof window !== 'undefined' ? window.commandHub : undefined
  return !!bridge && !bridge.devBridge && !bridge.remote
}

export default function BrowserPage() {
  if (!inDesktopWindow()) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md gap-2 p-6 text-sm">
          <h1 className="text-base font-semibold">Browser works in the desktop app</h1>
          <p className="text-muted-foreground">The in-app browser needs MonoRail's own window on your PC. It isn't available in a browser tab or on a phone.</p>
        </Card>
      </div>
    )
  }
  return <Browser />
}

function Browser() {
  const [{ tabs, active }, setState] = useState(savedTabs)
  const [address, setAddress] = useState('')
  const [editing, setEditing] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [notice, setNotice] = useState<string>()
  const views = useRef(new Map<number, WebviewElement>())
  const current = tabs.find((t) => t.id === active) ?? tabs[0]

  const update = useCallback((id: number, patch: Partial<Tab>) => {
    setState((s) => ({ ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
  }, [])

  const openTab = useCallback((url: string, focus = true) => {
    setState((s) => {
      if (s.tabs.length >= MAX_TABS) return s
      const tab = newTab(url)
      return { tabs: [...s.tabs, tab], active: focus ? tab.id : s.active }
    })
  }, [])

  function closeTab(id: number) {
    setState((s) => {
      const i = s.tabs.findIndex((t) => t.id === id)
      const rest = s.tabs.filter((t) => t.id !== id)
      if (!rest.length) {
        const tab = newTab(HOME)
        return { tabs: [tab], active: tab.id }
      }
      return { tabs: rest, active: s.active === id ? rest[Math.min(i, rest.length - 1)].id : s.active }
    })
    views.current.delete(id)
  }

  // Remember the open tabs (addresses only) for next time.
  useEffect(() => {
    prefs.setItem(TABS_KEY, JSON.stringify({ urls: tabs.map((t) => t.url), active: tabs.findIndex((t) => t.id === active) }))
  }, [tabs, active])

  // Links that ask for a new tab (target=_blank, middle click) arrive from the main process.
  useEffect(
    () =>
      window.commandHub?.on?.('browser:open-tab', (payload) => {
        const url = (payload as { url?: unknown } | undefined)?.url
        if (typeof url === 'string' && /^https?:\/\//i.test(url)) openTab(url)
      }),
    [openTab],
  )

  // The address bar follows the active tab unless the user is typing in it.
  useEffect(() => {
    if (!editing) setAddress(current?.url ?? '')
  }, [current?.url, current?.id, editing])

  // Ctrl+T new tab, Ctrl+W close, Ctrl+L address bar, Ctrl+R / F5 reload.
  const addressRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      if (e.ctrlKey && key === 't') openTab(HOME)
      else if (e.ctrlKey && key === 'w') closeTab(active)
      else if (e.ctrlKey && key === 'l') addressRef.current?.select()
      else if ((e.ctrlKey && key === 'r') || e.key === 'F5') views.current.get(active)?.reload()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // closeTab only reads state through setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, openTab])

  function go(e: FormEvent) {
    e.preventDefault()
    const url = toAddress(address)
    if (!url) {
      setNotice('Only http and https addresses can be opened here.')
      return
    }
    setNotice(undefined)
    setEditing(false)
    addressRef.current?.blur()
    void views.current.get(active)?.loadURL(url).catch(() => {})
  }

  async function openOutside() {
    if (!current?.url) return
    try {
      await invokeModule('browser', 'openExternal', { url: current.url })
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
    }
  }

  async function clearData() {
    setClearOpen(false)
    try {
      await invokeModule('browser', 'clearData')
      for (const view of views.current.values()) view.reload()
      setNotice('Signed out of every site and cleared the cache.')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err))
    }
  }

  const view = () => views.current.get(active)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Tabs */}
      <div className="flex shrink-0 items-end gap-1 overflow-x-auto border-b bg-muted/40 px-2 pt-2" role="tablist" aria-label="Tabs">
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tab"
            aria-selected={t.id === active}
            tabIndex={0}
            onClick={() => setState((s) => ({ ...s, active: t.id }))}
            onKeyDown={(e) => e.key === 'Enter' && setState((s) => ({ ...s, active: t.id }))}
            onAuxClick={(e) => e.button === 1 && closeTab(t.id)}
            className={cn(
              'group flex h-9 w-52 min-w-28 shrink cursor-default items-center gap-2 rounded-t-lg px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
              t.id === active ? 'bg-background ring-1 ring-foreground/10' : 'text-muted-foreground hover:bg-background/60',
            )}
            title={t.title || t.url}
          >
            {t.loading ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : <Globe className="size-3.5 shrink-0" />}
            <span className="min-w-0 flex-1 truncate">{t.title || t.url.replace(/^https?:\/\//, '')}</span>
            <button
              type="button"
              aria-label="Close tab"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(t.id)
              }}
              className="rounded p-0.5 opacity-60 hover:bg-accent hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <Button variant="ghost" size="icon" className="mb-0.5 size-8 shrink-0" aria-label="New tab" title="New tab (Ctrl+T)" disabled={tabs.length >= MAX_TABS} onClick={() => openTab(HOME)}>
          <Plus />
        </Button>
      </div>

      {/* Toolbar */}
      <form onSubmit={go} className="flex shrink-0 items-center gap-1 border-b px-2 py-2">
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Back" disabled={!current?.canBack} onClick={() => view()?.goBack()}>
          <ArrowLeft />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Forward" disabled={!current?.canForward} onClick={() => view()?.goForward()}>
          <ArrowRight />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={current?.loading ? 'Stop' : 'Reload'}
          onClick={() => (current?.loading ? view()?.stop() : view()?.reload())}
        >
          {current?.loading ? <X /> : <RotateCw />}
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Home" onClick={() => void view()?.loadURL(HOME).catch(() => {})}>
          <Home />
        </Button>
        <Input
          ref={addressRef}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onFocus={(e) => {
            setEditing(true)
            e.currentTarget.select()
          }}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setAddress(current?.url ?? '')
              e.currentTarget.blur()
            }
          }}
          aria-label="Address"
          placeholder="Search or type a web address"
          spellCheck={false}
          className="mx-1 h-8 flex-1 font-mono text-xs"
        />
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Open in your browser" title="Open in your browser (Chrome, if it is your default)" onClick={() => void openOutside()}>
          <ExternalLink />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Sign out of all sites" title="Sign out of all sites" onClick={() => setClearOpen(true)}>
          <Eraser />
        </Button>
      </form>
      {notice && (
        <div className="flex shrink-0 items-center gap-2 border-b bg-info-soft px-4 py-1.5 text-xs text-info-soft-foreground">
          <span className="flex-1">{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(undefined)}>
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Pages: every tab stays loaded; only the active one is shown. */}
      <div className="relative min-h-0 flex-1 bg-background">
        {tabs.map((t) => (
          <TabView
            key={t.id}
            tab={t}
            visible={t.id === active}
            onUpdate={update}
            register={(el) => {
              if (el) views.current.set(t.id, el)
              else views.current.delete(t.id)
            }}
          />
        ))}
      </div>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out of all sites?</DialogTitle>
            <DialogDescription>
              This clears the in-app browser's sign-ins, cookies, saved site data and cache for this profile. Your real Chrome is not touched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => void clearData()}>
              Sign out of all sites
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TabView({ tab, visible, onUpdate, register }: { tab: Tab; visible: boolean; onUpdate: (id: number, patch: Partial<Tab>) => void; register: (el: WebviewElement | null) => void }) {
  const ref = useRef<WebviewElement | null>(null)
  const { id, start } = tab

  useEffect(() => {
    const el = ref.current
    if (!el) return
    register(el)
    const nav = () =>
      onUpdate(id, { url: el.getURL(), title: el.getTitle(), canBack: el.canGoBack(), canForward: el.canGoForward(), error: undefined })
    const onStart = () => onUpdate(id, { loading: true })
    const onStop = () => {
      onUpdate(id, { loading: false })
      nav()
    }
    const onTitle = (e: Event) => onUpdate(id, { title: (e as Event & { title: string }).title })
    const onFail = (e: Event) => {
      const { errorCode, errorDescription, isMainFrame } = e as Event & { errorCode: number; errorDescription: string; isMainFrame: boolean }
      if (isMainFrame && errorCode !== -3) onUpdate(id, { loading: false, error: errorDescription || 'The page could not be loaded.' })
    }
    el.addEventListener('did-start-loading', onStart)
    el.addEventListener('did-stop-loading', onStop)
    el.addEventListener('did-navigate', nav)
    el.addEventListener('did-navigate-in-page', nav)
    el.addEventListener('page-title-updated', onTitle)
    el.addEventListener('did-fail-load', onFail)
    return () => {
      el.removeEventListener('did-start-loading', onStart)
      el.removeEventListener('did-stop-loading', onStop)
      el.removeEventListener('did-navigate', nav)
      el.removeEventListener('did-navigate-in-page', nav)
      el.removeEventListener('page-title-updated', onTitle)
      el.removeEventListener('did-fail-load', onFail)
      register(null)
    }
    // Set up once per tab; register and onUpdate are stable enough for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return (
    <div className={cn('absolute inset-0 flex flex-col', !visible && 'invisible')} aria-hidden={!visible}>
      {tab.error && <div className="shrink-0 border-b bg-destructive/10 px-4 py-1.5 text-xs text-destructive">{tab.error}</div>}
      <webview ref={ref as never} src={start} partition="persist:browser" {...WEBVIEW_ATTRS} className="min-h-0 w-full flex-1" />
    </div>
  )
}
