import type { SpendingSettings, SpendingStatus } from '@/components/spending/spending'
import type * as Ext from '@/extensions/types'
import type { AgentsOverview, DefinitionDetail } from '@/pages/agents/types'
import type { ChangesResult } from '@/modules/agent-chat/Panels'
import type * as Chat from '@/modules/agent-chat/types'
import type { CatalogData, SubagentDetail, SubagentDraft, SubagentTool } from '@/modules/agent-catalog/types'
import type { QueryArgs } from '@/modules/bigquery/api'
import type * as Bq from '@/modules/bigquery/types'
import type { UsageReport, UsageSummary } from '@/modules/claude-stats/types'
import type { ClaudeAccount } from '@/modules/connections/account'
import type { ConnectionJob, ConnectionStatus, ConnectionsList } from '@/modules/connections/types'
import type * as Docker from '@/modules/docker/types'
import type { BigQueryExplore, IngestionExplore } from '@/modules/explore/ExplorePage'
import type * as Files from '@/modules/files/types'
import type * as Cards from '@/modules/flashcards/types'
import type * as Flows from '@/modules/flows/types'
import type * as Ingestion from '@/modules/ingestion/types'
import type { McpAccess, McpAuditEntry, McpSetup } from '@/modules/mcp/types'
import type * as Notes from '@/modules/notes/types'
import type { Source } from '@/modules/openmetadata/api'
import type * as Om from '@/modules/openmetadata/types'
import type * as Malloy from '@/modules/openmetadata/tabs/semantic/malloyClient'
import type { MalloySettings } from '@/modules/openmetadata/tabs/semantic/malloySettings'
import type { MalloyListing } from '@/modules/openmetadata/tabs/semantic/malloyTypes'
import type { RemoteStatus } from '@/modules/remote/types'
import type { InAppReport } from '@/modules/scheduled/inAppSample'
import type { ExplainResult, QueryRequest, QueryResult, SemanticProject } from '@/modules/semantic/types'
import type { AppStatus, BackupStatus, GlobalBackupSettings, ProfilesView } from '@/modules/settings/types'
import type * as Sqlx from '@/modules/sqlx/types'
import type { DriveGoal, DrivesResult, ScanState, StorageHistory } from '@/modules/storage/types'
import type { Rpc } from './contract'

type Id = { id: string }
type Kind = { kind: string }
type Path = { path: string }
type UpdatedAt = { updatedAt?: number }
type Revision = Id & { oid: string }
type RunId = { runId: string }
type TurnId = { turnId: string }
type DeckId = { deckId: string }
type Ok = { ok: true }
type BqProject = { projectId: string }
type BqDataset = BqProject & { datasetId: string }
type BqTable = BqDataset & { tableId: string }
type BqJob = BqProject & { jobId: string; location?: string }
type SqlxProject = { projectId: string }
type OmSource = { source?: Source }
type OmType = OmSource & { type: string }
type OmId = OmType & Id
type LineageDepth = number | 'all'
type MalloyQuery = Path & { query: string }
type MalloyDraft = Pick<MalloySettings, 'project' | 'location' | 'run' | 'maxScanGb'>
type DeckDraft = Pick<Cards.Deck, 'name'> & Partial<Pick<Cards.Deck, 'description' | 'newPerDay' | 'retention'>>
type CardText = Pick<Cards.Card, 'front' | 'back'>
type PipelineDraft = Pick<Ingestion.Pipeline, 'name' | 'pipelineType' | 'sourceConfig' | 'airflowConfig' | 'loggerLevel' | 'displayName' | 'description'>
type SavedPipeline = Omit<Ingestion.Pipeline, 'schedule' | 'lastRun'>

export type Bookmark = { id: string; name: string; description: string; target: string; kind?: 'folder' | 'bookmark'; parentId?: string | null; color?: string }
export type PromptTemplate = { id: string; versions: { version: number; name: string; text: string; savedAt: string }[] }
export type ReviewerState = {
  enabled: boolean
  repository: string
  model: string
  lastCheckedAt?: number
  error?: string
  runs: { number: number; title: string; status: string; error?: string; startedAt: number }[]
}
export type ReviewerTemplate = { prompt: string; updatedAt: number; customized: boolean }
export type ScheduledTask = { name: string; path: string; description: string; command: string; schedule: string; state: string; lastRun: string | null; nextRun: string | null; result: number | null; writable: boolean }
export type ScheduledAction = 'run' | 'stop' | 'enable' | 'disable' | 'delete'

