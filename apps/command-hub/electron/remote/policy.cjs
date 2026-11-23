// @ts-check
// Method-by-method audit of the built-in backends (docs/remote-access.md).
// A phone can call only methods explicitly listed under `phone`. `desktop`
// records the decisions for every other known method, including desktopOnly.
/** @satisfies {import('../../src/ipc/contract').BackendAccessPolicy} */
const REMOTE_METHODS = {
  'agent-catalog': {
    phone: ['list', 'get'],
    desktop: ['create', 'update', 'reset', 'remove', 'openBackups'],
  },
  'prompt-templates': {
    phone: ['list', 'save'],
    desktop: [],
  },
  'pr-review': {
    phone: ['get', 'template', 'source'],
    desktop: ['saveTemplate', 'resetTemplate', 'configure', 'disable', 'check', 'retry'],
  },
  'agent-chat': {
    phone: ['getComposer', 'getSystemPrompts', 'getChanges', 'getSpending', 'startTurn', 'pollTurn', 'stopTurn',
      'runningTurn', 'runningChats', 'listSessions', 'markSeen', 'setUnread', 'setArchived', 'getSession', 'getFolders'],
    desktop: ['setSystemPrompts', 'setSpending', 'allowOneMoreTurn', 'resetSpending', 'pickReposRoot', 'addRepo', 'removeRepo'],
  },
  agents: { phone: ['getOverview', 'getDefinition'], desktop: [] },
  backups: { phone: ['getStatus'], desktop: ['save', 'runAll', 'pickFolder', 'openFolder'] },
  bigquery: {
    phone: ['status', 'listProjects', 'listDatasets', 'getDataset', 'listTables', 'getTable', 'previewTable',
      'dryRun', 'getQueryResults', 'getJob', 'listJobs'],
    desktop: ['runQuery', 'cancelJob'],
  },
  // Saving a bookmark can set the target of a later desktop shell.openPath call.
  bookmarks: { phone: ['list'], desktop: ['save', 'remove', 'open'] },
  'claude-stats': { phone: ['getUsage'], desktop: [] },
  connections: {
    phone: ['list', 'check', 'getJob', 'claudeAccount'],
    desktop: ['save', 'remove', 'runAction', 'cancelJob', 'listWindowsCredentials'],
  },
  developer: { phone: [], desktop: ['toggleDevTools'] },
  docker: {
    phone: ['getOverview', 'getStats', 'getLogs', 'getContainer'],
    desktop: ['openLazydocker', 'openLazydockerPage'],
  },
  files: {
    phone: [],
    desktop: ['places', 'list', 'preview', 'thumbnail', 'search', 'folderSize', 'statMany', 'createFolder',
      'createFile', 'rename', 'paste', 'trash', 'open', 'reveal'],
  },
  semantic: { phone: ['getProject', 'query', 'explain'], desktop: [] },
  malloy: {
    phone: ['status', 'listModels', 'compile', 'sql', 'run', 'getSettings'],
    desktop: ['saveSettings', 'pickFolder', 'resetSettings'],
  },
  flashcards: {
    phone: ['listDecks', 'createDeck', 'updateDeck', 'deleteDeck', 'listCards', 'addCard', 'importCards',
      'updateCard', 'resetCard', 'deleteCard', 'study', 'answer', 'undo'],
    desktop: [],
  },
  flows: {
    phone: ['list', 'get', 'create', 'save', 'flush', 'remove', 'history', 'version', 'options', 'components',
      'run', 'pollRun', 'stopRun', 'runningRun', 'runs'],
    desktop: [],
  },
  home: { phone: ['getSummaries'], desktop: [] },
  ingestion: {
    phone: ['overview', 'listPipelines', 'runs', 'serverOverview', 'serverRuns', 'serverLogs', 'explore'],
    desktop: ['testConnection', 'syncConnected', 'savePipeline', 'deletePipeline', 'setFlags', 'run', 'kill', 'serverAction', 'serverCreate'],
  },
  mcp: { phone: ['getSetup', 'getAccess', 'getAudit'], desktop: ['setAllowed', 'forgetAgent', 'clearAudit'] },
  notes: { phone: ['list', 'get', 'create', 'save', 'flush', 'remove', 'history', 'version'], desktop: [] },
  sqlx: { phone: ['listProjects', 'listFiles', 'readFile'], desktop: ['addProject', 'removeProject', 'saveFile'] },
  openmetadata: {
    phone: ['status', 'counts', 'list', 'get', 'versions', 'recent', 'search', 'getLineage', 'tableHealth', 'bigquerySetupSql', 'explore'],
    desktop: ['setDescription', 'syncBigQuery'],
  },
  profiles: { phone: ['getProfiles'], desktop: ['rename', 'switchTo', 'restart'] },
  remote: {
    phone: [],
    desktop: ['getStatus', 'setEnabled', 'check', 'setupServe', 'startPairing', 'cancelPairing', 'setAgentFromPhone',
      'setLogins', 'renameDevice', 'revokeDevice', 'clearAudit'],
  },
  settings: {
    phone: ['getStatus'],
    desktop: ['checkForUpdates', 'downloadUpdate', 'installAndRestart', 'installWithoutBackup'],
  },
  storage: {
    phone: ['getDrives', 'getScan', 'getHistory'],
    desktop: ['setGoal', 'startScan', 'openLocation', 'openStorageSettings'],
  },
  scheduled: { phone: ['list', 'inApp'], desktop: ['change', 'runInApp', 'openScheduler'] },
  extensions: {
    phone: ['list'],
    desktop: ['inspect', 'confirm', 'cancel', 'uninstall', 'setEnabled', 'approve', 'reload', 'checkUpdates',
      'stageUpdate', 'revokeFolder', 'getSettings', 'saveSettings', 'logs', 'openFolder', 'call', 'requestFolder', 'openExternal'],
  },
  'app:github-plus': {
    // openRepo checks that a phone is reopening a recent or linked repo.
    phone: ['openRepo', 'getSettings', 'getActivity', 'getWorkingStates', 'workingState', 'getRecents', 'getLinked',
      'listRefs', 'listTree', 'treeLastCommits', 'branchDivergence', 'readBlob', 'readWorkingBlob', 'search',
      'searchAll', 'searchCounts', 'lineHistory', 'getLog', 'countCommits', 'getCommit', 'compareRefs', 'listIssues',
      'issueCounts', 'getIssue', 'createIssue', 'githubTarget', 'githubRepos', 'updateIssue', 'addIssueComment',
      'linkedTasks', 'linkedTaskCount', 'linkedTasksOnGitHub', 'linkCounts', 'getBackup'],
    desktop: ['pickRepoFolder', 'pickBackupFolder', 'previewFolder', 'initRepo', 'saveSettings', 'removeRecent',
      'openInExplorer', 'cloneGitHubRepo', 'openOnGitHub', 'unlinkTask', 'linkTask', 'saveBackup', 'removeBackup', 'runBackup'],
  },
  'app:jira-plus': {
    phone: ['listTriggerTemplates', 'getOverview', 'calendarIssues', 'listIssues', 'getIssue', 'getIssueTypes',
      'createIssue', 'updateIssue', 'transitionIssue', 'addComment', 'updateComment', 'deleteComment', 'setParent',
      'parentOptions', 'logWork', 'deleteWorklog', 'deleteIssue', 'getRepoLinks'],
    desktop: ['saveTriggerTemplate', 'deleteTriggerTemplate', 'linkRepo', 'unlinkRepo', 'pickRepoFolder',
      'createLocalProject', 'updateLocalProject', 'saveSettings', 'forgetLegacyConnection'],
  },
  'app:email': {
    phone: ['getState', 'listFolders', 'listThreads', 'searchAccounts', 'getThread', 'modifyThread', 'archive', 'markRead', 'createFolder', 'send'],
    desktop: ['saveConnectorConfig', 'signIn', 'cancelSignIn', 'removeAccount', 'discover', 'addStores', 'updateAccount'],
  },
  'app:tracker': {
    phone: ['snapshot', 'createTeam', 'updateTeam', 'createIssue', 'updateIssues', 'deleteIssues', 'restoreIssues',
      'issueDetail', 'addProjectUpdate', 'scheduleCycles', 'addExample', 'save', 'remove'],
    desktop: [],
  },
}

