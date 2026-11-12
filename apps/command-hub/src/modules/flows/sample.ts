import type { Edge, Node } from '@xyflow/react'

import type { FlowNodeData, FlowSummary } from './types'

/** Fictional sample data for the browser dev server and the design preview. */

const day = 86_400_000
const now = Date.now()

export const SAMPLE_FLOWS: FlowSummary[] = [
  {
    id: 'pr-review-crew',
    name: 'PR review crew',
    description: 'A lead reviewer that asks a code-reviewer subagent and reads the repo, then scores readability in Python.',
    kinds: ['chat-input', 'prompt', 'subagent', 'repo-files', 'agent', 'python', 'chat-output'],
    nodes: 7,
    updated: now - 2 * 3_600_000,
    runs7d: 14,
    deployed: ['mcp', 'chat'],
    usesPython: true,
    agentName: 'Lead reviewer',
  },
  {
    id: 'release-notes',
    name: 'Release notes writer',
    description: 'Turns merged pull requests into a plain-language “What’s new” list.',
    kinds: ['text-input', 'monorail-tool', 'model', 'prompt', 'chat-output'],
    nodes: 5,
    updated: now - 1 * day,
    runs7d: 6,
    deployed: ['api'],
    usesPython: false,
    agentName: 'Release writer',
  },
  {
    id: 'triage',
    name: 'Issue triage router',
    description: 'A model sorts each new issue into bug or feature, then hands it to the right agent.',
    kinds: ['chat-input', 'router', 'agent', 'agent', 'merge', 'chat-output'],
    nodes: 7,
    updated: now - 3 * day,
    runs7d: 22,
    deployed: ['mcp'],
    usesPython: false,
    agentName: 'Triage planner',
  },
  {
    id: 'storage-tidy',
    name: 'Storage tidy-up advisor',
    description: 'Reads the last Storage scan and suggests what is safe to clean. Always asks before anything else.',
    kinds: ['monorail-tool', 'agent', 'approval', 'chat-output'],
    nodes: 4,
    updated: now - 6 * day,
    runs7d: 1,
    deployed: [],
    usesPython: false,
    agentName: 'Storage detective',
  },
  {
    id: 'research-loop',
    name: 'Research and refine',
    description: 'Researcher drafts, reviewer checks, and the loop repeats up to three times.',
    kinds: ['chat-input', 'subagent', 'loop', 'agent', 'chat-output'],
    nodes: 6,
    updated: now - 9 * day,
    runs7d: 0,
    deployed: [],
    usesPython: false,
    agentName: 'Research writer',
  },
]

const n = (id: string, kind: string, x: number, y: number, extra: Partial<FlowNodeData> = {}): Node<FlowNodeData> => ({
  id,
  type: 'component',
  position: { x, y },
  data: { kind, values: {}, ...extra },
})

export const SAMPLE_NODES: Node<FlowNodeData>[] = [
  n('in', 'chat-input', 0, 60, { values: { text: 'Review the branch claude/flows-canvas' } }),
  n('prompt', 'prompt', 0, 330, { values: { template: 'You lead a small review crew. Ask the code reviewer for a line-by-line pass, read files when you need context, and reply with a short verdict and the three most important fixes.' } }),
  n('reviewer', 'subagent', 340, -40, { agentName: 'code-reviewer', title: 'Code reviewer', values: { subagent: 'code-reviewer' } }),
  n('files', 'repo-files', 340, 350, { values: { repo: 'MonoRail' } }),
  n('lead', 'agent', 680, 40, { agentName: 'Lead reviewer', title: 'Lead reviewer', values: { model: 'Claude Sonnet 5.5', mode: 'Ask (read only)' } }),
  n('score', 'python', 1020, -60, { title: 'Score readability', values: { grade: 8 } }),
  n('out', 'chat-output', 1020, 330),
]

const e = (id: string, source: string, sourceHandle: string, target: string, targetHandle: string): Edge => ({
  id,
  source,
  sourceHandle,
  target,
  targetHandle,
})

export const SAMPLE_EDGES: Edge[] = [
  e('e1', 'in', 'message', 'lead', 'input'),
  e('e2', 'prompt', 'text', 'lead', 'instructions'),
  e('e3', 'reviewer', 'as-tool', 'lead', 'tools'),
  e('e4', 'files', 'tool', 'lead', 'tools'),
  e('e5', 'lead', 'reply', 'score', 'text'),
  e('e6', 'lead', 'reply', 'out', 'input'),
  e('e7', 'score', 'data', 'out', 'details'),
]

export const SAMPLE_PYTHON = `from monorail_flows import component, Input, Output


@component(
    name="Score readability",
    description="Grade a reply's reading level so the crew keeps it plain.",
)
def score_readability(
    text: Input[str],
    target_grade: Input[int] = 8,
) -> Output[dict, "score"]:
    words = text.split()
    sentences = max(1, text.count(".") + text.count("?") + text.count("!"))
    syllables = sum(_syllables(w) for w in words)
    grade = 0.39 * len(words) / sentences + 11.8 * syllables / max(1, len(words)) - 15.59
    return {"grade": round(grade, 1), "ok": grade <= target_grade}


def _syllables(word: str) -> int:
    vowels = "aeiouy"
    count, prev = 0, False
    for ch in word.lower():
        is_vowel = ch in vowels
        if is_vowel and not prev:
            count += 1
        prev = is_vowel
    return max(1, count)
`

/** The Playground run the preview plays back: node, status, summary. */
export const SAMPLE_RUN: { node: string; label: string; detail: string; ms: number; cost?: number }[] = [
  { node: 'in', label: 'Chat input', detail: 'Review the branch claude/flows-canvas', ms: 2 },
  { node: 'prompt', label: 'Prompt template', detail: 'Filled 1 template (412 characters)', ms: 1 },
  { node: 'lead', label: 'Lead reviewer', detail: 'Turn 1: planned the review, asked Code reviewer', ms: 6400, cost: 0.021 },
  { node: 'reviewer', label: 'Code reviewer (helper)', detail: 'Read 6 files, found 4 issues', ms: 18200, cost: 0.064 },
  { node: 'files', label: 'Read repo files (tool)', detail: 'grep “useReactFlow”, read FlowEditor.tsx', ms: 140 },
  { node: 'lead', label: 'Lead reviewer', detail: 'Turn 2: wrote the verdict', ms: 5100, cost: 0.018 },
  { node: 'score', label: 'Score readability', detail: '{ "grade": 7.2, "ok": true }', ms: 310 },
  { node: 'out', label: 'Chat output', detail: 'Reply sent to the Playground', ms: 1 },
]
