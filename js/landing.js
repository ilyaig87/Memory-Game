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

function openGame(key) {
  const game = GAMES[key]
  if (!game) return
  const modal = document.getElementById('gameModal')
  const frame = document.getElementById('gameFrame')
  const title = document.getElementById('gameModalTitle')

  title.textContent = game.title
  frame.classList.remove('ready')

  frame.onload = () => {
    // same-origin: hide the embedded page's own navbar for a clean modal view
    try {
      frame.contentDocument.documentElement.classList.add('embedded')
    } catch (e) {
      /* ignore cross-origin (shouldn't happen for local files) */
    }
    frame.classList.add('ready')
  }
  // reload fresh each time so the game resets
  frame.src = game.src

  document.body.classList.add('modal-open')
  modal.classList.add('open')
  modal.setAttribute('aria-hidden', 'false')
}

function closeGame() {
  const modal = document.getElementById('gameModal')
  const frame = document.getElementById('gameFrame')
  modal.classList.remove('open')
  modal.setAttribute('aria-hidden', 'true')
  document.body.classList.remove('modal-open')
  // unload the game to stop timers/AI loops
  setTimeout(() => { frame.src = 'about:blank' }, 320)
}

function toggleMenu() {
  document.body.classList.toggle('menu-opened')
}

document.addEventListener('DOMContentLoaded', () => {
  // Close modal on Escape or backdrop bar click
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeGame()
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
