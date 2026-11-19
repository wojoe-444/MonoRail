// A fictional OpenMetadata catalog for the browser dev server (no backend).
// Same shapes as OpenMetadata 2.0.8's REST API, so the page cannot tell the
// difference. Edits last until the page reloads. Every name here is made up.

import type { OmCounts, OmEntity, OmLineage, OmLineageEdge, OmPage, OmRef, OmStatus, OmTag } from './types'
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

const stgOrders = table(staging, 'stg_orders', 'One row per order, cleaned from the shop database.', [col('order_id', 'STRING', 'The order.', [], 'PRIMARY_KEY'), col('customer_id', 'STRING'), col('ordered_at', 'TIMESTAMP'), col('status', 'STRING', 'placed, shipped, delivered or returned.')], { owners: [ref(sam, 'user')], daysAgo: 6 })
const stgCustomers = table(staging, 'stg_customers', 'One row per customer.', [col('customer_id', 'STRING', '', [], 'PRIMARY_KEY'), col('email', 'STRING', 'Contact address.', [tag('PII.Sensitive')]), col('created_at', 'TIMESTAMP')], { owners: [ref(sam, 'user')], tags: [tag('PII.Sensitive')], daysAgo: 6 })
const fct = table(marts, 'fct_orders', 'One row per order with its totals.', [col('order_id', 'STRING', '', [], 'PRIMARY_KEY'), col('customer_id', 'STRING'), col('order_date', 'DATE'), col('gross_revenue', 'NUMERIC', 'Before discounts.', [tag('Business.Revenue', 'Glossary')]), col('net_revenue', 'NUMERIC', 'After discounts.', [tag('Business.Revenue', 'Glossary')])], { owners: [ref(ada, 'user')], tags: [tag('Tier.Tier1')], domains: [ref(sales, 'domain')], daysAgo: 1 })
const dim = table(marts, 'dim_customers', 'One row per customer with first and last order.', [col('customer_id', 'STRING', '', [], 'PRIMARY_KEY'), col('first_order_date', 'DATE'), col('lifetime_orders', 'INT64'), col('address', 'STRUCT', 'Where orders ship.', [tag('PII.Sensitive')])], { owners: [ref(ada, 'user')], tags: [tag('Tier.Tier2')], domains: [ref(sales, 'domain')], daysAgo: 4 })
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

