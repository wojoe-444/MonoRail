/**
 * Fictional subagents for the browser dev server, where there is no backend.
 * Safe to commit: no real names, repos or files.
 */
import type { CatalogData, SubagentDetail } from './types'

const DAY = 24 * 60 * 60 * 1000

export function sampleCatalog(now = Date.now()): CatalogData {
  return {
    generatedAt: now,
    repos: ['demo-app', 'garden-planner', 'notes'],
    subagents: sampleDetails(now).map(({ prompt: _prompt, ...s }) => s),
  }
}

export function sampleDetails(now = Date.now()): SubagentDetail[] {
  return [
    {
      id: 'sub_1',
      scope: 'user',
      name: 'code-reviewer',
      description: 'Reviews a diff for correctness bugs and missing tests before a PR goes up. Use it after finishing a change.',
      model: 'sonnet',
      tools: ['Read', 'Grep', 'Glob'],
      location: '~/.claude/agents/code-reviewer.md',
      updatedAt: now - 3 * DAY,
      prompt: `You are a careful code reviewer.\n\n## How to review\n\n1. Read the diff and the files around it.\n2. Look for bugs first: wrong conditions, missing error handling, race conditions.\n3. Check that each change has a test.\n\n## How to answer\n\n- List findings most severe first, each with the file and line.\n- Say plainly when you found nothing.\n- Do not rewrite the code yourself.`,
    },
    {
      id: 'sub_2',
      scope: 'project',
      repo: 'demo-app',
      name: 'test-writer',
      description: 'Writes focused unit tests for the files you name, following the repo conventions.',
      model: 'haiku',
      tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
      location: '.claude/agents/test-writer.md',
      updatedAt: now - 9 * DAY,
      prompt: 'You write unit tests.\n\nMatch the style of the nearest existing test file. Run the tests you wrote with `npm test` and fix them until they pass.',
    },
    {
      id: 'sub_3',
      scope: 'project',
      repo: 'garden-planner',
      name: 'migration-checker',
      description: 'Checks database migrations for locking problems and missing rollbacks.',
      tools: ['Read', 'Grep'],
      location: '.claude/agents/migration-checker.md',
      updatedAt: now - 20 * DAY,
      prompt: 'Check each new migration for long table locks, missing down steps and data loss.',
    },
    {
      id: 'sub_4',
      scope: 'user',
      name: 'docs-writer',
      description: 'Updates the README and docs after a feature lands, in plain language.',
      model: 'inherit',
      tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write'],
      location: '~/.claude/agents/docs-writer.md',
      updatedAt: now - 1 * DAY,
      prompt: 'Keep docs short and concrete. Update only the sections the change touched.',
    },
    {
      id: 'sub_5',
      scope: 'user',
      name: 'web-researcher',
      description: 'Looks up library docs and release notes online and reports back with links.',
      model: 'haiku',
      tools: ['WebSearch', 'WebFetch', 'Read'],
      location: '~/.claude/agents/web-researcher.md',
      updatedAt: now - 6 * DAY,
      prompt: 'Search, read the most official source, and answer with links.',
    },
    {
      id: 'sub_6',
      scope: 'project',
      repo: 'notes',
      name: 'release-planner',
      description: 'Breaks a release into ordered tasks with owners and risks.',
      model: 'opus',
      location: '.claude/agents/release-planner.md',
      updatedAt: now - 30 * DAY,
      prompt: 'Plan the release as a numbered list of tasks.',
    },
    {
      id: 'builtin:coordinator',
      scope: 'builtin',
      name: 'coordinator',
      description: "Coordinates your other agent chats from MonoRail. Used when you have no coordinator of your own.",
      tools: ['Agent', 'Workflow', 'mcp__monorail__list_chats', 'mcp__monorail__read_chat', 'mcp__monorail__send_to_chat', 'mcp__monorail__start_chat', 'mcp__monorail__wait_for_reply'],
      location: 'Built in to MonoRail',
      updatedAt: now - 2 * DAY,
      prompt: "You are the user's coordinator in MonoRail. You coordinate their other Claude Code and pi chats.",
    },
  ]
}
