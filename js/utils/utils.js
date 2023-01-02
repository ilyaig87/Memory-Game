function createMat(ROWS, COLS) {
  var mat = []
  for (var i = 0; i < ROWS; i++) {
    var row = []
    for (var j = 0; j < COLS; j++) {
      row.push('')
    }
    mat.push(row)
  }
  return mat
}

//print the mat to the DOM with classes and cell names
function printMat(mat, selector) {
  var strHTML = '<table border="0"><tbody>'
  for (var i = 0; i < mat.length; i++) {
    strHTML += '<tr>'
    for (var j = 0; j < mat[0].length; j++) {
      const cell = mat[i][j]
      const className = `cell cell-${i}-${j}`

      strHTML += `<td class="${className}">${cell}</td>`
    }
    strHTML += '</tr>'
  }
  strHTML += '</tbody></table>'

  const elContainer = document.querySelector(selector)
  elContainer.innerHTML = strHTML
}

// location such as: {i: 2, j: 7}
function renderCell(location, value) {
  // Select the elCell and set the value
  const elCell = document.querySelector(`.cell-${location.i}-${location.j}`)
  elCell.innerHTML = value
}

function getRandomIntInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min
}

function getRandomColor() {
  var letters = '0123456789ABCDEF'
  var color = '#'
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
}

function generateRandomColor() {
  var randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16)
  return randomColor
  //random color will be freshly served
}

//build board with surrounding walls
function buildBoard() {
  const size = 10
  const board = []

  for (var i = 0; i < size; i++) {
    board.push([]) // board[i] = []

    for (var j = 0; j < size; j++) {
      board[i][j] = '*'

      if (i === 0 || i === size - 1 || j === 0 || j === size - 1) {
        board[i][j] = 'X'
      }
    }
  }
  return board
}

function countNeighbors(cellI, cellJ, mat) {
  var neighborsCount = 0

  for (var i = cellI - 1; i <= cellI + 1; i++) {
    if (i < 0 || i >= mat.length) continue

    for (var j = cellJ - 1; j <= cellJ + 1; j++) {
      if (i === cellI && j === cellJ) continue
      if (j < 0 || j >= mat[i].length) continue
      if (mat[i][j] === LIFE || mat[i][j] === SUPER_LIFE) neighborsCount++
    }
  }
  return neighborsCount
}

function isEmptyCell(coord) {
  return gBoard[coord.i][coord.j] === ''
}

//returns Current h/m/s
function getTime() {
  return new Date().toString().split(' ')[4]
}

//returns timer from 0 seconds
function getTimer() {
  //add gElapsed in main and gStartingTime =  Date.now()

  gElapsed = Date.now() - gStartingTime
  gElapsed /= 1000
  var elBoxes = document.getElementsByClassName('timer')
  elBoxes[0].innerText = 'Game time:\n' + gElapsed
}

function startTimer() {
  gInter = setInterval(getTime)
}

function stopTimer() {
  clearInterval(gInter)
}

function shuffle(items) {
  var randIdx, keep, i
  for (i = items.length - 1; i > 0; i--) {
    randIdx = getRandomIntInt(0, items.length - 1)

    keep = items[i]
    items[i] = items[randIdx]
    items[randIdx] = keep
  }

  return items
}

//creates unique random ID
function makeId(length = 5) {
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  var txt = ''
  for (var i = 0; i < length; i++) {
    txt += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return txt
}

//@@@@@@@@@@@ STORAGE @@@@@@@@@@@
function saveToStorage(key, val) {
  const str = JSON.stringify(val)
  localStorage.setItem(key, str)
}
//@@@@@@@@@@@ STORAGE @@@@@@@@@@@
function loadFromStorage(key) {
  const str = localStorage.getItem(key)
  const val = JSON.parse(str)
  return val
}
//@@@@@@@@@@@ STORAGE @@@@@@@@@@@
function clearStorage(key) {
  const str = JSON.stringify('')
  localStorage.setItem(key, str)
}

// formats date.now() to D/M/Y
function formatDate(date) {
  var d = new Date(date),
    month = '' + (d.getMonth() + 1),
    day = '' + d.getDate(),
    year = d.getFullYear()

  if (month.length < 2) month = '0' + month
  if (day.length < 2) day = '0' + day

  return [day, month, year].join('-')
}

// request data from server
function ask(cb) {
  const xhr = new XMLHttpRequest()
  console.log('XMLHttpRequest', XMLHttpRequest)
  xhr.onreadystatechange = () => {
    if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
      const res = JSON.parse(xhr.responseText)
      cb(res)
    }
  }
  xhr.open('GET', 'https://yesno.wtf/api', true)
  xhr.send()
}

const format = (time) => {
  new Date(time).getTime()
  return [
    new Date(time).getUTCDate(),
    '.',
    new Date(time).getMonth() + 1,
    '.',
    new Date(time).getFullYear(),
    '\n',
    new Date(time).getHours(),
    ':',
    new Date(time).getMinutes(),
  ]
}

function makeColor(size) {
  var color = [
    'Goldenrod',
    'Tomato',
    'Orange',
    'Lavender',
    'MediumSeaGreen',
    'Gray',
    'SlateBlue',
    'Pink',
    'LightBlue',
    'Firebrick',
    'Green',
    'Red',
    'SkyBlue',
    'Tan',
    'Wheat',
    'Turquoise',
    'SaddleBrown',
    'Salmon',
    'Olive',
    'Yellow',
    'Violet',
    'Maroon',
    'Darkolivegreen',
    'Lightslategray',
    'Lime',
    'Khaki',
    'GhostWhite',
    'Coral',
    'Chocolate',
    'Black',
    'Aquamarine',
    'Blue',
  ]

  var txt = ''
  while (size > 0) {
    size--
    shuffle(color)
    let newArray = color.pop()
    txt += newArray + ','
  }

  const myArray = txt.split(',')
  myArray.pop()
  return myArray
}
function createCards(num) {
  let cards = []
  const colors = [
    'Goldenrod',
    'Tomato',
    'Orange',
    'Lavender',
    'MediumSeaGreen',
    'Gray',
    'SlateBlue',
    'Pink',
    'LightBlue',
    'Firebrick',
    'Green',
    'Red',
    'SkyBlue',
    'Tan',
    'Wheat',
    'Turquoise',
    'SaddleBrown',
    'Salmon',
    'Olive',
    'Yellow',
    'Violet',
    'Maroon',
    'Darkolivegreen',
    'Lightslategray',
    'Lime',
    'Khaki',
    'GhostWhite',
    'Coral',
    'Chocolate',
    'Black',
    'Aquamarine',
    'Blue',
  ]
  shuffle(colors)
  for (let i = 0; i < num / 2; i++) {
    cards.push({ id: i + 1, color: colors[i], isShown: false })
  }
  return cards
}
