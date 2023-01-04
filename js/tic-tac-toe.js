'use strict'

let gBoard = []
let gGameIsOn = false
let gFirstMove = false
let gCounter = 9
createBoard()

function playTwo(i, j) {
  console.log(gGameIsOn)
  if (!gGameIsOn) return
  gCounter--
  if (gCounter === 0) {
    openTieModal()
    gGameIsOn = true
  }

  let firstPlayer = 'First Player'
  let secondPlayer = 'Second Player'
  let board = gBoard
  let elCurrentCard = document.querySelector(`.card${i}-${j}`)
  if (!gFirstMove) {
    elCurrentCard.classList.add('hide-x')
    board[i][j] = secondPlayer
    if (checkVictory(board)) {
      gGameIsOn = false
      openModal(secondPlayer)
    }
    gFirstMove = true
  } else {
    elCurrentCard.classList.add('hide-0')
    board[i][j] = firstPlayer
    if (checkVictory(board)) {
      gGameIsOn = false
      openModal(firstPlayer)
    }

    gFirstMove = false
  }
  console.table(board)
}

function checkVictory(board) {
  for (var i = 0; i < 3; i++) {
    if (board[i][0] === board[i][1] && board[i][1] === board[i][2]) {
      return true
    }
    if (board[0][i] === board[1][i] && board[1][i] === board[2][i]) {
      return true
    }
    if (board[0][0] === board[1][1] && board[1][1] === board[2][2]) {
      return true
    }
    if (board[0][2] === board[1][1] && board[1][1] === board[2][0]) {
      return true
    }
  }
  return false
}

function playOne(i, j) {
  let elCurrentCard = document.querySelector(`.card${i}-${j}`)
  if (!gGameIsOn) return
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

function disableBtns(str) {
  let elButton1 = document.querySelector(`.one`)
  let elButton2 = document.querySelector(`.two`)
  elButton1.disabled = true
  elButton2.disabled = true
}

function enableBtns() {
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
      row.push({})
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
  gGameIsOn = true
  gFirstMove = true
  disableBtns()
}

function openModal(name) {
  const eldiv = document.querySelector('.box-container')
  const elModal = document.querySelector('.modal-box')
  const elName = document.querySelector('.modal-box span')
  const elContainer = document.querySelector('.game-container')
  elName.innerHTML = name
  elModal.classList.remove('display-none')
  elContainer.classList.add('display-none')
  eldiv.classList.add('display-none')
}

function restartGame() {
  gBoard = []
  // let elButton1 = document.querySelector(`.one`)
  // let elButton2 = document.querySelector(`.two`)
  closeModal()
}

function closeModal() {
  const eldiv = document.querySelector('.box-container')
  const elModal = document.querySelector('.modal-box')
  const elContainer = document.querySelector('.game-container')
  elModal.classList.add('display-none')
  elContainer.classList.remove('display-none')
  eldiv.classList.remove('display-none')
  enableBtns()
}

function openTieModal() {
  const eldiv = document.querySelector('.box-container')
  const elModal = document.querySelector('.modal-box')
  const elName = document.querySelector('.modal-box h1')
  const elContainer = document.querySelector('.game-container')
  elModal.classList.remove('display-none')
  elContainer.classList.add('display-none')
  eldiv.classList.add('display-none')
  elName.innerHTML = 'No winners- Tie'
}
