import { ChatMarkdown } from '@/modules/agent-chat/ChatMarkdown'
import { cn } from '@/lib/utils'

import './flashcards.css'

/**
 * One face of a card, as Markdown (no raw HTML, links do not navigate, remote
 * images are not fetched: same rules as chat replies).
 */
export function CardText({ text, size = 'lg', className }: { text: string; size?: 'lg' | 'sm'; className?: string }) {
  return (
    <div className={cn('fc-face', size === 'sm' && 'fc-face-sm', className)}>
      <ChatMarkdown text={text} />
    </div>
  )
}
