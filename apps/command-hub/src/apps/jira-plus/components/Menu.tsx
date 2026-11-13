import type { ComponentProps } from 'react'
import { DropdownMenu as M } from 'radix-ui'

import { cn } from '@/lib/utils'

export const Menu = M.Root
export const MenuTrigger = M.Trigger

/** Dropdown menu in MonoRail's look; portaled, so it carries the `.jp` scope class. */
export function MenuContent({ className, sideOffset = 4, ...props }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={sideOffset}
        className={cn('jp z-50 min-w-48 rounded-lg bg-popover p-1 text-popover-foreground shadow-elevation-3 ring-1 ring-foreground/10 outline-none', className)}
        {...props}
      />
    </M.Portal>
  )
}

export function MenuItem({ className, ...props }: ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      className={cn(
        'flex cursor-default items-center gap-2 rounded-md px-3 py-1.5 text-sm text-(--jp-text) outline-none select-none data-[highlighted]:bg-(--jp-hover) data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof M.Label>) {
  return <M.Label className={cn('jp-overline px-4 pt-2 pb-1', className)} {...props} />
}

export function MenuSeparator() {
  return <M.Separator className="my-1.5 h-px bg-(--jp-border)" />
}
