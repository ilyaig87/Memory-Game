'use strict'

/* ============================================================
   Backgammon engine + UI — vanilla JS, no dependencies.
   Uses shared helpers from js/utils/game-ui.js:
     showWin, hideWin, setStatus, activateSeg, toggleMenu

   --- Board convention -------------------------------------
   Points are 1..24. We store them in an array `board[0..25]`:
     index 1..24  = the 24 points (positive = White checkers,
                    negative = Black checkers, abs = count)
     index 0      = unused placeholder
     index 25     = unused placeholder
   Off / bar counts are kept separately.

   WHITE = the human ("you"), light checkers.
     - moves DOWN in point number (from 24 toward 1)
     - home board = points 1..6, bears off past point 1
     - a die `d` moves a white checker from point p to p-d
     - enters from the bar onto point 25-d  (i.e. the 24..19 quad)
   BLACK = the AI ("computer"), dark checkers.
     - moves UP in point number (from 1 toward 24)
     - home board = points 19..24, bears off past point 24
     - a die `d` moves a black checker from point p to p+d
     - enters from the bar onto point d  (i.e. the 1..6 quad)

   This mirror convention keeps the two players symmetric, which
   makes the move generator and AI heuristic easy to reason about.
   ============================================================ */

const WHITE = 1
const BLACK = -1

/* ---------- Game state ---------- */
let state = null
let difficulty = 'normal'
let selected = null      // selected source: point number or 'bar'
let inputLocked = false  // true during AI turn / animations

function freshState() {
  // Standard starting position (White perspective, points 1..24).
  const board = new Array(26).fill(0)
  board[24] = 2 * WHITE
  board[13] = 5 * WHITE
  board[8] = 3 * WHITE
  board[6] = 5 * WHITE
  // Black is the mirror (point p ↔ 25-p)
  board[1] = 2 * BLACK
  board[12] = 5 * BLACK
  board[17] = 3 * BLACK
  board[19] = 5 * BLACK

  return {
    board,
    bar: { [WHITE]: 0, [BLACK]: 0 },
    off: { [WHITE]: 0, [BLACK]: 0 },
    turn: WHITE,
    dice: [],        // [{value, used}]
    rolled: false,
    over: false,
  }
}

/* ============================================================
   RULES / MOVE GENERATION
   ============================================================ */

// Where does player `color` enter from the bar with die `d`?
function entryPoint(color, d) {
  return color === WHITE ? 25 - d : d
}

// The home-board point range for a color.
function homeRange(color) {
  return color === WHITE ? [1, 6] : [19, 24]
}

// Direction of travel (sign added to point index).
function dir(color) {
  return color === WHITE ? -1 : 1
}

// Does `color` own the point (>=1 of its checkers)?
function ownsPoint(board, color, p) {
  if (p < 1 || p > 24) return false
  return Math.sign(board[p]) === color && Math.abs(board[p]) > 0
}

// Can `color` land on point p? (empty, own, or exactly one enemy = hit)
function canLand(board, color, p) {
  if (p < 1 || p > 24) return false
  const v = board[p]
  if (v === 0) return true
  if (Math.sign(v) === color) return true
  return Math.abs(v) === 1 // exactly one enemy -> hit allowed
}

// Are ALL of color's checkers in the home board (so bearing off is legal)?
function allHome(board, bar, color) {
  if (bar[color] > 0) return false
  const [lo, hi] = homeRange(color)
  for (let p = 1; p <= 24; p++) {
    if (Math.sign(board[p]) === color && (p < lo || p > hi)) return false
  }
  return true
}

// For bearing off: the highest-pip occupied point in own home (the point
// farthest from bearing off). White bears toward 1 so "highest pip" = point 6;
// Black bears toward 24 so "highest pip" = point 19.
function highestHomePoint(board, color) {
  const [lo, hi] = homeRange(color)
  if (color === WHITE) {
    for (let p = hi; p >= lo; p--) if (ownsPoint(board, color, p)) return p
  } else {
    for (let p = lo; p <= hi; p++) if (ownsPoint(board, color, p)) return p
  }
  return null
}

// pips required to bear a checker off from point p
function bearOffPips(color, p) {
  return color === WHITE ? p : 25 - p
}

/* Generate all single moves legal for `color` with one die value `d`,
   given the current board/bar. Returns array of move objects:
     { from: <point|'bar'>, to: <point|'off'>, die: d, hit: bool } */
