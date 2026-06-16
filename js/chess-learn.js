'use strict'

/* ============================================================
   Chess "Learn to Play" overlay.
   Self-contained: builds a piece picker, a 5x5 mini-board diagram
   showing each piece's moves/captures, and a list of special rules.
   No dependency on the chess engine in chess.js.
   ============================================================ */

// Each piece sits at the centre of a 5x5 grid (row 2, col 2). Move squares
// are listed as [dr, dc] offsets; sliding pieces list their full rays.
const N = 5
const CENTER = { r: 2, c: 2 }

function ray(dr, dc) {
  const out = []
  for (let s = 1; s < N; s++) out.push([dr * s, dc * s])
  return out
}

const LEARN_PIECES = [
  {
    key: 'K', glyph: '♔', name: 'King',
    desc: 'Moves one square in any direction. It can never move into check, and if it is attacked with no escape, the game is lost (checkmate).',
    moves: [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]],
  },
  {
    key: 'Q', glyph: '♕', name: 'Queen',
    desc: 'The most powerful piece — moves any number of squares in a straight line: horizontally, vertically or diagonally.',
    moves: [].concat(ray(-1,0), ray(1,0), ray(0,-1), ray(0,1), ray(-1,-1), ray(-1,1), ray(1,-1), ray(1,1)),
  },
  {
    key: 'R', glyph: '♖', name: 'Rook',
    desc: 'Moves any number of squares horizontally or vertically. Rooks also take part in castling with the king.',
    moves: [].concat(ray(-1,0), ray(1,0), ray(0,-1), ray(0,1)),
  },
  {
    key: 'B', glyph: '♗', name: 'Bishop',
    desc: 'Moves any number of squares diagonally. Each bishop stays on one colour of square for the whole game.',
    moves: [].concat(ray(-1,-1), ray(-1,1), ray(1,-1), ray(1,1)),
  },
  {
    key: 'N', glyph: '♘', name: 'Knight',
    desc: 'Moves in an “L”: two squares one way and one square at a right angle. The knight is the only piece that can jump over others.',
    moves: [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],
  },
  {
    key: 'P', glyph: '♙', name: 'Pawn',
    desc: 'Moves forward one square (or two from its starting square), but captures one square diagonally forward. Reaching the far end promotes it — usually to a queen.',
    moves: [[-1,0],[-2,0]],            // forward moves (green)
    captures: [[-1,-1],[-1,1]],        // diagonal captures (red)
  },
]

const LEARN_RULES = [
  ['Check & Checkmate', 'When the king is attacked it is “in check” and must escape. If there is no legal escape, it is checkmate and the game ends.'],
  ['Castling', 'A one-time king + rook move: the king slides two squares toward an unmoved rook and the rook hops to its other side. Not allowed through, into, or out of check.'],
  ['En passant', 'If a pawn advances two squares and lands beside an enemy pawn, that pawn may capture it “in passing”, but only on the very next move.'],
  ['Promotion', 'A pawn that reaches the far rank is promoted to any piece — almost always a queen.'],
  ['Stalemate', 'If the side to move has no legal move but is NOT in check, the game is a draw.'],
]

function buildDiagram(piece) {
  const wrap = document.getElementById('learnDiagram')
  wrap.innerHTML = ''
  const grid = document.createElement('div')
  grid.className = 'learn-grid'

  const moveSet = new Set((piece.moves || []).map(([dr, dc]) => dr + ',' + dc))
  const capSet = new Set((piece.captures || []).map(([dr, dc]) => dr + ',' + dc))

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cell = document.createElement('div')
      cell.className = 'learn-cell ' + ((r + c) % 2 ? 'd' : 'l')
      const dr = r - CENTER.r
      const dc = c - CENTER.c
      const kk = dr + ',' + dc
      if (r === CENTER.r && c === CENTER.c) {
        cell.classList.add('origin')
        cell.textContent = piece.glyph
      } else if (capSet.has(kk)) {
        cell.classList.add('cap')
      } else if (moveSet.has(kk)) {
        cell.classList.add('mv')
      }
      grid.appendChild(cell)
    }
  }
  wrap.appendChild(grid)
}

function selectLearnPiece(idx) {
  const piece = LEARN_PIECES[idx]
  document.querySelectorAll('#learnTabs .seg-btn').forEach((b, i) =>
    b.classList.toggle('active', i === idx)
  )
  buildDiagram(piece)
  document.getElementById('learnPieceName').textContent = piece.glyph + '  ' + piece.name
  document.getElementById('learnPieceDesc').textContent = piece.desc
}

function buildLearn() {
  const tabs = document.getElementById('learnTabs')
  tabs.innerHTML = ''
  LEARN_PIECES.forEach((p, i) => {
    const b = document.createElement('button')
    b.className = 'seg-btn' + (i === 0 ? ' active' : '')
    b.innerHTML = `<span class="tab-glyph">${p.glyph}</span> ${p.name}`
    b.addEventListener('click', () => selectLearnPiece(i))
    tabs.appendChild(b)
  })

  const rules = document.getElementById('learnRules')
  rules.innerHTML = ''
  LEARN_RULES.forEach(([t, d]) => {
    const li = document.createElement('li')
    li.innerHTML = `<strong>${t}.</strong> ${d}`
    rules.appendChild(li)
  })

  selectLearnPiece(0)
}

function openLearn() {
  document.getElementById('learnOverlay').classList.remove('hidden')
}
function closeLearn() {
  document.getElementById('learnOverlay').classList.add('hidden')
}

function initLearn() {
  buildLearn()
  document.getElementById('learnBtn').addEventListener('click', openLearn)
  document.getElementById('learnClose').addEventListener('click', closeLearn)
  // click backdrop or press Escape to close
  document.getElementById('learnOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'learnOverlay') closeLearn()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLearn()
  })
}

// scripts sit at the end of <body>, so the elements already exist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLearn)
} else {
  initLearn()
}
