// Team Jira: a small client for the Jira Cloud REST API (v3).
//
// Auth is an Atlassian API token (id.atlassian.com > Security > API tokens)
// sent as Basic auth with the account email. The token is stored by
// index.cjs in %APPDATA%\MonoRail\apps\jira-plus, encrypted with Electron's
// safeStorage (Windows DPAPI). It is never logged or returned to the page.
//
// Jira v3 stores rich text as Atlassian Document Format (ADF). The page works
// in plain text, so descriptions and comments are converted both ways here.

const CATEGORY = { new: 'todo', indeterminate: 'in_progress', done: 'done' }
const ISSUE_FIELDS = [
  'summary',
  'status',
  'issuetype',
  'priority',
  'assignee',
  'reporter',
  'labels',
  'created',
  'updated',
  'project',
  'comment',
  'parent',
  'timespent',
  'aggregatetimespent',
]

/** Jira wants worklog times as 2026-11-12T09:30:00.000+0000. */
function jiraTime(iso) {
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) throw new Error('Pick when the work started.')
  return d.toISOString().replace('Z', '+0000')
}

// ---------- ADF <-> plain text ----------

function adfToText(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  const kids = (n) => (n.content ?? []).map(adfToText).join('')
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(adfToText).join('').replace(/\n{3,}/g, '\n\n').trim()
    case 'text':
      return node.text ?? ''
    case 'hardBreak':
      return '\n'
    case 'paragraph':
    case 'heading':
      return `${kids(node)}\n\n`
    case 'bulletList':
    case 'orderedList':
      return (
        (node.content ?? [])
          .map((li, i) => `${node.type === 'orderedList' ? `${i + 1}.` : '-'} ${adfToText(li).trim()}`)
          .join('\n') + '\n\n'
      )
    case 'listItem':
      return kids(node)
    case 'codeBlock':
      return `${kids(node)}\n\n`
    case 'blockquote':
      return kids(node)
        .trim()
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n') + '\n\n'
    case 'mention':
      return node.attrs?.text ?? '@someone'
    case 'emoji':
      return node.attrs?.text ?? node.attrs?.shortName ?? ''
    case 'inlineCard':
    case 'blockCard':
      return node.attrs?.url ?? ''
    case 'rule':
      return '---\n\n'
    default:
      return kids(node)
  }
}

function textToAdf(text) {
  const paragraphs = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  return {
    type: 'doc',
    version: 1,
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: p.split('\n').flatMap((line, i) => [
        ...(i ? [{ type: 'hardBreak' }] : []),
        ...(line ? [{ type: 'text', text: line }] : []),
      ]),
    })),
  }
}

// ---------- client ----------

function normalizeSite(siteUrl) {
  let s = String(siteUrl ?? '').trim()
  if (!s) throw new Error('Enter your Jira site, like your-team.atlassian.net.')
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  const u = new URL(s)
  if (u.protocol !== 'https:') throw new Error('The Jira site must use https.')
  return `https://${u.host}`
}