// ---------- More for the governance tabs (Glossary, Classifications, Domains, Data quality, Services, Teams) ----------
{
  // Teams: Organization > Commerce (business unit) > Data Platform (department) > Analytics (group).
  const org = add('team', 'Organization', { description: 'The whole organization.', teamType: 'Organization', daysAgo: 90 })
  const commerce = add('team', 'Commerce', { description: 'Everything that sells.', teamType: 'BusinessUnit', parents: [ref(org, 'team')], daysAgo: 45 })
  const platform = add('team', 'Data Platform', { fqn: 'Data Platform', description: 'Runs the warehouse and its pipelines.', teamType: 'Department', email: 'data-platform@example.com', parents: [ref(commerce, 'team')], daysAgo: 45 })
  const consumer = byType.get('role')!.find((r) => r.name === 'DataConsumer')!
  const lin = add('user', 'lin.moreau', { displayName: 'Lin Moreau', email: 'lin.moreau@example.com', isAdmin: true, isBot: false, teams: [ref(platform, 'team')], roles: [ref(steward, 'role')], daysAgo: 40 })
  const noor = add('user', 'noor.haddad', { displayName: 'Noor Haddad', email: 'noor.haddad@example.com', isAdmin: false, isBot: false, teams: [ref(platform, 'team'), ref(team, 'team')], roles: [ref(consumer, 'role')], daysAgo: 15 })
  add('user', 'profiler-bot', { displayName: 'Profiler Bot', email: 'profiler-bot@example.com', isBot: true, teams: [], roles: [], daysAgo: 60 })
  org.children = [ref(commerce, 'team')]
  commerce.children = [ref(platform, 'team')]
  platform.children = [ref(team, 'team')]
  platform.users = [ref(lin, 'user'), ref(noor, 'user')]
  platform.userCount = 2
  team.parents = [ref(platform, 'team')]
  team.users = [...((team.users as OmRef[]) ?? []), ref(noor, 'user')]
  team.userCount = 3
  steward.users = [ref(ada, 'user'), ref(lin, 'user')]
  consumer.users = [ref(noor, 'user')]
  stgOrders.owners = [ref(platform, 'team')]

  // Glossary: a term tree, related terms, reviewers, and a second glossary.
  glossary.reviewers = [ref(sam, 'user')]
  const customer = byType.get('glossaryTerm')!.find((t) => t.name === 'Customer')!
  const order = byType.get('glossaryTerm')!.find((t) => t.name === 'Order')!
  const term = (g: OmEntity, parent: OmEntity | undefined, name: string, description: string, extra: Partial<OmEntity> = {}) =>
    add('glossaryTerm', name, { fqn: `${parent?.fullyQualifiedName ?? g.fullyQualifiedName}.${name}`, description, glossary: ref(g, 'glossary'), ...(parent ? { parent: ref(parent, 'glossaryTerm') } : {}), status: 'Approved', daysAgo: 10, ...extra })
  const net = term(glossary, termRevenue, 'Net revenue', 'Revenue after discounts and before refunds.', { synonyms: ['Net sales'], owners: [ref(ada, 'user')], reviewers: [ref(sam, 'user')] })
  const gross = term(glossary, termRevenue, 'Gross revenue', 'Revenue before discounts.', { status: 'In Review', reviewers: [ref(sam, 'user')] })
  const churned = term(glossary, customer, 'Churned customer', 'A customer with no order in the last 365 days.', { status: 'Draft', synonyms: ['Lapsed customer'] })
  termRevenue.children = [ref(net, 'glossaryTerm'), ref(gross, 'glossaryTerm')]
  customer.children = [ref(churned, 'glossaryTerm')]
  termRevenue.relatedTerms = [ref(order, 'glossaryTerm')]
  order.relatedTerms = [ref(termRevenue, 'glossaryTerm'), ref(customer, 'glossaryTerm')]
  termRevenue.reviewers = [ref(sam, 'user')]
  termRevenue.references = [{ name: 'Finance handbook', endpoint: 'https://example.com/handbook/revenue' }]
  const ops = add('glossary', 'Operations', { description: 'Words the warehouse and fulfillment teams use.', owners: [ref(platform, 'team')], mutuallyExclusive: false, daysAgo: 18 })
  term(ops, undefined, 'Fulfillment', 'Picking, packing and shipping an order.', { owners: [ref(lin, 'user')] })
  term(ops, undefined, 'Return', 'An item sent back after delivery.', { status: 'Deprecated' })
  glossary.termCount = 6
  ops.termCount = 2
  dim.tags = [...(dim.tags ?? []), tag('Business.Customer', 'Glossary')]
  daily.tags = [...(daily.tags ?? []), tag('Business.Revenue.Net revenue', 'Glossary')]

  // Classifications: one that is not mutually exclusive.
  const layer = add('classification', 'DataLayer', { displayName: 'Data layer', description: 'Where in the warehouse an asset sits.', mutuallyExclusive: false, provider: 'user', owners: [ref(platform, 'team')], daysAgo: 30 })
  for (const [n, d] of [['Staging', 'Cleaned copies of source tables.'], ['Marts', 'Facts and dimensions for reporting.'], ['Raw', 'Loaded as-is from a source.']]) add('tag', n, { fqn: `DataLayer.${n}`, description: d, classification: ref(layer, 'classification'), daysAgo: 30 })
  for (const t of [stgOrders, stgCustomers]) t.tags = [...(t.tags ?? []), tag('DataLayer.Staging')]
  for (const t of [fct, dim, daily]) t.tags = [...(t.tags ?? []), tag('DataLayer.Marts')]
  tier.termCount = 3
  layer.termCount = 3

  // Domains: a subdomain with its own data product, and a second domain.
  sales.experts = [ref(ada, 'user')]
  const insights = add('domain', 'Customer insights', { fqn: 'Sales.Customer insights', description: 'Who buys, how often, and who stops.', domainType: 'Aggregate', parent: ref(sales, 'domain'), owners: [ref(ada, 'user')], experts: [ref(sam, 'user')], daysAgo: 14 })
  sales.children = [ref(insights, 'domain')]
  const operations = add('domain', 'Operations', { description: 'Fulfillment, inventory and returns.', domainType: 'Source-aligned', owners: [ref(platform, 'team')], daysAgo: 22 })
  const c360 = add('dataProduct', 'Customer 360', { fqn: 'Sales.Customer insights.Customer 360', description: 'One row per customer, with everything known about them.', domains: [ref(insights, 'domain')], assets: [ref(dim, 'table'), ref(stgCustomers, 'table')], owners: [ref(sam, 'user')], experts: [ref(ada, 'user')], daysAgo: 6 })
  insights.dataProducts = [ref(c360, 'dataProduct')]
  operations.dataProducts = []
  stgCustomers.domains = [ref(insights, 'domain')]
  stgOrders.domains = [ref(operations, 'domain')]

  // Data quality: more cases and results, and a logical suite.
  const unique = add('testDefinition', 'columnValuesToBeUnique', { displayName: 'Column values to be unique', description: 'No value appears twice.', entityType: 'COLUMN', testPlatforms: ['OpenMetadata'], provider: 'system', daysAgo: 60 })
  const inSet = add('testDefinition', 'columnValuesToBeInSet', { displayName: 'Column values to be in set', description: 'Every value is one of the allowed values.', entityType: 'COLUMN', testPlatforms: ['OpenMetadata'], provider: 'system', daysAgo: 60 })
  const suiteFor = (t: OmEntity) => add('testSuite', `${t.fullyQualifiedName}.testSuite`, { description: `Tests on ${t.name}.`, basic: true, basicEntityReference: ref(t, 'table'), daysAgo: 3 })
  const dimSuite = suiteFor(dim)
  const stgSuite = suiteFor(stgOrders)
  const custSuite = suiteFor(stgCustomers)
  const tc = (s: OmEntity, t: OmEntity, column: string | undefined, name: string, def: OmEntity, description: string, result?: { status: string; text: string; hoursAgo: number }, extra: Partial<OmEntity> = {}) =>
    add('testCase', name, {
      fqn: `${t.fullyQualifiedName}${column ? `.${column}` : ''}.${name}`,
      description,
      testDefinition: ref(def, 'testDefinition'),
      entityLink: `<#E::table::${t.fullyQualifiedName}${column ? `::columns::${column}` : ''}>`,
      testSuite: ref(s, 'testSuite'),
      ...(result ? { testCaseResult: { timestamp: now - result.hoursAgo * 3_600_000, testCaseStatus: result.status, result: result.text } } : {}),
      daysAgo: 1,
      ...extra,
    })
  const dimUnique = tc(dimSuite, dim, 'customer_id', 'dim_customers_customer_id_unique', unique, 'One row per customer.', { status: 'Success', text: 'Found 0 duplicate values.', hoursAgo: 11 })
  tc(stgSuite, stgOrders, 'status', 'stg_orders_status_in_set', inSet, 'Only the four known statuses.', { status: 'Aborted', text: 'The query timed out after 300 s.', hoursAgo: 13 }, { parameterValues: [{ name: 'allowedValues', value: '["placed","shipped","delivered","returned"]' }] })
  tc(custSuite, stgCustomers, 'email', 'stg_customers_email_not_null', notNull, 'Every customer can be reached.', { status: 'Success', text: 'Found 0 null values.', hoursAgo: 12 })
  tc(custSuite, stgCustomers, 'customer_id', 'stg_customers_customer_id_unique', unique, 'No customer twice.', { status: 'Failed', text: 'Found 3 duplicate values.', hoursAgo: 12 })
  tc(dimSuite, dim, undefined, 'dim_customers_row_count', rowCount, 'At least 100 customers.', undefined, { parameterValues: [{ name: 'minValue', value: '100' }, { name: 'maxValue', value: '10000000' }] })
  const fctCases = byType.get('testCase')!.filter((c) => c.fullyQualifiedName?.startsWith(`${fct.fullyQualifiedName}.`))
  add('testSuite', 'Nightly critical checks', { description: 'The tests that must pass before the executive dashboard refreshes.', basic: false, tests: [...fctCases.map((c) => ref(c, 'testCase')), ref(dimUnique, 'testCase')], owners: [ref(ada, 'user')], daysAgo: 7 })

  // Services: one per category, with ingestion pipelines and their last runs.
  const bi = add('dashboardService', 'bi', { displayName: 'BI', description: 'Dashboards for the business.', serviceType: 'Superset', owners: [ref(team, 'team')], daysAgo: 35 })
  const orchestrator = add('pipelineService', 'orchestrator', { description: 'Schedules the nightly loads.', serviceType: 'Airflow', owners: [ref(platform, 'team')], daysAgo: 35 })
  add('storageService', 'lake', { description: 'Raw files before they are loaded.', serviceType: 'GCS', owners: [ref(platform, 'team')], daysAgo: 35 })
  add('messagingService', 'events', { description: 'Order events from the shop.', serviceType: 'Kafka', daysAgo: 35 })
  const run = (state: string, hoursAgo: number, minutes: number) => ({ pipelineState: state, runId: uuid(), startDate: now - hoursAgo * 3_600_000, endDate: now - hoursAgo * 3_600_000 + minutes * 60_000, timestamp: now - hoursAgo * 3_600_000 })
  const pipe = (svc: OmEntity, svcType: string, name: string, displayName: string, pipelineType: string, cron: string, description: string, statuses: ReturnType<typeof run>[], extra: Partial<OmEntity> = {}) =>
    add('ingestionPipeline', name, { fqn: `${svc.fullyQualifiedName}.${name}`, displayName, description, pipelineType, service: ref(svc, svcType), airflowConfig: { scheduleInterval: cron }, enabled: true, deployed: true, pipelineStatuses: statuses[0], daysAgo: 2, ...extra })
  pipe(service, 'databaseService', 'warehouse_usage', 'Warehouse usage', 'usage', '0 4 * * *', 'Reads query logs to find popular tables.', [run('success', 20, 6)])
  pipe(service, 'databaseService', 'warehouse_profiler', 'Warehouse profiler', 'profiler', '0 5 * * 1', 'Profiles the marts tables once a week.', [run('failed', 30, 12)])
  pipe(service, 'databaseService', 'warehouse_tests', 'Warehouse tests', 'TestSuite', '30 5 * * *', 'Runs the data quality tests.', [run('partialSuccess', 18, 4)])
  pipe(bi, 'dashboardService', 'bi_metadata', 'BI metadata', 'metadata', '0 3 * * *', 'Reads dashboards and charts.', [run('success', 21, 2)])
  pipe(orchestrator, 'pipelineService', 'orchestrator_metadata', 'Orchestrator metadata', 'metadata', '0 */6 * * *', 'Reads DAGs and their task status.', [], { enabled: false, deployed: false })
}

