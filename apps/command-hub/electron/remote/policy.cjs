// What a paired phone may call (docs/remote-access.md, "What the phone can't do").
//
// Refused for every remote device, on top of each backend's desktopOnly list:
// anything that changes accounts, secrets, permissions, MonoRail itself or
// Remote access. Those stay on the PC, where the person can see them.

/** moduleId -> methods refused remotely. '*' refuses the whole backend. */
const REMOTE_DENY = Object.freeze({
  storage: ['setGoal'],
  remote: ['*'], // pairing, devices, settings: only from the PC's own window
  developer: ['*'],
  profiles: ['rename', 'switchTo', 'restart'],
  settings: ['checkForUpdates', 'downloadUpdate', 'installAndRestart', 'installWithoutBackup'],
  connections: ['save', 'remove', 'runAction', 'cancelJob', 'listWindowsCredentials'],
  mcp: ['setAllowed', 'forgetAgent', 'clearAudit'],
  backups: ['save', 'runAll'],
  'agent-chat': ['setSystemPrompts', 'setSpending', 'allowOneMoreTurn', 'resetSpending', 'removeRepo'],
  'agent-catalog': ['create', 'update', 'remove'], // subagent definitions change what agents may do
  extensions: ['confirm', 'cancel', 'uninstall', 'setEnabled', 'approve', 'reload', 'checkUpdates', 'stageUpdate', 'revokeFolder', 'saveSettings'],
  'app:email': ['saveConnectorConfig', 'signIn', 'cancelSignIn', 'removeAccount', 'discover', 'addStores', 'updateAccount'],
  'app:github-plus': ['saveSettings', 'saveBackup', 'removeBackup', 'removeRecent'],
  'app:jira-plus': ['saveSettings', 'forgetLegacyConnection'],
})

const DESKTOP_MESSAGE = 'Do this on your PC: it needs the PC screen.'
const DENY_MESSAGE = 'Do this on your PC: it changes settings that stay on the PC.'

/**
 * Why a remote call is refused, or undefined when it is allowed.
 * @param {(moduleId: string, method: string) => boolean} isDesktopOnly
 */
function remoteRefusal(moduleId, method, isDesktopOnly) {
  if (typeof moduleId !== 'string' || typeof method !== 'string') return 'Bad request'
  if (isDesktopOnly?.(moduleId, method)) return DESKTOP_MESSAGE
  const deny = REMOTE_DENY[moduleId]
  if (deny && (deny.includes('*') || deny.includes(method))) return DENY_MESSAGE
  return undefined
}

// Calls a page makes on its own while it is open (reads and polls). Logged only
// when refused or failed, so the Activity list shows what the person did.
const QUIET = /^(get|list|poll|read|count|running|check|search|preview|tree|branch|compare|linked|issueCounts|study|claudeAccount|logs|call$)/

function isQuiet(method) {
  return QUIET.test(method)
}

module.exports = { REMOTE_DENY, remoteRefusal, isQuiet, DESKTOP_MESSAGE, DENY_MESSAGE }
