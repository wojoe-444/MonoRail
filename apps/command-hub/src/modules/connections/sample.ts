import { sampleClaudeAccount } from './account'
import type { ConnectionsList, ConnectionStatus } from './types'

/** Browser dev server only (no backend). Every account here is fictional. */
const at = '2026-01-15T09:30:00.000Z'

export const sampleStatuses: Record<string, ConnectionStatus> = {
  gcloud: {
    state: 'expired',
    summary: 'Google sign-in needs renewing (application default credentials).',
    hint: 'Sign in again runs both logins.',
    details: [
      { label: 'Account', value: 'sam.demo@example.com' },
      { label: 'Project', value: 'demo-project-123' },
      { label: 'gcloud login', value: 'Valid', ok: true },
      { label: 'Application default credentials', value: 'Expired', ok: false },
    ],
    added: true,
    checkedAt: at,
  },
  atlassian: {
    state: 'ok',
    summary: 'Connected as Sam Demo.',
    details: [
      { label: 'Site', value: 'demo-team.atlassian.net' },
      { label: 'Email', value: 'sam.demo@example.com' },
      { label: 'Token', value: 'Credential Manager: atlassian-demo' },
    ],
    added: true,
    checkedAt: at,
  },
  claude: {
    state: 'ok',
    summary: 'Signed in as sam.demo@example.com.',
    details: [
      { label: 'Account type', value: 'Subscription' },
      { label: 'Account', value: 'sam.demo@example.com' },
      { label: 'Plan', value: 'Claude Max' },
      { label: 'Claude Code CLI', value: '2.0.0 (Claude Code)' },
    ],
    account: sampleClaudeAccount,
    added: true,
    checkedAt: at,
  },
}

export const sampleList: ConnectionsList = {
  encryptionAvailable: true,
  platform: 'win32',
  connectors: [
    {
      kind: 'gcloud',
      title: 'Google Cloud',
      description: 'The gcloud CLI login and Application Default Credentials, used by Google Cloud tools and client libraries.',
      icon: 'cloud',
      fields: [],
      actions: [
        {
          id: 'sign-in',
          label: 'Sign in again',
          description: 'Runs gcloud auth login, then gcloud auth application-default login.',
          showWhen: ['expired', 'needs-setup', 'ok', 'error'],
          steps: 2,
        },
      ],
    },
    {
      kind: 'atlassian',
      title: 'Atlassian',
      description: 'An Atlassian API token for Jira Cloud. Used by Jira+.',
      icon: 'key',
      fields: [
        { key: 'siteUrl', label: 'Site', type: 'text', placeholder: 'your-team.atlassian.net' },
        {
          key: 'tokenSource',
          label: 'Where the token is',
          type: 'select',
          defaultValue: 'direct',
          options: [
            { value: 'direct', label: 'Paste it into MonoRail' },
            { value: 'wincred', label: 'Windows Credential Manager entry' },
          ],
        },
        { key: 'email', label: 'Account email', type: 'text', placeholder: 'you@example.com' },
        { key: 'token', label: 'API token', type: 'secret', showIf: { tokenSource: 'direct' } },
        { key: 'credentialTarget', label: 'Credential Manager entry', type: 'text', showIf: { tokenSource: 'wincred' }, credentialPicker: true },
      ],
      actions: [],
    },
    {
      kind: 'claude',
      title: 'Claude',
      description: 'The Claude account that Claude Code and the Claude Agent SDK use.',
      icon: 'sparkles',
      fields: [
        {
          key: 'accountType',
          label: 'Account type',
          type: 'select',
          defaultValue: 'auto',
          options: [
            { value: 'auto', label: 'Detect automatically' },
            { value: 'subscription', label: 'Subscription (Pro, Max, Team): flat fee' },
            { value: 'api', label: 'API (Console, API key, cloud provider): billed per token' },
            { value: 'enterprise', label: 'Enterprise: billed per token at API prices' },
          ],
          help: 'Decides how MonoRail treats Claude costs. Choose one only if the detected type is wrong.',
        },
      ],
      actions: [{ id: 'sign-in', label: 'Sign in', description: 'Opens a terminal running claude auth login.', showWhen: ['expired', 'needs-setup', 'ok', 'error'] }],
    },
  ],
  connections: [
    {
      kind: 'gcloud',
      values: {},
      secretsSet: {},
      addedAt: at,
      updatedAt: at,
      status: sampleStatuses.gcloud,
    },
    {
      kind: 'atlassian',
      values: { siteUrl: 'demo-team.atlassian.net', tokenSource: 'wincred', email: '', credentialTarget: 'atlassian-demo' },
      secretsSet: {},
      addedAt: at,
      updatedAt: at,
      status: sampleStatuses.atlassian,
    },
    {
      kind: 'claude',
      values: { accountType: 'auto' },
      secretsSet: {},
      addedAt: at,
      updatedAt: at,
      status: sampleStatuses.claude,
    },
  ],
}
