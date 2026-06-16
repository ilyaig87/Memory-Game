'use strict'

/* ============================================================
   SMART Checkers — English/American draughts (8x8, mandatory
   captures, multi-jumps, kings) with a minimax + alpha-beta AI.
   Self-contained vanilla JS. Relies on game-ui.js globals:
   showWin, hideWin, setStatus, activateSeg.
   ============================================================ */

/* ---------- Board model ----------
   The board is an array of 64 ints indexed row*8+col, row 0 at the
   TOP. Pieces only ever sit on dark squares ((row+col) odd).
   RED is the human player (bottom, rows 5-7), moving UP (row-).
   BLACK is the AI (top, rows 0-2), moving DOWN (row+).
   Piece encoding:
     0 = empty
     1 = red man, 2 = red king
     3 = black man, 4 = black king
*/
const EMPTY = 0
const RED_MAN = 1
const RED_KING = 2
const BLK_MAN = 3
const BLK_KING = 4

const RED = 'red'
const BLACK = 'black'

const isRed = (p) => p === RED_MAN || p === RED_KING
const isBlack = (p) => p === BLK_MAN || p === BLK_KING
const isKing = (p) => p === RED_KING || p === BLK_KING
const colorOf = (p) => (p === EMPTY ? null : isRed(p) ? RED : BLACK)

const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8
const isDark = (r, c) => (r + c) % 2 === 1

/* ---------- Game state ---------- */
let board = []
let turn = RED            // whose turn it is
let mode = 'ai'           // 'ai' or 'pvp'
let aiDepth = 5
let selected = null       // index of the selected square
let legalForSelected = [] // moves available from the selected square
let chainPiece = null     // index of a piece mid multi-jump (must continue)
let locked = false        // input locked (AI thinking / game over)
let gameOver = false
let history = []          // stack of snapshots for Undo
let captured = { red: [], black: [] } // pieces removed, for the chips display
let lastMove = null       // {from, to} for board highlight

const boardEl = document.getElementById('board')
const capturedEl = document.getElementById('captured')

/* ---------- Setup ---------- */
function initialBoard() {
  const b = new Array(64).fill(EMPTY)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (!isDark(r, c)) continue
      if (r < 3) b[r * 8 + c] = BLK_MAN      // black at top
      else if (r > 4) b[r * 8 + c] = RED_MAN // red at bottom
    }
  }
  return b
}

/* ============================================================
   MOVE GENERATION
   A move is { from, to, captures: [idx...], jump: bool }.
   Mandatory-capture rule: if ANY capture exists for the side to
   move, only captures are returned. Multi-jumps are expanded into
   full chains so each generated jump-move lists every captured idx.
   ============================================================ */

// Diagonal directions a piece may travel: men move forward only.
function directions(piece) {
  if (piece === RED_MAN) return [[-1, -1], [-1, 1]]          // red moves up
  if (piece === BLK_MAN) return [[1, -1], [1, 1]]            // black moves down
  // kings move all four diagonals
  return [[-1, -1], [-1, 1], [1, -1], [1, 1]]
}

// Generate every capture chain starting from one piece on a board.
// Returns full-chain moves (multi-jumps collapsed into one move).
function captureMovesFrom(b, idx) {
  const piece = b[idx]
  if (piece === EMPTY) return []
  const me = colorOf(piece)
  const results = []

  // Depth-first search over successive jumps. We mutate a working
  // copy of the board to "make" each jump, then recurse.
  function dfs(curBoard, curIdx, curPiece, capturedList, fromOrigin) {
    const r = Math.floor(curIdx / 8)
    const c = curIdx % 8
    let extended = false

    for (const [dr, dc] of directions(curPiece)) {
      const mr = r + dr      // square being jumped over
      const mc = c + dc
      const lr = r + dr * 2  // landing square
      const lc = c + dc * 2
      if (!inBounds(lr, lc)) continue
      const midIdx = mr * 8 + mc
      const landIdx = lr * 8 + lc
      const midPiece = curBoard[midIdx]
      // must jump an ENEMY into an EMPTY square beyond
      if (midPiece === EMPTY || colorOf(midPiece) === me) continue
      if (curBoard[landIdx] !== EMPTY) continue
      if (capturedList.includes(midIdx)) continue // can't recapture same piece

      extended = true
      const next = curBoard.slice()
      next[curIdx] = EMPTY
      next[midIdx] = EMPTY
      // promotion check: a man reaching the far row becomes a king,
      // and per standard rules the multi-jump turn ENDS on crowning.
      let landed = curPiece
      let crowned = false
      if (curPiece === RED_MAN && lr === 0) { landed = RED_KING; crowned = true }
      else if (curPiece === BLK_MAN && lr === 7) { landed = BLK_KING; crowned = true }
      next[landIdx] = landed

      const chain = capturedList.concat(midIdx)
      if (!crowned) {
        // try to continue jumping with the same (now-moved) piece
        const before = results.length
        dfs(next, landIdx, landed, chain, fromOrigin)
        // if no further jump was possible, record this terminal chain
        if (results.length === before) {
          results.push({ from: fromOrigin, to: landIdx, captures: chain, jump: true })
        }
      } else {
        results.push({ from: fromOrigin, to: landIdx, captures: chain, jump: true })
      }
    }
    return extended
  }

  dfs(b.slice(), idx, piece, [], idx)
  return results
}

