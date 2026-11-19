import { Link, useSearchParams } from 'react-router-dom'
import { useAsync, useRepo } from '../RepoContext'
import Markdown from '../components/Markdown'
import FileTree from '../components/FileTree'
import { CardHead } from '../components/Dense'
import { useCollapsed } from '../components/collapsed'
import { FileIcon } from '../components/Icons'
import { blobLink } from '../links'
import { api } from '../api'

const README_RE = /^readme(\.(md|markdown|txt|rst))?$/i

export default function TreePage() {
  const { repo } = useRepo()
  const [sp] = useSearchParams()
  const ref = sp.get('ref') || repo!.defaultRef || 'HEAD'
  const path = sp.get('path') || ''
  const rp = repo!.path
  const [readmeClosed, toggleReadme] = useCollapsed('readme')

  const tree = useAsync(() => api.listTree(rp, ref, path), [rp, ref, path])
  const readme = tree.data?.find((e) => e.type === 'file' && README_RE.test(e.name))
  const readmeBlob = useAsync(async () => (readme ? api.readBlob(rp, ref, readme.path) : null), [rp, ref, readme?.path])

  return (
    <div className="ghp-code">
      <FileTree refName={ref} current={path} />
      <div className="min-w-0">
        {tree.error && <div className="flash error">{tree.error}</div>}
        {readme && readmeBlob.data?.kind === 'text' && (
          <div className="ghp-card">
            <CardHead title={<span className="title-ico"><FileIcon /><h2>{readme.name}</h2></span>} hint={path ? `in ${path}` : undefined} collapse={{ closed: readmeClosed, toggle: toggleReadme, label: readme.name }}>
              <Link className="act" to={blobLink(ref, readme.path)}>Open</Link>
            </CardHead>
            {!readmeClosed && (
              <div className="ghp-card-pad">
                {/\.(md|markdown)$/i.test(readme.name)
                  ? <Markdown source={readmeBlob.data.content} refName={ref} baseDir={path} />
                  : <pre className="plain">{readmeBlob.data.content}</pre>}
              </div>
            )}
          </div>
        )}
        {!tree.loading && !tree.error && !readme && (
          <div className="ghp-card"><div className="ghp-card-pad muted">No README here. Pick a file in the tree.</div></div>
        )}
      </div>
    </div>
  )
}
