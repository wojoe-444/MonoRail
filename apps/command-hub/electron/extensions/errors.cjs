// The error contract between an extension backend, MonoRail and the page.
//
// Every failed monorail.invoke() rejects with an error that has a `code`, a
// `message` and, when the backend sent them, JSON `details`. Codes starting
// with EXT_ come from MonoRail itself; a backend uses its own codes (any short
// identifier, e.g. "NOT_SIGNED_IN") through ctx.fail(code, message, details)
// or by throwing an Error with a `code` property. Node's own codes (ENOENT,
// ECONNREFUSED, ...) pass through unchanged.
//
// runner.cjs must stay self-contained, so it repeats the few codes it raises;
// keep this list, runner.cjs, the SDK's backend.d.ts and
// docs/extensions/backend-api.md in step.

/** @type {Record<string, string>} code -> when it happens */
const ERROR_CODES = {
  EXT_BACKEND_ERROR: 'The backend threw an error without a usable code.',
  EXT_UNKNOWN_METHOD: 'The backend has no method with that name.',
  EXT_TIMEOUT: 'The call took longer than 2 minutes.',
  EXT_NOT_ACTIVE: 'The extension is turned off, waiting for permission approval, incompatible or broken.',
  EXT_NO_BACKEND: 'The extension has no backend.',
  EXT_START_FAILED: 'The backend failed to start (it threw while loading, in migrate() or in start(), or did not start within 20 seconds).',
  EXT_CRASHED: 'The backend process exited during the call, or is stopped after crashing 3 times in a minute.',
  EXT_BAD_PAYLOAD: 'An argument, result or event payload is not plain JSON, or is too large.',
  EXT_NETWORK_DENIED: 'A connection to a host that permissions.network does not list.',
  EXT_PROCESS_DENIED: 'Starting a program that permissions.process does not list.',
  EXT_FS_DENIED: 'Reading or writing a file outside the folders the extension may use.',
  EXT_SECRETS_UNAVAILABLE: 'The operating system offers no encryption, so secrets cannot be stored.',
  EXT_INVALID_SECRET: 'A secret name or value that breaks the rules (name: 1-100 of A-Z a-z 0-9 . _ -; value: a string up to 64 KB).',
  EXT_HOST_ERROR: 'MonoRail could not complete a request from the backend.',
}

class ExtensionCallError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = 'ExtensionCallError'
    this.code = code
    if (details !== undefined) this.details = details
  }
}

/** Plain { code, message, details? } for any error, for the page bridge. */
function toWire(err) {
  if (err && typeof err === 'object' && typeof err.code === 'string') {
    const out = { code: err.code, message: String(err.message ?? err.code) }
    if (err.details !== undefined) out.details = err.details
    return out
  }
  return { code: 'EXT_HOST_ERROR', message: err instanceof Error ? err.message : String(err) }
}

module.exports = { ERROR_CODES, ExtensionCallError, toWire }