/** @type {Map<string, Set<string>>} */
const allowed = new Map(Object.entries(REMOTE_METHODS).map(([id, { phone }]) => [id, new Set(phone)]))

const DESKTOP_MESSAGE = 'Do this on your PC: it needs the PC screen.'
const DENY_MESSAGE = 'Do this on your PC: this action is available only on the PC.'

/**
 * Why a remote call is refused, or undefined when it is allowed.
 * @param {unknown} moduleId
 * @param {unknown} method
 * @param {(moduleId: string, method: string) => boolean} isDesktopOnly
 */
function remoteRefusal(moduleId, method, isDesktopOnly) {
  if (typeof moduleId !== 'string' || typeof method !== 'string') return 'Bad request'
  if (moduleId.startsWith('ext:')) return 'Extension pages are not available on the phone yet.'
  if (isDesktopOnly?.(moduleId, method)) return DESKTOP_MESSAGE
  return allowed.get(moduleId)?.has(method) ? undefined : DENY_MESSAGE
}

// Calls a page makes on its own while it is open (reads and polls). Logged only
// when refused or failed, so the Activity list shows what the person did.
const QUIET = /^(get|list|poll|read|count|running|check|search|preview|tree|branch|compare|linked|issueCounts|study|claudeAccount|logs|call$)/

/** @param {string} method */
function isQuiet(method) {
  return QUIET.test(method)
}

module.exports = { REMOTE_METHODS, remoteRefusal, isQuiet, DESKTOP_MESSAGE, DENY_MESSAGE }
