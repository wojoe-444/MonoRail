import { useEffect, useRef, useState } from 'react'

import type { Draft } from '../types'

/** To / Cc / Bcc / Subject / body fields shared by the composer and inline replies. */
export default function DraftFields({ draft, onChange, showSubject = true, autoFocusBody }: { draft: Draft; onChange: (d: Draft) => void; showSubject?: boolean; autoFocusBody?: boolean }) {
  const [extra, setExtra] = useState(!!(draft.cc || draft.bcc))
  const body = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    // Replies start with the cursor above the quoted text.
    if (!autoFocusBody || !body.current) return
    body.current.focus()
    body.current.setSelectionRange(0, 0)
    body.current.scrollTop = 0
  }, [autoFocusBody])
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...draft, [k]: e.target.value })
  return (
    <div className="eml-draft">
      <div className="eml-draft-line">
        <span>To</span>
        <input value={draft.to} onChange={set('to')} placeholder="name@example.com, …" autoFocus={!autoFocusBody} />
        {!extra && <button type="button" className="eml-link-btn" onClick={() => setExtra(true)}>Cc Bcc</button>}
      </div>
      {extra && (
        <>
          <div className="eml-draft-line"><span>Cc</span><input value={draft.cc} onChange={set('cc')} /></div>
          <div className="eml-draft-line"><span>Bcc</span><input value={draft.bcc} onChange={set('bcc')} /></div>
        </>
      )}
      {showSubject && <div className="eml-draft-line"><span>Subject</span><input value={draft.subject} onChange={set('subject')} /></div>}
      <textarea
        value={draft.body}
        onChange={set('body')}
        ref={body}
      />
    </div>
  )
}
