// A fictional OpenMetadata catalog for the browser dev server (no backend).
// Same shapes as OpenMetadata 2.0.8's REST API, so the page cannot tell the
// difference. Edits last until the page reloads. Every name here is made up.

import type { OmCounts, OmEntity, OmPage, OmRef, OmStatus, OmTag } from './types'
import { TYPES } from './catalog'

const DAY = 86_400_000
const now = Date.now()
let seq = 0
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

const byType = new Map<string, OmEntity[]>(TYPES.map((x) => [x.type, []]))
const history = new Map<string, OmEntity[]>()

function add(type: string, name: string, extra: Partial<OmEntity> & { fqn?: string; daysAgo?: number } = {}): OmEntity {
  const { fqn, daysAgo = 3, ...rest } = extra
  const e: OmEntity = {
    id: uuid(),
    name,
    fullyQualifiedName: fqn ?? name,
    displayName: name,
    description: '',
    version: 0.1,
    updatedAt: now - daysAgo * DAY,
    updatedBy: 'admin',
    deleted: false,
    owners: [],
    tags: [],
    followers: [],
    domains: [],
    ...rest,
  }
  byType.get(type)!.push(e)
  return e
}

const ref = (e: OmEntity, type: string): OmRef => ({ id: e.id, type, name: e.name, fullyQualifiedName: e.fullyQualifiedName, displayName: e.displayName })
const tag = (tagFQN: string, source: OmTag['source'] = 'Classification'): OmTag => ({ tagFQN, source, labelType: 'Manual', state: 'Confirmed' })

// ---------- Teams and access ----------
const policyConsumer = add('policy', 'DataConsumerPolicy', { description: 'View everything; suggest descriptions and tags.', rules: [{ name: 'DataConsumerPolicy-EditRule', effect: 'allow', resources: ['All'], operations: ['ViewAll', 'EditDescription', 'EditTags'] }], enabled: true, provider: 'system', daysAgo: 60 })
const policySteward = add('policy', 'DataStewardPolicy', { description: 'Curate the catalog.', rules: [{ name: 'DataStewardPolicy-EditRule', effect: 'allow', resources: ['All'], operations: ['ViewAll', 'EditDescription', 'EditDisplayName', 'EditOwners', 'EditTags', 'EditLineage'] }], enabled: true, provider: 'system', daysAgo: 60 })
add('role', 'DataConsumer', { displayName: 'Data Consumer', description: 'Uses the catalog and suggests changes.', policies: [ref(policyConsumer, 'policy')], provider: 'system', daysAgo: 60 })
const steward = add('role', 'DataSteward', { displayName: 'Data Steward', description: 'Curates the catalog.', policies: [ref(policySteward, 'policy')], provider: 'system', daysAgo: 60 })
const team = add('team', 'Analytics', { description: 'Owns the staging and marts layers.', teamType: 'Group', email: 'analytics@example.com', daysAgo: 30 })
const ada = add('user', 'ada.park', { displayName: 'Ada Park', email: 'ada.park@example.com', isAdmin: false, isBot: false, teams: [ref(team, 'team')], roles: [ref(steward, 'role')], daysAgo: 30 })
const sam = add('user', 'sam.okafor', { displayName: 'Sam Okafor', email: 'sam.okafor@example.com', isAdmin: false, isBot: false, teams: [ref(team, 'team')], roles: [], daysAgo: 30 })
add('user', 'ingestion-bot', { displayName: 'Ingestion Bot', email: 'ingestion-bot@example.com', isBot: true, teams: [], roles: [], daysAgo: 60 })
team.users = [ref(ada, 'user'), ref(sam, 'user')]
team.userCount = 2

