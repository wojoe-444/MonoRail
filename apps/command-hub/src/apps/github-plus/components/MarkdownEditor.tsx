import { useState } from 'react'
import { useRepo } from '../RepoContext'
import Markdown from './Markdown'

/** A Write / Preview text box like a code host's comment field. Ctrl+Enter submits. */
export default function MarkdownEditor({ value, onChange, placeholder, onSubmit, rows = 8 }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  onSubmit?: () => void
  rows?: number
}) {
  const { repo } = useRepo()
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  return (
    <div className="md-editor">
      <div className="md-editor-tabs">
        <button className={tab === 'write' ? 'active' : ''} onClick={() => setTab('write')}>Write</button>
        <button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Preview</button>
      </div>
      {tab === 'write' ? (
        <textarea value={value} rows={rows} maxLength={65_536} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && onSubmit) { e.preventDefault(); onSubmit() } }} />
      ) : (
        <div className="md-preview">
          {value.trim() ? <Markdown source={value} refName={repo?.defaultRef ?? 'HEAD'} baseDir="" /> : <span className="muted">Nothing to preview</span>}
        </div>
      )}
    </div>
  )
}
