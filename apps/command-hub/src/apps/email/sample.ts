import type { EmailApi } from './api'
import type { Account, EmailState, Folder, Message, Thread, ThreadSummary } from './types'

/*
 * Fictional sample inbox for the browser dev server (no backend there).
 * Every name, address and message here is made up.
 */

const ME = 'you@example.com'
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

const account: Account = { id: 'sample', kind: 'gmail', address: ME, name: ME, addedAt: hoursAgo(400) }

const folders: Folder[] = [
  { id: 'INBOX', name: 'Inbox', kind: 'system', role: 'inbox', unread: 2 },
  { id: 'STARRED', name: 'Starred', kind: 'system', role: 'starred' },
  { id: 'IMPORTANT', name: 'Important', kind: 'system', role: 'important' },
  { id: 'SENT', name: 'Sent', kind: 'system', role: 'sent' },
  { id: 'DRAFT', name: 'Drafts', kind: 'system', role: 'drafts' },
  { id: 'SPAM', name: 'Spam', kind: 'system', role: 'spam' },
  { id: 'TRASH', name: 'Trash', kind: 'system', role: 'trash' },
  { id: 'Label_1', name: 'Projects', kind: 'user' },
  { id: 'Label_2', name: 'Receipts', kind: 'user' },
  { id: 'Label_3', name: 'Travel', kind: 'user' },
]

function msg(threadId: string, n: number, from: string, to: string, h: number, text: string, extra: Partial<Message> = {}): Message {
  return {
    id: `${threadId}-m${n}`,
    threadId,
    from,
    to,
    cc: '',
    replyTo: '',
    subject: '',
    date: hoursAgo(h),
    snippet: text.slice(0, 120).replace(/\s+/g, ' '),
    text,
    html: '',
    attachments: [],
    labelIds: [],
    unread: false,
    ...extra,
  }
}

const threads: Thread[] = [
  {
    id: 't-launch',
    subject: 'Launch checklist for the trail map',
    labelIds: ['INBOX', 'UNREAD', 'IMPORTANT', 'Label_1'],
    messages: [
      msg('t-launch', 1, 'Priya Nandakumar <priya@northwind.example>', ME, 26, 'Hi!\n\nHere is the draft checklist for next week. Can you look over the hosting section?\n\n- Final copy review\n- Map tiles cached\n- Hosting cutover\n\nThanks,\nPriya'),
      msg('t-launch', 2, `You <${ME}>`, 'Priya Nandakumar <priya@northwind.example>', 20, 'Looks good. I will take the hosting cutover.\n\nOn yesterday, Priya wrote:\n> Here is the draft checklist for next week.'),
      msg(
        't-launch',
        3,
        'Marco Ruiz <marco@northwind.example>',
        ME,
        2,
        'Tiles are cached. One open question about the CDN, details below.',
        {
          unread: true,
          labelIds: ['UNREAD'],
          html: '<div style="font-family:Arial,sans-serif"><p>Tiles are cached. 🎉</p><p>One open question: do we keep the <b>old CDN</b> warm for a week? See <a href="https://example.com/cdn-notes">the notes</a>.</p><p style="color:#666">Marco</p></div>',
          attachments: [{ id: 'a1', filename: 'tile-report.pdf', mimeType: 'application/pdf', size: 248_000 }],
        },
      ),
    ],
  },
  {
    id: 't-receipt',
    subject: 'Your receipt from Lumen Coffee Roasters',
    labelIds: ['INBOX', 'Label_2'],
    messages: [msg('t-receipt', 1, 'Lumen Coffee Roasters <orders@lumen.example>', ME, 30, 'Thanks for your order #4821.\n\n1 x Highland blend, 340 g\nTotal: $18.00\n\nIt ships tomorrow.')],
  },
  {
    id: 't-trip',
    subject: 'Cabin weekend: who is driving?',
    labelIds: ['INBOX', 'UNREAD', 'STARRED', 'Label_3'],
    messages: [
      msg('t-trip', 1, 'Jules Okafor <jules@mailbox.example>', `${ME}, sam@mailbox.example`, 50, 'The cabin is booked for Friday to Sunday. Who can drive? I can take four people.'),
      msg('t-trip', 2, 'Sam Lee <sam@mailbox.example>', `${ME}, jules@mailbox.example`, 5, 'I can drive too, leaving around 5pm Friday.', { unread: true, labelIds: ['UNREAD'] }),
    ],
  },
  {
    id: 't-news',
    subject: 'This week in open source maps',
    labelIds: ['INBOX'],
    messages: [msg('t-news', 1, 'Map Weekly <hello@mapweekly.example>', ME, 72, 'Five new tile renderers, a vector style guide, and a long read on projections.')],
  },
  {
    id: 't-sent',
    subject: 'Invoice question',
    labelIds: ['SENT'],
    messages: [msg('t-sent', 1, `You <${ME}>`, 'billing@hosting.example', 96, 'Hi, could you resend the October invoice? Thanks.')],
  },
]

