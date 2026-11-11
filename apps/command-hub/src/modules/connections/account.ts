import { useEffect, useState } from 'react'

import { invokeModule, isDesktop } from '@/modules/client'

/**
 * How the Claude login is billed (mirrors resolveAccount in
 * electron/connections/connectors/claude.cjs). Subscription is a flat fee;
 * API and Enterprise logins pay every token at API prices, even an
 * Enterprise login that signs in through claude.ai.
 */
export type ClaudeAccountType = 'subscription' | 'api' | 'enterprise' | 'unknown'

export interface ClaudeAccount {
  type: ClaudeAccountType
  label: string
  /** 'override' when the user picked the type in the connection's settings. */
  source: 'detected' | 'override'
  detected: ClaudeAccountType
  /** Why it was detected that way. */
  reason: string
  /** One sentence on what that means for cost. */
  billing: string
  billedAtApiPrices: boolean
}

/** Browser dev server only: a fictional subscription login. */
export const sampleClaudeAccount: ClaudeAccount = {
  type: 'subscription',
  label: 'Subscription',
  source: 'detected',
  detected: 'subscription',
  reason: 'Signed in through claude.ai, Claude Max plan.',
  billing: 'Flat-fee plan: usage is not billed per token. Costs shown are what the same use would cost at API prices.',
  billedAtApiPrices: false,
}

/** The Claude account type, for any page that shows Claude costs. Undefined while loading or on failure. */
export function useClaudeAccount(): ClaudeAccount | undefined {
  const desktop = isDesktop()
  const [account, setAccount] = useState<ClaudeAccount | undefined>(desktop ? undefined : sampleClaudeAccount)
  useEffect(() => {
    if (!desktop) return
    let live = true
    invokeModule<ClaudeAccount | undefined>('connections', 'claudeAccount').then(
      (a) => live && setAccount(a),
      () => {},
    )
    return () => {
      live = false
    }
  }, [desktop])
  return account
}

/** A short line for cost figures that include Claude Code. */
export function claudeCostNote(account: ClaudeAccount | undefined): string | undefined {
  if (!account || account.type === 'unknown') return undefined
  if (account.type === 'subscription') return 'Claude Code: subscription, not billed per token'
  return `Claude Code: ${account.label}, billed at API prices`
}