type Summary<T> = { builtAt: string; ageMs: number; ttlMs: number; stale: boolean; summary: T }
type ConnectionSummary = Pick<ConnectionStatus, 'state' | 'summary' | 'hint' | 'checkedAt'> & {
  title: string
  account?: Pick<ClaudeAccount, 'type' | 'billedAtApiPrices'>
}
type HomeSummaries = Record<string, Summary<unknown> | undefined> & {
  'claude-stats.summary'?: Summary<UsageSummary>
  'connections.summary'?: Summary<{ connections?: Record<string, ConnectionSummary> }>
}

export type ExtensionInstall = { kind: 'folder' | 'zip' | 'dev'; path?: string } | { kind: 'github'; repo: string }
type ExtensionCallResult = { ok: true; value: unknown } | { ok: false; error: { code: string; message: string; details?: unknown } }

export interface ModuleIpc {
  'agent-catalog': {
    list: Rpc<CatalogData>
    get: Rpc<SubagentDetail, Id>
    create: Rpc<Id, { tool: SubagentTool; draft: SubagentDraft }>
    update: Rpc<Id, Id & UpdatedAt & { draft: SubagentDraft }>
    reset: Rpc<Id, Id & UpdatedAt>
    remove: Rpc<{ backup: string }, Id>
    openBackups: Rpc<Ok>
  }
  'prompt-templates': {
    list: Rpc<PromptTemplate[]>
    save: Rpc<PromptTemplate, { id?: string; name: string; text: string; baseVersion?: number }>
  }
  'pr-review': {
    get: Rpc<ReviewerState>
    template: Rpc<ReviewerTemplate>
    saveTemplate: Rpc<ReviewerTemplate, UpdatedAt & { prompt: string }>
    resetTemplate: Rpc<ReviewerTemplate, UpdatedAt | undefined>
    source: Rpc<{ name: string; text: string }[]>
    configure: Rpc<ReviewerState, { repository: string; model?: string }>
    disable: Rpc<ReviewerState>
    check: Rpc<ReviewerState>
    retry: Rpc<ReviewerState, { number: number }>
  }
  'agent-chat': {
    getComposer: Rpc<Chat.ComposerInfo>
    getSystemPrompts: Rpc<Chat.SystemPrompts>
    setSystemPrompts: Rpc<Chat.SystemPrompts, { prompts: Chat.SystemPrompts }>
    getChanges: Rpc<ChangesResult, { chatId?: string; repo?: string } | undefined>
    getSpending: Rpc<SpendingStatus>
    setSpending: Rpc<SpendingStatus, { settings: SpendingSettings }>
    allowOneMoreTurn: Rpc<SpendingStatus>
    resetSpending: Rpc<SpendingStatus>
    startTurn: Rpc<TurnId, { prompt: string; chatId?: string; repo?: string; coordinator?: boolean; sdk?: Chat.SessionSource; mode?: Chat.ChatMode; model?: string; reasoning?: boolean; effort?: string }>
    pollTurn: Rpc<Chat.TurnPoll, TurnId & { after?: number }>
    stopTurn: Rpc<void, TurnId>
    runningTurn: Rpc<string | null, { chatId: string }>
    runningChats: Rpc<string[]>
    listSessions: Rpc<Chat.SessionList>
    markSeen: Rpc<void, Id>
    setUnread: Rpc<void, Id & { unread: boolean }>
    setArchived: Rpc<void, Id & { archived: boolean }>
    getSession: Rpc<Chat.SessionTranscript, Id>
    getFolders: Rpc<Chat.AllowedFolders>
    pickReposRoot: Rpc<boolean>
    addRepo: Rpc<boolean>
    removeRepo: Rpc<void, Path>
  }
  agents: {
    getOverview: Rpc<AgentsOverview>
    getDefinition: Rpc<DefinitionDetail, Id>
  }
  backups: {
    getStatus: Rpc<BackupStatus>
    save: Rpc<BackupStatus, { settings: GlobalBackupSettings }>
    runAll: Rpc<BackupStatus>
    pickFolder: Rpc<string | null>
    openFolder: Rpc<boolean>
  }
  bigquery: {
    status: Rpc<Bq.BqStatus>
    listProjects: Rpc<{ projects: Bq.BqProject[]; truncated?: boolean }>
    listDatasets: Rpc<{ datasets: Bq.BqDataset[]; truncated?: boolean }, BqProject>
    getDataset: Rpc<Bq.BqDatasetInfo, BqDataset>
    listTables: Rpc<{ tables: Bq.BqTableItem[]; truncated?: boolean }, BqDataset>
    getTable: Rpc<Bq.BqTable, BqTable>
    previewTable: Rpc<Bq.BqPreview, BqTable & { maxResults?: number; pageToken?: string }>
    dryRun: Rpc<Bq.BqQueryResult, QueryArgs>
    runQuery: Rpc<Bq.BqQueryResult, QueryArgs>
    getQueryResults: Rpc<Bq.BqQueryResult, BqJob & { maxResults?: number; pageToken?: string; timeoutMs?: number }>
    getJob: Rpc<Bq.BqJob, BqJob>
    cancelJob: Rpc<Bq.BqJob, BqJob>
    listJobs: Rpc<{ jobs: Bq.BqJob[]; pageToken?: string }, BqProject & { allUsers?: boolean; maxResults?: number; pageToken?: string }>
  }
  bookmarks: {
    list: Rpc<Bookmark[]>
    save: Rpc<Bookmark, Pick<Bookmark, 'name'> & Partial<Omit<Bookmark, 'name'>>>
    remove: Rpc<void, Id>
    open: Rpc<void, Id>
  }
  'claude-stats': { getUsage: Rpc<UsageReport, { refresh?: boolean } | undefined> }
  connections: {
    list: Rpc<ConnectionsList>
    check: Rpc<ConnectionStatus, Kind & { force?: boolean }>
    save: Rpc<ConnectionStatus, Kind & { values?: Record<string, string>; secrets?: Record<string, string>; clearSecrets?: string[] }>
    remove: Rpc<boolean, Kind>
    runAction: Rpc<ConnectionJob, Kind & { action: string }>
    getJob: Rpc<ConnectionJob | undefined, Kind>
    cancelJob: Rpc<ConnectionJob | undefined, Kind>
    claudeAccount: Rpc<ClaudeAccount | undefined>
    listWindowsCredentials: Rpc<{ target: string; userName: string }[]>
  }
  developer: { toggleDevTools: Rpc<{ open: boolean; available: boolean }> }
  docker: {
    getOverview: Rpc<Docker.DockerOverview>
    getStats: Rpc<Docker.StatsSample>
    getLogs: Rpc<Docker.ContainerLogs, Id>
    getContainer: Rpc<Docker.ContainerInfo, Id>
    openLazydocker: Rpc<void>
    openLazydockerPage: Rpc<void>
  }
  files: {
    places: Rpc<Files.Places>
    list: Rpc<Files.Listing, Path & { showHidden?: boolean }>
    preview: Rpc<Files.Preview, Path>
    thumbnail: Rpc<string | null, Path & { size?: number }>
    search: Rpc<Files.SearchResult, { dir: string; query: string; showHidden?: boolean }>
    folderSize: Rpc<Files.FolderSize, Path>
    statMany: Rpc<Files.FileEntry[], { paths: string[] }>
    createFolder: Rpc<Path, { dir: string; name: string }>
    createFile: Rpc<Path, { dir: string; name: string }>
    rename: Rpc<Path, Path & { name: string }>
    paste: Rpc<Files.BatchResult & { pairs?: { from: string; to: string }[] }, { sources: string[]; dir: string; mode: 'copy' | 'move' }>
    trash: Rpc<Files.BatchResult, { paths: string[] }>
    open: Rpc<Ok, Path>
    reveal: Rpc<Ok, Path>
  }
  semantic: {
    getProject: Rpc<SemanticProject>
    query: Rpc<QueryResult, QueryRequest>
    explain: Rpc<ExplainResult, QueryRequest>
  }
  malloy: {
    status: Rpc<Malloy.MalloyStatus>
    listModels: Rpc<MalloyListing>
    compile: Rpc<Malloy.MalloyCompiled, Path>
    sql: Rpc<Malloy.MalloySql, MalloyQuery>
    run: Rpc<Malloy.MalloyRun, MalloyQuery>
    getSettings: Rpc<MalloySettings>
    saveSettings: Rpc<MalloySettings, MalloyDraft>
    pickFolder: Rpc<MalloySettings & { canceled?: boolean; files?: number }>
    resetSettings: Rpc<MalloySettings>
  }
  flashcards: {
    listDecks: Rpc<Cards.DeckList>
    createDeck: Rpc<Cards.Deck, DeckDraft>
    updateDeck: Rpc<Cards.Deck, Id & Partial<DeckDraft>>
    deleteDeck: Rpc<{ deleted: number }, Id>
    listCards: Rpc<Cards.CardList, DeckId & { query?: string }>
    addCard: Rpc<Cards.Card, DeckId & CardText>
    importCards: Rpc<{ added: number; skipped: number }, DeckId & { text: string; separator?: '\t' | ';' }>
    updateCard: Rpc<Cards.Card, Id & Partial<CardText & DeckId & { suspended: boolean }>>
    resetCard: Rpc<Cards.Card, Id>
    deleteCard: Rpc<Ok, Id>
    study: Rpc<Cards.StudyState, DeckId>
    answer: Rpc<Cards.StudyState, { cardId: string; rating: Cards.Rating }>
    undo: Rpc<Cards.StudyState, DeckId>
  }
  flows: {
    list: Rpc<Flows.FlowList>
    get: Rpc<Flows.FlowDoc, Id>
    create: Rpc<Flows.FlowDoc, { template?: string; folder?: string; copyOf?: string; flow?: Partial<Flows.Flow> } | undefined>
    save: Rpc<Flows.FlowDoc, Id & { flow: Flows.Flow }>
    flush: Rpc<{ committed: boolean }>
    remove: Rpc<{ removed: true }, Id>
    history: Rpc<Flows.Version[], Id>
    version: Rpc<{ flow: Flows.Flow }, Revision>
    options: Rpc<Flows.EditorOptions>
    components: Rpc<{ components: Flows.ComponentDef[]; categories: Flows.Category[] }>
    run: Rpc<RunId, Id & { input?: string }>
    pollRun: Rpc<Flows.RunSnapshot, RunId>
    stopRun: Rpc<{ stopped: boolean }, RunId>
    runningRun: Rpc<{ runId?: string }, Id>
    runs: Rpc<{ runs: { id: string; flowId: string; startedAt: number; ms: number; status: string; costUsd: number; steps: number }[] }, Partial<Id> | undefined>
  }
  home: { getSummaries: Rpc<HomeSummaries> }
  ingestion: {
    overview: Rpc<Ingestion.Overview>
    testConnection: Rpc<Ingestion.TestResult, Kind>
    syncConnected: Rpc<Om.BqSync, Kind & { full?: boolean }>
    listPipelines: Rpc<Ingestion.Pipeline[]>
    savePipeline: Rpc<SavedPipeline, { pipeline: PipelineDraft & { id?: string; serviceKind: string; deploy?: boolean } }>
    deletePipeline: Rpc<{ deleted: string }, Id>
    setFlags: Rpc<SavedPipeline, Id & { deployed?: boolean; enabled?: boolean }>
    run: Rpc<RunId, Id>
    kill: Rpc<{ killed: boolean }, Id>
    runs: Rpc<Ingestion.PipelineStatus[], Id>
    serverOverview: Rpc<Ingestion.ServerOverview>
    serverRuns: Rpc<Ingestion.PipelineStatus[], { fqn: string }>
    serverAction: Rpc<Ok & { message?: string }, Id & { action: 'run' | 'deploy' | 'kill' | 'toggle' }>
    serverLogs: Rpc<{ lines: string[]; truncated: boolean }, Id>
    serverCreate: Rpc<{ pipeline?: Ingestion.Pipeline; deployError?: string }, { service: Id & { category: string }; pipeline: PipelineDraft; deploy?: boolean }>
    explore: Rpc<IngestionExplore>
  }
  mcp: {
    getSetup: Rpc<McpSetup>
    getAccess: Rpc<McpAccess>
    setAllowed: Rpc<McpAccess, { agent: string; tool: string; allowed: boolean }>
    forgetAgent: Rpc<McpAccess, { agent: string }>
    getAudit: Rpc<McpAuditEntry[], { limit?: number } | undefined>
    clearAudit: Rpc<void>
  }
  notes: {
    list: Rpc<Notes.NoteList, { query?: string } | undefined>
    get: Rpc<Notes.Note, Id>
    create: Rpc<Notes.Note, { body?: string } | undefined>
    save: Rpc<Notes.Note, Id & { body: string }>
    flush: Rpc<{ committed: boolean }>
    remove: Rpc<{ removed: true }, Id>
    history: Rpc<Notes.NoteVersion[], Id>
    version: Rpc<{ body: string }, Revision>
  }
  sqlx: {
    listProjects: Rpc<Sqlx.SqlxProject[]>
    addProject: Rpc<Sqlx.SqlxProject | null>
    removeProject: Rpc<boolean, Id>
    listFiles: Rpc<Sqlx.SqlxFileList, SqlxProject>
    readFile: Rpc<Sqlx.SqlxFileContent, SqlxProject & Path>
    saveFile: Rpc<Sqlx.SqlxSaved, SqlxProject & Path & { text: string; mtimeMs?: number }>
  }
  openmetadata: {
    status: Rpc<Om.OmStatus, OmSource | undefined>
    counts: Rpc<Om.OmCounts, OmSource | undefined>
    list: Rpc<Om.OmPage, OmType & { after?: string; deleted?: boolean; limit?: number }>
    get: Rpc<Om.OmEntity, OmType & { fqn: string }>
    versions: Rpc<Om.OmEntity[], OmId>
    recent: Rpc<(Om.OmEntity & { entityType: string })[], OmSource & { size?: number } | undefined>
    search: Rpc<Om.OmSearch, OmSource & { q: string; types?: string[]; limit?: number; deleted?: boolean }>
    getLineage: Rpc<Om.OmLineage, OmId & { upstreamDepth?: LineageDepth; downstreamDepth?: LineageDepth }>
    setDescription: Rpc<Om.OmEntity, OmId & { description: string }>
    syncBigQuery: Rpc<Om.BqSync, { full?: boolean } | undefined>
    bigquerySetupSql: Rpc<{ sql: string; source: string }>
    explore: Rpc<BigQueryExplore>
  }
  profiles: {
    getProfiles: Rpc<ProfilesView>
    rename: Rpc<ProfilesView, Id & { name: string }>
    switchTo: Rpc<ProfilesView, Id>
    restart: Rpc<{ restarting: boolean }>
  }
  remote: {
    getStatus: Rpc<RemoteStatus>
    setEnabled: Rpc<RemoteStatus, { enabled: boolean }>
    check: Rpc<RemoteStatus>
    setupServe: Rpc<RemoteStatus>
    startPairing: Rpc<{ url: string; expiresAt: number }>
    cancelPairing: Rpc<void>
    setAgentFromPhone: Rpc<RemoteStatus, { on: boolean }>
    setLogins: Rpc<RemoteStatus, { logins: string[] }>
    renameDevice: Rpc<RemoteStatus, Id & { name: string }>
    revokeDevice: Rpc<RemoteStatus, Id>
    clearAudit: Rpc<RemoteStatus>
  }
  settings: { [M in 'getStatus' | 'checkForUpdates' | 'downloadUpdate' | 'installAndRestart' | 'installWithoutBackup']: Rpc<AppStatus> }
  storage: {
    getDrives: Rpc<DrivesResult>
    getScan: Rpc<ScanState>
    getHistory: Rpc<StorageHistory>
    setGoal: Rpc<{ goals: Record<string, DriveGoal> }, { drive: string; freeBytes: number | null }>
    startScan: Rpc<ScanState>
    openLocation: Rpc<Ok, Id>
    openStorageSettings: Rpc<Ok>
  }
  scheduled: {
    list: Rpc<{ tasks: ScheduledTask[]; readAt: string }>
    change: Rpc<Record<string, never>, { action: ScheduledAction; name: string; path: string }>
    inApp: Rpc<InAppReport>
    runInApp: Rpc<InAppReport, Id>
    openScheduler: Rpc<void>
  }
  extensions: {
    list: Rpc<Ext.ExtensionList>
    inspect: Rpc<Ext.InstallPreview | null, ExtensionInstall>
    confirm: Rpc<Ext.ExtensionSummary, { token: string }>
    cancel: Rpc<null, { token: string }>
    uninstall: Rpc<Ext.ExtensionList, Id & { deleteData?: boolean }>
    setEnabled: Rpc<Ext.ExtensionSummary, Id & { enabled: boolean }>
    approve: Rpc<Ext.ExtensionSummary, Id>
    reload: Rpc<Ext.ExtensionSummary, Id>
    checkUpdates: Rpc<{ checkedAt: string; results: { id: string; ok: boolean; error?: string }[] }>
    stageUpdate: Rpc<Ext.InstallPreview, Id>
    revokeFolder: Rpc<Ext.ExtensionSummary, Id & Path>
    getSettings: Rpc<Ext.SettingsSnapshot, Id>
    saveSettings: Rpc<Pick<Ext.SettingsSnapshot, 'values' | 'secrets'>, Id & { values: Record<string, string | number | boolean | null> }>
    logs: Rpc<Ext.LogLine[], Id>
    openFolder: Rpc<null, Id & { which: 'data' | 'extension' }>
    call: Rpc<ExtensionCallResult, Id & { method: string; args?: unknown }>
    requestFolder: Rpc<{ path: string; write: boolean } | null, Id & { write: boolean }>
    openExternal: Rpc<null, { url: string }>
  }
}
