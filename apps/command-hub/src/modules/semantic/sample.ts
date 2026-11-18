import type { GroupByDimension, SemanticModel, SemanticProject } from './types'

// Fictional sample data for the browser dev server, which has no backend.
// "Lantern Coffee" is made up: a small coffee chain's dbt project.

const models: SemanticModel[] = [
  {
    name: 'orders',
    description: 'One row per order placed in a store or online.',
    model: 'fct_orders',
    relation: { database: 'lantern', schema: 'marts', name: 'fct_orders' },
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
    relation: { database: 'lantern', schema: 'marts', name: 'fct_order_items' },
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
    relation: { database: 'lantern', schema: 'core', name: 'dim_customers' },
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
    relation: { database: 'lantern', schema: 'core', name: 'dim_stores' },
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
    relation: { database: 'lantern', schema: 'core', name: 'dim_products' },
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
