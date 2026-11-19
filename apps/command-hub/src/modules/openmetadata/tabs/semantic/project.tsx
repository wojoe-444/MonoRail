import type { ReactNode } from 'react'
import { AlertTriangle, Cable, Database, FileCode2, FolderOpen, Loader2, PlugZap, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatRelative } from '@/lib/format'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { isDesktop } from '@/modules/client'
import type { SemanticBlock, SemanticProject } from '@/modules/semantic/types'

import type { ProjectState } from './useSemanticProject'

/**
 * Loading, not-set-up and broken-project states around a semantic tab, plus
 * the project strip. Renders `children` only for a readable project.
 */
export function SemanticFrame({ state, children }: { state: ProjectState; children: (project: SemanticProject) => ReactNode }) {
  const { project, error, fetching, reload } = state
  if (!project) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {error ? error : (<><Loader2 className="size-4 animate-spin" /> Reading the dbt project…</>)}
      </div>
    )
  }
  if (project.block) return <BlockedCard block={project.block} detail={project.blockDetail} onRetry={reload} />
  return (
    <div className="flex flex-col gap-6">
      <ProjectStrip project={project} fetching={fetching} onReload={reload} />
      {children(project)}
    </div>
  )
}

const BLOCKS: Record<SemanticBlock, { title: string; body: string; icon: typeof PlugZap; warn?: boolean }> = {
  'not-set-up': {
    title: 'MetricFlow is not set up in MonoRail',
    body: 'The semantic layer comes from a dbt project and is queried with MetricFlow. It is optional: add the MetricFlow connection on Connections and pick your dbt project folder. Until then MonoRail looks at nothing: it does not search for dbt projects or Python, and it never installs MetricFlow.',
    icon: PlugZap,
  },
  'no-project': {
    title: 'The dbt project folder was not found',
    body: 'The folder in the MetricFlow connection has no dbt_project.yml, or it was moved. Pick the folder again on Connections.',
    icon: FolderOpen,
    warn: true,
  },
  'no-manifest': {
    title: 'This project has no semantic manifest yet',
    body: 'dbt writes target/semantic_manifest.json when it parses the project. Run "dbt parse" (or "mf validate-configs") in the project folder, then reload. MonoRail reads that file; it does not run dbt for you.',
    icon: FileCode2,
    warn: true,
  },
  'bad-manifest': {
    title: 'The semantic manifest could not be read',
    body: 'target/semantic_manifest.json is damaged or from a dbt version this page does not know. Parse the project again, then reload.',
    icon: AlertTriangle,
    warn: true,
  },
}

export function BlockedCard({ block, detail, onRetry, body }: { block: SemanticBlock; detail?: string; onRetry: () => void; body?: string }) {
  const b = BLOCKS[block]
  return (
    <Card className="items-start gap-4 px-6 py-8">
      <span className={cn('flex size-10 items-center justify-center rounded-lg', b.warn ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-primary-soft text-primary-soft-foreground')}>
        <b.icon className="size-5" />
      </span>
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 className="text-lg font-semibold">{b.title}</h2>
        <p className="text-sm text-muted-foreground">{body ?? b.body}</p>
        {detail && <p className="font-mono text-xs text-muted-foreground">{detail}</p>}
      </div>
      <div className="flex gap-2">
        {block === 'not-set-up' || block === 'no-project' ? (
          <Button onClick={() => navigate('/connections')}>
            <Cable /> {block === 'not-set-up' ? 'Set up on Connections' : 'Open Connections'}
          </Button>
        ) : (
          <Button onClick={onRetry}>
            <RefreshCw /> Reload project
          </Button>
        )}
      </div>
    </Card>
  )
}

function ProjectStrip({ project, fetching, onReload }: { project: SemanticProject; fetching: boolean; onReload: () => void }) {
  const p = project.project
  const mf = project.metricflow
  const parts = [
    p?.folderName,
    p?.dbtVersion && `dbt ${p.dbtVersion}`,
    `${project.metrics.length} metrics`,
    `${project.dimensions.length} dimensions`,
    `${project.models.length} semantic models`,
  ].filter(Boolean)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      <Badge variant="secondary" className="font-mono">
        <Database /> {p?.name}
      </Badge>
      {parts.map((t, i) => (
        <span key={i} className="flex items-center gap-3">
          {i > 0 && <span className="text-foreground/20">·</span>}
          <span className="tabular-nums">{t}</span>
        </span>
      ))}
      <span className="ml-auto flex items-center gap-3 text-xs">
        {mf.canRun && mf.found ? (
          <Badge variant="success">
            <span className="size-1.5 rounded-full bg-success" /> MetricFlow {mf.version ?? ''}
          </Badge>
        ) : (
          <Badge variant="secondary" title="Turn on “Run queries with MetricFlow” in the MetricFlow connection">
            Queries off
          </Badge>
        )}
        {p?.manifestAt && <span>Parsed {formatRelative(p.manifestAt)}</span>}
        <Button variant="ghost" size="sm" disabled={!isDesktop() || fetching} onClick={onReload} title="Reads target/semantic_manifest.json again">
          {fetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Reload
        </Button>
      </span>
    </div>
  )
}
