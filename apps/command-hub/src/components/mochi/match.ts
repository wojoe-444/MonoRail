// Picks a mochi role and flavor for an agent from its name and description.

import { FLAVORS } from './flavors'
import { MOCHI_ROLES, type MochiRoleId } from './characters'

/** Keyword stems per role. Earlier roles win ties in a description. */
const KEYWORDS: [MochiRoleId, string[]][] = [
  ['coordinator', ['coordinat', 'orchestrat', 'dispatch', 'manager', 'supervis']],
  ['strategist', ['strateg', 'architect', 'trade-off', 'tradeoff']],
  ['planner', ['plan', 'roadmap', 'breakdown', 'decompos']],
  ['forecaster', ['forecast', 'predict', 'estimat']],
  ['security', ['secur', 'vuln', 'threat', 'pentest', 'secret']],
  ['reviewer', ['review', 'audit', 'lint', 'critic', 'check']],
  ['tester', ['test', 'qa', 'e2e', 'spec']],
  ['debugger', ['debug', 'bug', 'triage', 'diagnos', 'fix']],
  ['optimizer', ['optimi', 'perf', 'speed', 'tune', 'profil']],
  ['automator', ['automat', 'script', 'pipeline', 'workflow', 'deploy', 'ci']],
  ['integrator', ['integrat', 'connect', 'api', 'mcp', 'sync', 'migrat']],
  ['translator', ['translat', 'locali', 'i18n', 'l10n']],
  ['scheduler', ['schedul', 'calendar', 'remind', 'cron']],
  ['reporter', ['report', 'summar', 'changelog', 'digest', 'status', 'recap']],
  ['writer', ['writ', 'doc', 'copy', 'blog', 'draft', 'readme', 'edit']],
  ['designer', ['design', 'ui', 'ux', 'style', 'css', 'visual', 'brand']],
  ['communicator', ['communicat', 'slack', 'email', 'notif', 'message', 'announce']],
  ['analyst', ['analy', 'data', 'metric', 'stat', 'insight', 'sql']],
  ['scout', ['scout', 'explor', 'discover', 'survey', 'browse']],
  ['learner', ['learn', 'study', 'tutor', 'teach', 'onboard']],
  ['researcher', ['research', 'investigat', 'search', 'find', 'lookup']],
  ['builder', ['build', 'scaffold', 'implement', 'feature', 'prototype']],
  ['coder', ['code', 'coder', 'develop', 'engineer', 'program', 'refactor', 'frontend', 'backend']],
  ['journaler', ['journal', 'diary', 'log', 'notes', 'retro', 'takeaway']],
  ['dreamer', ['dream', 'brainstorm', 'idea', 'imagin', 'vision', 'muse']],
  ['assistant', ['assist', 'help', 'general', 'concierge']],
]

/** Words in a name: "code-reviewer" -> ["code", "reviewer"]. */
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

function roleFromWords(ws: string[], fromEnd: boolean): MochiRoleId | undefined {
  const seq = fromEnd ? [...ws].reverse() : ws
  for (const w of seq) for (const [role, stems] of KEYWORDS) if (stems.some((s) => (s.length <= 3 ? w === s : w.startsWith(s)))) return role
  return undefined
}

/**
 * Role for an agent. The name decides first, reading from its last word, since
 * the head noun comes last ("code-reviewer" is a reviewer); then the description.
 */
export function mochiRoleFor(name: string, description = ''): MochiRoleId {
  return roleFromWords(words(name), true) ?? roleFromWords(words(description).slice(0, 40), false) ?? 'agent'
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * Flavor for an agent: the role's default when the agent is named after the
 * role (e.g. "reviewer"), otherwise a stable pick from its name, so two
 * agents with the same role still look different.
 */
export function mochiFlavorFor(name: string, role: MochiRoleId): string {
  const r = MOCHI_ROLES[role]
  const n = name.trim().toLowerCase()
  if (role === 'coordinator' || n === role || n === r.label.toLowerCase()) return r.flavor
  return FLAVORS[hash(n) % FLAVORS.length][0]
}