// An older version of daily_revenue, so the Versions view has history.
history.set(daily.id, [{ ...daily, version: 0.1, description: 'Revenue per day.', updatedAt: now - 3 * DAY, updatedBy: 'ingestion-bot', changeDescription: undefined }])
daily.version = 0.2
daily.changeDescription = { fieldsUpdated: [{ name: 'description' }] }

// A few data assets beyond tables, for the Explore, Lineage and Insights tabs.
const svcRef = (type: string, name: string) => {
  const s = byType.get(type)?.find((x) => x.name === name)
  return s ? { service: ref(s, type) } : {}
}
const execDash = add('dashboard', 'executive_revenue', { fqn: 'bi.executive_revenue', displayName: 'Executive revenue', description: 'Daily revenue and orders for the leadership team.', ...svcRef('dashboardService', 'bi'), owners: [ref(ada, 'user')], tags: [tag('Tier.Tier1')], domains: [ref(sales, 'domain')], daysAgo: 0.5 })
add('chart', 'revenue_by_day', { fqn: 'bi.revenue_by_day', displayName: 'Revenue by day', description: '', ...svcRef('dashboardService', 'bi'), daysAgo: 0.5 })
add('dashboard', 'customer_health', { fqn: 'bi.customer_health', displayName: 'Customer health', description: '', ...svcRef('dashboardService', 'bi'), daysAgo: 10 })
const nightly = add('pipeline', 'nightly_marts', { fqn: 'orchestrator.nightly_marts', displayName: 'Nightly marts', description: 'Builds the staging and marts layers every night.', ...svcRef('pipelineService', 'orchestrator'), owners: [ref(sam, 'user')], daysAgo: 1 })
add('topic', 'order_events', { fqn: 'events.order_events', description: 'One message per order status change.', ...svcRef('messagingService', 'events'), tags: [tag('PII.NonSensitive')], daysAgo: 14 })

