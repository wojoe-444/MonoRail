// Whether this process is the self-hosted mode (`npm start`, electron/host.cjs):
// MonoRail without its own window, its pages in the user's browser on this PC.
// Backends that would act on MonoRail's window (restart, updates) ask here.
// docs/guide/setup/run-from-source.md.

/** Exit code that asks the launcher (scripts/host.cjs) to start the host again. */
const HOST_RESTART_CODE = 75

let restartHandler

function isHosted() {
  return process.env.MONORAIL_HOSTED === '1'
}

/** electron/host.cjs hands in how it restarts (quit with HOST_RESTART_CODE). */
function onHostRestart(fn) {
  restartHandler = fn
}

/** Restart the hosted process. False when this is not the hosted mode. */
function restartHost() {
  if (!isHosted() || typeof restartHandler !== 'function') return false
  restartHandler()
  return true
}

module.exports = { isHosted, onHostRestart, restartHost, HOST_RESTART_CODE }
