// Cron schedules for ingestion pipelines. OpenMetadata keeps a pipeline's
// schedule as a cron string in airflowConfig.scheduleInterval, so MonoRail
// stores the same string and works out run times from it here.
//
// Five fields (minute hour day-of-month month day-of-week) in this PC's local
// time, with *, lists (1,15), ranges (1-5), steps (*/15, 0-30/10) and the
// shorthands @hourly, @daily, @weekly, @monthly, @yearly. Day of week is 0-7
// (0 and 7 are Sunday). As in cron, when both day fields are restricted a day
// matches if either does. No Electron here, so tests run it under Node.

const SHORTHANDS = Object.freeze({
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
})

const FIELDS = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'day of week', min: 0, max: 7 },
]

function parseField(text, { name, min, max }) {
  const values = new Set()
  for (const part of text.split(',')) {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part)
    if (!m) throw new Error(`The ${name} field "${text}" is not valid cron.`)
    let lo = min
    let hi = max
    if (m[1] !== '*') {
      const [a, b] = m[1].split('-').map(Number)
      lo = a
      hi = b === undefined ? (m[2] ? max : a) : b
    }
    const step = m[2] ? Number(m[2]) : 1
    if (lo < min || hi > max || lo > hi || step < 1) throw new Error(`The ${name} field "${text}" is out of range (${min}-${max}).`)
    for (let v = lo; v <= hi; v += step) values.add(v)
  }
  return values
}

/** Parse a cron string. Throws a readable message for anything else. */
function parse(expr) {
  if (typeof expr !== 'string' || !expr.trim()) throw new Error('Enter a schedule, for example 0 */6 * * *.')
  const text = SHORTHANDS[expr.trim().toLowerCase()] ?? expr.trim()
  const parts = text.split(/\s+/)
  if (parts.length !== 5) throw new Error('A cron schedule has five fields: minute hour day-of-month month day-of-week.')
  const [minute, hour, dom, month, dowRaw] = parts.map((p, i) => parseField(p, FIELDS[i]))
  const dow = new Set([...dowRaw].map((d) => (d === 7 ? 0 : d)))
  return { minute, hour, dom, month, dow, domAny: parts[2] === '*', dowAny: parts[4] === '*' }
}

function dayMatches(c, d) {
  const inDom = c.dom.has(d.getDate())
  const inDow = c.dow.has(d.getDay())
  if (c.domAny && c.dowAny) return true
  if (c.domAny) return inDow
  if (c.dowAny) return inDom
  return inDom || inDow
}

/** The first run time strictly after `after` (a Date), or null if none within ~5 years. */
function next(expr, after = new Date()) {
  const c = typeof expr === 'string' ? parse(expr) : expr
  const d = new Date(after.getTime())
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() + 1)
  const limit = after.getTime() + 5 * 366 * 86_400_000
  while (d.getTime() <= limit) {
    if (!c.month.has(d.getMonth() + 1)) {
      d.setMonth(d.getMonth() + 1, 1)
      d.setHours(0, 0, 0, 0)
      continue
    }
    if (!dayMatches(c, d)) {
      d.setDate(d.getDate() + 1)
      d.setHours(0, 0, 0, 0)
      continue
    }
    if (!c.hour.has(d.getHours())) {
      d.setHours(d.getHours() + 1, 0, 0, 0)
      continue
    }
    if (!c.minute.has(d.getMinutes())) {
      d.setMinutes(d.getMinutes() + 1, 0, 0)
      continue
    }
    return d
  }
  return null
}

const pad = (n) => String(n).padStart(2, '0')
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** A plain-language description for the common shapes; the cron itself otherwise. */
function describe(expr) {
  let c
  try {
    c = parse(expr)
  } catch {
    return String(expr ?? '')
  }
  const one = (s) => (s.size === 1 ? [...s][0] : undefined)
  const all = (s, field) => s.size === field.max - field.min + 1 || (field.name === 'day of week' && s.size === 7)
  const m = one(c.minute)
  const h = one(c.hour)
  const everyDay = c.domAny && c.dowAny && all(c.month, FIELDS[3])
  if (everyDay && m !== undefined && all(c.hour, FIELDS[1])) return m === 0 ? 'Every hour' : `Every hour at :${pad(m)}`
  if (everyDay && m !== undefined && h === undefined) {
    const hours = [...c.hour].sort((a, b) => a - b)
    const step = hours[1] - hours[0]
    if (hours.length > 1 && hours[0] < step && hours.every((v, i) => v === hours[0] + i * step) && 24 % step === 0) return `Every ${step} hours`
  }
  if (everyDay && m !== undefined && h !== undefined) return `Daily at ${pad(h)}:${pad(m)}`
  if (c.domAny && !c.dowAny && c.dow.size === 1 && m !== undefined && h !== undefined) return `Weekly on ${DAYS[one(c.dow)]} at ${pad(h)}:${pad(m)}`
  if (!c.domAny && c.dowAny && c.dom.size === 1 && m !== undefined && h !== undefined) return `Monthly on day ${one(c.dom)} at ${pad(h)}:${pad(m)}`
  return String(expr).trim()
}

module.exports = { parse, next, describe, SHORTHANDS }
