import { useEffect, useRef, useState } from 'react'
import { Check, Tag } from 'lucide-react'

import { useMail } from '../MailContext'

/** Pick which user labels a thread has. Applies on close, as one change. */
export default function LabelMenu({ labelIds, onApply }: { labelIds: string[]; onApply: (add: string[], remove: string[]) => void }) {
  const { folders } = useMail()
  const labels = folders.filter((f) => f.kind === 'user')
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const start = () => {
    setPicked(new Set(labelIds.filter((l) => labels.some((x) => x.id === l))))
    setFilter('')
    setOpen(true)
  }
  const finish = () => {
    setOpen(false)
    const before = new Set(labelIds)
    const add = [...picked].filter((l) => !before.has(l))
    const remove = labels.map((l) => l.id).filter((l) => before.has(l) && !picked.has(l))
    if (add.length || remove.length) onApply(add, remove)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) finish()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  })

  const shown = labels.filter((l) => l.name.toLowerCase().includes(filter.toLowerCase()))
  return (
    <div className="eml-pop-wrap" ref={ref}>
      <button className="eml-tool" title="Labels" onClick={() => (open ? finish() : start())} aria-expanded={open}>
        <Tag /> <span>Label</span>
      </button>
      {open && (
        <div className="eml-pop">
          <input autoFocus placeholder="Find a label" value={filter} onChange={(e) => setFilter(e.target.value)} />
          {shown.length === 0 && <p className="eml-muted small">No labels. Make one with + in the sidebar.</p>}
          {shown.map((l) => (
            <label key={l.id} className="eml-check">
              <input
                type="checkbox"
                checked={picked.has(l.id)}
                onChange={(e) =>
                  setPicked((p) => {
                    const n = new Set(p)
                    if (e.target.checked) n.add(l.id)
                    else n.delete(l.id)
                    return n
                  })
                }
              />
              <span className="eml-box"><Check /></span>
              <span className="eml-ellipsis">{l.name}</span>
            </label>
          ))}
          <button className="eml-btn small" onClick={finish}>Apply</button>
        </div>
      )}
    </div>
  )
}
