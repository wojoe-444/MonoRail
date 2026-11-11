import { Bell, Moon, Search, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TopBarProps {
  title: string
  dark: boolean
  onToggleDark: () => void
}

/** 64px app bar (MUI Toolbar height) with breadcrumb title, search and actions. */
export function TopBar({ title, dark, onToggleDark }: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-background/85 px-6 backdrop-blur">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Command Hub</span>
        <span className="text-muted-foreground/60">/</span>
        <span className="font-medium">{title}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search agents and runs" className="h-9 w-72 pl-9" />
        </div>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={onToggleDark}>
          {dark ? <Sun /> : <Moon />}
        </Button>
      </div>
    </header>
  )
}
