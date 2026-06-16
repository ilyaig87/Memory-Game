'use strict'

document.addEventListener('contextmenu', (event) => event.preventDefault())

let gGame = { isOn: false, shownCount: 0, markedCount: 0, secsPassed: 0 }
let gLevel = { SIZE: 4, MINES: 2 }
const BOMB = '💣'
const FLAG = '🚩'
let gBoard = []

function setLevel(size) {
  let level = size
  if (level === 4) {
    gLevel = { SIZE: 4, MINES: 2 }
  }
  if (level === 8) {
    gLevel = { SIZE: 8, MINES: 12 }
  }
  if (level === 12) {
    gLevel = { SIZE: 12, MINES: 30 }
  }
  return gLevel
}

function gameSize(size) {
  setLevel(size)
  gGame = {
    isOn: true,
    shownCount: size,
    markedCount: gLevel.MINES,
    flagsCount: 0,
    secsPassed: 0,
  }
  let gameBoard = createBoard(size)
  gBoard = gameBoard
  const mineContainer = document.querySelector('.mine-container')
  let strHtmls = ''
  for (let i = 0; i < gameBoard.length; i++) {
    for (let j = 0; j < gameBoard.length; j++) {
      let currCell = gameBoard[i][j]
      let bombClass = currCell.isMine ? 'bomb' : ''

      strHtmls += `<div id="item-${i}-${j}" class="cell cell-${i}-${j} ${bombClass} hide " onclick="cellClicked(this,${i},${j})" oncontextmenu="toggleFlag(event,this,${i},${j})"></div>`
      document.getElementById(
        `box`
      ).style.gridTemplateColumns = `repeat(${size}, 50px)`
      document.getElementById(
        'box'
      ).style.gridTemplateRows = `repeat(${size}, 50px)`
    }
  }
  mineContainer.innerHTML = strHtmls
  updateMinesLeft()
}

// Right-click toggles a flag on a hidden cell. Flags can't be opened by a
// left click, and the "Mines Left" counter tracks mines minus flags.
function toggleFlag(ev, elCell, i, j) {
  ev.preventDefault()
  if (!gGame.isOn) return
  const cell = gBoard[i][j]
  if (cell.isShown) return
  cell.isFlagged = !cell.isFlagged
  if (cell.isFlagged) {
    elCell.classList.add('flag')
    elCell.innerHTML = FLAG
    gGame.flagsCount++
  } else {
    elCell.classList.remove('flag')
    elCell.innerHTML = ''
    gGame.flagsCount--
  }
  updateMinesLeft()
}

function updateMinesLeft() {
  const count = document.querySelector('.mines-count span')
  if (count) count.innerHTML = gLevel.MINES - gGame.flagsCount
}

function cellClicked(elCell, i, j) {
  if (!gGame.isOn) return
  let gameBoard = gBoard
  let clickedCell = gameBoard[i][j]

  if (clickedCell.isShown || clickedCell.isFlagged) return
  checkLose(i, j)
  let num = (clickedCell.minesAroundCount = checkNeighbors(gBoard, i, j))
  elCell.classList.remove('hide')
  clickedCell.isShown = true

  if (!clickedCell.isMine) {
    elCell.innerHTML = num
  } else {
    elCell.innerHTML = BOMB
  }
  if (clickedCell.minesAroundCount === 0) {
    expandShown(gBoard, elCell, i, j)
  }
}

function createBoard(size) {
  let board = []
  for (let i = 0; i < size; i++) {
    let row = []
    for (let j = 0; j < size; j++) {
      row.push({
        minesAroundCount: 4,
        isShown: false,
        isMine: false,
        isMarked: false,
      })
    }
    board.push(row)
  }

  for (let i = 0; i < gLevel.MINES; i++) {
    let row, col
    do {
      row = Math.floor(Math.random() * size)
      col = Math.floor(Math.random() * size)
    } while (board[row][col].isMine === true)
    board[row][col].isMine = true
  }

  return board
}

function checkNeighbors(board, row, col) {
  let count = 0
  for (let i = row - 1; i <= row + 1; i++) {
    for (let j = col - 1; j <= col + 1; j++) {
      if (
        i >= 0 &&
        i < board.length &&
        j >= 0 &&
        j < board[0].length &&
        board[i][j].isMine
      ) {
        count++
      }
    }
  }
  return count
}

function expandShown(board, elCell, i, j) {}

function checkLose(i, j) {
  let elModal = document.querySelector('.modal-box')
  if (gBoard[i][j].isMine) {
    elModal.classList.add('display-none')
    gGame.isOn = false
  }
}

function restartGame() {
  let elModal = document.querySelector('.modal-box')
  elModal.classList.remove('display-none')
  gGame.isOn = true
}
