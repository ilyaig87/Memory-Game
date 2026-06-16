'use strict'

/* Single-page landing controller:
   - opens each game inside a fullscreen modal via a same-origin iframe
     (so every game keeps its own JS scope — no global collisions)
   - smooth-scroll nav with active-link highlighting (scrollspy)
   - mobile menu toggle
   No client-side routing: games load in-place, the top page never navigates. */

const GAMES = {
  memory:     { title: '🧠 Memory Game', src: 'assets/memory-game.html' },
  tictactoe:  { title: '⭕ Tic Tac Toe',  src: 'assets/tic-tac-toe.html' },
  minesweeper:{ title: '💣 Mine Sweeper', src: 'assets/mine-sweeper.html' },
  chess:      { title: '♟️ Chess',        src: 'assets/chess.html' },
  checkers:   { title: '⛀ Checkers',     src: 'assets/checkers.html' },
  backgammon: { title: '🎲 Backgammon',   src: 'assets/backgammon.html' },
}

/* ---------- Hash routing ----------
   Each game lives at the route #play/<key>, so the browser URL reflects
   the open game and the native Back button closes it. There is no server
   routing — everything stays in this single page. */
let currentGame = null

// Card click / programmatic open: navigate to the game's route.
function openGame(key) {
  if (!GAMES[key]) return
  location.hash = '#play/' + key
}

// Leaving a game: pop the route if we're on one (so Back history is clean),
// otherwise just make sure the modal is closed.
function backHome() {
  if (/^#play\//.test(location.hash)) {
    history.back()
  } else {
    actuallyClose()
  }
}

// Logo click: return home from a game, or scroll to top on the landing.
function goHome() {
  if (/^#play\//.test(location.hash)) backHome()
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}

// React to the URL: open the matching game, or close if it's not a game route.
function handleRoute() {
  const m = location.hash.match(/^#play\/(\w+)$/)
  if (m && GAMES[m[1]]) actuallyOpen(m[1])
  else actuallyClose()
}

function actuallyOpen(key) {
  if (currentGame === key) return
  currentGame = key
  const game = GAMES[key]
  const modal = document.getElementById('gameModal')
  const frame = document.getElementById('gameFrame')
  document.getElementById('gameModalTitle').textContent = game.title

  frame.classList.remove('ready')
  frame.onload = () => {
    // same-origin: hide the embedded page's own navbar for a clean view
    try {
      frame.contentDocument.documentElement.classList.add('embedded')
    } catch (e) {
      /* ignore cross-origin (shouldn't happen for local files) */
    }
    frame.classList.add('ready')
  }
  frame.src = game.src // fresh load each time so the game resets

  document.body.classList.add('modal-open')
  modal.classList.add('open')
  modal.setAttribute('aria-hidden', 'false')
}

function actuallyClose() {
  if (currentGame === null) return
  currentGame = null
  const modal = document.getElementById('gameModal')
  const frame = document.getElementById('gameFrame')
  modal.classList.remove('open')
  modal.setAttribute('aria-hidden', 'true')
  document.body.classList.remove('modal-open')
  setTimeout(() => { frame.src = 'about:blank' }, 320) // stop timers/AI loops
}

function toggleMenu() {
  document.body.classList.toggle('menu-opened')
}

window.addEventListener('hashchange', handleRoute)

document.addEventListener('DOMContentLoaded', () => {
  handleRoute() // honor a deep-link like ...#play/chess on first load

  // Escape leaves the current game
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') backHome()
  })

  // Smooth-scroll nav + close mobile menu after click
  document.querySelectorAll('a[data-scroll]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')
      if (id && id.startsWith('#')) {
        e.preventDefault()
        const el = document.querySelector(id)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
        document.body.classList.remove('menu-opened')
      }
    })
  })

  // Scrollspy: highlight the nav link of the section in view
  const links = [...document.querySelectorAll('a[data-scroll]')]
  const sections = links
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean)
  if ('IntersectionObserver' in window && sections.length) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            links.forEach((l) => l.classList.remove('active'))
            const active = links.find(
              (l) => l.getAttribute('href') === '#' + en.target.id
            )
            if (active) active.classList.add('active')
          }
        })
      },
      { rootMargin: '-45% 0px -50% 0px' }
    )
    sections.forEach((s) => obs.observe(s))
  }
})
