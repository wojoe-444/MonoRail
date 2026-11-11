// The stdio transport for the MCP server: one JSON-RPC message per line on
// stdin, one response per line on stdout. Nothing else may write to stdout,
// so server.cjs sends every log line to stderr.

const readline = require('node:readline')

const { errorResponse, ERR } = require('./protocol.cjs')

const MAX_LINE = 4 * 1024 * 1024

/** Serve `server` over a readable and a writable stream until input ends. */
function serveStdio(server, { input = process.stdin, output = process.stdout } = {}) {
  const write = (msg) => output.write(`${JSON.stringify(msg)}\n`)
  const rl = readline.createInterface({ input, crlfDelay: Infinity })
  const inFlight = new Set()
  rl.on('line', (line) => {
    if (!line.trim()) return
    if (line.length > MAX_LINE) return write(errorResponse(null, ERR.invalidRequest, 'Message too large'))
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return write(errorResponse(null, ERR.parse, 'Parse error'))
    }
    // Answer each as it finishes; every response is one write of one line.
    const job = server
      .handle(msg)
      .then((res) => {
        if (res !== undefined) write(res)
      })
      .finally(() => inFlight.delete(job))
    inFlight.add(job)
  })
  // When input ends, finish the calls already under way, then stop.
  return new Promise((resolve) => rl.on('close', () => void Promise.allSettled([...inFlight]).then(() => resolve())))
}

module.exports = { serveStdio }