// Quiet (non-capturing) single-step moves from one piece.
function quietMovesFrom(b, idx) {
  const piece = b[idx]
  if (piece === EMPTY) return []
  const r = Math.floor(idx / 8)
  const c = idx % 8
  const out = []
  for (const [dr, dc] of directions(piece)) {
    const nr = r + dr
    const nc = c + dc
    if (!inBounds(nr, nc)) continue
    const nIdx = nr * 8 + nc
    if (b[nIdx] === EMPTY) out.push({ from: idx, to: nIdx, captures: [], jump: false })
  }
  return out
}

// All legal moves for a color, enforcing mandatory captures.
function legalMoves(b, color) {
  const caps = []
  const quiets = []
  for (let i = 0; i < 64; i++) {
    if (colorOf(b[i]) !== color) continue
    const c = captureMovesFrom(b, i)
    if (c.length) caps.push(...c)
    else quiets.push(...quietMovesFrom(b, i))
  }
  // if any capture exists anywhere, captures are forced
  return caps.length ? caps : quiets
}

// Apply a move to a board copy. Returns { board, crownedAt|null }.
function applyMove(b, move) {
  const nb = b.slice()
  let piece = nb[move.from]
  nb[move.from] = EMPTY
  for (const cap of move.captures) nb[cap] = EMPTY
  // promotion
  const toRow = Math.floor(move.to / 8)
  let crownedAt = null
  if (piece === RED_MAN && toRow === 0) { piece = RED_KING; crownedAt = move.to }
  else if (piece === BLK_MAN && toRow === 7) { piece = BLK_KING; crownedAt = move.to }
  nb[move.to] = piece
  return { board: nb, crownedAt }
}

/* ============================================================
   AI — minimax with alpha-beta pruning.
   Maximizing player = BLACK (the AI). Evaluation is from BLACK's
   perspective (positive = good for AI).
   ============================================================ */

const KING_VALUE = 1.75 // a king is worth ~1.75 men
const MAN_VALUE = 1.0

function evaluate(b) {
  let score = 0
  let redCount = 0
  let blackCount = 0
  for (let i = 0; i < 64; i++) {
    const p = b[i]
    if (p === EMPTY) continue
    const r = Math.floor(i / 8)
    const c = i % 8
    if (isBlack(p)) {
      blackCount++
      score += isKing(p) ? KING_VALUE : MAN_VALUE
      // advancement: black men want larger rows (closer to promotion)
      if (!isKing(p)) score += 0.05 * r
      // back-row defense: keep pieces on home row 0 to block promotion
      if (r === 0) score += 0.12
      // center control
      if (c >= 2 && c <= 5 && r >= 2 && r <= 5) score += 0.04
    } else {
      redCount++
      score -= isKing(p) ? KING_VALUE : MAN_VALUE
      if (!isKing(p)) score -= 0.05 * (7 - r)
      if (r === 7) score -= 0.12
      if (c >= 2 && c <= 5 && r >= 2 && r <= 5) score -= 0.04
    }
  }
  // mobility: more available moves is a small advantage
  const blackMob = legalMoves(b, BLACK).length
  const redMob = legalMoves(b, RED).length
  score += 0.03 * (blackMob - redMob)
  // decisive states
  if (redCount === 0) score += 1000
  if (blackCount === 0) score -= 1000
  return score
}

function minimax(b, depth, alpha, beta, maximizing) {
  const color = maximizing ? BLACK : RED
  const moves = legalMoves(b, color)
  // terminal: no moves means the side to move loses
  if (moves.length === 0) return maximizing ? -1000 - depth : 1000 + depth
  if (depth === 0) return evaluate(b)

  if (maximizing) {
    let best = -Infinity
    for (const m of moves) {
      const { board: nb } = applyMove(b, m)
      const val = minimax(nb, depth - 1, alpha, beta, false)
      if (val > best) best = val
      if (best > alpha) alpha = best
      if (alpha >= beta) break // beta cutoff
    }
    return best
  } else {
    let best = Infinity
    for (const m of moves) {
      const { board: nb } = applyMove(b, m)
      const val = minimax(nb, depth - 1, alpha, beta, true)
      if (val < best) best = val
      if (best < beta) beta = best
      if (alpha >= beta) break // alpha cutoff
    }
    return best
  }
}

