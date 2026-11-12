import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type Edge, type EdgeProps } from '@xyflow/react'
import { X } from 'lucide-react'

export type FlowEdgeData = { color: string } & Record<string, unknown>

/**
 * A connection line. It is easy to hit (a wide invisible band), shows a soft
 * halo on hover and a strong one when selected, and a selected line gets a
 * small round x in its middle that removes it, like deleting a line on a slide.
 */
export const FlowEdge = memo(function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, animated, data, markerEnd }: EdgeProps<Edge<FlowEdgeData>>) {
  const rf = useReactFlow()
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const color = data?.color ?? 'var(--muted-foreground)'
  return (
    <>
      <path d={path} className="flow-edge-halo" style={{ stroke: color }} />
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={28}
        className={animated ? 'flow-edge-animated' : undefined}
        style={{ stroke: color, strokeWidth: selected ? 3 : 2 }}
      />
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            aria-label="Delete this connection"
            title="Delete this connection (Delete key)"
            onClick={(e) => {
              e.stopPropagation()
              void rf.deleteElements({ edges: [{ id }] })
            }}
            className="nodrag nopan pointer-events-auto absolute grid size-6 place-items-center rounded-full bg-card text-foreground shadow-elevation-2 ring-1 ring-foreground/15 transition-colors hover:bg-destructive hover:text-white"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <X className="size-3.5" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
})
