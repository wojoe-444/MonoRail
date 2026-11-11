import { Link } from 'react-router-dom'
import { useRepo } from '../RepoContext'
import { treeLink } from '../links'

export default function Breadcrumb({ refName, path, isFile }: { refName: string; path: string; isFile?: boolean }) {
  const { repo } = useRepo()
  const parts = path.split('/').filter(Boolean)
  return (
    <div className="breadcrumb">
      <Link to={treeLink(refName, '')}><strong>{repo?.name}</strong></Link>
      {parts.map((p, i) => {
        const sub = parts.slice(0, i + 1).join('/')
        const last = i === parts.length - 1
        return (
          <span key={sub}>
            <span className="sep">/</span>
            {last && isFile ? <strong>{p}</strong> : <Link to={treeLink(refName, sub)}>{last ? <strong>{p}</strong> : p}</Link>}
          </span>
        )
      })}
    </div>
  )
}
