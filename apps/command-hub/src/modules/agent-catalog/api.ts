// Page side of the Agent Catalog: the backend in the desktop app, fictional
// subagents kept in memory in the browser dev server.

import { useCallback, useState } from 'react'

import { invokeModule, isDesktop, useModuleQuery } from '@/modules/client'

import { sampleCatalog, sampleDetails } from './sample'
import type { CatalogData, SubagentDetail, SubagentDraft, SubagentTool } from './types'

const ID = 'agent-catalog'

// Browser dev server only: a fictional catalog that create/edit/delete change.
let sample: SubagentDetail[] | undefined
const samples = () => (sample ??= sampleDetails())

function sampleData(): CatalogData {
  const base = sampleCatalog()
  return { ...base, subagents: samples().map(({ prompt: _p, source: _source, sourceName: _name, ...s }) => s) }
}

function sampleWrite(tool: SubagentTool, draft: SubagentDraft, id?: string): string {
  const dir = tool === 'pi' ? (draft.saveTo === 'user' ? '~/.pi/agent/agents' : '.pi/agents') : draft.saveTo === 'user' ? '~/.claude/agents' : '.claude/agents'
  const next: SubagentDetail = {
    id: id ?? `sub_${Date.now()}`,
    tool,
    scope: draft.saveTo === 'user' ? 'user' : 'project',
    repo: draft.saveTo === 'user' ? undefined : draft.saveTo,
    name: draft.name,
    description: draft.description,
    model: draft.model || undefined,
    tools: draft.tools ?? undefined,
    prompt: draft.prompt,
    location: `${dir}/${draft.name}.md`,
    updatedAt: Date.now(),
    extraFields: [],
  }
  sample = id ? samples().map((s) => (s.id === id ? next : s)) : [...samples(), next]
  return next.id
}

export function useCatalog() {
  const desktop = isDesktop()
  const query = useModuleQuery<CatalogData>(ID, 'list')
  const [local, setLocal] = useState(() => (desktop ? undefined : sampleData()))
  const refresh = useCallback(async () => {
    if (desktop) await query.refresh()
    else setLocal(sampleData())
  }, [desktop, query])
  return { data: desktop ? query.data : local, error: desktop ? query.error : undefined, loading: desktop && query.loading, fetching: desktop && query.fetching, refresh }
}

export async function getSubagent(id: string): Promise<SubagentDetail> {
  if (!isDesktop()) {
    const s = samples().find((x) => x.id === id)
    if (!s) throw new Error('Subagent not found.')
    return s
  }
  return invokeModule<SubagentDetail>(ID, 'get', { id })
}

export async function createSubagent(tool: SubagentTool, draft: SubagentDraft): Promise<string> {
  if (!isDesktop()) return sampleWrite(tool, draft)
  return (await invokeModule<{ id: string }>(ID, 'create', { tool, draft })).id
}

export async function updateSubagent(s: SubagentDetail, draft: SubagentDraft): Promise<string> {
  if (!isDesktop() && s.scope === 'builtin') {
    sample = samples().map((item) => item.id === s.id ? { ...item, ...draft, tools: draft.tools ?? undefined, customized: true, updatedAt: Date.now() } : item)
    return s.id
  }
  if (!isDesktop()) return sampleWrite(s.tool, draft, s.id)
  return (await invokeModule<{ id: string }>(ID, 'update', { id: s.id, draft, updatedAt: s.updatedAt })).id
}

export async function resetSubagent(s: SubagentDetail): Promise<void> {
  if (!isDesktop()) { const original = sampleDetails().find((item) => item.id === s.id); if (original) sample = samples().map((item) => item.id === s.id ? original : item); return }
  await invokeModule(ID, 'reset', { id: s.id, updatedAt: s.updatedAt })
}

export async function removeSubagent(id: string): Promise<void> {
  if (!isDesktop()) {
    sample = samples().filter((s) => s.id !== id)
    return
  }
  await invokeModule(ID, 'remove', { id })
}

export async function openBackups(): Promise<void> {
  if (isDesktop()) await invokeModule(ID, 'openBackups')
}
