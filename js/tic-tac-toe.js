'use strict'

let gBoard = []
let gGameIsOn = false
let gFirstMove = false
let gCounter = 9
let gInterval

function playOne(i, j) {
  console.log(gFirstMove)

  if (!gGameIsOn) return

  let player = 'X'
  let computer = 'O'
  let fullBoard = gBoard
  let elCurrentCard = document.querySelector(`.card${i}-${j}`)
  if (fullBoard[i][j] === player || fullBoard[i][j] === computer) return
  gCounter--

  if (gCounter === 0) {
    openTieModal()
    gGameIsOn = false
  }
  if (gFirstMove) {
    gFirstMove = false
    elCurrentCard.classList.add('hide-x')
    fullBoard[i][j] = player
    if (checkVictory(fullBoard, player)) {
      openModal('Player')
      gGameIsOn = false
    } else {
      computerMove(fullBoard, computer)
      if (checkVictory(fullBoard, computer)) {
        openModal('Computer')
        gGameIsOn = false
      }
    }
  }
}

function playTwo(i, j) {
  if (!gGameIsOn) return
  let player1 = 'X'
  let player2 = 'O'
  let board = gBoard
  let elCurrentCard = document.querySelector(`.card${i}-${j}`)
  if (board[i][j] !== null) return

  gCounter--

  if (gCounter < 1) {
    openTieModal()
    gGameIsOn = false
  }
  if (gFirstMove) {
    elCurrentCard.classList.add('hide-x')
    board[i][j] = player1
    gFirstMove = false
    if (checkVictory(board, player1)) {
      gGameIsOn = false
      openModal('Player one')
    }
  } else {
    elCurrentCard.classList.add('hide-0')
    board[i][j] = player2
    if (checkVictory(board, player2)) {
      gGameIsOn = false
      openModal('Player two')
    }
  }
}

function checkVictory(board, symbol) {
  // Check rows
  for (let row = 0; row < 3; row++) {
    if (
      board[row][0] === symbol &&
      board[row][1] === symbol &&
      board[row][2] === symbol
    ) {
      return true
    }
  }
  // Check columns
  for (let col = 0; col < 3; col++) {
    if (
      board[0][col] === symbol &&
      board[1][col] === symbol &&
      board[2][col] === symbol
    ) {
      return true
    }
  }
  // Check diagonals
  if (
    board[0][0] === symbol &&
    board[1][1] === symbol &&
    board[2][2] === symbol
  ) {
    return true
  }
  if (
    board[0][2] === symbol &&
    board[1][1] === symbol &&
    board[2][0] === symbol
  ) {
    return true
  }

  return false
}

function onePlayer() {
  let elButton = document.querySelector(`.one`)
  elButton.disabled = true

  startGame()
  renderGame('One')
}

function twoPlayers() {
  let elButton = document.querySelector(`.two`)
  elButton.disabled = true
  startGame()
  renderGame('Two')
}

function disableBtns() {
  let elButton1 = document.querySelector(`.player`)
  elButton1.classList.add('display-none')
}

function enableBtns() {
  document.getElementById('restart-button').style.visibility = 'hidden'

  let elButton1 = document.querySelector(`.one`)
  let elButton2 = document.querySelector(`.two`)
  elButton1.disabled = false
  elButton2.disabled = false
}

function createBoard() {
  let board = []

  for (let i = 0; i < 3; i++) {
    let row = []
    for (let j = 0; j < 3; j++) {
      row.push(null)
    }
    board.push(row)
  }
  gBoard = board
  return board
}

function renderGame(str) {
  let strHTML = ''
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      strHTML += `<div class="card card${i}-${j}" onclick="play${str}(${i},${j})"></div>`
    }
  }
  const elContainer = document.querySelector('.tic-tac-toe')
  elContainer.innerHTML = strHTML
}

function startGame() {
  gCounter = 9
  gGameIsOn = true
  gFirstMove = true
  disableBtns()
  createBoard()
}

function openModal(name) {
  // const eldiv = document.querySelector('.box-container')
  const elModal = document.querySelector('.modal-box')
  const elName = document.querySelector('h3 span')
  document.getElementById('restart-button').style.visibility = 'visible'
  // const elContainer = document.querySelector('.game-container')
  elName.innerHTML = name + ` won 😍`
  elModal.classList.remove('display-none')
  // elContainer.classList.add('display-none')
  // eldiv.classList.add('display-none')
}

function restartGame() {
  let elButton1 = document.querySelector(`.player`)
  elButton1.classList.remove('display-none')
  gBoard = []
  // let elButton1 = document.querySelector(`.one`)
  // let elButton2 = document.querySelector(`.two`)
  closeModal()
}

function closeModal() {
  const eldiv = document.querySelector('.box-container')
  const elModal = document.querySelector('.modal-box')
  elModal.classList.add('display-none')
  eldiv.classList.remove('display-none')
  enableBtns()
}

function openTieModal() {
  const elModal = document.querySelector('.modal-box')
  const elName = document.querySelector('h3 span')
  document.getElementById('restart-button').style.visibility = 'visible'
  elModal.classList.remove('display-none')
  elName.innerHTML = 'No winners - Tie 😵'
}

function computerMove(board, symbol) {
  let emptyCells = getEmptyCell(board)
  if (emptyCells.length) {
    let currCell = emptyCells[getRandomIntInt(0, emptyCells.length)]
    let elCurrentCard = document.querySelector(
      `.card${currCell[0]}-${currCell[1]}`
    )
    if (gCounter === 0) return
    gCounter--
    board[currCell[0]][currCell[1]] = symbol
    setTimeout(() => {
      gFirstMove = true
      elCurrentCard.classList.add('hide-0')
    }, 1000)
  }
}
