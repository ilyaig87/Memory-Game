'use strict'

/* Shared UI helpers for the I-Games board games (Chess, Checkers, Backgammon).
   Expects markup:
   <div class="win-overlay hidden" id="winOverlay">
     <div class="win-card glass">
       <div class="win-emoji" id="winEmoji">🏆</div>
       <h2 class="win-title" id="winTitle"></h2>
       <p class="win-subtitle" id="winSubtitle"></p>
       <button class="game-btn game-btn--primary" id="winBtn">Play Again</button>
     </div>
   </div>
*/

const CONFETTI_COLORS = ['#ffd166', '#38e1ff', '#ff5fa2', '#38e08a', '#f4a52b', '#a78bfa']

function showWin(title, subtitle = '', emoji = '🏆', onReplay) {
  const overlay = document.getElementById('winOverlay')
  if (!overlay) return
  document.getElementById('winEmoji').textContent = emoji
  document.getElementById('winTitle').textContent = title
  document.getElementById('winSubtitle').textContent = subtitle
  overlay.classList.remove('hidden')

  const btn = document.getElementById('winBtn')
  if (btn) {
    btn.onclick = () => {
      hideWin()
      if (typeof onReplay === 'function') onReplay()
    }
  }
  launchConfetti()
}

function hideWin() {
  const overlay = document.getElementById('winOverlay')
  if (overlay) overlay.classList.add('hidden')
}

function launchConfetti(count = 90) {
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div')
    c.className = 'confetti'
    c.style.left = Math.random() * 100 + 'vw'
    c.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    c.style.animationDuration = 2.2 + Math.random() * 1.8 + 's'
    c.style.animationDelay = Math.random() * 0.6 + 's'
    c.style.transform = `rotate(${Math.random() * 360}deg)`
    document.body.appendChild(c)
    setTimeout(() => c.remove(), 4600)
  }
}

/* Flash + pulse a status banner with an optional danger style. */
function setStatus(text, { danger = false, pulse = true } = {}) {
  const el = document.getElementById('status')
  if (!el) return
  el.textContent = text
  el.classList.toggle('danger', danger)
  if (pulse) {
    el.classList.remove('pulse')
    // force reflow so the animation can replay
    void el.offsetWidth
    el.classList.add('pulse')
  }
}

/* Toggle the .active state across a segmented control. */
function activateSeg(groupEl, btnEl) {
  groupEl.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'))
  btnEl.classList.add('active')
}

function toggleMenu() {
  document.body.classList.toggle('menu-opened')
}
