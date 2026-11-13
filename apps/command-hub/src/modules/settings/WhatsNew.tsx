import type { AppStatus } from './types'
import { changeItems, type ChangeItem as Item } from './changes'

// "What's new" between the installed and the latest version. The settings
// backend reads the notes of every release in between (release-notes.cjs);
// CI writes them from the merged pull requests. Shown in Settings (full) and
// in the update pop-up (compact).

function versionsLine(status: AppStatus): string | null {
  const n = status.changes?.length ?? 0
  if (n < 2) return null
  return `${n} updates since your version ${status.currentVersion}.`
}

/** Full list for Settings, grouped by version when there are several. */
export function WhatsNewList({ status }: { status: AppStatus }) {
  const items = changeItems(status)
  const releases = status.changes ?? []
  const silent = releases.filter((r) => r.items.length === 0).length
  if (!items.length) return null
  const grouped = releases.filter((r) => r.items.length).length > 1
  return (
    <div className="flex flex-col gap-4">
      {versionsLine(status) && <p className="text-sm text-muted-foreground">{versionsLine(status)}</p>}
      {grouped ? (
        releases
          .filter((r) => r.items.length)
          .map((r) => (
            <div key={r.version} className="flex flex-col gap-2">
              <div className="font-mono text-xs text-muted-foreground">{r.version}</div>
              <Items items={items.filter((it) => it.key.startsWith(`${r.version}-`))} />
            </div>
          ))
      ) : (
        <Items items={items} />
      )}
      {silent > 0 && grouped && (
        <p className="text-xs text-muted-foreground">
          {silent === 1 ? 'One older update has' : `${silent} older updates have`} no notes.
        </p>
      )}
    </div>
  )
}

function Items({ items }: { items: Item[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-sm marker:text-muted-foreground">
      {items.map((it) => (
        <li key={it.key}>
          <span className="font-medium">{it.title}</span>
          {it.text && <span className="text-muted-foreground">: {it.text}</span>}
        </li>
      ))}
    </ul>
  )
}

/** Compact list for the update pop-up: the newest few titles. */
export function WhatsNewBrief({ status, max = 4 }: { status: AppStatus; max?: number }) {
  const items = changeItems(status)
  if (!items.length) return null
  const more = items.length - max
  return (
    <div className="mt-3">
      <div className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">What's new</div>
      <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-sm marker:text-muted-foreground">
        {items.slice(0, max).map((it) => (
          <li key={it.key}>
            <span className="line-clamp-2">{it.title}</span>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <div className="mt-1.5 text-xs text-muted-foreground">
          and {more} more {more === 1 ? 'change' : 'changes'}, listed in Settings
        </div>
      )}
    </div>
  )
}
