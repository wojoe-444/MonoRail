import {
  AppWindow,
  Archive,
  Asterisk,
  Bell,
  Book,
  BookOpen,
  Bot,
  Boxes,
  Braces,
  Brain,
  BrainCircuit,
  Cable,
  ChartColumn,
  ChartLine,
  ChartPie,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  Database,
  File,
  FileCheck,
  FileCode,
  FileInput,
  FileJson,
  FileSearch,
  FileText,
  FileUp,
  Folder,
  FolderCode,
  FolderTree,
  Gauge,
  GitBranch,
  GitCommitHorizontal,
  GraduationCap,
  Grid3x3,
  HardDrive,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  Link,
  Link2,
  ListChecks,
  ListTodo,
  Mail,
  Megaphone,
  MessageSquareText,
  MousePointerClick,
  Network,
  Notebook,
  Package,
  PackageCheck,
  Plug,
  PlugZap,
  Radio,
  Ruler,
  ScrollText,
  Server,
  ServerCog,
  Shapes,
  Sheet,
  Shield,
  ShieldCheck,
  Sigma,
  SquareFunction,
  Store,
  Table2,
  Tag,
  Target,
  TestTube,
  User,
  UserCog,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { entityType as standardType, type EntityType } from '@/standard'

/**
 * Every OpenMetadata 2.1 entity type that has a REST collection, grouped the
 * way OpenMetadata groups them. The backend (electron/modules/openmetadata.cjs,
 * `TYPES`) knows the REST collection of each; tests check both lists name the
 * same types, and that they are the MonoRail standard's OpenMetadata types.
 * `t()` gives this page's own wording; `std()` takes the name, plural and
 * summary from the standard (src/standard/standard.json).
 */

export interface TypeInfo {
  type: string
  name: string
  plural: string
  /** One line on what OpenMetadata uses it for. */
  summary: string
  icon: LucideIcon
}

export interface TypeGroup {
  id: string
  name: string
  summary: string
  types: TypeInfo[]
}

const t = (type: string, name: string, plural: string, icon: LucideIcon, summary: string): TypeInfo => ({ type, name, plural, icon, summary })

/** Sentence case like the rest of this page, keeping acronyms: "LLM Model" -> "LLM model". */
const sentence = (s: string) => s.split(' ').map((w, i) => (i === 0 || /^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase())).join(' ')
function std(type: string, icon: LucideIcon): TypeInfo {
  const def = standardType(type)
  if (!def) throw new Error(`"${type}" is not in the MonoRail standard.`)
  return { type, name: sentence(def.name), plural: def.plural, icon, summary: def.summary }
}

export const GROUPS: TypeGroup[] = [
  {
    id: 'assets',
    name: 'Data assets',
    summary: 'What the catalog describes: tables and everything else ingestion finds.',
    types: [
      t('table', 'Table', 'Tables', Table2, 'Tables and views, with columns, constraints, profiles and lineage.'),
      t('database', 'Database', 'Databases', Database, 'Databases under a database service (BigQuery calls them projects).'),
      t('databaseSchema', 'Database schema', 'Database schemas', FolderTree, 'Schemas in a database (BigQuery calls them datasets).'),
      t('storedProcedure', 'Stored procedure', 'Stored procedures', SquareFunction, 'Routines in a schema, with their code.'),
      t('query', 'Query', 'Queries', FileCode, 'SQL run against tables, from usage ingestion or saved by people.'),
      t('metric', 'Metric', 'Metrics', Sigma, 'Business metrics with their definitions.'),
      t('dashboard', 'Dashboard', 'Dashboards', LayoutDashboard, 'Dashboards from a BI tool, with their charts.'),
      t('chart', 'Chart', 'Charts', ChartColumn, 'Charts on dashboards.'),
      t('dashboardDataModel', 'Dashboard data model', 'Dashboard data models', Shapes, 'Semantic models inside BI tools.'),
      t('pipeline', 'Pipeline', 'Pipelines', Workflow, 'Data pipelines (Airflow DAGs, dbt jobs) and their tasks.'),
      t('topic', 'Topic', 'Topics', Radio, 'Message topics with their schemas.'),
      t('mlmodel', 'ML model', 'ML models', BrainCircuit, 'Machine learning models, their features and hyperparameters.'),
      t('container', 'Container', 'Containers', Archive, 'Storage buckets and folders, with their data models.'),
      t('searchIndex', 'Search index', 'Search indexes', FileSearch, 'Indexes in a search service, with their fields.'),
      t('apiCollection', 'API collection', 'API collections', FolderCode, 'Groups of API endpoints.'),
      t('apiEndpoint', 'API endpoint', 'API endpoints', Plug, 'API endpoints with request and response schemas.'),
      t('directory', 'Directory', 'Directories', Folder, 'Folders in a drive service.'),
      t('file', 'File', 'Files', File, 'Files in a drive service.'),
      t('spreadsheet', 'Spreadsheet', 'Spreadsheets', Sheet, 'Spreadsheets in a drive service.'),
      t('worksheet', 'Worksheet', 'Worksheets', Grid3x3, 'Sheets in a spreadsheet, with their columns.'),
      std('report', FileText),
      std('metricGroup', LayoutGrid),
    ],
  },
  {
    id: 'ai',
    name: 'AI assets',
    summary: 'Models, AI applications, MCP servers and prompt templates, and how they are governed.',
    types: [
      std('llmModel', Cpu),
      std('aiApplication', Bot),
      std('mcpServer', ServerCog),
      std('promptTemplate', MessageSquareText),
      std('aiGovernanceFramework', Landmark),
      std('aiFrameworkControl', ListChecks),
      std('aiGovernancePolicy', ScrollText),
      std('auditReport', ClipboardCheck),
    ],
  },
  {
    id: 'services',
    name: 'Services',
    summary: 'Connections to the systems OpenMetadata ingests from, and the pipelines that ingest.',
    types: [
      t('databaseService', 'Database service', 'Database services', Server, 'Warehouses and databases, such as BigQuery.'),
      t('dashboardService', 'Dashboard service', 'Dashboard services', Server, 'BI tools.'),
      t('messagingService', 'Messaging service', 'Messaging services', Server, 'Kafka, Pub/Sub and similar.'),
      t('pipelineService', 'Pipeline service', 'Pipeline services', Server, 'Orchestrators such as Airflow.'),
      t('mlmodelService', 'ML model service', 'ML model services', Server, 'Model registries such as MLflow.'),
      t('storageService', 'Storage service', 'Storage services', HardDrive, 'Object stores such as GCS or S3.'),
      t('searchService', 'Search service', 'Search services', Server, 'Elasticsearch and OpenSearch.'),
      t('apiService', 'API service', 'API services', Cable, 'REST APIs described by OpenAPI.'),
      t('metadataService', 'Metadata service', 'Metadata services', Server, 'Other catalogs OpenMetadata reads from, and itself.'),
      t('securityService', 'Security service', 'Security services', ShieldCheck, 'Access-policy systems such as Ranger.'),
      t('driveService', 'Drive service', 'Drive services', HardDrive, 'Google Drive and similar.'),
      std('llmService', Server),
      std('mcpService', Server),
      t('ingestionPipeline', 'Ingestion pipeline', 'Ingestion pipelines', Workflow, 'Scheduled metadata, usage, lineage, profiler and test runs.'),
    ],
  },
  {
    id: 'governance',
    name: 'Governance',
    summary: 'The shared vocabulary and structure that assets are described with.',
    types: [
      t('glossary', 'Glossary', 'Glossaries', Book, 'Business glossaries.'),
      t('glossaryTerm', 'Glossary term', 'Glossary terms', BookOpen, 'Terms with definitions, synonyms and related terms.'),
      t('classification', 'Classification', 'Classifications', Shield, 'Groups of tags, such as Tier or PII.'),
      t('tag', 'Tag', 'Tags', Tag, 'Labels within a classification.'),
      t('domain', 'Domain', 'Domains', Boxes, 'Business areas that own assets.'),
      t('dataProduct', 'Data product', 'Data products', Package, 'Curated sets of assets a domain publishes.'),
      t('dataContract', 'Data contract', 'Data contracts', FileCheck, 'Schema, quality and semantic guarantees on an asset.'),
      std('workflowDefinition', GitBranch),
      std('intakeForm', ClipboardList),
    ],
  },
  {
    id: 'ontology',
    name: 'Ontology',
    summary: 'Formal ontologies: concepts, properties, axioms, relationship types and releases. New in OpenMetadata 2.1.',
    types: [
      std('ontology', Network),
      std('ontologyConcept', Lightbulb),
      std('ontologyProperty', Link),
      std('ontologyAxiom', Asterisk),
      std('ontologyChangeSet', GitCommitHorizontal),
      std('ontologyRelease', PackageCheck),
      std('relationshipType', Link2),
    ],
  },
  {
    id: 'quality',
    name: 'Data quality',
    summary: 'Tests and their results.',
    types: [
      t('testDefinition', 'Test definition', 'Test definitions', TestTube, 'The kinds of test available, with their parameters.'),
      t('testSuite', 'Test suite', 'Test suites', Layers, 'Sets of test cases that run together.'),
      t('testCase', 'Test case', 'Test cases', Gauge, 'A test definition applied to a table or column.'),
      std('dataQualityDimension', Ruler),
    ],
  },
  {
    id: 'access',
    name: 'Teams and access',
    summary: 'Who people are, and what they may do.',
    types: [
      t('user', 'User', 'Users', User, 'People and bots.'),
      t('team', 'Team', 'Teams', Users, 'The organization, its business units, departments and groups.'),
      t('role', 'Role', 'Roles', KeyRound, 'Sets of policies given to users and teams.'),
      t('policy', 'Policy', 'Policies', ScrollText, 'Rules allowing or denying operations on resources.'),
      t('persona', 'Persona', 'Personas', UserCog, 'Kinds of user, each with its own default experience.'),
      std('bot', Bot),
    ],
  },
  {
    id: 'collaboration',
    name: 'Collaboration and context',
    summary: 'Tasks, announcements, knowledge pages and the context center.',
    types: [
      std('task', ListTodo),
      std('taskFormSchema', FileInput),
      std('announcement', Megaphone),
      std('page', Notebook),
      std('learningResource', GraduationCap),
      std('folder', Folder),
      std('contextFile', FileUp),
      std('contextMemory', Brain),
    ],
  },
  {
    id: 'platform',
    name: 'Platform',
    summary: "OpenMetadata's own configuration.",
    types: [
      t('eventsubscription', 'Alert', 'Alerts', Bell, 'Notifications and observability alerts on changes and test results.'),
      t('app', 'App', 'Apps', AppWindow, 'Installed applications, such as Data Insights and search indexing.'),
      t('kpi', 'KPI', 'KPIs', Target, 'Documentation and ownership targets for Data Insights.'),
      t('type', 'Type', 'Types', Braces, 'Entity and property types, with the custom properties added to each.'),
      std('workflow', Zap),
      std('appMarketPlaceDefinition', Store),
      std('notificationTemplate', Mail),
      std('testConnectionDefinition', PlugZap),
      std('document', FileJson),
      std('dataInsightChart', ChartLine),
      std('dataInsightCustomChart', ChartPie),
      std('webAnalyticEvent', MousePointerClick),
    ],
  },
]

export const TYPES: TypeInfo[] = GROUPS.flatMap((g) => g.types)

const byType = new Map(TYPES.map((x) => [x.type, x]))

export function typeInfo(type: string | undefined): TypeInfo | undefined {
  return type ? byType.get(type) : undefined
}

/** The type's icon, or a table for a type this page does not know (a column, say). */
export function typeIcon(type: string | undefined): LucideIcon {
  return typeInfo(type)?.icon ?? Table2
}

/** The type in the MonoRail standard (src/standard) when MonoRail has adopted it, with its field descriptions. */
export function adopted(type: string): EntityType | undefined {
  const def = standardType(type)
  return def?.origin === 'openmetadata' ? def : undefined
}
