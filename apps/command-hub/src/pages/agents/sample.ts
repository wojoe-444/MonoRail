/**
 * Fictional data for the Agents overview in the browser dev server, where
 * there is no backend. Safe to commit: no real names, repos or sessions.
 */
import type { AgentsOverview, DefinitionDetail } from './types'

const MIN = 60 * 1000
const H = 60 * MIN
const DAY = 24 * H

export function sampleOverview(now = Date.now()): AgentsOverview {
  const today = new Date(now)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const perDay = [
    [3, 1],
    [5, 0],
    [2, 2],
    [6, 1],
    [4, 3],
    [7, 2],
    [4, 1],
  ]
  return {
    generatedAt: now,
    definitions: [
      { id: 'def_s1', tool: 'claude', kind: 'subagent', scope: 'user', name: 'code-reviewer', description: 'Reviews a diff for correctness bugs and missing tests before a PR goes up.', model: 'sonnet', tools: ['Read', 'Grep', 'Glob'], location: '~/.claude/agents/code-reviewer.md', updatedAt: now - 3 * DAY },
      { id: 'def_s2', tool: 'claude', kind: 'subagent', scope: 'project', repo: 'demo-app', name: 'test-writer', description: 'Writes focused unit tests for the files you name, following the repo conventions.', model: 'haiku', tools: ['Read', 'Edit', 'Write'], location: '.claude/agents/test-writer.md', updatedAt: now - 9 * DAY },
      { id: 'def_s3', tool: 'claude', kind: 'subagent', scope: 'project', repo: 'garden-planner', name: 'migration-checker', description: 'Checks database migrations for locking problems and missing rollbacks.', tools: ['Read', 'Grep'], location: '.claude/agents/migration-checker.md', updatedAt: now - 20 * DAY },
      { id: 'def_k1', tool: 'claude', kind: 'skill', scope: 'user', name: 'release-notes', description: 'Drafts release notes from the PRs merged since the last tag.', tools: ['Bash', 'Read'], location: '~/.claude/skills/release-notes/SKILL.md', updatedAt: now - 5 * DAY },
      { id: 'def_k2', tool: 'claude', kind: 'skill', scope: 'project', repo: 'demo-app', name: 'screenshot-check', description: 'Takes light and dark screenshots of a page and compares them with the last run.', location: '.claude/skills/screenshot-check/SKILL.md', updatedAt: now - 2 * DAY },
      { id: 'def_k3', tool: 'pi', kind: 'skill', scope: 'user', name: 'issue-triage', description: 'Labels new issues and suggests an owner from recent history.', location: '~/.pi/agent/skills/issue-triage/SKILL.md', updatedAt: now - 12 * DAY },
    ],
    definitionSources: [
      { tool: 'claude', kind: 'subagent', found: true },
      { tool: 'claude', kind: 'skill', found: true },
      { tool: 'pi', kind: 'skill', found: true },
    ],
    definitionsTruncated: false,
    recent: [
      { id: 'claude:s-101', source: 'claude', title: 'Add a dark mode toggle to settings', repo: 'demo-app', branch: 'feature/dark-mode', model: 'claude-sonnet-4-5', startedAt: now - 40 * MIN, updatedAt: now - 20 * 1000, state: 'running' },
      { id: 'pi:s-102', source: 'pi', title: 'Explain how the planting calendar is computed', repo: 'garden-planner', branch: 'main', model: 'gpt-5', startedAt: now - 70 * MIN, updatedAt: now - 2 * MIN, state: 'active' },
      { id: 'claude:s-103', source: 'claude', title: 'Fix the flaky date test in the scheduler', repo: 'demo-app', branch: 'main', model: 'claude-opus-4-1', startedAt: now - 5 * H, updatedAt: now - 4 * H, state: 'idle' },
      { id: 'claude:s-104', source: 'claude', title: 'Write release notes for 0.9', repo: 'notes', branch: 'main', model: 'claude-sonnet-4-5', startedAt: now - 26 * H, updatedAt: now - 25 * H, state: 'idle' },
      { id: 'pi:s-105', source: 'pi', title: 'Rename the seed packet model', repo: 'garden-planner', branch: 'refactor/seeds', model: 'claude-sonnet-4-5', startedAt: now - 2 * DAY, updatedAt: now - 2 * DAY + H, state: 'idle' },
      { id: 'claude:s-106', source: 'claude', title: 'Review the onboarding copy', repo: 'notes', model: 'claude-haiku-4-5', startedAt: now - 3 * DAY, updatedAt: now - 3 * DAY + 20 * MIN, state: 'idle' },
    ],
    activity: {
      today: 5,
      week: 41,
      weekCapped: false,
      days: perDay.map(([claude, pi], i) => ({ start: start - (6 - i) * DAY, claude, pi })),
      activeNow: 2,
      runningTurns: 1,
    },
    repos: [
      { name: 'demo-app', path: '/sample/demo-app', sessions: 18, lastAt: now - 20 * 1000, sources: ['claude'] },
      { name: 'garden-planner', path: '/sample/garden-planner', sessions: 11, lastAt: now - 2 * MIN, sources: ['claude', 'pi'] },
      { name: 'notes', path: '/sample/notes', sessions: 7, lastAt: now - 25 * H, sources: ['claude'] },
      { name: 'recipes', path: '/sample/recipes', sessions: 0, lastAt: 0, sources: [] },
    ],
    repoCount: 4,
    sdks: [
      { id: 'claude', label: 'Claude', ready: true },
      { id: 'pi', label: 'pi', ready: true },
    ],
    sources: [
      { id: 'claude', label: 'Claude Code', found: true },
      { id: 'pi', label: 'pi', found: true },
    ],
    folders: { reposRoot: '~/Repos', reposRootFound: true, repoCount: 4 },
    cost: {
      days: [4.1, 6.8, 3.2, 9.5, 5.4, 11.2, 7.3].map((cost, i) => ({ date: new Date(start - (6 - i) * DAY).toISOString().slice(0, 10), cost })),
      total: 47.5,
      builtAt: new Date(now - 6 * MIN).toISOString(),
      stale: false,
    },
  }
}

export const sampleDetail: DefinitionDetail = {
  id: 'sample',
  fields: { name: 'code-reviewer', description: 'Reviews a diff for correctness bugs and missing tests before a PR goes up.', model: 'sonnet', tools: 'Read, Grep, Glob' },
  body: 'You are a careful code reviewer.\n\n1. Read the diff and the files it touches.\n2. List real bugs first, each with the line and a failing input.\n3. Then list missing tests.\n\nDo not comment on style.',
}
