import { useState } from 'react'
import { Bookmark, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'

import { takeQueryDraft, type QueryDraft } from './semantic/handoff'
import { SemanticFrame } from './semantic/project'
import { useSemanticProject } from './semantic/useSemanticProject'
import { QueryBuilder } from './semantic/QueryBuilder'
import { useSemanticEngine } from './semantic/engine'
import { EngineSwitch } from './semantic/EngineSwitch'
import { MalloyQueryTab } from './semantic/MalloyQueryBuilder'
import type { OmTabProps } from './types'

/**
 * Query builder, on Malloy (default) or MetricFlow; the engine switch is remembered per person.
 */
export default function QueryTab(_props: OmTabProps) {
  const [engine, setEngine] = useSemanticEngine()
  return (
    <div className="flex flex-col gap-6">
      <EngineSwitch engine={engine} onChange={setEngine} />
      {engine === 'malloy' ? <MalloyQueryTab /> : <MetricFlowQuery />}
    </div>
  )
}

/**
 * Query builder: the semantic layer's metrics through the user's own
 * MetricFlow. A metric, measure or saved query from another tab arrives as a
 * draft (filled in, never run by itself).
 */
function MetricFlowQuery() {
  const state = useSemanticProject()
  const [draft, setDraft] = useState<QueryDraft | undefined>(takeQueryDraft)

  return (
    <SemanticFrame state={state}>
      {(project) => (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Pick metrics and how to split them. MetricFlow writes the SQL, with the joins between semantic models worked out from their entities.
            </p>
            <div className="ml-auto flex items-center gap-2">
              {project.savedQueries.length > 0 && (
                <div className="flex items-center gap-2">
                  <Bookmark className="size-4 text-muted-foreground" />
                  <NativeSelect
                    aria-label="Open a saved query"
                    className="w-56"
                    value=""
                    onChange={(e) => {
                      const s = project.savedQueries.find((q) => q.name === e.target.value)
                      if (s) setDraft({ metrics: s.metrics, groupBy: s.groupBy, where: s.where, key: Date.now() })
                    }}
                  >
                    <option value="">Open a saved query…</option>
                    {project.savedQueries.map((s) => (
                      <option key={s.name} value={s.name} title={s.description}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={() => setDraft({ metrics: [], groupBy: [], key: Date.now() })} title="Clear the builder">
                <RotateCcw /> Start over
              </Button>
            </div>
          </div>
          <Card className="gap-0 py-0">
            <QueryBuilder key={draft?.key ?? 'default'} project={project} initial={draft} />
          </Card>
        </div>
      )}
    </SemanticFrame>
  )
}
