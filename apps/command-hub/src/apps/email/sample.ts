import type { EmailApi } from './api'
import type { Account, DiscoveredStore, EmailState, Folder, Message, Thread, ThreadSummary } from './types'

/*
 * Fictional sample inbox for the browser dev server (no backend there).
 * Every name, address and message here is made up.
 */

const ME = 'you@example.com'
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

const account: Account = { id: 'sample', kind: 'gmail', address: ME, name: ME, addedAt: hoursAgo(400) }

// Outlook on this PC: one own mailbox and one shared team mailbox (read-only).
const OL_ME = 'you@contoso.example'
const outlookStores: DiscoveredStore[] = [
  { key: 'store-own', name: OL_ME, address: OL_ME, kindLabel: 'Mailbox', shared: false, accountId: null },
  { key: 'store-team', name: 'Field Reports', address: '', kindLabel: 'Shared mailbox', shared: true, accountId: null },
  { key: 'store-pst', name: 'Old archive 2019', address: '', kindLabel: 'Data file', shared: false, accountId: null },
]
const accounts: Account[] = [
  account,
  { id: 'sample-ol', kind: 'outlook', key: 'store-own', address: OL_ME, name: OL_ME, detail: 'Mailbox', readOnly: false, settings: {}, addedAt: hoursAgo(300) },
  { id: 'sample-ol-team', kind: 'outlook', key: 'store-team', address: '', name: 'Field Reports', detail: 'Shared mailbox', readOnly: true, settings: { skipFolders: ['Inbox\\Old'] }, addedAt: hoursAgo(300) },
]

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

const olFolders = (inboxKids: [string, string][]): Folder[] => [
  { id: 'INBOX', name: 'Inbox', kind: 'system', role: 'inbox', path: 'Inbox', parentId: null, depth: 0 },
  ...inboxKids.map(([path, name]) => ({ id: path, name, kind: 'user' as const, path, parentId: path.split('\\').slice(0, -1).join('\\').replace(/^Inbox$/, 'INBOX'), depth: path.split('\\').length - 1 })),
  { id: 'DRAFT', name: 'Drafts', kind: 'system', role: 'drafts', path: 'Drafts', parentId: null, depth: 0 },
  { id: 'SENT', name: 'Sent Items', kind: 'system', role: 'sent', path: 'Sent Items', parentId: null, depth: 0 },
  { id: 'TRASH', name: 'Deleted Items', kind: 'system', role: 'trash', path: 'Deleted Items', parentId: null, depth: 0 },
  { id: 'Archive', name: 'Archive', kind: 'user', path: 'Archive', parentId: null, depth: 0 },
]
const foldersBy: Record<string, Folder[]> = {
  sample: folders,
  'sample-ol': olFolders([['Inbox\\Projects', 'Projects'], ['Inbox\\Projects\\Harbor', 'Harbor']]),
  'sample-ol-team': olFolders([['Inbox\\Daily', 'Daily'], ['Inbox\\Daily\\Station 4', 'Station 4'], ['Inbox\\Weekly', 'Weekly']]),
}

const olThreads = (acct: string, from: string, rows: [string, string, number, string, string, boolean][]): Thread[] =>
  rows.map(([id, folder, h, subject, text, unread]) => ({
    id: `${acct}-${id}`,
    subject,
    labelIds: [folder, ...(unread ? ['UNREAD'] : [])],
    messages: [msg(`${acct}-${id}`, 1, from, acct === 'sample-ol' ? OL_ME : 'Field Reports', h, text, { subject, unread })],
  }))

const threadsBy: Record<string, Thread[]> = {
  sample: threads,
  'sample-ol': olThreads('sample-ol', 'Dana Whitfield <dana@contoso.example>', [
    ['o1', 'INBOX', 3, 'Harbor project: kickoff notes', 'Notes from today are attached. Next check-in is Thursday.', true],
    ['o2', 'Inbox\\Projects\\Harbor', 30, 'Harbor budget, first pass', 'Here is the first pass at the budget. Numbers are rough.', false],
    ['o3', 'INBOX', 52, 'Station 4 weekly numbers', 'The weekly numbers from station 4 look normal again.', false],
  ]),
  'sample-ol-team': olThreads('sample-ol-team', 'Reports Robot <reports@contoso.example>', [
    ['t1', 'Inbox\\Daily\\Station 4', 6, 'Station 4 daily report', 'All sensors reporting. 2 warnings, 0 faults.', true],
    ['t2', 'Inbox\\Daily', 28, 'Daily report summary', 'Five stations reported. Station 4 had two warnings.', false],
    ['t3', 'Inbox\\Weekly', 120, 'Weekly numbers, week 45', 'Uptime 99.2%. Station 4 numbers are attached.', false],
    ['t4', 'INBOX', 9, 'Shared mailbox: new access request', 'A new member asked for access to Field Reports.', false],
  ]),
}

