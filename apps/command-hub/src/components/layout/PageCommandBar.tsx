import type { ReactNode } from 'react'
import { Info } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { TopBarPortal } from './TopBarSlot'

interface PageCommandBarProps {
  title: string
  /** One line on what the page is for. Shown in a tooltip on an info icon. */
  description?: string
  /** The middle of the bar, usually `<PageTabs size="sm" sticky={false} />`. Scrolls sideways when tight. */
  children?: ReactNode
  /** Search, icon buttons and one small primary button (`size="sm"`). */
  actions?: ReactNode
}

/**
 * Header style A (monorail-ui "Command bar"): the page's title, tabs and
 * actions live in the top bar instead of a block above the content, so the
 * body starts right under the chrome. For tools, dense data and pages used
 * all day. Render it first in the page. Below `md` there's no room for tabs
 * in the bar, so the children render at the top of the page body instead.
 */
export function PageCommandBar({ title, description, children, actions }: PageCommandBarProps) {
  return (
    <>
      {children && <div className="md:hidden">{children}</div>}
      <TopBarPortal>
        <div className="flex min-w-0 items-center gap-1.5 md:max-w-[40%] md:shrink-0">
          <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
          {description && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`About ${title}`}
                  className="shrink-0 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{description}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="min-w-0 flex-1 max-md:hidden">{children}</div>
        <span className="flex-1 md:hidden" />
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </TopBarPortal>
    </>
  )
}