function singleMoves(board, bar, color, d) {
  const moves = []

  // Must enter from the bar first if any checker is there.
  if (bar[color] > 0) {
    const ep = entryPoint(color, d)
    if (canLand(board, color, ep)) {
      moves.push({ from: 'bar', to: ep, die: d, hit: ownsPoint(board, -color, ep) && Math.abs(board[ep]) === 1 })
    }
    return moves
  }

  const step = dir(color)
  const bearing = allHome(board, bar, color)

  for (let p = 1; p <= 24; p++) {
    if (!ownsPoint(board, color, p)) continue
    const to = p + step * d

    if (to >= 1 && to <= 24) {
      if (canLand(board, color, to)) {
        moves.push({ from: p, to, die: d, hit: Math.sign(board[to]) === -color && Math.abs(board[to]) === 1 })
      }
    } else if (bearing) {
      // bearing off: checker would leave the board
      const need = bearOffPips(color, p)
      if (need === d) {
        moves.push({ from: p, to: 'off', die: d, hit: false })
      } else if (need < d) {
        // overshoot only allowed if no checker on a higher point
        const hi = highestHomePoint(board, color)
        if (hi === p) moves.push({ from: p, to: 'off', die: d, hit: false })
      }
    }
  }
  return moves
}

/* Apply a single move to a (mutable) state-like object {board,bar,off}.
   Returns the same object (mutated). */
function applyMove(s, color, mv) {
  if (mv.from === 'bar') {
    s.bar[color]--
  } else {
    s.board[mv.from] -= color
  }
  if (mv.to === 'off') {
    s.off[color]++
  } else {
    if (mv.hit) {
      // send the lone enemy checker to the bar
      s.board[mv.to] = 0
      s.bar[-color]++
    }
    s.board[mv.to] += color
  }
  return s
}

// Deep-ish clone of the parts of state we mutate during search.
function cloneLite(s) {
  return {
    board: s.board.slice(),
    bar: { [WHITE]: s.bar[WHITE], [BLACK]: s.bar[BLACK] },
    off: { [WHITE]: s.off[WHITE], [BLACK]: s.off[BLACK] },
  }
}

/* Enumerate every legal *full* move sequence for the given dice values.
   Handles two-die ordering and doubles (4 of the same).
   Returns { sequences: [[mv,...], ...], maxLen: n }.
   Per the rules, only sequences using the maximum possible number of
   dice are legal. We compute all sequences then filter to maxLen. */
function enumerateSequences(s, color, diceValues) {
  const results = []

  function recurse(cur, remaining, seq) {
    let any = false
    for (let i = 0; i < remaining.length; i++) {
      const d = remaining[i]
      const ms = singleMoves(cur.board, cur.bar, color, d)
      for (const mv of ms) {
        any = true
        const next = cloneLite(cur)
        applyMove(next, color, mv)
        const rest = remaining.slice(0, i).concat(remaining.slice(i + 1))
        recurse(next, rest, seq.concat([mv]))
      }
      // For non-doubles, only the two distinct orderings matter; trying each
      // unique value index covers both. Avoid duplicate work for equal values.
      if (i + 1 < remaining.length && remaining[i + 1] === d) break
    }
    if (!any) results.push(seq)
  }

  recurse(cloneLite(s), diceValues.slice(), [])

  // Keep only the longest sequences (must use as many dice as possible).
  let maxLen = 0
  for (const r of results) if (r.length > maxLen) maxLen = r.length
  let seqs = results.filter((r) => r.length === maxLen)

  // Special rule: if max length is 1 (can only play one die) and the two
  // dice differ, you must play the higher die if it is playable alone.
  if (maxLen === 1 && diceValues.length === 2 && diceValues[0] !== diceValues[1]) {
    const hi = Math.max(diceValues[0], diceValues[1])
    const hiPlayable = seqs.some((r) => r[0].die === hi)
    if (hiPlayable) seqs = seqs.filter((r) => r[0].die === hi)
  }

  // De-duplicate identical resulting positions to trim AI search a little.
  return { sequences: seqs, maxLen }
}