for (const list of Object.values(threadsBy)) for (const t of list) for (const m of t.messages) m.subject = m.subject || t.subject

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

const allThreads = () => Object.values(threadsBy).flat()
const find = (id: string) => {
  const t = allThreads().find((x) => x.id === id)
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
      setup: 'oauth',
      capabilities: { labels: true, queryHint: 'Search mail (from:, subject:, has:attachment …)', attachmentsHint: 'Open the message in Gmail to download attachments' },
    },
    {
      kind: 'outlook',
      label: 'Outlook on this PC',
      description: 'Uses the classic Outlook that is open and signed in here. No sign-in, no app registration.',
      configFields: [],
      config: { values: {}, secretsSet: {} },
      setup: 'discover',
      capabilities: { labels: false, folderTree: true, fullStoreSearch: true, queryHint: 'Search subject, sender, recipients and text', attachmentsHint: 'Open the message in Outlook to save attachments' },
    },
  ],
  accounts: structuredClone(accounts),
  encryptionAvailable: true,
  signingIn: false,
})

/** Folder, query, days back and unread filters over one sample account. */
function sampleList(accountId: string, { folderId, query, daysBack, unreadOnly, allFolders }: { folderId?: string; query?: string; daysBack?: number; unreadOnly?: boolean; allFolders?: boolean }): ThreadSummary[] {
  const q = (query ?? '').toLowerCase()
  const isOutlook = accountId !== 'sample'
  // Gmail searches all mail; Outlook searches the open folder unless All folders is on.
  const inFolder = (t: Thread) => !folderId || (q && (!isOutlook || allFolders)) || t.labelIds.includes(folderId)
  const cutoff = daysBack ? Date.now() - daysBack * 86_400_000 : 0
  return (threadsBy[accountId] ?? [])
    .filter(inFolder)
    .filter((t) => !q || JSON.stringify(t).toLowerCase().includes(q))
    .filter((t) => !unreadOnly || t.labelIds.includes('UNREAD'))
    .filter((t) => !cutoff || Date.parse(t.messages.at(-1)?.date ?? '') >= cutoff)
    .map((t) => ({ ...summarize(t), folder: isOutlook && q && allFolders ? t.labelIds[0].replace(/^INBOX$/, 'Inbox') : undefined }))
    .sort((a, b) => Date.parse(b.date ?? '') - Date.parse(a.date ?? ''))
}

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120))

export const sampleApi: EmailApi = {
  getState: () => delay(state()),
  saveConnectorConfig: () => delay(state()),
  signIn: () => delay(account),
  cancelSignIn: () => delay(true),
  removeAccount: () => delay(state()),
  discover: () => delay({ status: 'ok' as const, stores: outlookStores.map((st) => ({ ...st, accountId: accounts.find((a) => a.key === st.key)?.id ?? null })) }),
  addStores: (_k, picks) => {
    const added: Account[] = []
    for (const p of picks) {
      const st = outlookStores.find((x) => x.key === p.key)
      if (!st || accounts.some((a) => a.key === st.key)) continue
      const a: Account = { id: `sample-${st.key}`, kind: 'outlook', key: st.key, address: st.address, name: st.name, detail: st.kindLabel, readOnly: p.readOnly, settings: {}, addedAt: hoursAgo(0) }
      accounts.push(a)
      foldersBy[a.id] = olFolders([])
      threadsBy[a.id] = []
      added.push(a)
    }
    return delay({ added, state: state() })
  },
  updateAccount: (id, patch) => {
    const a = accounts.find((x) => x.id === id)
    if (a && typeof patch.readOnly === 'boolean') a.readOnly = patch.readOnly
    if (a && patch.skipFolders) a.settings = { skipFolders: patch.skipFolders.map((x) => x.trim()).filter(Boolean) }
    return delay(state())
  },
  listFolders: (accountId) => {
    const list = threadsBy[accountId] ?? []
    const unreadIn = (id: string) => list.filter((t) => t.labelIds.includes(id) && t.labelIds.includes('UNREAD')).length
    return delay({ folders: (foldersBy[accountId] ?? []).map((f) => (f.id === 'INBOX' || f.kind === 'user' ? { ...f, unread: unreadIn(f.id) || undefined } : f)), timedOut: false })
  },
  listThreads: (accountId, opts) => delay({ threads: sampleList(accountId, opts), nextPageToken: null, estimate: 0 }),
  searchAccounts: (ids, opts) => {
    const rows = ids.flatMap((id) => sampleList(id, { ...opts, folderId: opts.allFolders ? undefined : 'INBOX' }).map((t) => ({ ...t, accountId: id, alsoIn: [] })))
    rows.sort((a, b) => Date.parse(b.date ?? '') - Date.parse(a.date ?? ''))
    return delay({ threads: rows, truncated: false, errors: [], partial: [] })
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
