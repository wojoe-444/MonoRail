import { CreditCard } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { navigate } from '@/lib/router'

import type { ClaudeAccount, ClaudeAccountType } from './account'

const VARIANT: Record<ClaudeAccountType, 'primary' | 'info' | 'warning' | 'secondary'> = {
  subscription: 'primary',
  api: 'info',
  enterprise: 'warning',
  unknown: 'secondary',
}

/**
 * The Claude account type as a chip: Subscription, API, Enterprise or
 * Unknown, with "(set)" when the user overrode the detection. With
 * `link`, clicking it opens Connections, where the type can be changed.
 */
export function ClaudeAccountBadge({ account, link = false, prefix }: { account: ClaudeAccount; link?: boolean; prefix?: string }) {
  const title = `${account.billing}\n${account.source === 'override' ? `Set by you. Detected: ${account.detected}. ` : ''}${account.reason}${link ? '\nClick to change it on Connections.' : ''}`
  const content = (
    <>
      <CreditCard /> {prefix}
      {account.label}
      {account.source === 'override' && <span className="opacity-70">(set)</span>}
    </>
  )
  if (!link)
    return (
      <Badge variant={VARIANT[account.type]} title={title}>
        {content}
      </Badge>
    )
  return (
    <Badge asChild variant={VARIANT[account.type]} title={title}>
      <button type="button" className="cursor-pointer" onClick={() => navigate('/connections')}>
        {content}
      </button>
    </Badge>
  )
}
