import type { ExplainResult, GroupByDimension, QueryRequest, QueryResult, SemanticModel, SemanticProject } from './types'

// Fictional sample data for the browser dev server, which has no backend.
// "Lantern Coffee" is made up: a small coffee chain's dbt project.

const models: SemanticModel[] = [
  {
    name: 'orders',
    description: 'One row per order placed in a store or online.',
    model: 'fct_orders',
    defaultTimeDimension: 'ordered_at',
    primaryEntity: 'order',
    entities: [
      { name: 'order', type: 'primary' },
      { name: 'customer', type: 'foreign' },
      { name: 'store', type: 'foreign' },
    ],
    dimensions: [
      { name: 'ordered_at', type: 'time', grain: 'day', description: 'When the order was placed.' },
      { name: 'channel', type: 'categorical', description: 'In store, app or web.' },
      { name: 'order_status', type: 'categorical' },
      { name: 'is_first_order', type: 'categorical' },
    ],
    measures: [
      { name: 'order_total', agg: 'sum', description: 'Order value after discounts.' },
      { name: 'order_count', agg: 'count' },
      { name: 'discount_total', agg: 'sum' },
      { name: 'ordering_customers', agg: 'count_distinct' },
    ],
  },
  {
    name: 'order_items',
    description: 'One row per product on an order.',
    model: 'fct_order_items',
    defaultTimeDimension: 'ordered_at',
    primaryEntity: 'order_item',
    entities: [
      { name: 'order_item', type: 'primary' },
      { name: 'order', type: 'foreign' },
      { name: 'product', type: 'foreign' },
    ],
    dimensions: [{ name: 'ordered_at', type: 'time', grain: 'day' }],
    measures: [
      { name: 'item_revenue', agg: 'sum' },
      { name: 'items_sold', agg: 'sum' },
    ],
  },
  {
    name: 'customers',
    description: 'Everyone who has ordered at least once.',
    model: 'dim_customers',
    defaultTimeDimension: 'first_order_at',
    primaryEntity: 'customer',
    entities: [{ name: 'customer', type: 'primary' }],
    dimensions: [
      { name: 'first_order_at', type: 'time', grain: 'day' },
      { name: 'region', type: 'categorical' },
      { name: 'segment', type: 'categorical', description: 'Regular, occasional or new.' },
    ],
    measures: [{ name: 'customer_count', agg: 'count_distinct' }],
  },
  {
    name: 'stores',
    model: 'dim_stores',
    primaryEntity: 'store',
    entities: [{ name: 'store', type: 'primary' }],
    dimensions: [
      { name: 'city', type: 'categorical' },
      { name: 'store_format', type: 'categorical', description: 'Kiosk, cafe or roastery.' },
      { name: 'opened_at', type: 'time', grain: 'day' },
    ],
    measures: [{ name: 'store_count', agg: 'count' }],
  },
  {
    name: 'products',
    model: 'dim_products',
    primaryEntity: 'product',
    entities: [{ name: 'product', type: 'primary' }],
    dimensions: [
      { name: 'category', type: 'categorical' },
      { name: 'roast', type: 'categorical' },
    ],
    measures: [],
  },
]

const dimensions: GroupByDimension[] = [
  { name: 'metric_time', type: 'time', grain: 'day', semanticModel: '', description: 'The time of each metric, from its measure’s default time dimension.' },
  { name: 'order__ordered_at', type: 'time', grain: 'day', semanticModel: 'orders' },
  { name: 'order__channel', type: 'categorical', semanticModel: 'orders', description: 'In store, app or web.' },
  { name: 'order__order_status', type: 'categorical', semanticModel: 'orders' },
  { name: 'order__is_first_order', type: 'categorical', semanticModel: 'orders' },
  { name: 'customer__region', type: 'categorical', semanticModel: 'customers' },
  { name: 'customer__segment', type: 'categorical', semanticModel: 'customers' },
  { name: 'customer__first_order_at', type: 'time', grain: 'day', semanticModel: 'customers' },
  { name: 'store__city', type: 'categorical', semanticModel: 'stores' },
  { name: 'store__store_format', type: 'categorical', semanticModel: 'stores' },
  { name: 'store__opened_at', type: 'time', grain: 'day', semanticModel: 'stores' },
  { name: 'product__category', type: 'categorical', semanticModel: 'products' },
  { name: 'product__roast', type: 'categorical', semanticModel: 'products' },
]

