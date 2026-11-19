// Fictional Dataform project for the browser dev server. Saves stay in memory.

import type { SqlxFileContent, SqlxFileList, SqlxProject, SqlxSaved } from './types'

const PROJECT: SqlxProject = { id: 'sample', name: 'acme-analytics', dataform: true, core: 3 }

const files: Record<string, { text: string; mtimeMs: number }> = {
  'definitions/sources/raw_orders.sqlx': {
    mtimeMs: 1,
    text: `config {
  type: "declaration",
  database: "acme-raw",
  schema: "shop",
  name: "orders",
  description: "Orders as the shop system exports them, one row per order.",
  columns: {
    order_id: "Unique order id",
    customer_id: "Who placed it",
    amount: "Order total in cents",
    created_at: "When the order was placed (UTC)"
  }
}
`,
  },
  'definitions/staging/stg_orders.sqlx': {
    mtimeMs: 1,
    text: `config {
  type: "view",
  schema: "staging",
  description: "Orders with amounts in dollars and test orders removed.",
  tags: ["staging", "orders"]
}

SELECT
  order_id,
  customer_id,
  amount / 100 AS amount_usd,
  created_at
FROM \${ref("shop", "orders")}
WHERE NOT is_test
`,
  },
  'definitions/marts/fct_orders.sqlx': {
    mtimeMs: 1,
    text: `config {
  type: "incremental",
  schema: "marts",
  description: \`Daily order facts.
One row per order, merged on order_id.\`,
  tags: ["daily", "orders", "finance"],
  uniqueKey: ["order_id"],
  partitionBy: "DATE(created_at)",
  clusterBy: ["customer_id"],
  requirePartitionFilter: true,
  assertions: {
    nonNull: ["order_id", "customer_id"],
    rowConditions: ["amount_usd >= 0"]
  },
  columns: {
    order_id: "Unique order id",
    amount_usd: "Order total in dollars",
    first_order: "True for the customer's first order"
  }
}

pre_operations {
  DECLARE since TIMESTAMP DEFAULT (
    \${when(incremental(), \`SELECT MAX(created_at) FROM \${self()}\`, \`SELECT TIMESTAMP("2020-01-01")\`)}
  );
}

SELECT
  o.order_id,
  o.customer_id,
  o.amount_usd,
  o.created_at,
  o.created_at = MIN(o.created_at) OVER (PARTITION BY o.customer_id) AS first_order
FROM \${ref("stg_orders")} AS o
LEFT JOIN \${ref("dim_customers")} AS c USING (customer_id)
WHERE o.created_at > since
`,
  },
  'definitions/marts/dim_customers.sqlx': {
    mtimeMs: 1,
    text: `config {
  type: "table",
  schema: "marts",
  description: "One row per customer with their first and latest order.",
  tags: ["daily"]
}

SELECT
  customer_id,
  MIN(created_at) AS first_order_at,
  MAX(created_at) AS latest_order_at,
  COUNT(*) AS orders
FROM \${ref("stg_orders")}
GROUP BY customer_id
`,
  },
  'definitions/assertions/orders_have_customers.sqlx': {
    mtimeMs: 1,
    text: `config {
  type: "assertion",
  description: "Every order belongs to a known customer.",
  tags: ["quality"]
}

SELECT o.order_id
FROM \${ref("fct_orders")} AS o
LEFT JOIN \${ref("dim_customers")} AS c USING (customer_id)
WHERE c.customer_id IS NULL
`,
  },
  'definitions/ops/grant_readers.sqlx': {
    mtimeMs: 1,
    text: `config {
  type: "operations",
  dependencies: ["fct_orders"],
  tags: ["ops"]
}

GRANT \`roles/bigquery.dataViewer\`
ON SCHEMA marts
TO "group:analysts@example.com"
`,
  },
}

export async function sampleInvoke<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  const path = String(args?.path ?? '')
  switch (method) {
    case 'listProjects':
      return [PROJECT] as T
    case 'listFiles':
      return { files: Object.entries(files).map(([p, f]) => ({ path: p, size: f.text.length, mtimeMs: f.mtimeMs })), truncated: false } satisfies SqlxFileList as T
    case 'readFile': {
      const f = files[path]
      if (!f) throw new Error('File not found.')
      return { path, text: f.text, mtimeMs: f.mtimeMs } satisfies SqlxFileContent as T
    }
    case 'saveFile': {
      const f = files[path]
      if (!f) throw new Error('File not found.')
      if (f.mtimeMs !== args?.mtimeMs) throw new Error('This file changed on disk after you opened it.')
      files[path] = { text: String(args?.text ?? ''), mtimeMs: f.mtimeMs + 1 }
      return { path, mtimeMs: f.mtimeMs + 1 } satisfies SqlxSaved as T
    }
    case 'addProject':
    case 'removeProject':
      throw new Error('Project folders can only be picked in the desktop app.')
    default:
      throw new Error(`Unknown method ${method}`)
  }
}