// ---------- Governance ----------
const tier = add('classification', 'Tier', { description: 'How critical an asset is.', mutuallyExclusive: true, provider: 'system', daysAgo: 60 })
const pii = add('classification', 'PII', { description: 'Whether data identifies a person.', mutuallyExclusive: true, provider: 'system', daysAgo: 60 })
for (const [n, d] of [['Tier1', 'Critical: feeds executive reporting.'], ['Tier2', 'Important: used by several teams.'], ['Tier3', 'Team-level.']]) add('tag', n, { fqn: `Tier.${n}`, description: d, classification: ref(tier, 'classification'), daysAgo: 60 })
for (const [n, d] of [['Sensitive', 'Identifies a person directly.'], ['NonSensitive', 'Does not identify a person on its own.']]) add('tag', n, { fqn: `PII.${n}`, description: d, classification: ref(pii, 'classification'), daysAgo: 60 })
const glossary = add('glossary', 'Business', { description: 'Shared definitions for the business.', owners: [ref(ada, 'user')], daysAgo: 20 })
const termRevenue = add('glossaryTerm', 'Revenue', { fqn: 'Business.Revenue', description: 'Money from orders, after discounts and before refunds.', glossary: ref(glossary, 'glossary'), synonyms: ['Sales'], status: 'Approved', owners: [ref(ada, 'user')], daysAgo: 12 })
add('glossaryTerm', 'Customer', { fqn: 'Business.Customer', description: 'Anyone who has placed at least one order.', glossary: ref(glossary, 'glossary'), status: 'Approved', daysAgo: 12 })
add('glossaryTerm', 'Order', { fqn: 'Business.Order', description: 'One checkout: one or more items bought together.', glossary: ref(glossary, 'glossary'), status: 'Draft', daysAgo: 2 })
const sales = add('domain', 'Sales', { description: 'Orders, revenue and customers.', domainType: 'Consumer-aligned', owners: [ref(team, 'team')], daysAgo: 25 })

// ---------- Services and data assets ----------
const service = add('databaseService', 'warehouse', { description: 'The analytics warehouse.', serviceType: 'BigQuery', connection: { config: { type: 'BigQuery', hostPort: 'bigquery.googleapis.com' } }, owners: [ref(team, 'team')], daysAgo: 40 })
add('metadataService', 'OpenMetadata', { description: 'This server.', serviceType: 'OpenMetadata', daysAgo: 60 })
const database = add('database', 'acme-analytics', { fqn: 'warehouse.acme-analytics', description: 'The modeled analytics project.', service: ref(service, 'databaseService'), serviceType: 'BigQuery', daysAgo: 40 })
const schema = (name: string, description: string) =>
  add('databaseSchema', name, { fqn: `warehouse.acme-analytics.${name}`, description, service: ref(service, 'databaseService'), database: ref(database, 'database'), daysAgo: 40 })
const staging = schema('staging', 'Cleaned copies of the source tables, one per source.')
const marts = schema('marts', 'Facts and dimensions for reporting.')

const col = (name: string, dataType: string, description = '', tags: OmTag[] = [], constraint?: string) => ({ name, dataType, dataTypeDisplay: dataType.toLowerCase(), description, tags, ...(constraint ? { constraint } : {}) })
const table = (s: OmEntity, name: string, description: string, columns: ReturnType<typeof col>[], extra: Partial<OmEntity> = {}) =>
  add('table', name, {
    fqn: `${s.fullyQualifiedName}.${name}`,
    description,
    tableType: 'Regular',
    columns: columns.map((c) => ({ ...c, fullyQualifiedName: `${s.fullyQualifiedName}.${name}.${c.name}` })),
    service: ref(service, 'databaseService'),
    database: ref(database, 'database'),
    databaseSchema: ref(s, 'databaseSchema'),
    serviceType: 'BigQuery',
    ...extra,
  })

