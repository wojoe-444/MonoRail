import { useEffect, useState, type ComponentProps } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useRepo } from '../RepoContext'
import { resolveRelative } from '../util'
import { blobLink, treeLink } from '../links'
import { api } from '../api'

const isExternal = (s: string): boolean => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(s)

function RepoImage({ src, alt, refName, baseDir }: { src: string; alt?: string; refName: string; baseDir: string }) {
  const { repo } = useRepo()
  const [url, setUrl] = useState<string | null>(null)
  const external = isExternal(src)
  useEffect(() => {
    if (external || !repo) return
    let live = true
    api.readBlob(repo.path, refName, resolveRelative(baseDir, src.split('#')[0])).then(
      (b) => live && b.kind === 'image' && setUrl(b.dataUrl),
      () => undefined
    )
    return () => { live = false }
  }, [external, repo, refName, baseDir, src])
  // Remote images are never fetched: this app must not make network requests for sensitive repos.
  if (external) return <span className="muted" title={src}>[remote image blocked: {alt || src}]</span>
  return url ? <img src={url} alt={alt} /> : <span className="muted">{alt}</span>
}

/** Renders Markdown from the repo. Raw HTML is not rendered; relative links/images resolve inside the repo. */
export default function Markdown({ source, refName, baseDir }: { source: string; refName: string; baseDir: string }) {
  const nav = useNavigate()
  const { repo } = useRepo()
  const A = ({ href = '', children }: ComponentProps<'a'>) => (
    <a
      href={href}
      title={href}
      onClick={(e) => {
        e.preventDefault()
        if (isExternal(href) || href.startsWith('#') || !repo) return
        const target = resolveRelative(baseDir, href.split('#')[0])
        api.listTree(repo.path, refName, target).then(
          (t) => nav(t.length ? treeLink(refName, target) : blobLink(refName, target)),
          () => nav(blobLink(refName, target))
        )
      }}
    >
      {children}
    </a>
  )
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={{
          a: A,
          img: ({ src, alt }) => <RepoImage src={typeof src === 'string' ? src : ''} alt={alt} refName={refName} baseDir={baseDir} />
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