function createJiraClient({ siteUrl, email, token }) {
  const base = normalizeSite(siteUrl)
  const auth = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`

  async function request(method, path, body) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: auth,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 204) return undefined
    const text = await res.text()
    let data
    try {
      data = text ? JSON.parse(text) : undefined
    } catch {
      data = undefined
    }
    if (!res.ok) {
      const detail =
        data?.errorMessages?.join(' ') ||
        Object.entries(data?.errors ?? {})
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ') ||
        res.statusText
      const hint =
        res.status === 401
          ? ' Check the email and API token in Connect Jira.'
          : res.status === 403
            ? ' Your Jira account does not have permission for this.'
            : ''
      throw new Error(`Jira ${res.status}: ${detail}.${hint}`.replace('..', '.'))
    }
    return data
  }

  function toIssue(raw) {
    const f = raw.fields ?? {}
    return {
      key: raw.key,
      id: raw.id,
      source: 'jira',
      projectKey: f.project?.key ?? raw.key.split('-')[0],
      projectName: f.project?.name,
      summary: f.summary ?? '',
      type: f.issuetype?.name ?? 'Task',
      priority: f.priority?.name ?? 'Medium',
      status: f.status?.name ?? 'Unknown',
      statusCategory: CATEGORY[f.status?.statusCategory?.key] ?? 'todo',
      assignee: f.assignee?.displayName,
      reporter: f.reporter?.displayName,
      labels: f.labels ?? [],
      created: f.created,
      updated: f.updated,
      commentCount: f.comment?.total ?? 0,
      ...(f.parent ? { parent: parentOf(f.parent) } : {}),
      timeSpentSeconds: f.timespent ?? 0,
      // Jira's own roll-up: this issue plus its sub-tasks.
      aggregateSeconds: f.aggregatetimespent ?? f.timespent ?? 0,
      url: `${base}/browse/${raw.key}`,
    }
  }

  function parentOf(p) {
    const status = p.fields?.status
    return {
      key: p.key,
      summary: p.fields?.summary,
      type: p.fields?.issuetype?.name,
      status: status?.name,
      statusCategory: CATEGORY[status?.statusCategory?.key] ?? 'todo',
    }
  }

  async function worklogs(key) {
    const data = await request('GET', `/rest/api/3/issue/${encodeURIComponent(key)}/worklog?maxResults=200`)
    return (data?.worklogs ?? [])
      .map((w) => ({
        id: w.id,
        author: w.author?.displayName ?? 'Someone',
        started: new Date(w.started).toISOString(),
        seconds: w.timeSpentSeconds ?? 0,
        comment: adfToText(w.comment),
        created: w.created,
      }))
      .sort((a, b) => b.started.localeCompare(a.started))
  }

  async function search(jql, max = 200) {
    const issues = []
    let nextPageToken
    do {
      const page = await request('POST', '/rest/api/3/search/jql', {
        jql,
        fields: ISSUE_FIELDS,
        maxResults: Math.min(100, max - issues.length),
        ...(nextPageToken ? { nextPageToken } : {}),
      })
      issues.push(...(page?.issues ?? []).map(toIssue))
      nextPageToken = page?.isLast === false ? page.nextPageToken : undefined
    } while (nextPageToken && issues.length < max)
    return issues
  }

  return {
    base,
    myself: () => request('GET', '/rest/api/3/myself'),
    search,

    async getIssue(key) {
      const [raw, tr, logs, children] = await Promise.all([
        request('GET', `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${[...ISSUE_FIELDS, 'description'].join(',')}`),
        request('GET', `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`),
        worklogs(key).catch(() => []),
        search(`parent = "${String(key).replace(/["\\]/g, '')}" ORDER BY key ASC`, 100).catch(() => []),
      ])
      const issue = toIssue(raw)
      const comments = (raw.fields?.comment?.comments ?? []).map((c) => ({
        id: c.id,
        author: c.author?.displayName ?? 'Someone',
        body: adfToText(c.body),
        created: c.created,
      }))
      return {
        ...issue,
        description: adfToText(raw.fields?.description),
        comments,
        worklogs: logs,
        children,
        timeTracking: {
          spentSeconds: issue.timeSpentSeconds,
          // Children's roll-ups include their sub-tasks, so epic > story > sub-task adds up.
          totalSeconds: issue.timeSpentSeconds + children.reduce((n, c) => n + (c.aggregateSeconds ?? 0), 0),
        },
        history: [],
        transitions: (tr?.transitions ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          toStatus: t.to?.name ?? t.name,
          toCategory: CATEGORY[t.to?.statusCategory?.key] ?? 'todo',
        })),
      }
    },

    async issueTypes(projectKey) {
      const data = await request('GET', `/rest/api/3/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`)
      return (data?.issueTypes ?? data?.values ?? []).filter((t) => !t.subtask).map((t) => t.name)
    },

    async createIssue({ projectKey, summary, description, type, labels, accountId, parent }) {
      const fields = {
        project: { key: projectKey },
        ...(parent ? { parent: { key: parent } } : {}),
        summary,
        issuetype: { name: type || 'Task' },
        ...(description ? { description: textToAdf(description) } : {}),
        ...(labels?.length ? { labels } : {}),
      }
      const created = await request('POST', '/rest/api/3/issue', { fields })
      // Assign to yourself when allowed; leave unassigned otherwise.
      if (accountId) {
        await request('PUT', `/rest/api/3/issue/${created.key}/assignee`, { accountId }).catch(() => {})
      }
      return created.key
    },

    async updateIssue(key, fields) {
      const out = {}
      if (fields.summary !== undefined) out.summary = fields.summary
      if (fields.description !== undefined) out.description = fields.description.trim() ? textToAdf(fields.description) : null
      if (fields.labels !== undefined) out.labels = fields.labels
      if (fields.priority !== undefined) out.priority = { name: fields.priority }
      if (fields.type !== undefined) out.issuetype = { name: fields.type }
      if (Object.keys(out).length) await request('PUT', `/rest/api/3/issue/${encodeURIComponent(key)}`, { fields: out })
    },

    /** parent: an issue key, or null to remove it. Jira decides which hierarchies it allows. */
    setParent: (key, parent) =>
      request('PUT', `/rest/api/3/issue/${encodeURIComponent(key)}`, { fields: { parent: parent ? { key: parent } : null } }),

    /** Issues in the project that could be a parent: newest first, open ones only. */
    parentOptions: (projectKey, key) =>
      search(
        `project = "${String(projectKey).replace(/["\\]/g, '')}"${key ? ` AND key != "${String(key).replace(/["\\]/g, '')}"` : ''} AND statusCategory != Done ORDER BY updated DESC`,
        50,
      ).then((list) =>
        list.map((i) => ({ key: i.key, summary: i.summary, type: i.type, status: i.status, statusCategory: i.statusCategory })),
      ),

    async logWork(key, { seconds, started, comment }) {
      const w = await request('POST', `/rest/api/3/issue/${encodeURIComponent(key)}/worklog`, {
        timeSpentSeconds: Math.round(seconds),
        started: jiraTime(started),
        ...(comment ? { comment: textToAdf(comment) } : {}),
      })
      return { id: w.id, author: w.author?.displayName ?? 'You', started: new Date(w.started).toISOString(), seconds: w.timeSpentSeconds, comment: adfToText(w.comment), created: w.created }
    },

    deleteWorklog: (key, id) =>
      request('DELETE', `/rest/api/3/issue/${encodeURIComponent(key)}/worklog/${encodeURIComponent(id)}`),

    transition: (key, transitionId) =>
      request('POST', `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, { transition: { id: transitionId } }),

    async addComment(key, body) {
      const c = await request('POST', `/rest/api/3/issue/${encodeURIComponent(key)}/comment`, { body: textToAdf(body) })
      return { id: c.id, author: c.author?.displayName ?? 'You', body: adfToText(c.body), created: c.created }
    },
  }
}

module.exports = { createJiraClient, normalizeSite, adfToText, textToAdf, jiraTime }
