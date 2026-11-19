# OpenMetadata lineage graph

`LineageGraph` takes immutable snapshots. Include the root in `nodes` and keep the same array instances across unrelated renders. Update the snapshots when more lineage arrives.

```tsx
import { LineageGraph } from './lineage-graph/LineageGraph'

// Memoize these arrays by the getLineage reply.
const nodes = [data.entity, ...data.nodes]
const edges = [...data.upstreamEdges, ...data.downstreamEdges]

<LineageGraph
  nodes={nodes}
  edges={edges}
  rootId={data.entity.id}
  layout="force"
  onOpen={(ref) => {
    if (typeInfo(ref.type)) onOpen({ type: ref.type, fqn: ref.fullyQualifiedName ?? ref.name ?? ref.id })
  }}
/>
```

Force is the default. Choose Layered in the toolbar or set `layout="layered"` to start with all assets in rank order. The component is standalone. When integrating it into EntityView, keep the depth picker and loading, error, and missing-lineage states. The backend still determines which assets are available. Supply an `unknown` placeholder if a reply references an asset without an `OmRef`.

## Exploring

- Force mode starts with the root and its immediate upstream and downstream neighbours. Click an asset or its `+N` badge to reveal its hidden neighbours. Badges appear at labelled zoom levels. The selected asset's controls also show its count.
- Arrow keys select the next visible asset. Enter expands its hidden neighbours or opens the asset when all its neighbours are visible. **Open asset** always opens the selection. **Collapse branch** or Backspace hides the descendants revealed through that branch. A shared asset stays visible if it was first revealed through another branch. Every connection between visible assets is drawn.
- **Expand all** reveals the entire snapshot, including disconnected components. Drag to pan, scroll or use the buttons to zoom, and press Home to fit the visible graph. Escape clears the selection. Use `className` to override the graph height.

## Layout and drawing

- Both modes share ID and edge normalization and longest-path ranks. Duplicate IDs use the first reference. Duplicate edges, self-edges, and edges with missing endpoints are filtered. DFS excludes cycle feedback edges from ranking and keeps them in the graph.
- Both modes place an asset across by its rank (`rankColumns` in `force.ts`, the same idea in `layout.ts`): ranks run left to right, so every non-cycle connection points right. A rank with more than 30 assets wraps into side-by-side tracks, so a huge rank does not become one endless column and Fit keeps a usable shape. In force mode an asset's column is worked out from the whole snapshot, so nothing moves sideways as branches open; when a new snapshot (another depth) changes an asset's rank, `restore` lets it move to its new column.
- In force mode, new nodes first draw at their parent's position. The renderer draws coincident cards and connections once on that first frame. A worker simulates only y: degree-weighted springs pull connected assets toward the same row, with collision and Barnes-Hut repulsion. For large reveals, the first physics tick starts each track as an evenly spaced stack so thousands of coincident seeds do not overwhelm collision. Alpha decays over 36 ticks and a final packing pass resolves residual card intersections along y. Settled assets stay fixed during reveals. Assets still moving when a reveal occurs continue settling from their displayed positions.
- The force solver uses typed arrays throughout. A transferable position buffer is reused by the worker and renderer, with one snapshot in flight and coalescing at roughly display rate. The main thread interpolates geometry, refits the existing bounding volume hierarchies in linear time, and draws. It repartitions the indexes when visibility changes and when motion ends.
- Layered mode uses two forward/backward barycenter passes to reduce crossings. Its existing worker transfers geometry and bounding volume hierarchies in one result. On snapshot updates, surviving assets seed row order and the camera keeps the selection or root in place.
- Both modes share Canvas 2D level of detail, viewport culling, and batched edge strokes. At overview zoom the renderer shows dots joined centre to centre, and still names the root and the selection. Labelled views show arrows. On high-DPI displays, bulk animations use a DPR 1 backing store and restore the settled frame to device resolution up to DPR 2. Selection traces upstream and downstream across the full snapshot and caches the masks, so revealing a branch reuses the current selection trace.
- Cycles can produce arrows in both directions. Dense overview marks can merge. The quadtree gives typical O(n log n) repulsion, with exact work needed for unusually dense collision neighbourhoods.

## Benchmark

From `apps/command-hub`:

```powershell
node src/modules/openmetadata/lineage-graph/benchmark.cjs
node src/modules/openmetadata/lineage-graph/benchmark.cjs --dpr=2
```

The script builds a disposable Vite entry with `resolve.preserveSymlinks` and runs it under Electron's `file://` origin in a 1280 × 720 offscreen window at 60 Hz. Its component checks cover the initial neighbourhood, keyboard and button expansion, collapse, disconnected assets, layout switching, snapshot updates, asset opening, and palette changes.

The layered trace compares cumulative Canvas optimizations over 120 frames. The force trace compares exact repulsion, Barnes-Hut, bulk seeding, index refitting, coincident spawn drawing, and the high-DPI animation resolution cap while repeatedly panning and zooming through the 5,000-asset, 7,000-connection fixture. It also compares global reheat with pinned assets when reopening a branch in the fully expanded graph. Worker ticks/s include scheduling time. Compute ticks/s measure solver work. End-to-end settle time includes the final interpolated frame. First draw is time from the expansion trigger through Canvas submission. First motion tracks the last revealed card travelling at least two world pixels from its spawn. The benchmark also reports frame-interval percentiles, frames above 20 ms, card overlaps, and the number of edges that point right.

For a manual demo, run Vite and open `/src/modules/openmetadata/lineage-graph/benchmark.html`.
