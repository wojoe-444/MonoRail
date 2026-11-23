---
audience: ai
summary: Catalog routing, entity schema updates, backend contracts, search and lineage.
---

# OpenMetadata catalog

See the [OpenMetadata guide](../guide/data/openmetadata.md), the
[MonoRail standard](../standard/README.md) and the [developer reference](README.md).

## Sources and backend

`electron/modules/openmetadata.cjs` routes each call via `createService`.
Callers can request `source: 'local' | 'bigquery' | 'server'`. With no
explicit source, the precedence is configured [BigQuery metadata](../bigquery-metadata.md),
connected OpenMetadata server, then the [local database](../local-database.md).
The page uses that precedence without a source switch. BigQuery reads its
local SQLite mirror and the sync keeps that mirror fresh. Metrics and model
tabs have their own [Malloy](../malloy.md) and [MetricFlow](../semantic.md)
backends.

`electron/connections/connectors/openmetadata.cjs` accepts HTTPS or HTTP
on localhost, with a bot token or a login exchanged at `POST /api/v1/users/login`.
Like all [Connections](connections.md), it is opt-in. The renderer sends an
entity type or UUID, and the backend builds the REST path. `TYPES` maps
types to collection paths and tests check agreement with the standard and
`src/modules/openmetadata/catalog.ts`. A server lacking an API type returns
404 and the navigator disables the type. List and get remember a server's
400 refusal of optional fields and retry without them.

The catalog's description edit is one `/description` patch on a server or
a versioned change locally. BigQuery is read-only and the edit affordance
is hidden. Descriptions render with links and images inert. Browser-only
development uses `sample.ts`.

## Tabs and search

`OM_TABS` in `src/modules/openmetadata/tabs.ts` maps tabs to
`/openmetadata/<id>`. Home is `/openmetadata` and the old `/semantic`
route redirects. Route and nav lookup match the prefix. `OpenMetadataPage.tsx`
owns status and Refresh. Tabs marked `catalog: true` wait for catalog data.
Semantic tools load independently. `PageCommandBar`, `PageTabs` and
`TopBarSlot` replace the breadcrumb with the tab strip. Tabs can hand off an
entity via `openInCatalog({ type, fqn })` in memory.

Search over Explore, the Lineage picker and the Catalog list uses backend
search. `useAssetSearch` in `tabs/assets.ts` debounces requests. The local
source searches all entities in SQLite, the server calls `/search/query`
and BigQuery searches its mirror. Keep search independent of capped browse
results. The status page and [Services](../ingestion.md) control ingestion
and sync.

## Table page

Tables open `TableView.tsx` instead of the generic `EntityView` (`tabs/CatalogTab.tsx`
routes on `type === 'table'`). Overview (tiles, description, a one-step lineage
card with `endProducts` beyond it, a columns glance, ownership, data quality,
recent changes) and Quality live there; `TableColumns.tsx` holds the Columns
tab and the column inspector (side by side from a container width of 56rem,
stacked below that); `table.ts` holds the plain helpers (columns flattened with
profile, key, terms and tags; fill share and its percent text, which never
rounds a gap to 0% or 100%; tests from `testCaseResult`; row trend; column
lineage from `lineageDetails.columnsLineage`), tested in `table.test.ts`.
Lineage, Relationships, Versions, Details and JSON reuse `EntityView`'s
exported components; shared non-component helpers are in `entity.ts`.

Profiles and tests come from one read method, `tableHealth({ id, fqn })`,
returning `OmTableHealth`: `profile` (OpenMetadata's tableProfile plus its
columns' columnProfile, checked field by field), `history` (row counts, oldest
first, at most 30), `tests` (test cases whose `entityLink` is the table or one
of its columns) and `errors` (a part that failed; the rest still shows). The
server reads `GET /tables/{fqn}/tableProfile/latest`, `GET /tables/{fqn}/tableProfile`
(30 days) and `GET /dataQuality/testCases?entityLink=&includeAllTests=true`; a
404 means never profiled, not an error. Local and BigQuery read the
`tableProfile` records (the SQLite profiler keeps 30) and the `testCase`
entities from SQLite. It is a phone-allowed read in `electron/remote/policy.cjs`.

## Lineage

All sources return an EntityLineage shape. The server uses
`GET /lineage/{type}/{id}`, then `deepLineage` follows the edges as needed
in three-level batches, up to 120 requests with a `truncated` marker.
Local and BigQuery read SQLite edges. Depths are numbers or `'all'`.
`lineage.ts` defines depth choices and `endProducts`, the downstream
sinks displayed under the entity header. See the
[lineage graph implementation](../../apps/command-hub/src/modules/openmetadata/lineage-graph/README.md)
and [local lineage storage](../local-database.md#lineage).

## Refreshing OpenMetadata schemas

From `apps/command-hub`, run
`node scripts/standard-openmetadata.cjs <OpenMetadata checkout>`. It
refreshes field definitions from pinned JSON schemas and resolves `$ref`s
for descriptions. It reports missing and removed entity types and enum
overlap. Use the [standard rules](../standard/README.md) to add new entities.
Get REST paths from the server's `@Path`, update the backend map and renderer
catalog, then set `openMetadata.pinned` and regenerate the field tables with
`node scripts/standard-docs.cjs`. Tests check the tables, type names,
connector enum values and REST paths.
