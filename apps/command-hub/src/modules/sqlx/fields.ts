/**
 * What the config form knows about Dataform's config fields: a label, a
 * widget, a section and the action types a field applies to. Fields in the
 * file that are not listed here still show, with a widget picked from their
 * value. Covers Dataform core 2.x (options under `bigquery`) and 3.x (the same
 * options at the top level).
 */

export type Widget = 'text' | 'textarea' | 'select' | 'bool' | 'number' | 'chips' | 'list' | 'map' | 'group' | 'sql'

export type Section = 'Target' | 'About' | 'Run' | 'BigQuery' | 'Data quality' | 'Columns' | 'More'

export interface FieldSpec {
  key: string
  label: string
  widget: Widget
  section?: Section
  help?: string
  placeholder?: string
  options?: string[]
  /** Action types the field applies to; all when missing. */
  types?: string[]
  /** For `group`: the nested object's fields. */
  children?: FieldSpec[]
}

export const ACTION_TYPES = ['table', 'view', 'incremental', 'operations', 'assertion', 'declaration'] as const

const TABLES = ['table', 'incremental']
const DATASETS = ['table', 'view', 'incremental']

const BIGQUERY_OPTIONS: FieldSpec[] = [
  { key: 'partitionBy', label: 'Partition by', widget: 'sql', types: TABLES, placeholder: 'DATE(created_at)', help: 'A SQL expression BigQuery partitions the table by.' },
  { key: 'clusterBy', label: 'Cluster by', widget: 'chips', types: TABLES, placeholder: 'Add a column', help: 'Up to four columns.' },
  { key: 'requirePartitionFilter', label: 'Require a partition filter', widget: 'bool', types: TABLES, help: 'Queries must filter on the partition column.' },
  { key: 'partitionExpirationDays', label: 'Partition expiry (days)', widget: 'number', types: TABLES },
  { key: 'updatePartitionFilter', label: 'Update partition filter', widget: 'sql', types: ['incremental'], placeholder: "created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)", help: 'Limits the partitions a merge scans.' },
  { key: 'labels', label: 'Labels', widget: 'map', types: DATASETS, placeholder: 'label' },
  { key: 'additionalOptions', label: 'Additional options', widget: 'map', types: DATASETS, placeholder: 'option' },
]

export const CONFIG_FIELDS: FieldSpec[] = [
  { key: 'type', label: 'Type', widget: 'select', section: 'Target', options: [...ACTION_TYPES], help: 'What Dataform makes from this file.' },
  { key: 'name', label: 'Name', widget: 'text', section: 'Target', placeholder: 'Defaults to the file name' },
  { key: 'schema', label: 'Dataset', widget: 'text', section: 'Target', placeholder: 'Defaults to the project dataset', help: 'Dataform calls it schema.' },
  { key: 'database', label: 'Project', widget: 'text', section: 'Target', placeholder: 'Defaults to the project', help: 'Dataform calls it database.' },
  { key: 'description', label: 'Description', widget: 'textarea', section: 'About' },
  { key: 'tags', label: 'Tags', widget: 'chips', section: 'About', placeholder: 'Add a tag' },
  { key: 'dependencies', label: 'Depends on', widget: 'chips', section: 'Run', placeholder: 'Add an action', help: 'Actions that run first, besides the ones ref() finds.' },
  { key: 'disabled', label: 'Disabled', widget: 'bool', section: 'Run', help: 'Compiled but never run.' },
  { key: 'materialized', label: 'Materialized view', widget: 'bool', section: 'Run', types: ['view'] },
  { key: 'protected', label: 'Protected', widget: 'bool', section: 'Run', types: ['incremental'], help: 'A full refresh never rebuilds it.' },
  { key: 'uniqueKey', label: 'Unique key', widget: 'chips', section: 'Run', types: ['incremental'], placeholder: 'Add a column', help: 'New rows are merged on these columns.' },
  { key: 'onSchemaChange', label: 'On schema change', widget: 'select', section: 'Run', types: ['incremental'], options: ['IGNORE', 'FAIL', 'EXTEND', 'SYNCHRONIZE'] },
  { key: 'hasOutput', label: 'Creates a table', widget: 'bool', section: 'Run', types: ['operations'], help: 'Lets other files ref() what these statements create.' },
  ...BIGQUERY_OPTIONS.map((f) => ({ ...f, section: 'BigQuery' as const })),
  { key: 'bigquery', label: 'BigQuery', widget: 'group', section: 'BigQuery', types: DATASETS, children: BIGQUERY_OPTIONS },
  {
    key: 'assertions',
    label: 'Assertions',
    widget: 'group',
    section: 'Data quality',
    types: DATASETS,
    children: [
      { key: 'uniqueKey', label: 'Unique key', widget: 'chips', placeholder: 'Add a column', help: 'No two rows share these values.' },
      { key: 'nonNull', label: 'Not null', widget: 'chips', placeholder: 'Add a column' },
      { key: 'rowConditions', label: 'Row conditions', widget: 'list', placeholder: 'amount >= 0', help: 'SQL every row must satisfy.' },
    ],
  },
  { key: 'columns', label: 'Columns', widget: 'map', section: 'Columns', types: [...DATASETS, 'declaration'], placeholder: 'column', help: 'Column descriptions.' },
]

export const SECTIONS: Section[] = ['Target', 'About', 'Run', 'BigQuery', 'Data quality', 'Columns', 'More']

export function specFor(key: string, list: FieldSpec[] = CONFIG_FIELDS): FieldSpec | undefined {
  return list.find((f) => f.key === key)
}

export function appliesTo(spec: FieldSpec, type: string | undefined): boolean {
  return !spec.types || !type || spec.types.includes(type)
}