table(staging, 'stg_orders', 'One row per order, cleaned from the shop database.', [col('order_id', 'STRING', 'The order.', [], 'PRIMARY_KEY'), col('customer_id', 'STRING'), col('ordered_at', 'TIMESTAMP'), col('status', 'STRING', 'placed, shipped, delivered or returned.')], { owners: [ref(sam, 'user')], daysAgo: 6 })
table(staging, 'stg_customers', 'One row per customer.', [col('customer_id', 'STRING', '', [], 'PRIMARY_KEY'), col('email', 'STRING', 'Contact address.', [tag('PII.Sensitive')]), col('created_at', 'TIMESTAMP')], { owners: [ref(sam, 'user')], tags: [tag('PII.Sensitive')], daysAgo: 6 })
const fct = table(marts, 'fct_orders', 'One row per order with its totals.', [col('order_id', 'STRING', '', [], 'PRIMARY_KEY'), col('customer_id', 'STRING'), col('order_date', 'DATE'), col('gross_revenue', 'NUMERIC', 'Before discounts.', [tag('Business.Revenue', 'Glossary')]), col('net_revenue', 'NUMERIC', 'After discounts.', [tag('Business.Revenue', 'Glossary')])], { owners: [ref(ada, 'user')], tags: [tag('Tier.Tier1')], domains: [ref(sales, 'domain')], daysAgo: 1 })
table(marts, 'dim_customers', 'One row per customer with first and last order.', [col('customer_id', 'STRING', '', [], 'PRIMARY_KEY'), col('first_order_date', 'DATE'), col('lifetime_orders', 'INT64'), col('address', 'STRUCT', 'Where orders ship.', [tag('PII.Sensitive')])], { owners: [ref(ada, 'user')], tags: [tag('Tier.Tier2')], domains: [ref(sales, 'domain')], daysAgo: 4 })
const daily = table(marts, 'daily_revenue', 'Revenue per day, for the executive dashboard.', [col('day', 'DATE', '', [], 'PRIMARY_KEY'), col('orders', 'INT64'), col('net_revenue', 'NUMERIC', '', [tag('Business.Revenue', 'Glossary')])], { tableType: 'View', owners: [ref(team, 'team')], tags: [tag('Tier.Tier1')], domains: [ref(sales, 'domain')], daysAgo: 0.2 })
add('storedProcedure', 'refresh_daily_revenue', { fqn: 'warehouse.acme-analytics.marts.refresh_daily_revenue', description: 'Rebuilds daily_revenue from fct_orders.', storedProcedureCode: { language: 'SQL', code: 'CREATE OR REPLACE TABLE marts.daily_revenue AS\nSELECT order_date AS day, COUNT(*) AS orders, SUM(net_revenue) AS net_revenue\nFROM marts.fct_orders GROUP BY 1' }, databaseSchema: ref(marts, 'databaseSchema'), database: ref(database, 'database'), service: ref(service, 'databaseService'), daysAgo: 9 })
add('query', 'top_customers', { description: 'Customers by lifetime revenue.', query: 'SELECT customer_id, SUM(net_revenue) AS revenue FROM marts.fct_orders GROUP BY 1 ORDER BY 2 DESC LIMIT 20', queryUsedIn: [ref(fct, 'table')], users: [ref(sam, 'user')], daysAgo: 2 })
add('metric', 'net_revenue', { description: 'Revenue after discounts.', metricExpression: { language: 'SQL', code: 'SUM(net_revenue)' }, metricType: 'SUM', unitOfMeasurement: 'DOLLARS', granularity: 'DAY', tags: [tag('Business.Revenue', 'Glossary')], owners: [ref(ada, 'user')], daysAgo: 5 })
add('dataProduct', 'Revenue reporting', { description: 'The tables behind the executive revenue dashboard.', domains: [ref(sales, 'domain')], assets: [ref(fct, 'table'), ref(daily, 'table')], owners: [ref(ada, 'user')], daysAgo: 8 })
sales.dataProducts = byType.get('dataProduct')!.map((p) => ref(p, 'dataProduct'))
termRevenue.relatedTerms = []

