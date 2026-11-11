// A small Model Context Protocol server: JSON-RPC 2.0 messages in, responses
// out. Transport-free so it can be tested without a process (see stdio.cjs for
// the stdio transport the app uses). Only the parts MonoRail needs: tools.
//
// Spec: https://modelcontextprotocol.io/specification (2025-06-18, with the
// two earlier versions still accepted).
//
// A tool is { name, title, description, inputSchema, annotations?, write?, handler }.
// handler(args, ctx) returns any JSON value; it is sent back as JSON text. A
// thrown error becomes a tool result with isError, so the agent sees the
// message. ctx = { agent, did(text) }: agent is the name the client gave in
// initialize (after onInitialize), did() records a one-line description of
// what a write changed, for the audit log. authorize({ tool, agent }) runs
// before every write tool and throws to refuse it.

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const MAX_RESULT_CHARS = 400_000

const ERR = { parse: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602, internal: -32603 }

class ToolInputError extends Error {}

/**
 * Check args against the subset of JSON Schema the tools use: an object with
 * typed properties (string, integer, number, boolean), enum, minimum, maximum,
 * maxLength, required and additionalProperties: false.
 */
function checkArgs(schema, args) {
  if (args === undefined || args === null) args = {}
  if (typeof args !== 'object' || Array.isArray(args)) throw new ToolInputError('Arguments must be an object.')
  const props = schema.properties ?? {}
  for (const key of schema.required ?? []) {
    if (args[key] === undefined) throw new ToolInputError(`Missing argument "${key}".`)
  }
  for (const [key, value] of Object.entries(args)) {
    const p = Object.hasOwn(props, key) ? props[key] : undefined
    if (!p) {
      if (schema.additionalProperties === false) throw new ToolInputError(`Unknown argument "${key}".`)
      continue
    }
    if (value === undefined) continue
    const ok =
      p.type === 'string' ? typeof value === 'string'
      : p.type === 'integer' ? Number.isInteger(value)
      : p.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
      : p.type === 'boolean' ? typeof value === 'boolean'
      : true
    if (!ok) throw new ToolInputError(`"${key}" must be ${p.type === 'integer' ? 'an integer' : `a ${p.type}`}.`)
    if (p.enum && !p.enum.includes(value)) throw new ToolInputError(`"${key}" must be one of: ${p.enum.join(', ')}.`)
    if (typeof p.minimum === 'number' && value < p.minimum) throw new ToolInputError(`"${key}" must be at least ${p.minimum}.`)
    if (typeof p.maximum === 'number' && value > p.maximum) throw new ToolInputError(`"${key}" must be at most ${p.maximum}.`)
    if (typeof p.maxLength === 'number' && value.length > p.maxLength) throw new ToolInputError(`"${key}" is longer than ${p.maxLength} characters.`)
  }
  return args
}

function textResult(value, isError = false) {
  let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  if (text === undefined) text = 'null'
  if (text.length > MAX_RESULT_CHARS) text = `${text.slice(0, MAX_RESULT_CHARS)}\n... (cut at ${MAX_RESULT_CHARS} characters)`
  return isError ? { content: [{ type: 'text', text }], isError: true } : { content: [{ type: 'text', text }] }
}

/**
 * @param {{ name: string, version: string, instructions?: string, tools: any[],
 *   onCall?: (info: { tool: string, agent: string, write: boolean, ok: boolean, ms: number, error?: string, did?: string }) => void | Promise<void>,
 *   onInitialize?: (clientInfo: unknown) => Promise<string> | string,
 *   authorize?: (info: { tool: string, agent: string }) => Promise<void> | void }} opts
 */
function createMcpServer({ name, version, instructions, tools, onCall = () => {}, onInitialize, authorize }) {
  const byName = new Map(tools.map((t) => [t.name, t]))
  if (byName.size !== tools.length) throw new Error('Duplicate MCP tool name')

  const listed = tools.map(({ name: n, title, description, inputSchema, annotations }) => ({
    name: n,
    title,
    description,
    inputSchema,
    ...(annotations ? { annotations } : {}),
  }))

  let agent = 'unknown agent'

  /** onCall may be async (the audit log); its failure never changes the result. */
  async function report(info) {
    try {
      await onCall(info)
    } catch {
      // logged by the caller's own handler, if at all
    }
  }

  async function callTool(params) {
    const tool = typeof params?.name === 'string' && byName.has(params.name) ? byName.get(params.name) : undefined
    if (!tool) throw Object.assign(new Error(`Unknown tool: ${params?.name}`), { code: ERR.invalidParams })
    const started = Date.now()
    const write = !!tool.write
    let did
    try {
      const args = checkArgs(tool.inputSchema, params.arguments)
      if (write) {
        if (!authorize) throw new Error('Write tools are turned off.')
        await authorize({ tool: tool.name, agent })
      }
      const value = await tool.handler(args, { agent, did: (text) => (did = String(text).slice(0, 300)) })
      await report({ tool: tool.name, agent, write, ok: true, ms: Date.now() - started, did })
      return textResult(value)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await report({ tool: tool.name, agent, write, ok: false, ms: Date.now() - started, error: message })
      return textResult(message, true)
    }
  }

  const methods = {
    initialize: async (params) => {
      if (onInitialize) agent = (await onInitialize(params?.clientInfo)) || agent
      const asked = params?.protocolVersion
      return {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name, title: 'MonoRail', version },
        ...(instructions ? { instructions } : {}),
      }
    },
    ping: () => ({}),
    'tools/list': () => ({ tools: listed }),
    'tools/call': callTool,
  }

  /** Handle one parsed message (or a batch). Returns the response, or undefined for notifications. */
  async function handle(msg) {
    if (Array.isArray(msg)) {
      if (msg.length === 0) return errorResponse(null, ERR.invalidRequest, 'Empty batch')
      const out = (await Promise.all(msg.map(handleOne))).filter(Boolean)
      return out.length ? out : undefined
    }
    return handleOne(msg)
  }

  async function handleOne(msg) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') return errorResponse(msg?.id ?? null, ERR.invalidRequest, 'Not a JSON-RPC 2.0 message')
    const isRequest = msg.id !== undefined && msg.id !== null
    // Responses from the client (we send no requests) and notifications need no answer.
    if (typeof msg.method !== 'string') return undefined
    if (!isRequest) return undefined
    const fn = Object.hasOwn(methods, msg.method) ? methods[msg.method] : undefined
    if (!fn) return errorResponse(msg.id, ERR.methodNotFound, `Method not found: ${msg.method}`)
    try {
      return { jsonrpc: '2.0', id: msg.id, result: await fn(msg.params) }
    } catch (e) {
      return errorResponse(msg.id, e.code ?? ERR.internal, e instanceof Error ? e.message : String(e))
    }
  }

  return { handle, tools: listed }
}

function errorResponse(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

module.exports = { createMcpServer, checkArgs, errorResponse, PROTOCOL_VERSIONS, ERR }