// Lineage edges, kept apart from the entities as OpenMetadata keeps them.
const edges: { from: OmEntity; to: OmEntity; details?: OmLineageEdge['lineageDetails'] }[] = [
  { from: daily, to: execDash, details: { source: 'DashboardLineage' } },
  { from: stgOrders, to: daily, details: { source: 'PipelineLineage', pipeline: ref(nightly, 'pipeline'), description: 'Refreshed by the nightly marts run.' } },
  { from: stgOrders, to: fct, details: { source: 'DbtLineage' } },
  { from: stgCustomers, to: dim, details: { source: 'DbtLineage' } },
  { from: fct, to: dim, details: { source: 'DbtLineage' } },
  { from: fct, to: daily, details: { source: 'QueryLineage', sqlQuery: 'SELECT order_date AS day, COUNT(*) AS orders, SUM(net_revenue) AS net_revenue FROM marts.fct_orders GROUP BY 1' } },
]

function typeOfEntity(e: OmEntity): string {
  for (const [type, items] of byType) if (items.includes(e)) return type
  return 'table'
}

/** The same walk as the local database's: up to 3 levels each way. */
function lineage(id: string, up: number, down: number): OmLineage {
  const all = [...byType].flatMap(([type, items]) => items.map((e) => ({ type, e })))
  const center = all.find((x) => x.e.id === id)
  if (!center) throw new Error('Not found')
  const nodes = new Map<string, OmRef>()
  const walk = (depth: number, upstream: boolean) => {
    const out: OmLineageEdge[] = []
    let frontier = [id]
    const seen = new Set(frontier)
    for (let d = 0; d < Math.min(3, depth) && frontier.length; d++) {
      const next: string[] = []
      for (const at of frontier) {
        for (const x of edges.filter((x) => (upstream ? x.to.id : x.from.id) === at)) {
          out.push({ fromEntity: x.from.id, toEntity: x.to.id, ...(x.details ? { lineageDetails: x.details } : {}) })
          const other = upstream ? x.from : x.to
          nodes.set(other.id, ref(other, typeOfEntity(other)))
          if (!seen.has(other.id)) {
            seen.add(other.id)
            next.push(other.id)
          }
        }
      }
      frontier = next
    }
    return out
  }
  const upstreamEdges = walk(up, true)
  const downstreamEdges = walk(down, false)
  nodes.delete(id)
  return { entity: ref(center.e, center.type), nodes: [...nodes.values()], upstreamEdges, downstreamEdges }
}

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
  getLineage: ({ id, upstreamDepth, downstreamDepth }) => lineage(String(id), Number(upstreamDepth ?? 1), Number(downstreamDepth ?? 1)),
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
