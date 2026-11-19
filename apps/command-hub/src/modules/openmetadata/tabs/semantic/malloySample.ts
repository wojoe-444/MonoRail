import type { MalloyFile, MalloyListing } from './malloyTypes'

// Fictional sample Malloy files for the browser dev server, which has no
// backend. "Lantern Coffee" is the same made-up coffee chain as the semantic
// sample project.

const ORDERS = `// Lantern Coffee: orders and what is on them.
import "dimensions.malloy"

#" One row per order placed in a store or online.
source: orders is duckdb.table('marts/fct_orders.parquet') extend {
  primary_key: order_id

  join_one: customers with customer_id
  join_one: stores with store_id
  join_many: items is order_items on items.order_id = order_id

  dimension:
    #" In store, app or web.
    channel is order_channel
    order_month is ordered_at.month
    is_large is order_total > 25
    size_band is
      pick 'small' when order_total < 8
      pick 'medium' when order_total < 20
      else 'large'

  measure:
    #" Money taken on orders, after discounts.
    revenue is order_total.sum()
    order_count is count()
    average_order_value is revenue / order_count
    discounts is discount_total.sum()
    app_revenue is revenue { where: channel = 'App' }

  view: by_month is {
    group_by: order_month
    aggregate: revenue, order_count
    order_by: order_month
  }

  view: by_channel is {
    group_by: channel
    aggregate: revenue, average_order_value
  }
}

source: order_items is duckdb.table('marts/fct_order_items.parquet') extend {
  primary_key: order_item_id
  join_one: products with product_id

  measure:
    items_sold is quantity.sum()
    item_revenue is line_total.sum()

  view: top_products is {
    group_by: products.product_name
    aggregate: items_sold, item_revenue
    limit: 10
  }
}

query: monthly_kpis is orders -> {
  group_by: order_month
  aggregate: revenue, order_count, average_order_value
}
`

const DIMENSIONS = `// Shared dimension sources for Lantern Coffee.

#" Everyone who has ordered at least once.
source: customers is duckdb.table('core/dim_customers.parquet') extend {
  primary_key: customer_id
  dimension:
    region is home_region
    #" Regular, occasional or new.
    segment is customer_segment
  measure: customer_count is count()
}

source: stores is duckdb.table('core/dim_stores.parquet') extend {
  primary_key: store_id
  dimension: city is store_city, store_format is format
  measure: store_count is count()
}

source: products is duckdb.table('core/dim_products.parquet') extend {
  primary_key: product_id
  dimension:
    category is product_category
    roast is roast_level
}

-- Roasteries only: the same stores, narrowed.
source: roasteries is stores extend {
  where: store_format = 'Roastery'
}
`

export const sampleMalloy: MalloyFile[] = [
  { path: 'malloy/orders.malloy', size: ORDERS.length, modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), text: ORDERS },
  { path: 'malloy/dimensions.malloy', size: DIMENSIONS.length, modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(), text: DIMENSIONS },
]

export const sampleListing: MalloyListing = { folderName: 'lantern-analytics', files: sampleMalloy, readAt: new Date().toISOString() }
