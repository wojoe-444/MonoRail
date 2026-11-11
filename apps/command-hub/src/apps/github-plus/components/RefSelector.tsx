import { useEffect, useRef, useState } from 'react'
import { useRepo } from '../RepoContext'
import { BranchIcon, ChevronDown, TagIcon } from './Icons'

interface Props {
  value: string
  onChange(ref: string): void
  label?: string
  /** Allow picking tags as well as branches (default true). */
  tags?: boolean
}

export default function RefSelector({ value, onChange, label, tags = true }: Props) {
  const { refs } = useRepo()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'branch' | 'tag'>('branch')
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const isTag = refs.some((r) => r.type === 'tag' && r.name === value) && !refs.some((r) => r.type === 'branch' && r.name === value)
  const shown = refs.filter((r) => r.type === tab && r.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="refsel" ref={box}>
      <button className="btn" onClick={() => setOpen(!open)} title="Switch branch or tag">
        {isTag ? <TagIcon /> : <BranchIcon />}
        {label && <span className="muted">{label}:</span>}
        <strong className="refname">{value}</strong>
        <ChevronDown />
      </button>
      {open && (
        <div className="popover">
          <input autoFocus placeholder={`Find a ${tab}...`} value={q} onChange={(e) => setQ(e.target.value)} />
          {tags && (
            <div className="tabs-mini">
              <button className={tab === 'branch' ? 'active' : ''} onClick={() => setTab('branch')}>Branches</button>
              <button className={tab === 'tag' ? 'active' : ''} onClick={() => setTab('tag')}>Tags</button>
            </div>
          )}
          <ul>
            {shown.map((r) => (
              <li key={r.type + r.name}>
                <button onClick={() => { onChange(r.name); setOpen(false); setQ('') }}>
                  <span className="check">{r.name === value ? '✓' : ''}</span>{r.name}
                  {r.isCurrent && <span className="badge">HEAD</span>}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="muted pad">Nothing found</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