const orderDims = ['metric_time', 'order__ordered_at', 'order__channel', 'order__order_status', 'order__is_first_order', 'customer__region', 'customer__segment', 'customer__first_order_at', 'store__city', 'store__store_format', 'store__opened_at']
const itemDims = ['metric_time', 'order__ordered_at', 'order__channel', 'product__category', 'product__roast', 'customer__region', 'store__city']

export const sampleProject: SemanticProject = {
  project: { name: 'lantern_coffee', folderName: 'lantern-analytics', dbtVersion: '1.10.4', manifestAt: new Date(Date.now() - 1000 * 60 * 42).toISOString() },
  metricflow: { canRun: true, found: true, version: '0.208.1' },
  models,
  dimensions,
  metrics: [
    { name: 'revenue', label: 'Revenue', description: 'Money taken on orders, after discounts.', type: 'simple', definition: 'Sum of order_total', measures: ['order_total'], inputMetrics: [], semanticModels: ['orders'], dimensions: orderDims },
    { name: 'orders', label: 'Orders', description: 'Orders placed, in any channel.', type: 'simple', definition: 'Count of order_count', measures: ['order_count'], inputMetrics: [], semanticModels: ['orders'], dimensions: orderDims },
    { name: 'average_order_value', label: 'Average order value', description: 'Revenue per order.', type: 'ratio', definition: 'revenue ÷ orders', measures: ['order_total', 'order_count'], inputMetrics: ['revenue', 'orders'], semanticModels: ['orders'], dimensions: orderDims },
    { name: 'discount_rate', label: 'Discount rate', type: 'ratio', definition: 'discounts ÷ gross revenue', measures: ['discount_total', 'order_total'], inputMetrics: ['discounts', 'revenue'], semanticModels: ['orders'], dimensions: orderDims },
    { name: 'discounts', label: 'Discounts', type: 'simple', definition: 'Sum of discount_total', measures: ['discount_total'], inputMetrics: [], semanticModels: ['orders'], dimensions: orderDims },
    { name: 'new_customers', label: 'New customers', description: 'Customers placing their first order.', type: 'simple', definition: 'Count distinct of ordering_customers', filter: "{{ Dimension('order__is_first_order') }} = true", measures: ['ordering_customers'], inputMetrics: [], semanticModels: ['orders'], dimensions: orderDims },
    { name: 'cumulative_revenue', label: 'Revenue to date', type: 'cumulative', definition: 'Running total of revenue, grain to date: month', measures: ['order_total'], inputMetrics: ['revenue'], semanticModels: ['orders'], dimensions: orderDims },
    { name: 'revenue_growth_mom', label: 'Revenue growth (month over month)', type: 'derived', definition: '(revenue − revenue a month ago) ÷ revenue a month ago', measures: ['order_total'], inputMetrics: ['revenue'], semanticModels: ['orders'], dimensions: orderDims },
    { name: 'items_sold', label: 'Items sold', type: 'simple', definition: 'Sum of items_sold', measures: ['items_sold'], inputMetrics: [], semanticModels: ['order_items'], dimensions: itemDims },
    { name: 'item_revenue', label: 'Product revenue', type: 'simple', definition: 'Sum of item_revenue', measures: ['item_revenue'], inputMetrics: [], semanticModels: ['order_items'], dimensions: itemDims },
  ],
  savedQueries: [
    { name: 'weekly_revenue_by_channel', description: 'The Monday review chart.', metrics: ['revenue', 'orders'], groupBy: ['metric_time__week', 'order__channel'], where: [] },
    { name: 'monthly_kpis', metrics: ['revenue', 'orders', 'average_order_value', 'new_customers'], groupBy: ['metric_time__month'], where: [] },
    { name: 'roast_mix', description: 'What sells, by roast.', metrics: ['items_sold'], groupBy: ['product__roast'], where: ["{{ TimeDimension('metric_time', 'day') }} >= '2026-08-01'"] },
  ],
  readAt: new Date().toISOString(),
}

