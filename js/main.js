'use strict'

let isOpen
let gColors
let gRandomColors = []
let gCompareArray = []
let gameIsOn = false
let gCounter = 2
let gDivArray = []
let gScore = 0

function counter() {
  return gCounter
}

function onInit() {
  document.querySelector('.start').disabled = true
  document.querySelectorAll(`.item`).forEach(function (elDiv) {
    elDiv.classList.remove('hide')
  })
  setTimeout(changeToWhite, 2000)
}

function changeToWhite() {
  document.querySelectorAll(`.item`).forEach(function (elDiv) {
    elDiv.classList.add('hide')
  })
  gameIsOn = true
}

function flipCard(num) {
  const elDiv = document.querySelector(`.item${num}`)
  const elModal = document.querySelector('.modal-box')
  const elContainer = document.querySelector('.container')

  console.log(elModal)
  gDivArray.push(elDiv)

  let currColor = elDiv.style.backgroundColor
  gCompareArray.push(currColor)

  elDiv.classList.remove('hide')
  gCounter--
  if (gameIsOn) {
    if (gCounter === 0) {
      gameIsOn = false
      if (gCompareArray[0] === gCompareArray[1]) {
        gScore--
        console.log(gScore)
        if (gScore === 0) {
          elModal.classList.remove('black')
          elContainer.classList.add('black')
        }
        gDivArray = []
      } else {
        for (let i = 0; i < gDivArray.length; i++) {
          setTimeout(function () {
            gDivArray[i].classList.add('hide')
          }, 500) // delay of 500 milliseconds (0.5 seconds)
        }
      }
      gCompareArray = []
      gCounter = 2
      gameIsOn = true
    }
  } else return false
}

function restartGame() {
  const elModal = document.querySelector('.modal-box')
  elModal.classList.add('black')

  document.querySelector('.start').disabled = false
  document.querySelector('.levels').hidden = false
  gameIsOn = false
  gCounter = 2
  gDivArray = []
  gScore = 0
}
// function setHide(arr) {
//   setTimeout(arr[0].classList.add('hide'), 2000)
//   setTimeout(arr[1].classList.add('hide'), 2000)
// }

function gameSize(size) {
  gColors = size / 2
  gScore = gColors
  renderCards(size)
  gRandomColors.push(makeColor(gColors))
  let randomColors = gRandomColors.pop()
  makeShuffleColors(randomColors, randomColors.length, size)

  document.querySelector('.levels').hidden = true
}

function renderCards(size) {
  let strHTML = ''
  for (let i = 1; i <= size; i++) {
    strHTML += `   
    <div id=${i} class="item item${i} hide" onclick="flipCard(${i})"></div>
    `
    document.getElementById(
      `box`
    ).style.gridTemplateColumns = `repeat(${Math.sqrt(size)}, 75px)`
    document.getElementById('box').style.gridTemplateRows = `repeat(${Math.sqrt(
      size
    )}, 75px)`
  }

  const elContainer = document.querySelector('.container')
  elContainer.innerHTML = strHTML
}

function makeShuffleColors(colors, num, size) {
  let newColorArray = []
  newColorArray = ([...colors] + ',' + [...colors]).split(',')
  let shuffled = shuffle(newColorArray)
  for (let i = 1; i < size + 1; i++) {
    let elDiv = document.getElementById(`${i}`)
    elDiv.style.backgroundColor = shuffled[i - 1]
  }
}

// function getButton(num) {
//   const elDiv = document.querySelector(`.item${num}`)
//   const style = getComputedStyle(elDiv)
//   document.body.style.backgroundColor = style.backgroundColor
// }
// setInterval(changeAllColors, 500)

// function changeAllColors() {
//   document.querySelectorAll(`.item`).forEach(function (elDiv) {
//     elDiv.style.backgroundColor = getRandomColor()
//   })
// }

// function getButton() {
//   document.querySelectorAll(`.item`).forEach(function (elDiv) {
//     elDiv.style.backgroundColor = getRandomColor()
//   })
// }

// buildBoard()
// function gameSize(size) {
//   for (let i = 0; i < size; i++) {
//     const elDiv = document.querySelector(`.item${i}`)

//     // elDiv.style.backgroundColor = getRandomColor()
//   }
// }
