import type { ReactNode } from 'react'

/** The bar at the top of every Tracker page: title, optional tabs and actions. */
export function PageTop({ title, icon, children, actions }: { title: ReactNode; icon?: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2">
      {icon}
      <h1 className="text-sm font-semibold">{title}</h1>
      {children}
      <span className="flex-1" />
      {actions}
    </div>
  )
}