// ---------- Data quality and ingestion ----------
const notNull = add('testDefinition', 'columnValuesToBeNotNull', { displayName: 'Column values to be not null', description: 'Every value in the column is set.', entityType: 'COLUMN', testPlatforms: ['OpenMetadata'], provider: 'system', daysAgo: 60 })
const rowCount = add('testDefinition', 'tableRowCountToBeBetween', { displayName: 'Table row count to be between', description: 'The table has between a minimum and a maximum number of rows.', entityType: 'TABLE', testPlatforms: ['OpenMetadata'], provider: 'system', daysAgo: 60 })
const suite = add('testSuite', 'warehouse.acme-analytics.marts.fct_orders.testSuite', { description: 'Tests on fct_orders.', basic: true, daysAgo: 3 })
add('testCase', 'fct_orders_order_id_not_null', { fqn: 'warehouse.acme-analytics.marts.fct_orders.order_id.fct_orders_order_id_not_null', description: 'Every order has an id.', testDefinition: ref(notNull, 'testDefinition'), entityLink: '<#E::table::warehouse.acme-analytics.marts.fct_orders::columns::order_id>', testSuite: ref(suite, 'testSuite'), testCaseResult: { timestamp: now - DAY / 2, testCaseStatus: 'Success', result: 'Found 0 null values.' }, daysAgo: 0.5 })
add('testCase', 'fct_orders_row_count', { fqn: 'warehouse.acme-analytics.marts.fct_orders.fct_orders_row_count', description: 'Between 1,000 and 5,000,000 rows.', testDefinition: ref(rowCount, 'testDefinition'), entityLink: '<#E::table::warehouse.acme-analytics.marts.fct_orders>', testSuite: ref(suite, 'testSuite'), parameterValues: [{ name: 'minValue', value: '1000' }, { name: 'maxValue', value: '5000000' }], testCaseResult: { timestamp: now - DAY / 2, testCaseStatus: 'Failed', result: 'Found 812 rows.' }, daysAgo: 0.5 })
add('ingestionPipeline', 'warehouse_metadata', { fqn: 'warehouse.warehouse_metadata', displayName: 'Warehouse metadata', description: 'Reads tables and views from the warehouse every night.', pipelineType: 'metadata', service: ref(service, 'databaseService'), airflowConfig: { scheduleInterval: '0 2 * * *' }, enabled: true, deployed: true, daysAgo: 1 })
add('app', 'SearchIndexingApplication', { displayName: 'Search Indexing', description: 'Keeps the search index in step with the catalog.', appType: 'internal', scheduleType: 'ScheduledOrManual', daysAgo: 60 })
add('type', 'table', { description: 'The entity type of tables, with its custom properties.', category: 'entity', customProperties: [], daysAgo: 60 })

// An older version of daily_revenue, so the Versions view has history.
history.set(daily.id, [{ ...daily, version: 0.1, description: 'Revenue per day.', updatedAt: now - 3 * DAY, updatedBy: 'ingestion-bot', changeDescription: undefined }])
daily.version = 0.2
daily.changeDescription = { fieldsUpdated: [{ name: 'description' }] }

function list(type: string): OmEntity[] {
  const items = byType.get(type)
  if (!items) throw new Error(`OpenMetadata has no entity type "${type}" here.`)
  return items
}

const methods: Record<string, (args: Record<string, unknown>) => unknown> = {
  status: (): OmStatus => ({ url: 'Sample catalog (browser preview)', version: '2.0.8', user: 'Ada Park' }),
  counts: (): OmCounts => Object.fromEntries(TYPES.map((x) => [x.type, list(x.type).filter((e) => !e.deleted).length])),
  list: ({ type, after, deleted, limit }): OmPage => {
    const items = list(String(type))
      .filter((e) => deleted || !e.deleted)
      .sort((a, b) => a.name.localeCompare(b.name))
    const start = Number(after ?? 0) || 0
    const n = Number(limit ?? 50) || 50
    const page = items.slice(start, start + n)
    return { data: page, paging: { total: items.length, after: start + n < items.length ? String(start + n) : undefined } }
  },
  get: ({ type, fqn }) => {
    const e = list(String(type)).find((x) => x.fullyQualifiedName === fqn || x.name === fqn)
    if (!e) throw new Error(`OpenMetadata: ${String(type)} instance for ${String(fqn)} not found`)
    return e
  },
  versions: ({ type, id }) => {
    const e = list(String(type)).find((x) => x.id === id)
    if (!e) throw new Error('Not found')
    return [e, ...[...(history.get(e.id) ?? [])].reverse()]
  },
  recent: () =>
    TYPES.flatMap((x) => list(x.type).map((e) => ({ ...e, entityType: x.type })))
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, 30),
  setDescription: ({ type, id, description }) => {
    const items = list(String(type))
    const i = items.findIndex((x) => x.id === id)
    if (i < 0) throw new Error('Not found')
    const prev = items[i]
    history.set(prev.id, [...(history.get(prev.id) ?? []), prev])
    const next: OmEntity = {
      ...prev,
      description: String(description),
      version: Math.round(((prev.version ?? 0.1) + 0.1) * 10) / 10,
      updatedAt: Date.now(),
      updatedBy: 'ada.park',
      changeDescription: { fieldsUpdated: [{ name: 'description' }] },
    }
    items[i] = next
    return next
  },
}

export async function sampleInvoke<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const fn = methods[method]
  if (!fn) throw new Error(`Unknown method ${method}`)
  await new Promise((r) => setTimeout(r, 120))
  return structuredClone(fn(args)) as T
}
