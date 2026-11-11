import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import './chat.css'

/**
 * Markdown for agent replies. Raw HTML is not rendered, links never navigate
 * (they would replace the whole Electron window) and remote images are not
 * fetched: a session log is private data and the page makes no requests.
 */
export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="chat-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <span className="chat-md-link" title={href}>
              {children}
            </span>
          ),
          img: ({ alt, src }) => <span className="chat-md-link" title={typeof src === 'string' ? src : undefined}>[image: {alt || 'untitled'}]</span>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
