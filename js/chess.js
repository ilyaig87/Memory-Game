'use strict'

/* ============================================================
   Chess — self-contained engine + UI for I-Games.
   - Full legal move generation (castling, en passant, promotion).
   - Check / checkmate / stalemate detection.
   - Minimax + alpha-beta AI with material + piece-square evaluation.
   Board model:
     board[r][c] is null or a 2-char string: side ('w'|'b') + type
     ('P','N','B','R','Q','K'). Row 0 = rank 8 (top), row 7 = rank 1.
     Files a..h map to columns 0..7. White plays from the bottom.
   ============================================================ */

;(function () {
  /* ---------- Glyphs ---------- */
  var GLYPH = {
    wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
    bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
  }

  /* ---------- DOM ---------- */
  var boardEl, statusEl, capturedEl, moveListEl
  var modeSeg, diffSeg, newGameBtn, undoBtn

  /* ---------- Game state ---------- */
  var board          // 8x8 array
  var turn           // 'w' | 'b'
  var castling       // { wK, wQ, bK, bQ } booleans = still allowed
  var enPassant      // {r,c} target square or null
  var selected       // {r,c} of selected piece or null
  var legalForSel    // array of legal move objects for selected piece
  var history        // stack of snapshots for undo
  var moveSAN        // list of notation strings for the move list
  var captured       // { w: [glyphs], b: [glyphs] } captured by each side
  var lastMove       // {from:{r,c}, to:{r,c}} or null
  var mode           // 'ai' | 'pvp'
  var aiDepth        // search depth
  var thinking       // input lock while AI computes
  var gameOver

  /* ---------- Setup ---------- */
  function initialBoard () {
    var back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    var b = []
    for (var r = 0; r < 8; r++) b.push([null, null, null, null, null, null, null, null])
    for (var c = 0; c < 8; c++) {
      b[0][c] = 'b' + back[c]
      b[1][c] = 'bP'
      b[6][c] = 'wP'
      b[7][c] = 'w' + back[c]
    }
    return b
  }

  function newGame () {
    board = initialBoard()
    turn = 'w'
    castling = { wK: true, wQ: true, bK: true, bQ: true }
    enPassant = null
    selected = null
    legalForSel = []
    history = []
    moveSAN = []
    captured = { w: [], b: [] }
    lastMove = null
    thinking = false
    gameOver = false
    hideWin()
    render()
    announceTurn()
  }

  /* ---------- Helpers ---------- */
  function inside (r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8 }
  function sideOf (p) { return p ? p[0] : null }
  function typeOf (p) { return p ? p[1] : null }
  function enemy (s) { return s === 'w' ? 'b' : 'w' }

  function cloneBoard (b) {
    var n = []
    for (var r = 0; r < 8; r++) n.push(b[r].slice())
    return n
  }

  /* ---------- Pseudo-legal move generation (no check filter) ----------
     Returns move objects: {from:{r,c}, to:{r,c}, piece, capture, flags...}
     flags: promo (true), enpassant (true), castle ('K'|'Q'). */
  var KNIGHT_D = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
  var KING_D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
  var ROOK_D = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  var BISHOP_D = [[-1, -1], [-1, 1], [1, -1], [1, 1]]

  function genPseudo (b, side, cast, ep) {
    var moves = []
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = b[r][c]
        if (!p || sideOf(p) !== side) continue
        var t = typeOf(p)
        if (t === 'P') genPawn(b, r, c, side, ep, moves)
        else if (t === 'N') genStep(b, r, c, side, KNIGHT_D, moves)
        else if (t === 'K') { genStep(b, r, c, side, KING_D, moves); genCastle(b, r, c, side, cast, moves) }
        else if (t === 'R') genSlide(b, r, c, side, ROOK_D, moves)
        else if (t === 'B') genSlide(b, r, c, side, BISHOP_D, moves)
        else if (t === 'Q') genSlide(b, r, c, side, ROOK_D.concat(BISHOP_D), moves)
      }
    }
    return moves
  }

  function addMove (moves, fr, fc, tr, tc, b, extra) {
    var m = { from: { r: fr, c: fc }, to: { r: tr, c: tc }, piece: b[fr][fc], capture: b[tr][tc] }
    if (extra) for (var k in extra) m[k] = extra[k]
    moves.push(m)
  }

  function genStep (b, r, c, side, dirs, moves) {
    for (var i = 0; i < dirs.length; i++) {
      var tr = r + dirs[i][0], tc = c + dirs[i][1]
      if (!inside(tr, tc)) continue
      var tp = b[tr][tc]
      if (!tp || sideOf(tp) !== side) addMove(moves, r, c, tr, tc, b)
    }
  }

  function genSlide (b, r, c, side, dirs, moves) {
    for (var i = 0; i < dirs.length; i++) {
      var tr = r + dirs[i][0], tc = c + dirs[i][1]
      while (inside(tr, tc)) {
        var tp = b[tr][tc]
        if (!tp) { addMove(moves, r, c, tr, tc, b) }
        else { if (sideOf(tp) !== side) addMove(moves, r, c, tr, tc, b); break }
        tr += dirs[i][0]; tc += dirs[i][1]
      }
    }
  }

  function genPawn (b, r, c, side, ep, moves) {
    var dir = side === 'w' ? -1 : 1            // white moves up (toward row 0)
    var startRow = side === 'w' ? 6 : 1
    var promoRow = side === 'w' ? 0 : 7
    var one = r + dir
    if (inside(one, c) && !b[one][c]) {
      pawnPush(moves, r, c, one, c, b, one === promoRow)
      var two = r + 2 * dir
      if (r === startRow && !b[two][c]) addMove(moves, r, c, two, c, b, { dbl: true })
    }
    // captures (incl. en passant)
    for (var dc = -1; dc <= 1; dc += 2) {
      var tc = c + dc
      if (!inside(one, tc)) continue
      var tp = b[one][tc]
      if (tp && sideOf(tp) === enemy(side)) pawnPush(moves, r, c, one, tc, b, one === promoRow)
      else if (ep && ep.r === one && ep.c === tc) addMove(moves, r, c, one, tc, b, { enpassant: true })
    }
  }

  function pawnPush (moves, fr, fc, tr, tc, b, isPromo) {
    if (isPromo) addMove(moves, fr, fc, tr, tc, b, { promo: 'Q' })
    else addMove(moves, fr, fc, tr, tc, b)
  }

  function genCastle (b, r, c, side, cast, moves) {
    var rank = side === 'w' ? 7 : 0
    if (r !== rank || c !== 4) return
    if (isAttacked(b, rank, 4, enemy(side))) return // king currently in check
    // king side
    if (cast[side + 'K'] && !b[rank][5] && !b[rank][6] && b[rank][7] === side + 'R') {
      if (!isAttacked(b, rank, 5, enemy(side)) && !isAttacked(b, rank, 6, enemy(side))) {
        addMove(moves, r, c, rank, 6, b, { castle: 'K' })
      }
    }
    // queen side
    if (cast[side + 'Q'] && !b[rank][3] && !b[rank][2] && !b[rank][1] && b[rank][0] === side + 'R') {
      if (!isAttacked(b, rank, 3, enemy(side)) && !isAttacked(b, rank, 2, enemy(side))) {
        addMove(moves, r, c, rank, 2, b, { castle: 'Q' })
      }
    }
  }

  /* ---------- Attack detection ----------
     Is square (r,c) attacked by `bySide`? Used for check/castling. */
  function isAttacked (b, r, c, bySide) {
    // pawns: a pawn of bySide attacks diagonally toward its forward dir.
    var pdir = bySide === 'w' ? -1 : 1 // white pawns capture upward
    for (var dc = -1; dc <= 1; dc += 2) {
      var pr = r + pdir, pc = c + dc
      if (inside(pr, pc) && b[pr][pc] === bySide + 'P') return true
    }
    // knights
    for (var i = 0; i < KNIGHT_D.length; i++) {
      var nr = r + KNIGHT_D[i][0], nc = c + KNIGHT_D[i][1]
      if (inside(nr, nc) && b[nr][nc] === bySide + 'N') return true
    }
    // king (adjacent)
    for (i = 0; i < KING_D.length; i++) {
      var kr = r + KING_D[i][0], kc = c + KING_D[i][1]
      if (inside(kr, kc) && b[kr][kc] === bySide + 'K') return true
    }
    // sliding: rook/queen orthogonal, bishop/queen diagonal
    if (slideHit(b, r, c, ROOK_D, bySide, 'R', 'Q')) return true
    if (slideHit(b, r, c, BISHOP_D, bySide, 'B', 'Q')) return true
    return false
  }

  function slideHit (b, r, c, dirs, bySide, t1, t2) {
    for (var i = 0; i < dirs.length; i++) {
      var tr = r + dirs[i][0], tc = c + dirs[i][1]
      while (inside(tr, tc)) {
        var p = b[tr][tc]
        if (p) {
          if (sideOf(p) === bySide && (typeOf(p) === t1 || typeOf(p) === t2)) return true
          break
        }
        tr += dirs[i][0]; tc += dirs[i][1]
      }
    }
    return false
  }

  function kingPos (b, side) {
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) if (b[r][c] === side + 'K') return { r: r, c: c }
    return null
  }

  function inCheck (b, side) {
    var k = kingPos(b, side)
    return k ? isAttacked(b, k.r, k.c, enemy(side)) : false
  }

  /* ---------- Apply a move to a board (mutates copy state) ----------
     Returns a fresh {board, castling, enPassant} for search; the live
     game uses applyToGame which also tracks history/captures/notation. */
  function simulate (b, cast, m) {
    var nb = cloneBoard(b)
    var nc = { wK: cast.wK, wQ: cast.wQ, bK: cast.bK, bQ: cast.bQ }
    var side = sideOf(m.piece)
    var nep = null
    nb[m.to.r][m.to.c] = m.piece
    nb[m.from.r][m.from.c] = null
    if (m.enpassant) {
      // captured pawn sits on the from-rank, to-file
      nb[m.from.r][m.to.c] = null
    }
    if (m.promo) nb[m.to.r][m.to.c] = side + m.promo
    if (m.castle === 'K') { nb[m.to.r][5] = side + 'R'; nb[m.to.r][7] = null }
    if (m.castle === 'Q') { nb[m.to.r][3] = side + 'R'; nb[m.to.r][0] = null }
    if (m.dbl) nep = { r: (m.from.r + m.to.r) / 2, c: m.from.c }
    // update castling rights
    if (typeOf(m.piece) === 'K') { nc[side + 'K'] = false; nc[side + 'Q'] = false }
    if (typeOf(m.piece) === 'R') {
      if (m.from.c === 0) nc[side + 'Q'] = false
      if (m.from.c === 7) nc[side + 'K'] = false
    }
    // capturing a rook on its home square removes that right
    var es = enemy(side)
    var erank = es === 'w' ? 7 : 0
    if (m.to.r === erank && m.to.c === 0) nc[es + 'Q'] = false
    if (m.to.r === erank && m.to.c === 7) nc[es + 'K'] = false
    return { board: nb, castling: nc, enPassant: nep }
  }

  /* Legal moves = pseudo moves that don't leave own king in check. */
  function legalMoves (b, side, cast, ep) {
    var pseudo = genPseudo(b, side, cast, ep)
    var legal = []
    for (var i = 0; i < pseudo.length; i++) {
      var sim = simulate(b, cast, pseudo[i])
      if (!inCheck(sim.board, side)) legal.push(pseudo[i])
    }
    return legal
  }

  /* ---------- Notation (lightweight algebraic) ---------- */
  function sqName (r, c) { return 'abcdefgh'[c] + (8 - r) }
  function moveToSAN (m, b, side) {
    if (m.castle === 'K') return 'O-O'
    if (m.castle === 'Q') return 'O-O-O'
    var t = typeOf(m.piece)
    var pieceLetter = t === 'P' ? '' : t
    var cap = (m.capture || m.enpassant) ? 'x' : ''
    var dest = sqName(m.to.r, m.to.c)
    var from = ''
    if (t === 'P' && cap) from = 'abcdefgh'[m.from.c]
    var promo = m.promo ? '=' + m.promo : ''
    // check / mate suffix
    var sim = simulate(b, castling, m)
    var oppMoves = legalMoves(sim.board, enemy(side), sim.castling, sim.enPassant)
    var suffix = ''
    if (inCheck(sim.board, enemy(side))) suffix = oppMoves.length ? '+' : '#'
    return pieceLetter + from + cap + dest + promo + suffix
  }

  /* ---------- Apply move to the live game ---------- */
  function snapshot () {
    return {
      board: cloneBoard(board),
      turn: turn,
      castling: { wK: castling.wK, wQ: castling.wQ, bK: castling.bK, bQ: castling.bQ },
      enPassant: enPassant ? { r: enPassant.r, c: enPassant.c } : null,
      lastMove: lastMove ? { from: lastMove.from, to: lastMove.to } : null,
      capW: captured.w.slice(),
      capB: captured.b.slice(),
      san: moveSAN.slice()
    }
  }

  function restore (s) {
    board = cloneBoard(s.board)
    turn = s.turn
    castling = { wK: s.castling.wK, wQ: s.castling.wQ, bK: s.castling.bK, bQ: s.castling.bQ }
    enPassant = s.enPassant ? { r: s.enPassant.r, c: s.enPassant.c } : null
    lastMove = s.lastMove ? { from: s.lastMove.from, to: s.lastMove.to } : null
    captured = { w: s.capW.slice(), b: s.capB.slice() }
    moveSAN = s.san.slice()
    gameOver = false
  }

  function applyMove (m) {
    history.push(snapshot())
    var side = turn
    var san = moveToSAN(m, board, side)
    // record capture glyph (the side that captures collects the enemy glyph)
    var capturedPiece = m.capture
    if (m.enpassant) capturedPiece = enemy(side) + 'P'
    if (capturedPiece) captured[side].push(GLYPH[capturedPiece])
    // mutate live board via simulate result
    var sim = simulate(board, castling, m)
    board = sim.board
    castling = sim.castling
    enPassant = sim.enPassant
    lastMove = { from: m.from, to: m.to }
    moveSAN.push(san)
    turn = enemy(side)
    selected = null
    legalForSel = []
  }

  /* ---------- Game flow after a move ---------- */
  function afterMove () {
    render()
    var moves = legalMoves(board, turn, castling, enPassant)
    if (moves.length === 0) {
      gameOver = true
      if (inCheck(board, turn)) {
        var winner = enemy(turn) === 'w' ? 'White' : 'Black'
        setStatus('Checkmate — ' + winner + ' wins!', { danger: true })
        showWin('Checkmate — ' + winner + ' wins!', 'A decisive finish.', '🏆', newGame)
      } else {
        setStatus('Stalemate — Draw', {})
        showWin('Stalemate — Draw', 'No legal moves left.', '🤝', newGame)
      }
      return
    }
    announceTurn()
    // hand off to AI if it's the computer's turn
    if (mode === 'ai' && turn === 'b' && !gameOver) {
      thinking = true
      setStatus('Computer is thinking…', { pulse: false })
      setTimeout(aiMove, 220)
    }
  }

  function announceTurn () {
    var name = turn === 'w' ? 'White' : 'Black'
    if (inCheck(board, turn)) setStatus(name + ' — Check!', { danger: true })
    else setStatus(name + ' to move', {})
  }

  /* ============================================================
     AI: minimax with alpha-beta pruning.
     White is the human (maximising for white in eval terms),
     so the computer (black) minimises the white-positive score.
     ============================================================ */
  var VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 }

  // Piece-square tables (from white's perspective, row 0 = rank 8).
  var PST = {
    P: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5, 5, 10, 25, 25, 10, 5, 5],
      [0, 0, 0, 20, 20, 0, 0, 0],
      [5, -5, -10, 0, 0, -10, -5, 5],
      [5, 10, 10, -20, -20, 10, 10, 5],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    N: [
      [-50, -40, -30, -30, -30, -30, -40, -50],
      [-40, -20, 0, 0, 0, 0, -20, -40],
      [-30, 0, 10, 15, 15, 10, 0, -30],
      [-30, 5, 15, 20, 20, 15, 5, -30],
      [-30, 0, 15, 20, 20, 15, 0, -30],
      [-30, 5, 10, 15, 15, 10, 5, -30],
      [-40, -20, 0, 5, 5, 0, -20, -40],
      [-50, -40, -30, -30, -30, -30, -40, -50]
    ],
    B: [
      [-20, -10, -10, -10, -10, -10, -10, -20],
      [-10, 0, 0, 0, 0, 0, 0, -10],
      [-10, 0, 5, 10, 10, 5, 0, -10],
      [-10, 5, 5, 10, 10, 5, 5, -10],
      [-10, 0, 10, 10, 10, 10, 0, -10],
      [-10, 10, 10, 10, 10, 10, 10, -10],
      [-10, 5, 0, 0, 0, 0, 5, -10],
      [-20, -10, -10, -10, -10, -10, -10, -20]
    ],
    R: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [5, 10, 10, 10, 10, 10, 10, 5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [0, 0, 0, 5, 5, 0, 0, 0]
    ],
    Q: [
      [-20, -10, -10, -5, -5, -10, -10, -20],
      [-10, 0, 0, 0, 0, 0, 0, -10],
      [-10, 0, 5, 5, 5, 5, 0, -10],
      [-5, 0, 5, 5, 5, 5, 0, -5],
      [0, 0, 5, 5, 5, 5, 0, -5],
      [-10, 5, 5, 5, 5, 5, 0, -10],
      [-10, 0, 5, 0, 0, 0, 0, -10],
      [-20, -10, -10, -5, -5, -10, -10, -20]
    ],
    K: [
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-20, -30, -30, -40, -40, -30, -30, -20],
      [-10, -20, -20, -20, -20, -20, -20, -10],
      [20, 20, 0, 0, 0, 0, 20, 20],
      [20, 30, 10, 0, 0, 10, 30, 20]
    ]
  }

  // Positive = good for white. Material + position.
  function evaluate (b) {
    var score = 0
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = b[r][c]
        if (!p) continue
        var t = typeOf(p)
        var val = VALUE[t]
        if (sideOf(p) === 'w') {
          score += val + PST[t][r][c]
        } else {
          // mirror the table vertically for black
          score -= val + PST[t][7 - r][c]
        }
      }
    }
    return score
  }

  // Order moves so captures come first => better alpha-beta cuts.
  function orderMoves (moves) {
    moves.sort(function (a, bm) {
      var av = a.capture ? VALUE[typeOf(a.capture)] : 0
      var bv = bm.capture ? VALUE[typeOf(bm.capture)] : 0
      return bv - av
    })
    return moves
  }

  function minimax (b, cast, ep, side, depth, alpha, beta) {
    if (depth === 0) return evaluate(b)
    var moves = legalMoves(b, side, cast, ep)
    if (moves.length === 0) {
      // checkmate or stalemate at this node
      if (inCheck(b, side)) return side === 'w' ? -100000 - depth : 100000 + depth
      return 0
    }
    orderMoves(moves)
    if (side === 'w') {
      var best = -Infinity
      for (var i = 0; i < moves.length; i++) {
        var s = simulate(b, cast, moves[i])
        var v = minimax(s.board, s.castling, s.enPassant, 'b', depth - 1, alpha, beta)
        if (v > best) best = v
        if (best > alpha) alpha = best
        if (beta <= alpha) break
      }
      return best
    } else {
      var worst = Infinity
      for (var j = 0; j < moves.length; j++) {
        var s2 = simulate(b, cast, moves[j])
        var v2 = minimax(s2.board, s2.castling, s2.enPassant, 'w', depth - 1, alpha, beta)
        if (v2 < worst) worst = v2
        if (worst < beta) beta = worst
        if (beta <= alpha) break
      }
      return worst
    }
  }

  // Computer (black) chooses the move minimising the white-positive score.
  function aiMove () {
    var moves = legalMoves(board, 'b', castling, enPassant)
    if (moves.length === 0) { thinking = false; return }
    orderMoves(moves)
    var bestMove = null
    var bestScore = Infinity
    for (var i = 0; i < moves.length; i++) {
      var s = simulate(board, castling, moves[i])
      var score = minimax(s.board, s.castling, s.enPassant, 'w', aiDepth - 1, -Infinity, Infinity)
      // tiny random tie-break keeps games from being identical
      score += (Math.random() - 0.5) * 0.5
      if (score < bestScore) { bestScore = score; bestMove = moves[i] }
    }
    applyMove(bestMove)
    thinking = false
    afterMove()
  }

  /* ============================================================
     Rendering & interaction
     ============================================================ */
  function render () {
    boardEl.innerHTML = ''
    var checkSide = inCheck(board, turn) ? turn : null
    var checkK = checkSide ? kingPos(board, checkSide) : null
    var targetMap = {} // "r,c" -> move (for selected piece)
    for (var i = 0; i < legalForSel.length; i++) {
      var mv = legalForSel[i]
      targetMap[mv.to.r + ',' + mv.to.c] = mv
    }
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var sq = document.createElement('div')
        sq.className = 'sq ' + ((r + c) % 2 === 0 ? 'sq--light' : 'sq--dark')
        sq.dataset.r = r
        sq.dataset.c = c
        var p = board[r][c]
        if (p) {
          sq.textContent = GLYPH[p]
          sq.classList.add(sideOf(p) === 'w' ? 'piece-w' : 'piece-b')
          // mark grabbable pieces for the active human
          if (!thinking && !gameOver && sideOf(p) === turn && (mode === 'pvp' || turn === 'w')) {
            sq.classList.add('movable')
          }
        }
        if (selected && selected.r === r && selected.c === c) sq.classList.add('selected')
        if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))) {
          sq.classList.add('last-move')
        }
        if (lastMove && lastMove.to.r === r && lastMove.to.c === c) sq.classList.add('just-moved')
        if (checkK && checkK.r === r && checkK.c === c) sq.classList.add('in-check')
        // legal-move indicator
        if (targetMap[r + ',' + c]) {
          var dot = document.createElement('div')
          dot.className = 'cell-dot' + (board[r][c] || targetMap[r + ',' + c].enpassant ? ' capture' : '')
          sq.appendChild(dot)
        }
        sq.addEventListener('click', onSquareClick)
        boardEl.appendChild(sq)
      }
    }
    renderCaptured()
    renderMoves()
  }

  function renderCaptured () {
    capturedEl.innerHTML = ''
    // show pieces white captured then pieces black captured
    var all = captured.w.concat(captured.b)
    for (var i = 0; i < all.length; i++) {
      var span = document.createElement('span')
      span.textContent = all[i]
      capturedEl.appendChild(span)
    }
  }

  function renderMoves () {
    var html = ''
    for (var i = 0; i < moveSAN.length; i += 2) {
      var num = (i / 2) + 1
      html += num + '. ' + moveSAN[i] + (moveSAN[i + 1] ? ' ' + moveSAN[i + 1] : '') + '  '
    }
    moveListEl.innerHTML = html
    moveListEl.scrollTop = moveListEl.scrollHeight
  }

  function onSquareClick (e) {
    if (thinking || gameOver) return
    if (mode === 'ai' && turn === 'b') return // computer's turn
    var sq = e.currentTarget
    var r = +sq.dataset.r
    var c = +sq.dataset.c
    var p = board[r][c]

    // clicking a legal destination for the selected piece -> move
    if (selected) {
      for (var i = 0; i < legalForSel.length; i++) {
        var mv = legalForSel[i]
        if (mv.to.r === r && mv.to.c === c) {
          applyMove(mv)
          afterMove()
          return
        }
      }
    }
    // (re)select own piece
    if (p && sideOf(p) === turn) {
      selected = { r: r, c: c }
      legalForSel = legalMoves(board, turn, castling, enPassant).filter(function (m) {
        return m.from.r === r && m.from.c === c
      })
      render()
      return
    }
    // empty / enemy click with nothing valid -> clear selection
    selected = null
    legalForSel = []
    render()
  }

  function undo () {
    if (thinking || history.length === 0) return
    // In AI mode, undo both plies so it's the human's turn again.
    var pops = (mode === 'ai' && history.length >= 2) ? 2 : 1
    var snap
    for (var i = 0; i < pops; i++) {
      snap = history.pop()
      if (!snap) break
    }
    if (snap) restore(snap)
    selected = null
    legalForSel = []
    hideWin()
    render()
    announceTurn()
  }

  /* ---------- Controls ---------- */
  function bindControls () {
    modeSeg.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-btn')
      if (!btn) return
      activateSeg(modeSeg, btn)
      mode = btn.dataset.mode
      newGame()
    })
    diffSeg.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-btn')
      if (!btn) return
      activateSeg(diffSeg, btn)
      aiDepth = +btn.dataset.depth
    })
    newGameBtn.addEventListener('click', newGame)
    undoBtn.addEventListener('click', undo)
  }

  /* ---------- Boot ---------- */
  function boot () {
    boardEl = document.getElementById('board')
    statusEl = document.getElementById('status')
    capturedEl = document.getElementById('captured')
    moveListEl = document.getElementById('moveList')
    modeSeg = document.getElementById('modeSeg')
    diffSeg = document.getElementById('diffSeg')
    newGameBtn = document.getElementById('newGameBtn')
    undoBtn = document.getElementById('undoBtn')

    mode = 'ai'
    aiDepth = 3
    bindControls()
    newGame()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