// Pick the AI's best move (BLACK maximizes).
function chooseAiMove() {
  const moves = legalMoves(board, BLACK)
  if (!moves.length) return null
  let best = -Infinity
  let bestMoves = []
  for (const m of moves) {
    const { board: nb } = applyMove(board, m)
    const val = minimax(nb, aiDepth - 1, -Infinity, Infinity, false)
    if (val > best) {
      best = val
      bestMoves = [m]
    } else if (val === best) {
      bestMoves.push(m)
    }
  }
  // tie-break randomly so the AI isn't perfectly repetitive
  return bestMoves[Math.floor(Math.random() * bestMoves.length)]
}

/* ============================================================
   RENDERING
   ============================================================ */
function render() {
  boardEl.innerHTML = ''
  // human-controlled colors: in AI mode only RED; in pvp both
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const idx = r * 8 + c
      const sq = document.createElement('div')
      sq.className = 'sq ' + (isDark(r, c) ? 'sq--dark' : 'sq--light')
      sq.dataset.idx = idx

      if (lastMove && (lastMove.from === idx || lastMove.to === idx)) {
        sq.classList.add('lastmove')
      }
      if (selected === idx) sq.classList.add('selected')

      const piece = board[idx]
      if (piece !== EMPTY) {
        const disc = document.createElement('div')
        disc.className = 'disc ' + (isRed(piece) ? 'disc--red' : 'disc--black')
        if (isKing(piece)) {
          disc.classList.add('king')
          const crown = document.createElement('span')
          crown.className = 'crown'
          crown.textContent = '♔'
          disc.appendChild(crown)
        }
        if (lastMove && lastMove.crownedAt === idx) disc.classList.add('just-crowned')
        // mark a clickable own piece
        if (isMovableColor(colorOf(piece))) sq.classList.add('own')
        sq.appendChild(disc)
      }

      // move hint dots on legal destinations of the selected piece
      const hint = legalForSelected.find((m) => m.to === idx)
      if (hint) {
        const dot = document.createElement('div')
        dot.className = 'cell-dot'
        if (hint.jump) sq.classList.add('capture-hint')
        sq.appendChild(dot)
      }

      sq.addEventListener('click', () => onSquareClick(idx))
      boardEl.appendChild(sq)
    }
  }
  renderCaptured()
}

// Whose pieces the current human may click right now.
function isMovableColor(color) {
  if (gameOver || locked) return false
  if (color !== turn) return false
  if (mode === 'ai' && color === BLACK) return false // AI controls black
  return true
}

function renderCaptured() {
  capturedEl.innerHTML = ''
  // a chip per captured disc, colored by who was taken
  const makeChip = (cls, count) => {
    for (let i = 0; i < count; i++) {
      const chip = document.createElement('span')
      chip.className = 'disc ' + cls
      chip.style.cssText =
        'width:22px;height:22px;display:inline-block;border-radius:50%;'
      capturedEl.appendChild(chip)
    }
  }
  makeChip('disc--red', captured.red.length)
  makeChip('disc--black', captured.black.length)
}

/* ============================================================
   INTERACTION
   ============================================================ */
function onSquareClick(idx) {
  if (locked || gameOver) return
  const piece = board[idx]

  // If a destination is clicked, try to move there.
  if (selected !== null) {
    const move = legalForSelected.find((m) => m.to === idx)
    if (move) {
      humanMove(move)
      return
    }
  }

  // Mid multi-jump: only the chaining piece may be (re)selected.
  if (chainPiece !== null) {
    if (idx === chainPiece) return
    return // ignore clicks elsewhere until the chain is resolved
  }

  // Otherwise select one of the current player's pieces.
  if (piece !== EMPTY && isMovableColor(colorOf(piece))) {
    selectPiece(idx)
  } else {
    // deselect on empty / invalid click
    selected = null
    legalForSelected = []
    render()
  }
}

function selectPiece(idx) {
  const all = legalMoves(board, turn)
  // only this piece's moves; mandatory-capture filtering already done
  const mine = all.filter((m) => m.from === idx)
  if (!mine.length) {
    // piece has no legal move (e.g. a capture is forced elsewhere)
    selected = null
    legalForSelected = []
    render()
    return
  }
  selected = idx
  legalForSelected = mine
  render()
}

