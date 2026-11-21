import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

import { type SessionSource } from './types'

export function SourceAvatar({ source, className }: { source: SessionSource; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md text-xs font-semibold',
        source === 'claude' ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-highlight-soft text-highlight-soft-foreground',
        className,
      )}
    >
      {source === 'claude' ? <Sparkles className="size-3.5" /> : <span className="font-mono text-sm leading-none">π</span>}
    </span>
  )
}