// All legal *first-step* moves available right now (for the human UI).
// We only surface a source/dest as legal if it can be part of some
// maximal sequence — but for responsiveness we use the simpler rule that
// a first move is legal if it appears as the first move of any maximal seq.
function legalFirstMoves(s, color) {
  const diceValues = activeDiceValues(s)
  if (diceValues.length === 0) return []
  const { sequences } = enumerateSequences(s, color, diceValues)
  const seen = new Set()
  const out = []
  for (const seq of sequences) {
    if (seq.length === 0) continue
    const mv = seq[0]
    const key = `${mv.from}>${mv.to}>${mv.die}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(mv)
    }
  }
  return out
}

// Dice values still available to play this turn.
function activeDiceValues(s) {
  return s.dice.filter((d) => !d.used).map((d) => d.value)
}

/* ============================================================
   AI — enumerate maximal sequences, evaluate resulting position,
   pick the best. Heuristic considers pip race, blots & shot
   exposure, made points / priming, home anchors, bar, and borne off.
   ============================================================ */

// Total pip count for a color (lower = closer to winning).
function pipCount(s, color) {
  let pips = s.bar[color] * 25
  for (let p = 1; p <= 24; p++) {
    if (Math.sign(s.board[p]) === color) {
      pips += Math.abs(s.board[p]) * bearOffPips(color, p) // distance to bear off
    }
  }
  return pips
}

// Count direct-shot probability that `opp` can hit `color`'s blots.
// For each blot, sum the chance an opponent checker within 1..6 pips behind
// can reach it on a single die (rough but effective shot model).
function blotExposure(s, color) {
  const opp = -color
  let risk = 0
  for (let p = 1; p <= 24; p++) {
    if (Math.sign(s.board[p]) === color && Math.abs(s.board[p]) === 1) {
      // a blot at p — how many opponent checkers can hit it with one die?
      for (let d = 1; d <= 6; d++) {
        // opp moves in dir(opp); a hitter sits `d` pips before p
        const src = p - dir(opp) * d
        if (ownsPoint(s.board, opp, src)) {
          // ~ probability weight of rolling this distance (incl. via combos approx)
          risk += 1
        }
      }
      // blots deep in our outfield are scarier; weight by how far from safety
      risk += 0.3
    }
  }
  return risk
}

// Number of "made" points (>=2 checkers) a color holds, weighted by location.
function structureScore(s, color) {
  const [lo, hi] = homeRange(color)
  let made = 0
  let homeMade = 0
  let primeRun = 0
  let bestPrime = 0
  // walk points in travel order to detect consecutive blocks (a prime)
  const order = []
  for (let p = 1; p <= 24; p++) order.push(p)
  for (let p = 1; p <= 24; p++) {
    if (Math.sign(s.board[p]) === color && Math.abs(s.board[p]) >= 2) {
      made++
      if (p >= lo && p <= hi) homeMade++
      primeRun++
      if (primeRun > bestPrime) bestPrime = primeRun
    } else {
      primeRun = 0
    }
  }
  return made * 1.0 + homeMade * 1.5 + bestPrime * 1.2
}

// Anchors in the opponent's home board (defensive value).
function anchorScore(s, color) {
  const [lo, hi] = homeRange(-color)
  let a = 0
  for (let p = lo; p <= hi; p++) {
    if (Math.sign(s.board[p]) === color && Math.abs(s.board[p]) >= 2) a++
  }
  return a
}

/* Position evaluation from `color`'s point of view. Higher = better. */
function evaluate(s, color, weights) {
  const w = weights
  const myPips = pipCount(s, color)
  const oppPips = pipCount(s, -color)

  const score =
    (oppPips - myPips) * w.pip +
    s.off[color] * w.off -
    s.off[-color] * w.off +
    s.bar[color] * w.bar -
    s.bar[-color] * w.bar * 0.6 +
    structureScore(s, color) * w.structure -
    structureScore(s, -color) * w.structure * 0.5 +
    anchorScore(s, color) * w.anchor -
    blotExposure(s, color) * w.blot +
    blotExposure(s, -color) * w.blot * 0.5

  return score
}

function aiWeights(level) {
  // Tunable heuristic weights per difficulty.
  if (level === 'easy') {
    return { pip: 1.0, off: 4, bar: -8, structure: 0.3, anchor: 0.5, blot: 0.4, random: 6 }
  }
  if (level === 'hard') {
    return { pip: 1.0, off: 8, bar: -14, structure: 2.0, anchor: 2.0, blot: 3.0, random: 0 }
  }
  // normal
  return { pip: 1.0, off: 6, bar: -10, structure: 1.2, anchor: 1.2, blot: 1.6, random: 0 }
}

// Choose the best move sequence for the AI (BLACK).
function chooseAiSequence(s) {
  const dv = activeDiceValues(s)
  const { sequences } = enumerateSequences(s, BLACK, dv)
  if (sequences.length === 0) return []

  const w = aiWeights(difficulty)
  let best = null
  let bestScore = -Infinity
  for (const seq of sequences) {
    const sim = cloneLite(s)
    for (const mv of seq) applyMove(sim, BLACK, mv)
    let sc = evaluate(sim, BLACK, w)
    if (w.random > 0) sc += (Math.random() - 0.5) * w.random
    if (sc > bestScore) {
      bestScore = sc
      best = seq
    }
  }
  return best || []
}

/* ============================================================
   RENDERING
   ============================================================ */

const boardEl = () => document.getElementById('board')

/* Board layout mapping point number -> visual quadrant + index.
   Top-left quad shows points 13..18 (left→right),
   Top-right quad shows points 19..24,
   Bottom-left quad shows points 12..7 (left→right),
   Bottom-right quad shows points 6..1.
   This is a standard board layout with point 24 top-right-most and
   point 1 bottom-right-most, the white home in the bottom-right. */
const QUAD_POINTS = {
  tl: [13, 14, 15, 16, 17, 18],
  tr: [19, 20, 21, 22, 23, 24],
  bl: [12, 11, 10, 9, 8, 7],
  br: [6, 5, 4, 3, 2, 1],
}

function render() {
  const root = boardEl()
  root.innerHTML = ''

  const legal = (!inputLocked && state.turn === WHITE && state.rolled && !state.over)
    ? legalFirstMoves(state, WHITE)
    : []
  const legalSources = new Set(legal.map((m) => m.from))
  let legalDests = new Set()
  if (selected !== null) {
    legalDests = new Set(
      legal.filter((m) => m.from === selected).map((m) => m.to)
    )
  }

  const makeQuad = (cls, isTop) => {
    const q = document.createElement('div')
    q.className = 'bg-quad ' + cls
    QUAD_POINTS[cls].forEach((p) => {
      q.appendChild(makePoint(p, isTop, legalSources, legalDests))
    })
    return q
  }

  root.appendChild(makeQuad('tl', true))
  root.appendChild(makeBar(legalSources))
  root.appendChild(makeQuad('tr', true))
  root.appendChild(makeQuad('bl', false))
  root.appendChild(makeQuad('br', false))

  renderDice()
  renderBarOff()
}

function makePoint(p, isTop, legalSources, legalDests) {
  const el = document.createElement('div')
  const colorClass = (p % 2 === 0) ? 'c-light' : 'c-dark'
  el.className = `bg-point ${isTop ? 'down' : 'up'} ${colorClass}`
  el.dataset.point = String(p)

  const label = document.createElement('span')
  label.className = 'pt-label'
  label.textContent = p
  el.appendChild(label)

  // checkers on this point
  const v = state.board[p]
  const n = Math.abs(v)
  const who = Math.sign(v) === WHITE ? 'w' : 'b'
  const shown = Math.min(n, 5)
  for (let i = 0; i < shown; i++) {
    const c = document.createElement('div')
    c.className = `checker ${who}`
    if (i === shown - 1 && n > 5) {
      const badge = document.createElement('span')
      badge.className = 'count-badge'
      badge.textContent = n
      c.appendChild(badge)
    }
    el.appendChild(c)
  }

  // highlights / interaction
  if (selected === p) el.classList.add('selected')
  if (legalSources.has(p)) {
    el.classList.add('src-ok')
    el.addEventListener('click', () => onSelectSource(p))
  }
  if (legalDests.has(p)) {
    el.classList.add('dest-ok')
    el.addEventListener('click', () => onChooseDest(p))
  }
  return el
}

function makeBar(legalSources) {
  const bar = document.createElement('div')
  bar.className = 'bg-bar'

  // top zone = black bar checkers (black enters into 1..6, drawn bottom),
  // we simply show white on top, black on bottom for visual separation.
  const top = document.createElement('div')
  top.className = 'bar-zone top'
  for (let i = 0; i < state.bar[BLACK]; i++) {
    const c = document.createElement('div')
    c.className = 'bar-checker b'
    top.appendChild(c)
  }

  const bottom = document.createElement('div')
  bottom.className = 'bar-zone bottom'
  for (let i = 0; i < state.bar[WHITE]; i++) {
    const c = document.createElement('div')
    c.className = 'bar-checker w'
    bottom.appendChild(c)
  }

  // White bar is the human's; allow selecting it when it's a legal source.
  if (legalSources.has('bar')) {
    bottom.classList.add('selectable')
    if (selected === 'bar') bottom.classList.add('selected')
    bottom.addEventListener('click', () => onSelectSource('bar'))
  }

  bar.appendChild(top)
  bar.appendChild(bottom)
  return bar
}

function renderDice() {
  const el = document.getElementById('dice')
  el.innerHTML = ''
  if (!state.dice.length) {
    el.innerHTML = '<span style="color:var(--ink-soft);font-size:.85rem;">—</span>'
    return
  }
  state.dice.forEach((d) => {
    el.appendChild(makeDie(d.value, d.used))
  })
}

// pip layouts per face value
const PIP_LAYOUT = {
  1: ['p-mc'],
  2: ['p-tl', 'p-br'],
  3: ['p-tl', 'p-mc', 'p-br'],
  4: ['p-tl', 'p-tr', 'p-bl', 'p-br'],
  5: ['p-tl', 'p-tr', 'p-mc', 'p-bl', 'p-br'],
  6: ['p-tl', 'p-tr', 'p-ml', 'p-mr', 'p-bl', 'p-br'],
}

function makeDie(value, used) {
  const die = document.createElement('div')
  die.className = 'die rolling' + (used ? ' used' : '')
  PIP_LAYOUT[value].forEach((pos) => {
    const pip = document.createElement('div')
    pip.className = 'pip ' + pos
    die.appendChild(pip)
  })
  setTimeout(() => die.classList.remove('rolling'), 500)
  return die
}

function renderBarOff() {
  const el = document.getElementById('barOff')
  el.innerHTML = ''
  const chip = (label, dotClass) => {
    const c = document.createElement('span')
    c.className = 'chip'
    const dot = document.createElement('span')
    dot.className = 'chip-dot ' + dotClass
    c.appendChild(dot)
    const t = document.createElement('span')
    t.textContent = label
    c.appendChild(t)
    return c
  }
  el.appendChild(chip(`Bar ${state.bar[WHITE]}`, 'w'))
  el.appendChild(chip(`Off ${state.off[WHITE]}/15`, 'w'))
  el.appendChild(chip(`Bar ${state.bar[BLACK]}`, 'b'))
  el.appendChild(chip(`Off ${state.off[BLACK]}/15`, 'b'))
}

/* ============================================================
   PLAYER INTERACTION
   ============================================================ */

function onSelectSource(src) {
  if (inputLocked || state.turn !== WHITE) return
  selected = (selected === src) ? null : src
  render()
}

function onChooseDest(dest) {
  if (inputLocked || state.turn !== WHITE || selected === null) return
  const legal = legalFirstMoves(state, WHITE)
  // find a legal move from selected -> dest, preferring the smaller die so
  // the player keeps flexibility (any matching die is rule-legal here).
  const candidates = legal.filter((m) => m.from === selected && m.to === dest)
  if (!candidates.length) return
  candidates.sort((a, b) => a.die - b.die)
  const mv = candidates[0]

  doMove(WHITE, mv)
  selected = null
  // mark the matching die as used
  consumeDie(mv.die)
  render()
  maybeEndPlayerTurn()
}

function consumeDie(value) {
  const d = state.dice.find((x) => !x.used && x.value === value)
  if (d) d.used = true
}

function doMove(color, mv) {
  applyMove(state, color, mv)
  if (state.off[color] >= 15) endGame(color)
}

// After a player move, see if they have any moves left; if not, end turn.
function maybeEndPlayerTurn() {
  if (state.over) return
  const dv = activeDiceValues(state)
  if (dv.length === 0) return finishPlayerTurn()
  const remaining = legalFirstMoves(state, WHITE)
  if (remaining.length === 0) {
    setStatus('No moves left — passing to computer', {})
    return finishPlayerTurn()
  }
  setStatus('Your move — pick a checker', {})
}

function finishPlayerTurn() {
  selected = null
  state.dice = []
  state.rolled = false
  state.turn = BLACK
  render()
  setRollEnabled(false)
  setTimeout(aiTurn, 650)
}

/* ============================================================
   AI TURN (animated)
   ============================================================ */

function aiTurn() {
  if (state.over) return
  inputLocked = true
  setRollEnabled(false)
  setStatus('Computer is thinking…', {})

  // roll for the AI
  rollDiceInto(state)
  render()

  setTimeout(() => {
    const seq = chooseAiSequence(state)
    if (!seq || seq.length === 0) {
      setStatus('Computer has no moves — your turn', {})
      return setTimeout(endAiTurn, 800)
    }
    playAiSequence(seq, 0)
  }, 600)
}

// Play the AI's chosen moves one at a time so the user can watch.
function playAiSequence(seq, i) {
  if (state.over) return
  if (i >= seq.length) {
    return setTimeout(endAiTurn, 500)
  }
  setStatus('Computer is moving…', {})
  const mv = seq[i]
  doMove(BLACK, mv)
  consumeDie(mv.die)
  render()
  if (state.over) return
  setTimeout(() => playAiSequence(seq, i + 1), 700)
}

function endAiTurn() {
  if (state.over) return
  inputLocked = false
  state.dice = []
  state.rolled = false
  state.turn = WHITE
  selected = null
  render()
  setRollEnabled(true)
  setStatus('Your turn — roll the dice', {})
}

/* ============================================================
   DICE / TURN CONTROL
   ============================================================ */

function rollDiceInto(s) {
  const a = 1 + Math.floor(Math.random() * 6)
  const b = 1 + Math.floor(Math.random() * 6)
  if (a === b) {
    s.dice = [a, a, a, a].map((v) => ({ value: v, used: false }))
  } else {
    s.dice = [a, b].map((v) => ({ value: v, used: false }))
  }
  s.rolled = true
}

function onRoll() {
  if (inputLocked || state.over || state.turn !== WHITE || state.rolled) return
  rollDiceInto(state)
  setRollEnabled(false)
  render()

  // If the player can't move at all, auto-pass.
  const moves = legalFirstMoves(state, WHITE)
  if (moves.length === 0) {
    setStatus('No legal moves — passing turn', { danger: true })
    setTimeout(finishPlayerTurn, 1100)
  } else {
    setStatus('Your move — pick a checker', {})
  }
}

function setRollEnabled(on) {
  const btn = document.getElementById('rollBtn')
  if (btn) btn.disabled = !on
}

/* ============================================================
   END / NEW GAME
   ============================================================ */

function endGame(winner) {
  state.over = true
  inputLocked = true
  setRollEnabled(false)
  const loser = -winner
  // gammon / backgammon detection (loser has borne off none)
  let kind = ''
  if (state.off[loser] === 0) {
    // backgammon if loser still has a checker on the bar or in winner's home
    const [lo, hi] = homeRange(winner)
    let inWinnerHome = state.bar[loser] > 0
    for (let p = lo; p <= hi; p++) if (Math.sign(state.board[p]) === loser) inWinnerHome = true
    kind = inWinnerHome ? 'Backgammon! (triple)' : 'Gammon! (double)'
  }
  if (winner === WHITE) {
    setStatus('You win!', {})
    showWin('You win! 🏆', kind || 'You bore off all 15 checkers.', '🏆', newGame)
  } else {
    setStatus('Computer wins', { danger: true })
    showWin('Computer wins', kind || 'The computer bore off all 15 checkers.', '🤖', newGame)
  }
}

function newGame() {
  hideWin()
  state = freshState()
  selected = null
  inputLocked = false
  render()
  setRollEnabled(true)
  setStatus('Your turn — roll the dice', {})
}

/* ============================================================
   WIRING
   ============================================================ */

function init() {
  document.getElementById('rollBtn').addEventListener('click', onRoll)
  document.getElementById('newGameBtn').addEventListener('click', newGame)

  const seg = document.getElementById('diffSeg')
  seg.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activateSeg(seg, btn)
      difficulty = btn.dataset.level
    })
  })

  newGame()
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
}

/* Export for node-based testing (no effect in browser). */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    freshState, singleMoves, enumerateSequences, applyMove, cloneLite,
    pipCount, evaluate, aiWeights, chooseAiSequence, allHome, canLand,
    WHITE, BLACK,
  }
}
