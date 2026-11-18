import * as React from 'react'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchFieldProps extends Omit<React.ComponentProps<'input'>, 'size'> {
  /** `sm` for toolbars and the top bar, `lg` for a page's main search (`PageBanner`). */
  size?: 'sm' | 'default' | 'lg'
  /** Keyboard hint shown at the right edge, e.g. "Ctrl K". Display only. */
  shortcut?: string
}

/**
 * Text input with a search icon and an optional shortcut hint. Give it an
 * `aria-label` (or a `Label`), like any input.
 */
function SearchField({ className, size = 'default', shortcut, ...props }: SearchFieldProps) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search
        aria-hidden
        className={cn('pointer-events-none absolute text-muted-foreground', size === 'lg' ? 'left-4 size-5' : 'left-3 size-4')}
      />
      <Input
        type="search"
        className={cn(
          '[&::-webkit-search-cancel-button]:appearance-none',
          size === 'sm' && 'h-8 pl-9',
          size === 'default' && 'pl-9',
          size === 'lg' && 'h-12 rounded-lg pl-12 text-base shadow-elevation-2',
          shortcut && 'pr-16',
        )}
        {...props}
      />
      {shortcut && (
        <kbd className="pointer-events-none absolute right-2 hidden rounded border bg-muted px-1.5 font-mono text-xs text-muted-foreground sm:block">
          {shortcut}
        </kbd>
      )}
    </div>
  )
}

export { SearchField }
