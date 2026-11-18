import type { ReactNode } from 'react'
import type { WorkingState } from '../types'
import { ChevronDown } from './Icons'

/** Commits behind | ahead as a small two-sided bar (red left, green right) plus the numbers. */
export function AheadBehind({ ahead, behind, max = 12, label }: { ahead: number; behind: number; max?: number; label?: string }) {
  const w = (n: number) => `${Math.round((Math.min(n, max) / max) * 40)}px`
  return (
    <span className="ghp-ab" title={`${behind} behind, ${ahead} ahead${label ? ` of ${label}` : ''}`}>
      <span className="bar" aria-hidden>
        <span className="l" style={{ width: w(behind) }} />
        <span className="mid" />
        <span className="r" style={{ width: w(ahead) }} />
      </span>
      <span className="nums"><span className="del">{behind}</span> | <span className="add">{ahead}</span></span>
    </span>
  )
}

/** "↑2 ↓1 ●3", "clean", or a placeholder while the working state is still being read. */
export function StateCell({ s, loading }: { s: WorkingState | null | undefined; loading: boolean }) {
  if (s === undefined) return <span className="muted">{loading ? '…' : ''}</span>
  if (s === null) return <span className="muted">—</span>
  const dirty = s.changed + s.untracked
  const bits: ReactNode[] = []
  if (s.ahead) bits.push(<span key="a" className="up" title={`${s.ahead} commit${s.ahead === 1 ? '' : 's'} not pushed to ${s.upstream}`}>↑{s.ahead}</span>)
  if (s.behind) bits.push(<span key="b" className="down" title={`${s.behind} commit${s.behind === 1 ? '' : 's'} on ${s.upstream} not pulled yet`}>↓{s.behind}</span>)
  if (dirty) bits.push(<span key="c" className="chg" title={`${s.changed} changed, ${s.untracked} new file${s.untracked === 1 ? '' : 's'} not committed`}>●{dirty}</span>)
  if (!bits.length) return <span className="ghp-state muted" title={s.upstream ? `In step with ${s.upstream}, nothing uncommitted` : 'Nothing uncommitted'}>clean</span>
  return <span className="ghp-state">{bits}</span>
}

/** Card header row: title, optional count and hint, actions; a chevron when the card can collapse. */
export function CardHead({ title, count, hint, children, collapse }: {
  title: ReactNode
  count?: number
  hint?: ReactNode
  children?: ReactNode
  collapse?: { closed: boolean; toggle(): void; label: string }
}) {
  return (
    <div className={`ghp-card-head${collapse?.closed ? ' closed' : ''}`}>
      {collapse && (
        <button className="ghp-icon-btn ghp-collapse" aria-expanded={!collapse.closed} title={collapse.closed ? `Show ${collapse.label}` : `Hide ${collapse.label}`} aria-label={collapse.closed ? `Show ${collapse.label}` : `Hide ${collapse.label}`} onClick={collapse.toggle}>
          <ChevronDown />
        </button>
      )}
      {typeof title === 'string' ? <h2>{title}</h2> : title}
      {count !== undefined && <span className="count">{count}</span>}
      {hint && <span className="hint">{hint}</span>}
      <span className="grow" />
      {children}
    </div>
  )
}
