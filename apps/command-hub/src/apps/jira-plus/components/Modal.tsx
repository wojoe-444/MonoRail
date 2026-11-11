import type { ReactNode } from 'react'
import { Dialog as D } from 'radix-ui'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Hidden visually when the modal draws its own header. */
  hideTitle?: boolean
  description?: ReactNode
  width?: number
  children: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * Jira-style modal. Radix portals it to <body>, outside the app root, so the
 * overlay and content carry the `.jp` scope class themselves.
 */
export function Modal({ open, onClose, title, hideTitle, description, width = 600, children, footer, className }: ModalProps) {
  return (
    <D.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className="jp fixed inset-0 z-50 bg-(--jp-blanket) data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content
          className={cn(
            'jp fixed top-[60px] left-1/2 z-50 flex max-h-[calc(100vh-120px)] w-[calc(100%-48px)] -translate-x-1/2 flex-col rounded-[3px] bg-(--jp-raised) shadow-(--jp-shadow-overlay) outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2',
            className,
          )}
          style={{ maxWidth: width }}
        >
          <div className={cn('flex items-start gap-4 px-6 pt-6 pb-2', hideTitle && 'sr-only')}>
            <div className="min-w-0 flex-1">
              <D.Title className="text-xl leading-7 font-medium">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-(--jp-subtle)">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</D.Description>
              )}
            </div>
            <D.Close className="jp-btn jp-btn-subtle -mt-1 -mr-2 size-8 px-0" aria-label="Close">
              <X />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">{children}</div>
          {footer && <div className="flex justify-end gap-2 px-6 pt-4 pb-6">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

export function Field({ id, label, hint, required, children }: { id: string; label: string; hint?: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="jp-label">
        {label}
        {required && <span className="ml-0.5 text-(--jp-danger)">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-(--jp-subtlest)">{hint}</p>}
    </div>
  )
}

export function ErrorNote({ error, className }: { error?: string; className?: string }) {
  if (!error) return null
  return <div className={cn('mb-4 rounded-[3px] bg-(--jp-danger-bg) px-4 py-3 text-(--jp-text)', className)}>{error}</div>
}