for (const t of threads) for (const m of t.messages) m.subject = m.subject || t.subject

function summarize(t: Thread): ThreadSummary {
  const last = t.messages.at(-1)!
  return {
    id: t.id,
    subject: t.subject,
    from: last.from,
    participants: [...new Set(t.messages.map((m) => m.from.replace(/\s*<.*>$/, '')))],
    snippet: last.snippet,
    date: last.date,
    messageCount: t.messages.length,
    unread: t.labelIds.includes('UNREAD'),
    starred: t.labelIds.includes('STARRED'),
    labelIds: t.labelIds,
    hasAttachments: t.messages.some((m) => m.attachments.length > 0),
  }
}

const find = (id: string) => {
  const t = threads.find((x) => x.id === id)
  if (!t) throw new Error('Thread not found')
  return t
}

const state = (): EmailState => ({
  connectors: [
    {
      kind: 'gmail',
      label: 'Google (Gmail)',
      description: 'Sign in with Google. Uses your own Google Cloud OAuth client (Desktop app type).',
      configFields: [
        { key: 'clientId', label: 'OAuth client ID', secret: false, optional: false, placeholder: '1234567890-abc.apps.googleusercontent.com' },
        { key: 'clientSecret', label: 'Client secret', secret: true, optional: false, placeholder: 'GOCSPX-…' },
      ],
      config: { values: { clientId: 'sample.apps.googleusercontent.com' }, secretsSet: { clientSecret: true } },
    },
  ],
  accounts: [account],
  encryptionAvailable: true,
  signingIn: false,
})

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120))

export const sampleApi: EmailApi = {
  getState: () => delay(state()),
  saveConnectorConfig: () => delay(state()),
  signIn: () => delay(account),
  cancelSignIn: () => delay(true),
  removeAccount: () => delay(state()),
  listFolders: () => delay(folders.map((f) => (f.id === 'INBOX' ? { ...f, unread: threads.filter((t) => t.labelIds.includes('INBOX') && t.labelIds.includes('UNREAD')).length } : f))),
  listThreads: (_a, { folderId, query }) => {
    const q = (query ?? '').toLowerCase()
    const list = threads
      .filter((t) => !folderId || t.labelIds.includes(folderId))
      .filter((t) => !q || JSON.stringify(t).toLowerCase().includes(q))
      .map(summarize)
      .sort((a, b) => Date.parse(b.date ?? '') - Date.parse(a.date ?? ''))
    return delay({ threads: list, nextPageToken: null, estimate: list.length })
  },
  getThread: (_a, id) => delay(structuredClone(find(id))),
  modifyThread: (_a, id, add, remove) => {
    const t = find(id)
    t.labelIds = [...new Set([...t.labelIds.filter((l) => !remove.includes(l)), ...add])]
    return delay({ id, labelIds: t.labelIds })
  },
  archive: (_a, id) => {
    const t = find(id)
    t.labelIds = t.labelIds.filter((l) => l !== 'INBOX')
    return delay({ id })
  },
  markRead: (_a, id, read) => {
    const t = find(id)
    t.labelIds = read ? t.labelIds.filter((l) => l !== 'UNREAD') : [...t.labelIds, 'UNREAD']
    for (const m of t.messages) m.unread = !read && m === t.messages.at(-1)
    return delay({ id })
  },
  createFolder: (_a, name) => {
    const f: Folder = { id: `Label_${folders.length + 1}`, name, kind: 'user' }
    folders.push(f)
    return delay(f)
  },
  send: (_a, draft) => {
    const replyTo = draft.replyTo ? threads.find((t) => t.messages.some((m) => m.id === draft.replyTo!.messageId)) : undefined
    const t: Thread = replyTo ?? { id: `t-${Date.now()}`, subject: draft.subject || '(no subject)', labelIds: ['SENT'], messages: [] }
    t.messages.push(msg(t.id, t.messages.length + 1, `You <${ME}>`, draft.to, 0, draft.body, { subject: draft.subject }))
    if (!t.labelIds.includes('SENT')) t.labelIds.push('SENT')
    if (!replyTo) threads.push(t)
    return delay({ id: t.messages.at(-1)!.id, threadId: t.id })
  },
}
