// Flashcards scheduler: FSRS-5 (Free Spaced Repetition Scheduler, open
// algorithm by Jarrett Ye and contributors) with its published default
// weights, plus short learning steps for new and forgotten cards.
//
// Pure functions, no I/O: schedule(card, now, options) returns the card after
// each of the four ratings, so the page can show every outcome on its button
// and the backend applies the one the user picked.
//
// Memory model: stability S is the number of days until recall probability
// falls to 90%; difficulty D runs 1..10. Retrievability after t days is
//   R(t, S) = (1 + FACTOR * t / S) ^ DECAY
// and the next interval is the t at which R falls to the desired retention.

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

/** FSRS-5 default weights (w0..w18). */
const W = Object.freeze([
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655,
  0.6621,
])
const DECAY = -0.5
const FACTOR = 19 / 81

const RATINGS = Object.freeze({ again: 1, hard: 2, good: 3, easy: 4 })
const LEARNING_STEPS = Object.freeze([1 * MINUTE, 10 * MINUTE])
const RELEARNING_STEPS = Object.freeze([10 * MINUTE])
const MAX_INTERVAL_DAYS = 36500

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

function retrievability(elapsedDays, stability) {
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY)
}

/** Days until recall falls to `retention`, rounded, at least 1. */
function intervalDays(stability, retention) {
  const raw = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1)
  return clamp(Math.round(raw), 1, MAX_INTERVAL_DAYS)
}

const initStability = (g) => Math.max(W[g - 1], 0.1)
const initDifficulty = (g) => clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10)

function nextDifficulty(d, g) {
  const delta = -W[6] * (g - 3)
  const damped = d + (delta * (10 - d)) / 9 // linear damping (FSRS-5)
  const reverted = W[7] * initDifficulty(4) + (1 - W[7]) * damped // mean reversion
  return clamp(reverted, 1, 10)
}

function recallStability(d, s, r, g) {
  const hardPenalty = g === 2 ? W[15] : 1
  const easyBonus = g === 4 ? W[16] : 1
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hardPenalty * easyBonus)
}

function forgetStability(d, s, r) {
  const sf = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14])
  return Math.min(sf, s)
}

/** Same-day review (FSRS-5 short-term stability). */
const shortTermStability = (s, g) => s * Math.exp(W[17] * (g - 3 + W[18]))

/** Memory state (S, D) after rating `g` at `now`. */
function nextMemory(card, g, now) {
  if (card.state === 'new' || !(card.stability > 0) || !(card.difficulty > 0)) {
    return { stability: initStability(g), difficulty: initDifficulty(g) }
  }
  const s = card.stability
  const d = card.difficulty
  const elapsed = card.lastReview ? (now - card.lastReview) / DAY : 0
  let stability
  if (elapsed < 1) stability = shortTermStability(s, g)
  else {
    const r = retrievability(elapsed, s)
    stability = g === 1 ? forgetStability(d, s, r) : recallStability(d, s, r, g)
  }
  return { stability: clamp(stability, 0.1, MAX_INTERVAL_DAYS), difficulty: nextDifficulty(d, g) }
}

/**
 * The card after each rating: { 1: card, 2: card, 3: card, 4: card }.
 * `card` needs state ('new' | 'learning' | 'review' | 'relearning'), step,
 * stability, difficulty, reps, lapses, lastReview and due (ms). Only those
 * fields change. options.retention is the desired recall (default 0.9).
 */
function schedule(card, now, { retention = 0.9 } = {}) {
  retention = clamp(retention, 0.7, 0.99)
  const mem = {}
  for (const g of [1, 2, 3, 4]) mem[g] = nextMemory(card, g, now)
  const base = { reps: (card.reps ?? 0) + 1, lapses: card.lapses ?? 0, lastReview: now }
  const at = (ms) => now + ms
  const inDays = (days) => now + days * DAY
  const ivl = (g) => intervalDays(mem[g].stability, retention)
  const out = {}

  const learn = (g, state, step, delay) => ({ ...base, ...mem[g], state, step, due: at(delay), intervalDays: 0 })
  const review = (g, days) => ({ ...base, ...mem[g], state: 'review', step: 0, due: inDays(days), intervalDays: days })

  if (card.state === 'new' || card.state === 'learning' || card.state === 'relearning') {
    const relearning = card.state === 'relearning'
    const steps = relearning ? RELEARNING_STEPS : LEARNING_STEPS
    const state = relearning ? 'relearning' : 'learning'
    const step = card.state === 'new' ? 0 : clamp(card.step ?? 0, 0, steps.length - 1)
    // Hard repeats the current step (on the first of two steps: halfway to the next).
    const hardDelay = step === 0 && steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[step] * (steps.length === 1 ? 1.5 : 1)
    const goodDays = ivl(3)
    out[1] = learn(1, state, 0, steps[0])
    out[2] = learn(2, state, step, hardDelay)
    out[3] = step + 1 < steps.length ? learn(3, state, step + 1, steps[step + 1]) : review(3, goodDays)
    out[4] = review(4, Math.max(ivl(4), goodDays + 1))
    return out
  }

  // review
  let hard = ivl(2)
  let good = ivl(3)
  let easy = ivl(4)
  hard = Math.min(hard, good)
  good = Math.max(good, hard + 1)
  easy = Math.max(easy, good + 1)
  out[1] = { ...learn(1, 'relearning', 0, RELEARNING_STEPS[0]), lapses: base.lapses + 1 }
  out[2] = review(2, hard)
  out[3] = review(3, good)
  out[4] = review(4, easy)
  return out
}

module.exports = { schedule, retrievability, intervalDays, RATINGS, LEARNING_STEPS, RELEARNING_STEPS, W, MINUTE, DAY }
