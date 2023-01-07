'use strict'

document.addEventListener('contextmenu', (event) => event.preventDefault())

let gGame = { isOn: false, shownCount: 0, markedCount: 0, secsPassed: 0 }
let gLevel = { SIZE: 4, MINES: 2 }
const BOMB = '💣'
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

      strHtmls += `<div id="item-${i}-${j}" class="cell cell-${i}-${j} ${bombClass} hide " onclick="cellClicked(this,${i},${j})"></div>`
      document.getElementById(
        `box`
      ).style.gridTemplateColumns = `repeat(${size}, 50px)`
      document.getElementById(
        'box'
      ).style.gridTemplateRows = `repeat(${size}, 50px)`
    }
  }
  mineContainer.innerHTML = strHtmls
}

function cellClicked(elCell, i, j) {
  if (!gGame.isOn) return
  checkLose(i, j)
  let count = document.querySelector('.mines-count span')
  let gameBoard = gBoard
  let clickedCell = gameBoard[i][j]

  // if (cellCount === 0) {
  //   gGame.isOn
  // }
  if (clickedCell.isShown) return
  let num = (clickedCell.minesAroundCount = checkNeighbors(gBoard, i, j))
  clickedCell.isMarked = true
  elCell.classList.remove('hide')
  clickedCell.isShown = true
  count.innerHTML = gGame.markedCount

  if (!clickedCell.isMine) {
    elCell.innerHTML = num
  } else {
    elCell.innerHTML = BOMB
    gGame.markedCount--
    count.innerHTML = gGame.markedCount
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
