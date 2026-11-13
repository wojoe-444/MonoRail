// Flows: the starter templates offered by "New flow". Fictional text only.

const n = (id, kind, x, y, values = {}, title) => ({ id, kind, x, y, values, ...(title ? { title } : {}) })
const e = (id, source, sourceHandle, target, targetHandle) => ({ id, source, sourceHandle, target, targetHandle })

const TEMPLATES = [
  {
    id: 'blank',
    title: 'Blank flow',
    text: 'An empty canvas with a Chat input and a Chat output.',
    flow: {
      name: 'New flow',
      nodes: [n('in', 'chat-input', 0, 80), n('out', 'chat-output', 520, 80)],
      edges: [e('e1', 'in', 'message', 'out', 'input')],
    },
  },
  {
    id: 'basic-prompt',
    title: 'Basic prompt',
    text: 'Chat input, a prompt template and one model call.',
    flow: {
      name: 'Basic prompt',
      nodes: [
        n('in', 'chat-input', 0, 60),
        n('prompt', 'prompt', 340, 0, { template: 'Explain this to a curious beginner in three short paragraphs:\n\n{question}' }),
        n('model', 'model', 680, 40, { model: 'claude-haiku-5-5' }),
        n('out', 'chat-output', 1020, 60),
      ],
      edges: [e('e1', 'in', 'message', 'prompt', 'var:question'), e('e2', 'prompt', 'text', 'model', 'input'), e('e3', 'model', 'text', 'out', 'input')],
    },
  },
  {
    id: 'agent-in-repo',
    title: 'Agent in a repo',
    text: 'One agent that reads your repo and answers.',
    flow: {
      name: 'Repo helper',
      nodes: [
        n('in', 'chat-input', 0, 120, { text: 'What does this repo do, in five bullet points?' }),
        n('agent', 'agent', 360, 0, { instructions: 'Answer from the files in this repo. Name the files you used.' }, 'Repo helper'),
        n('out', 'chat-output', 740, 120),
      ],
      edges: [e('e1', 'in', 'message', 'agent', 'input'), e('e2', 'agent', 'reply', 'out', 'input')],
    },
  },
  {
    id: 'draft-review',
    title: 'Draft and review',
    text: 'A writer drafts, a reviewer checks the draft, you get both.',
    flow: {
      name: 'Draft and review',
      nodes: [
        n('in', 'chat-input', 0, 140, { text: 'Write a short README section on how to run the tests.' }),
        n('writer', 'agent', 360, 0, { instructions: 'Write a clear first draft. Read the repo for facts.' }, 'Draft writer'),
        n('prompt', 'prompt', 740, 0, { template: 'Review this draft for mistakes and unclear parts. List fixes, most important first.\n\nTask: {task}\n\nDraft:\n{draft}' }),
        n('reviewer', 'agent', 1100, 0, { model: 'claude-sonnet-5-5' }, 'Reviewer'),
        n('combine', 'combine', 1480, 140, { sep: '\\n\\n---\\n\\n' }),
        n('out', 'chat-output', 1840, 160),
      ],
      edges: [
        e('e1', 'in', 'message', 'writer', 'input'),
        e('e2', 'in', 'message', 'prompt', 'var:task'),
        e('e3', 'writer', 'reply', 'prompt', 'var:draft'),
        e('e4', 'prompt', 'text', 'reviewer', 'input'),
        e('e5', 'writer', 'reply', 'combine', 'a'),
        e('e6', 'reviewer', 'reply', 'combine', 'b'),
        e('e7', 'combine', 'text', 'out', 'input'),
      ],
    },
  },
  {
    id: 'side-by-side',
    title: 'Two takes side by side',
    text: 'Two agents answer at once; a model merges their answers.',
    flow: {
      name: 'Two takes',
      nodes: [
        n('in', 'chat-input', 0, 200),
        n('a', 'agent', 360, 0, { instructions: 'Give the cautious, risk-first view.' }, 'Careful planner'),
        n('b', 'agent', 360, 520, { instructions: 'Give the fastest practical path.' }, 'Quick builder'),
        n('prompt', 'prompt', 740, 260, { template: 'Merge these two answers into one plan. Keep what each gets right.\n\nCareful view:\n{careful}\n\nFast view:\n{fast}' }),
        n('model', 'model', 1100, 220, { model: 'claude-sonnet-5-5' }),
        n('out', 'chat-output', 1460, 240),
      ],
      edges: [
        e('e1', 'in', 'message', 'a', 'input'),
        e('e2', 'in', 'message', 'b', 'input'),
        e('e3', 'a', 'reply', 'prompt', 'var:careful'),
        e('e4', 'b', 'reply', 'prompt', 'var:fast'),
        e('e5', 'prompt', 'text', 'model', 'input'),
        e('e6', 'model', 'text', 'out', 'input'),
      ],
    },
  },
]

module.exports = { TEMPLATES }
