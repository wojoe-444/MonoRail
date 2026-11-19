import { Segmented } from '@/components/ui/segmented'

import type { SemanticEngine } from './engine'

/** Malloy | MetricFlow, above the Semantic models and Query builder tabs. */
export function EngineSwitch({ engine, onChange }: { engine: SemanticEngine; onChange: (e: SemanticEngine) => void }) {
  return (
    <Segmented
      aria-label="Semantic engine"
      value={engine}
      onChange={onChange}
      options={[
        { value: 'malloy', label: 'Malloy', title: 'Malloy models, compiled by Malloy and run on BigQuery' },
        { value: 'metricflow', label: 'MetricFlow', title: "The dbt project's semantic layer, through your MetricFlow" },
      ]}
    />
  )
}