/** A made-up answer shaped like the request, so the page can be tried in the browser. */
export function sampleQuery(req: QueryRequest): QueryResult {
  const time = req.groupBy.find((g) => g.startsWith('metric_time'))
  const cats = req.groupBy.filter((g) => !g.startsWith('metric_time'))
  const grain = time?.split('__')[1] ?? 'day'
  const values: Record<string, string[]> = {
    order__channel: ['In store', 'App', 'Web'],
    customer__region: ['North', 'Harbor', 'Old Town', 'Hillside'],
    customer__segment: ['Regular', 'Occasional', 'New'],
    store__city: ['Brackenford', 'Lowmere', 'Ashby Cross'],
    store__store_format: ['Cafe', 'Kiosk', 'Roastery'],
    product__category: ['Espresso drinks', 'Filter', 'Beans', 'Pastry'],
    product__roast: ['Light', 'Medium', 'Dark'],
    order__order_status: ['completed', 'refunded'],
    order__is_first_order: ['false', 'true'],
  }
  const steps = time ? 12 : 1
  const stepDays = { day: 1, week: 7, month: 30, quarter: 91, year: 365 }[grain] ?? 7
  const start = new Date('2026-08-03T00:00:00Z')
  const catLists = cats.map((c) => values[c] ?? ['A', 'B'])
  const combos: string[][] = catLists.reduce<string[][]>((acc, list) => acc.flatMap((a) => list.map((v) => [...a, v])), [[]])
  const rows: (string | number | null)[][] = []
  let seed = 7
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  for (let i = 0; i < steps; i++) {
    const d = new Date(start.getTime() + i * stepDays * 86400000).toISOString().slice(0, 10)
    combos.forEach((combo, ci) => {
      const share = 1 / (ci + 1.4)
      const row: (string | number | null)[] = []
      if (time) row.push(d)
      row.push(...combo)
      for (const m of req.metrics) {
        const base = { revenue: 18400, orders: 2100, items_sold: 3900, item_revenue: 17100, discounts: 920, new_customers: 140 }[m] ?? 1000
        const scale = (stepDays / 7) * share * (1 + i * 0.025) * (0.9 + rand() * 0.2)
        if (m === 'average_order_value') row.push(Math.round((8.4 + rand() * 0.8) * 100) / 100)
        else if (m === 'discount_rate' || m === 'revenue_growth_mom') row.push(Math.round((0.03 + rand() * 0.04) * 1000) / 1000)
        else row.push(Math.round(base * scale))
      }
      rows.push(row)
    })
  }
  return { columns: [...(time ? [time] : []), ...cats, ...req.metrics], rows: rows.slice(0, req.limit ?? 1000), ms: 1840 }
}

export function sampleExplain(req: QueryRequest): ExplainResult {
  const time = req.groupBy.find((g) => g.startsWith('metric_time'))
  return {
    sql: `-- Compiled by MetricFlow (sample)
SELECT
  ${time ? `DATE_TRUNC('${time.split('__')[1] ?? 'day'}', orders_src.ordered_at) AS ${time},\n  ` : ''}${req.groupBy.filter((g) => g !== time).map((g) => `${g.split('__')[0]}_src.${g.split('__')[1]} AS ${g}`).join(',\n  ')}${req.groupBy.length > (time ? 1 : 0) ? ',\n  ' : ''}${req.metrics.map((m) => `SUM(orders_src.${m === 'orders' ? 'order_count' : 'order_total'}) AS ${m}`).join(',\n  ')}
FROM analytics.fct_orders orders_src
LEFT OUTER JOIN analytics.dim_customers customer_src
  ON orders_src.customer_id = customer_src.customer_id
GROUP BY ${req.groupBy.map((_, i) => i + 1).join(', ') || '1'}
${req.limit ? `LIMIT ${req.limit}` : ''}`,
  }
}
