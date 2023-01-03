'use strict'

let isOpen
let gColors
let gCompareArray = []
let gameIsOn = false
let gCounter = 2
let gDivArray = []
let gScore = 0
let gGameObjArray = []
let gColorsArray = []
let gDisableBtns = false

function onInit() {
  // toggleButtons()
  // gDisableBtns = true
  // flashCards()
  // setTimeout(changeToWhite, 2000)
}

function changeToWhite() {
  document.querySelectorAll(`.item`).forEach(function (elDiv) {
    elDiv.classList.add('hide')
  })
  gameIsOn = true
}

function flipCard(num) {
  let currGameCard = gGameObjArray[num - 1]
  if (currGameCard.isShown || !gameIsOn) return
  gColorsArray.push(currGameCard)
  let firstColor = gColorsArray[0]
  let secondColor = gColorsArray[1]
  const elDiv = document.querySelector(`.item${num}`)
  gDivArray.push(elDiv)
  let currColor = elDiv.style.backgroundColor
  gCompareArray.push(currColor)
  elDiv.classList.remove('hide')

  gCounter--
  if (gameIsOn) {
    if (gCounter === 0) {
      gColorsArray = []
      gameIsOn = false
      if (firstColor.color === secondColor.color) {
        gGameObjArray[num - 1].isShown = true
        gScore--
        if (gScore === 0) {
          openModal()
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
  } else return
}

function openModal() {
  const eldiv = document.querySelector('.box-container')
  const elModal = document.querySelector('.modal-box')
  const elContainer = document.querySelector('.container')
  elModal.classList.remove('display-none')
  elContainer.classList.add('display-none')
  eldiv.classList.add('display-none')
}

function restartGame() {
  const elModal = document.querySelector('.modal-box')
  elModal.classList.add('black')
  toggleButtons()

  gameIsOn = false
  gCounter = 2
  gDivArray = []
  gScore = 0
}

function gameSize(size) {
  let startBtn = document.querySelector('.start')
  startBtn.style.display = 'inline-block'
  let colorsArr = []
  colorsArr = createCards(size)
  renderCards(size)
  makeShuffleColors(colorsArr, size)
  gColors = size / 2
  gScore = gColors
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

function makeShuffleColors(colorsArr, size) {
  const copy = colorsArr.slice()
  const newArray = colorsArr.concat(copy)
  shuffle(newArray)
  for (let i = 0; i < size; i++) {
    let elDiv = document.getElementById(`${i + 1}`)
    elDiv.style.backgroundColor = newArray[i].color
  }
  gGameObjArray = newArray

  return newArray
}

// function disableBtns() {
//   let elH5 = document.querySelector('h5')
//   elH5.style.display = 'none'
//   document.querySelector('.start').disabled = true
//   const buttons = document.querySelectorAll('.size')
//   for (const button of buttons) {
//     button.setAttribute('disabled', true)
//   }
// }
// function enableBtns() {
//   let elH5 = document.querySelector('h5')
//   elH5.style.display = 'block'
//   document.querySelector('.start').disabled = false
//   const buttons = document.querySelectorAll('.size')
//   for (const button of buttons) {
//     button.setAttribute('disabled', false)
//   }
// }

function toggleButtons() {
  let elH5 = document.querySelector('h5')
  if (gDisableBtns) {
    elH5.style.display = 'none'
    document.querySelector('.start').disabled = false
    const buttons = document.querySelectorAll('.size')
    for (const button of buttons) {
      button.setAttribute('disabled', true)
    }
    gDisableBtns = true
  } else {
    elH5.style.display = 'block'
    document.querySelector('.start').disabled = true
    const buttons = document.querySelectorAll('.size')
    for (const button of buttons) {
      button.setAttribute('disabled', false)
    }
    gDisableBtns = false
  }
}

function flashCards() {
  document.querySelectorAll(`.item`).forEach(function (elDiv) {
    elDiv.classList.remove('hide')
  })
}