// Execute a single ply chosen by a human. Handles the multi-jump
// chain: our generator already collapses chains into one move, so a
// click on a chain endpoint resolves the whole sequence at once.
function humanMove(move) {
  pushHistory()
  performMove(move)

  selected = null
  legalForSelected = []
  chainPiece = null

  if (checkEnd()) { render(); return }

  // hand over the turn
  turn = turn === RED ? BLACK : RED
  render()

  if (mode === 'ai' && turn === BLACK) {
    runAi()
  } else {
    setStatus(turn === RED ? 'Red to move' : 'Black to move')
  }
}

// Mutate the live game state for a move and record captures.
function performMove(move) {
  const mover = colorOf(board[move.from])
  // record captured pieces for the chips display
  for (const cap of move.captures) {
    const capColor = colorOf(board[cap])
    if (capColor === RED) captured.red.push(1)
    else if (capColor === BLACK) captured.black.push(1)
  }
  const { board: nb, crownedAt } = applyMove(board, move)
  board = nb
  lastMove = { from: move.from, to: move.to, crownedAt }
  void mover
}

/* ---------- AI turn ---------- */
function runAi() {
  locked = true
  setStatus('Computer is thinking…', { pulse: true })
  // defer so the "thinking" status paints before the heavy search
  setTimeout(() => {
    const move = chooseAiMove()
    if (!move) { // AI has no moves -> human wins
      locked = false
      checkEnd()
      render()
      return
    }
    performMove(move)
    if (checkEnd()) { locked = false; render(); return }
    turn = RED
    locked = false
    render()
    setStatus('Your move')
  }, 220)
}

/* ============================================================
   END-OF-GAME
   ============================================================ */
function checkEnd() {
  const redMoves = legalMoves(board, RED).length
  const blackMoves = legalMoves(board, BLACK).length
  const redPieces = board.some(isRed)
  const blackPieces = board.some(isBlack)

  let winner = null
  if (!redPieces || redMoves === 0) winner = BLACK
  else if (!blackPieces || blackMoves === 0) winner = RED

  if (winner) {
    gameOver = true
    locked = true
    if (mode === 'ai') {
      if (winner === RED) {
        setStatus('You win! 🏆')
        showWin('You win!', 'You out-jumped the computer.', '🏆', newGame)
      } else {
        setStatus('Computer wins', { danger: true })
        showWin('Computer wins', 'The machine crowned more kings.', '🤖', newGame)
      }
    } else {
      const who = winner === RED ? 'Red' : 'Black'
      setStatus(`${who} wins! 🏆`)
      showWin(`${who} wins!`, 'Great match — rematch?', '🏆', newGame)
    }
    return true
  }
  return false
}

/* ============================================================
   UNDO — snapshot the full state before each human ply. In AI mode
   one Undo rewinds BOTH the AI reply and the player move (back to the
   player's last decision point).
   ============================================================ */
function snapshot() {
  return {
    board: board.slice(),
    turn,
    captured: { red: captured.red.slice(), black: captured.black.slice() },
    lastMove: lastMove ? { ...lastMove } : null,
  }
}
function pushHistory() {
  history.push(snapshot())
}
function restore(s) {
  board = s.board.slice()
  turn = s.turn
  captured = { red: s.captured.red.slice(), black: s.captured.black.slice() }
  lastMove = s.lastMove ? { ...s.lastMove } : null
}
function undo() {
  if (locked && !gameOver) return
  if (!history.length) return
  const s = history.pop()
  restore(s)
  selected = null
  legalForSelected = []
  chainPiece = null
  gameOver = false
  locked = false
  hideWin()
  render()
  setStatus(turn === RED ? 'Your move' : 'Black to move')
}

/* ============================================================
   NEW GAME / WIRING
   ============================================================ */
function newGame() {
  board = initialBoard()
  turn = RED
  selected = null
  legalForSelected = []
  chainPiece = null
  locked = false
  gameOver = false
  history = []
  captured = { red: [], black: [] }
  lastMove = null
  hideWin()
  render()
  setStatus(mode === 'ai' ? 'Your move' : 'Red to move')
}

function wire() {
  document.getElementById('newGameBtn').addEventListener('click', newGame)
  document.getElementById('undoBtn').addEventListener('click', undo)

  const modeSeg = document.getElementById('modeSeg')
  modeSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn')
    if (!btn) return
    activateSeg(modeSeg, btn)
    mode = btn.dataset.mode
    newGame()
  })

  const diffSeg = document.getElementById('diffSeg')
  diffSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn')
    if (!btn) return
    activateSeg(diffSeg, btn)
    aiDepth = parseInt(btn.dataset.depth, 10)
  })
}

wire()
newGame()
