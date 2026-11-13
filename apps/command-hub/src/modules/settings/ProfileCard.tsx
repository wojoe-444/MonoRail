import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, Laptop, Loader2, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop } from '@/modules/client'

import type { ProfilesView } from './types'

const MODULE_ID = 'profiles'

/** Browser dev server: fictional, kept in memory. */
let sample: ProfilesView = {
  activeId: 'default',
  damaged: false,
  profiles: [{ id: 'default', name: '', createdAt: null, active: true, isDefault: true, dataDir: '%APPDATA%\\MonoRail' }],
  machineDir: '%APPDATA%\\MonoRail',
  scopes: { profile: [], machine: [] },
}

const call = <T,>(method: string, args?: { id: string; name: string }): Promise<T> =>
  isDesktop()
    ? invokeModule<T>(MODULE_ID, method, args)
    : new Promise<T>((r) => {
        if (method === 'rename' && args) sample = { ...sample, profiles: sample.profiles.map((p) => (p.id === args.id ? { ...p, name: args.name.trim() } : p)) }
        setTimeout(() => r(sample as T), 60)
      })

/** What a profile holds, in the page's words. electron/profiles SCOPES is the source of truth. */
const PROFILE_ITEMS = [
  'Appearance and layout choices',
  'Connections and their secrets',
  'Backup folder and schedules',
  'Flashcards decks and study history',
  'Notes',
  'Tasks projects, task links and filter',
  'GitHub+ recent repos and local backups',
  'Email accounts',
  'Chat folders, flags, prompts and choices',
  'Agent access consent and activity',
]
const MACHINE_ITEMS = ['Updates and app version', 'Installed extensions', 'Claude Stats report (this computer’s logs)', 'Storage measurements']

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts.slice(0, 2).map((p) => [...p][0].toUpperCase()).join('') : ''
}

/** Settings > Profile: the person this copy of MonoRail keeps settings and data for. */
export function ProfileCard({ className }: { className?: string }) {
  const [view, setView] = useState<ProfilesView>()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let live = true
    call<ProfilesView>('getProfiles').then(
      (v) => {
        if (!live) return
        setView(v)
        setName(v.profiles.find((p) => p.active)?.name ?? '')
      },
      (e: Error) => live && setError(e.message),
    )
    return () => {
      live = false
    }
  }, [])

  const active = view?.profiles.find((p) => p.active)
  const dirty = !!active && name.trim() !== active.name

  async function save() {
    if (!active) return
    setBusy(true)
    setError(undefined)
    setSaved(false)
    try {
      const v = await call<ProfilesView>('rename', { id: active.id, name })
      setView(v)
      setName(v.profiles.find((p) => p.active)?.name ?? '')
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const mark = initials(active?.name ?? '')

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Your settings and data in MonoRail belong to a profile. There is one profile today; it uses the data you already have, where it already is.
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="flex flex-col gap-6">
        {!view || !active ? (
          error ? (
            <ErrorLine text={error} />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          )
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-4">
              <div
                aria-hidden
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-semibold text-primary-soft-foreground"
              >
                {mark || <UserRound className="size-6" />}
              </div>
              <form
                className="flex min-w-0 flex-1 flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (dirty && !busy) void save()
                }}
              >
                <label htmlFor="profile-name" className="flex items-center gap-2 text-sm font-medium">
                  Name {active.isDefault && <Badge variant="secondary">Default profile</Badge>}
                </label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="profile-name"
                    className="max-w-sm"
                    value={name}
                    maxLength={60}
                    placeholder="Your name (optional)"
                    onChange={(e) => {
                      setName(e.target.value)
                      setSaved(false)
                    }}
                  />
                  <Button type="submit" disabled={!dirty || busy || view.damaged}>
                    {busy ? <Loader2 className="animate-spin" /> : saved && !dirty ? <Check /> : null}
                    {saved && !dirty ? 'Saved' : 'Save'}
                  </Button>
                </div>
              </form>
            </div>

            {view.damaged && (
              <ErrorLine text="The profile list (profiles.json in the data folder) cannot be read, so MonoRail will not overwrite it. The default profile is used meanwhile." />
            )}
            {error && <ErrorLine text={error} />}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ScopeList
                icon={<UserRound className="size-4" />}
                title="Kept per profile"
                items={PROFILE_ITEMS}
                tone="bg-primary-soft text-primary-soft-foreground"
              />
              <ScopeList
                icon={<Laptop className="size-4" />}
                title="Shared by this computer"
                items={MACHINE_ITEMS}
                tone="bg-muted text-muted-foreground"
              />
            </div>

            <div className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Profile data</span>
              <span className="font-mono text-xs break-all">{active.dataDir}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ScopeList({ icon, title, items, tone }: { icon: ReactNode; title: string; items: string[]; tone: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className={cn('flex size-7 items-center justify-center rounded-md', tone)}>{icon}</span>
        {title}
      </div>
      <ul className="flex flex-col divide-y text-sm">
        {items.map((t) => (
          <li key={t} className="py-2 text-muted-foreground first:pt-0 last:pb-0">
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span className="break-words">{text}</span>
    </div>
  )
}
