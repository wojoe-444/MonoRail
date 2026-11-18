/** OpenMetadata 2.0.x JSON, the subset the OpenMetadata page reads. Field names are OpenMetadata's. */

export interface OmRef {
  id: string
  type: string
  name?: string
  fullyQualifiedName?: string
  displayName?: string
  description?: string
  deleted?: boolean
}

export interface OmTag {
  tagFQN: string
  source?: 'Classification' | 'Glossary'
  labelType?: string
  state?: string
}

export interface OmColumn {
  name: string
  displayName?: string
  fullyQualifiedName?: string
  dataType?: string
  dataTypeDisplay?: string
  description?: string
  constraint?: string
  tags?: OmTag[]
  children?: OmColumn[]
}

/** Any entity: the fields every type has, plus whatever its own type has. */
export interface OmEntity {
  id: string
  name: string
  fullyQualifiedName?: string
  displayName?: string
  description?: string
  version?: number
  updatedAt?: number
  updatedBy?: string
  deleted?: boolean
  owners?: OmRef[]
  tags?: OmTag[]
  domains?: OmRef[]
  followers?: OmRef[]
  changeDescription?: {
    fieldsAdded?: { name: string }[]
    fieldsUpdated?: { name: string }[]
    fieldsDeleted?: { name: string }[]
  }
  /** On search results only. */
  entityType?: string
  [field: string]: unknown
}

export interface OmPage {
  data: OmEntity[]
  paging?: { total?: number; after?: string }
}

/** Count per entity type; a type the server does not have gets the error. */
export type OmCounts = Record<string, number | { error: string }>

export interface OmStatus {
  /** not-set-up: no connection yet. rejected: the token was refused. unreachable: no answer. */
  block?: 'not-set-up' | 'rejected' | 'unreachable'
  url?: string
  version?: string
  user?: string
  error?: string
}
