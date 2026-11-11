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
  pi: {
    state: 'ok',
    summary: 'pi 1.5.2 is ready with 3 scoped models.',
    details: [
      { label: 'pi', value: '1.5.2' },
      { label: 'Signed in to', value: 'anthropic (login)' },
      { label: 'Scoped in pi', value: 'anthropic: claude-haiku-5-5, claude-sonnet-5-5, claude-opus-5-5' },
      { label: 'Matches this connection', value: 'Yes', ok: true },
    ],
    added: true,
    checkedAt: at,
  },
  'pi-playwright': {
    state: 'ok',
    summary: 'pi can drive your Google Chrome tabs, and knows how.',
    hint: 'Test connection opens the tab prompt once, then detaches.',
    details: [
      { label: 'pi-playwright', value: '0.1.2', ok: true },
      { label: 'Playwright CLI', value: '0.1.24', ok: true },
      { label: 'Google Chrome', value: 'Found', ok: true },
      { label: 'Playwright Extension', value: 'Installed in Default', ok: true },
      { label: 'Tab prompt', value: 'Google Chrome asks which tab to share' },
      { label: 'Skill for pi', value: 'use-my-browser: up to date', ok: true },
    ],
    actions: ['test-attach'],
    added: true,
    checkedAt: at,
  },
  git: {
    state: 'ok',
    summary: 'git 2.47.1.windows.1 is set up.',
    details: [
      { label: 'git', value: '2.47.1.windows.1' },
      { label: 'user.name', value: 'Sam Demo', ok: true },
      { label: 'user.email', value: 'sam.demo@example.com', ok: true },
      { label: 'Credential helper', value: 'Git Credential Manager', ok: true },
    ],
    added: true,
    checkedAt: at,
  },
}

const PI_DEFAULT_MODELS = 'anthropic/claude-haiku-5-5, anthropic/claude-sonnet-5-5, anthropic/claude-opus-5-5'

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
    {
      kind: 'pi',
      title: 'pi',
      description: 'The pi coding agent that Chat runs pi sessions with, and the models it is scoped to.',
      icon: 'terminal',
      fields: [
        {
          key: 'scopedModels',
          label: 'Scoped models',
          type: 'text',
          defaultValue: PI_DEFAULT_MODELS,
          placeholder: PI_DEFAULT_MODELS,
          help: "The models pi cycles through and offers, as pi's /scoped-models saves them (provider/model, comma separated; globs like anthropic/*sonnet* work). Saving writes them to pi's settings. Leave empty to allow all models.",
        },
      ],
      actions: [
        {
          id: 'apply-scoped-models',
          label: 'Apply scoped models',
          description: "Writes this connection's scoped models to pi's settings again (for example after /scoped-models changed them).",
          showWhen: ['ok', 'error', 'needs-setup'],
        },
      ],
    },
    {
      kind: 'pi-playwright',
      parent: 'pi',
      title: 'Playwright browser',
      description: "pi's Playwright skill working in your own Chrome tabs (with your logins) through the Playwright Extension.",
      icon: 'globe',
      fields: [
        {
          key: 'browser',
          label: 'Browser',
          type: 'select',
          defaultValue: 'chrome',
          options: [
            { value: 'chrome', label: 'Google Chrome' },
            { value: 'msedge', label: 'Microsoft Edge' },
          ],
          help: 'The browser that has the Playwright Extension. pi attaches to its open tabs.',
        },
        { key: 'profile', label: 'Browser profile folder (optional)', type: 'text', placeholder: 'Default, Profile 1, ...' },
        {
          key: 'teachPi',
          label: 'Teach pi',
          type: 'select',
          defaultValue: 'yes',
          options: [
            { value: 'yes', label: 'Add a use-my-browser skill that tells pi how to attach' },
            { value: 'no', label: 'No, I tell pi myself' },
          ],
        },
      ],
      actions: [
        { id: 'install-skill', label: 'Install in pi', description: 'Opens a terminal that runs pi install npm:pi-playwright.', showWhen: ['needs-setup', 'error'] },
        { id: 'open-extension-page', label: 'Get the extension', description: 'Opens the Playwright Extension in the Chrome Web Store.', showWhen: ['needs-setup'] },
        { id: 'test-attach', label: 'Test connection', description: 'Attaches to the browser the way pi does, then detaches.', steps: 2, showWhen: ['ok'] },
      ],
    },
    {
      kind: 'git',
      title: 'Git',
      description: 'The git that GitHub+ and Chat run: its version, commit identity and credential helper.',
      icon: 'git',
      fields: [],
      actions: [],
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
    {
      kind: 'pi',
      values: { scopedModels: PI_DEFAULT_MODELS },
      secretsSet: {},
      addedAt: at,
      updatedAt: at,
      status: sampleStatuses.pi,
    },
    {
      kind: 'pi-playwright',
      values: { browser: 'chrome', profile: '', teachPi: 'yes' },
      secretsSet: {},
      addedAt: at,
      updatedAt: at,
      status: sampleStatuses['pi-playwright'],
    },
    {
      kind: 'git',
      values: {},
      secretsSet: {},
      addedAt: at,
      updatedAt: at,
      status: sampleStatuses.git,
    },
  ],
}
