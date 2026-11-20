/*********************************************************************************************************************  

PRSM Participatory System Mapper 

	Copyright (C) 2022  Nigel Gilbert prsm@prsm.uk

This software is licenced under the PolyForm Noncommercial License 1.0.0

<https://polyformproject.org/licenses/noncommercial/1.0.0>

See the file LICENSE.md for details.

This module provides a set of utility functions used widely within the PRSM code.  
**********************************************************************************************************************/


import iro from '@jaames/iro'

/**
 * attach an event listener
 *
 * @param {string} id - id of the element on which to hang the event listener
 * @param {string} event
 * @param {function} callback
 * @param {object} options
 * @returns {void}
 */
export function listen(id, event, callback, options) {
  elem(id).addEventListener(event, callback, options)
}

/**
 * return the HTML element with the id
 * @param {string} id
 * @returns {HTMLElement|null} The matching element, if present.
 */
export function elem(id) {
  return document.getElementById(id)
}

/**
 * allow user to drag the element that has a header element that acts as the handle
 * @param {HTMLElement} el
 * @param {HTMLElement} header
 * @returns {void}
 */
export function dragElement(el, header) {
  let isDragging = false
  let startPosX = 0
  let startPosY = 0
  let lastPosX = 0
  let lastPosY = 0
  let width = 0
  let height = 0

  /**
   * Start dragging from a non-interactive part of the header.
   * @param {PointerEvent} ev Pointer event.
   * @returns {void}
   */
  function onPointerDown(ev) {
    // Don't start dragging if clicking on interactive button elements
    const target = ev.target
    // Check if the target or any of its ancestors (up to the header) has the interactiveButton class
    let element = target
    while (element && element !== header) {
      if (element.classList && element.classList.contains('interactiveButton')) {
        return // Don't start dragging
      }
      element = element.parentElement
    }
    // Start dragging (allow clicking on header or any of its children)
    isDragging = true
    startPosX = ev.clientX
    startPosY = ev.clientY
    lastPosX = el.offsetLeft
    lastPosY = el.offsetTop
    width = el.offsetWidth
    height = el.offsetHeight
    header.setPointerCapture(ev.pointerId)
    el.style.cursor = 'move'
  }

  /**
   * Move the dragged element within the viewport.
   * @param {PointerEvent} ev Pointer event.
   * @returns {void}
   */
  function onPointerMove(ev) {
    if (!isDragging) return

    // Calculate delta from start position
    const deltaX = ev.clientX - startPosX
    const deltaY = ev.clientY - startPosY

    // Calculate new position with boundary constraints
    let posX = lastPosX + deltaX
    if (posX < 0) posX = 0
    if (posX > window.innerWidth - width) posX = window.innerWidth - width

    let posY = lastPosY + deltaY
    if (posY < 0) posY = 0
    if (posY > window.innerHeight - height) posY = window.innerHeight - height

    // Move element to new position
    el.style.left = posX + 'px'
    el.style.top = posY + 'px'
  }

  /**
   * End a drag and release pointer capture.
   * @param {PointerEvent} ev Pointer event.
   * @returns {void}
   */
  function onPointerUp(ev) {
    if (!isDragging) return
    isDragging = false
    el.style.cursor = 'auto'
    header.releasePointerCapture(ev.pointerId)
  }

  /**
   * Cancel a drag and release pointer capture.
   * @param {PointerEvent} ev Pointer event.
   * @returns {void}
   */
  function onPointerCancel(ev) {
    if (!isDragging) return
    isDragging = false
    el.style.cursor = 'auto'
    header.releasePointerCapture(ev.pointerId)
  }

  header.addEventListener('pointerdown', onPointerDown)
  header.addEventListener('pointermove', onPointerMove)
  header.addEventListener('pointerup', onPointerUp)
  header.addEventListener('pointercancel', onPointerCancel)
}

const SEA_CREATURES = Object.freeze([
  'walrus',
  'seal',
  'fish',
  'shark',
  'clam',
  'coral',
  'whale',
  'crab',
  'lobster',
  'starfish',
  'eel',
  'dolphin',
  'squid',
  'jellyfish',
  'ray',
  'shrimp',
  'herring',
  'angler',
  'mackerel',
  'salmon',
  'urchin',
  'anemone',
  'morel',
  'axolotl',
  'blobfish',
  'tubeworm',
  'seabream',
  'seaweed',
  'anchovy',
  'cod',
  'barramundi',
  'carp',
  'crayfish',
  'haddock',
  'hake',
  'octopus',
  'plaice',
  'sardine',
  'skate',
  'sturgeon',
  'swordfish',
  'whelk',
])

const ADJECTIVES = Object.freeze([
  'cute',
  'adorable',
  'lovable',
  'happy',
  'sandy',
  'bubbly',
  'friendly',
  'drifting',
  'huge',
  'big',
  'small',
  'giant',
  'massive',
  'tiny',
  'nippy',
  'odd',
  'perfect',
  'rude',
  'wonderful',
  'agile',
  'beautiful',
  'bossy',
  'candid',
  'carnivorous',
  'clever',
  'cold',
  'cold-blooded',
  'colorful',
  'cuddly',
  'curious',
  'cute',
  'dangerous',
  'deadly',
  'domestic',
  'dominant',
  'energetic',
  'fast',
  'feisty',
  'ferocious',
  'fierce',
  'fluffy',
  'friendly',
  'furry',
  'fuzzy',
  'grumpy',
  'hairy',
  'heavy',
  'herbivorous',
  'jealous',
  'large',
  'lazy',
  'loud',
  'lovable',
  'loving',
  'malicious',
  'maternal',
  'mean',
  'messy',
  'nocturnal',
  'noisy',
  'nosy',
  'picky',
  'playful',
  'poisonous',
  'quick',
  'rough',
  'sassy',
  'scaly',
  'short',
  'shy',
  'slimy',
  'slow',
  'small',
  'smart',
  'smelly',
  'soft',
  'spikey',
  'stinky',
  'strong',
  'stubborn',
  'submissive',
  'tall',
  'tame',
  'tenacious',
  'territorial',
  'tiny',
  'vicious',
  'warm',
  'wild',
])

const colors = [
  '#00ffff',
  '#f0ffff',
  '#f5f5dc',
  '#0000ff',
  '#a52a2a',
  '#00008b',
  '#008b8b',
  '#a9a9a9',
  '#006400',
  '#bdb76b',
  '#8b008b',
  '#556b2f',
  '#ff8c00',
  '#9932cc',
  '#8b0000',
  '#e9967a',
  '#9400d3',
  '#ff00ff',
  '#ffd700',
  '#008000',
  '#4b0082',
  '#f0e68c',
  '#add8e6',
  '#e0ffff',
  '#90ee90',
  '#d3d3d3',
  '#ffb6c1',
  '#ffffe0',
  '#00ff00',
  '#ff00ff',
  '#800000',
  '#000080',
  '#808000',
  '#ffa500',
  '#ffc0cb',
  '#800080',
  '#ff0000',
  '#c0c0c0',
  '#ffff00',
]

/**
 * Pick a random item from an array.
 * @param {Array} items Choices.
 * @returns {*} Selected item.
 */
const random = (items) => items[(Math.random() * items.length) | 0]

/**
 * Determine whether the RGB color is light or not
 * http://www.w3.org/TR/AERT#color-contrast
 * @param  {number}  r               Red
 * @param  {number}  g               Green
 * @param  {number}  b               Blue
 * @param  {number}  differencePoint
 * @return {boolean}
 */
export const rgbIsLight = (r, g, b, differencePoint = 128) =>
  (r * 299 + g * 587 + b * 114) / 1000 >= differencePoint

/**
 * return a random colour, with a flag to show whether the color is light or dark,
 *  to suggest whether text applied should be white or black
 * @returns {Object} {color: string, isLight: boolean}
 */
function randomColour() {
  const color = random(colors)
  const rgb = color.replace('#', '')
  return {
    color,
    isLight: rgbIsLight(
      parseInt(rgb.substring(0, 2), 16),
      parseInt(rgb.substring(2, 4), 16),
      parseInt(rgb.substring(4, 6), 16),
      128
    ),
  }
}

/**
 * return the value of a CSS Variable, such as --primary-color
 * @param {string} varName name of a CSS variable defined in the HTML body element
 * @returns {string} the value of the CSS variable
 */
export function getCSSVariable(varName) {
  return window.getComputedStyle(document.body).getPropertyValue(varName)
}

/**
 * Capitalize the first character of a nonempty string.
 * @param {string} string Text to capitalize.
 * @returns {string} Capitalized text.
 */
const capitalize = (string) => string[0].toUpperCase() + string.slice(1)

/**
 * return a random fancy name for an avatar, with a random colour
 * @returns {object} Anonymous user name, colour and initial presence state.
 */
export function generateName() {
  const name = capitalize(random(ADJECTIVES)) + ' ' + capitalize(random(SEA_CREATURES))

  return {
    ...randomColour(),
    name,
    anon: true,
    asleep: false,
  }
}

/**
 * show status message at the bottom of the window
 * @param {string} msg
 * @returns {void}
 */
export function statusMsg(msg) {
  elem('statusBar').innerHTML = htmlEntities(msg)
}

let alertTimeout = null

let alertDuration = null

/**
 * Set an automatic expiry for alerts in the current application.
 * @param {number} duration Duration in milliseconds.
 * @returns {void}
 */
export function setAlertDuration(duration) {
  alertDuration = duration
}

/**
 * show alert messages at the bottom of the window
 * @param {string} msg
 * @param {string} [status] type of msg - info, warn, error
 * @param {boolean} [dontFade] if true, don't fade the message in and out
 * @returns {void}
 */
export function alertMsg(msg, status, dontFade = false) {
  const errMsgElement = elem('errMsg')
  switch (status) {
    case 'info':
      errMsgElement.style.backgroundColor = getCSSVariable('--primary-color')
      errMsgElement.style.color = 'white'
      break
    case 'warn':
      errMsgElement.style.backgroundColor = getCSSVariable('--warning-color')
      errMsgElement.style.color = 'black'
      break
    case 'error':
      errMsgElement.style.backgroundColor = getCSSVariable('--alert-color')
      errMsgElement.style.color = 'white'
      break
    default:
      console.log('Unknown status in alertMsg: ' + status)
      return
  }
  errMsgElement.innerHTML = msg
  if (alertDuration !== null) {
    clearTimeout(alertTimeout)
    errMsgElement.classList.remove('fadeInAndOut')
    if (status === 'error' || status === 'warn') {
      errMsgElement.style.opacity = 1
      alertTimeout = setTimeout(() => {
        errMsgElement.style.opacity = 0
      }, alertDuration)
      return
    }
    errMsgElement.style.opacity = dontFade ? 1 : 0
  }
  if (dontFade) {
    errMsgElement.style.opacity = 1
  } else {
    listen('errMsg', 'animationend', () => {
      elem('errMsg').classList.remove('fadeInAndOut')
    })
    errMsgElement.classList.add('fadeInAndOut')
  }
}

/**
 * replace special characters with their HTML entity codes
 * @param {string} str
 * @returns {string} Escaped text.
 */
function htmlEntities(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&quot;')
}

/**
 * remove any previous message from the status bar
 * @returns {void}
 */
export function clearStatusBar() {
  statusMsg(' ')
}

const SHORTLABELLEN = 25

/**
 * Shorten a label if necessary and add an ellipsis.
 * @param {string} label Text to shorten.
 * @param {number} [maxLength] Maximum length before shortening.
 * @returns {string} Shortened or original label.
 */
export function shorten(label, maxLength = SHORTLABELLEN) {
  return label.length > maxLength ? label.substring(0, maxLength) + '...' : label
}

/**
 * return the initials of the given name as a string: Nigel Gilbert -> NG
 * @param {string} name
 * @returns {string} Uppercase initials.
 */
export function initials(name) {
  return name
    .replace(/[^A-Za-z0-9À-ÿ ]/gi, '')
    .replace(/ +/gi, ' ')
    .match(/(^\S\S?|\b\S)?/g)
    .join('')
    .match(/(^\S|\S$)?/g)
    .join('')
    .toUpperCase()
}

export class CP {
  /**
   * Create the shared colour picker and its recent-colour cache.
   * @param {HTMLElement|null} boundsElement the area within which the picker should open
   */
  constructor(boundsElement = null) {
    this.boundsElement = boundsElement
    this.container = document.createElement('div')
    this.container.className = 'color-picker-container'
    this.container.id = 'colorPicker'
    const controls = document.createElement('div')
    controls.id = 'colorPickerControls'
    this.container.appendChild(controls)
    document.querySelector('body').insertAdjacentElement('beforeend', this.container)

    // see https://iro.js.org/guide.html#getting-started
    this.colorPicker = new iro.ColorPicker('#colorPickerControls', {
      width: 160,
      color: 'rgba(255, 255, 255, 1)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255,1)',
      margin: 6,
      layout: [
        {
          component: iro.ui.Wheel,
          options: {
            borderColor: '#ffffff',
          },
        },
        {
          component: iro.ui.Slider,
          options: {
            borderColor: '#000000',
            sliderType: 'value',
            padding: 2,
            handleRadius: 4,
          },
        },
        {
          component: iro.ui.Slider,
          options: {
            borderColor: '#000000',
            sliderType: 'alpha',
            padding: 2,
            handleRadius: 4,
          },
        },
      ],
    })

    // set up a grid of squares to hold last 8 selected colors
    this.colorCache = document.createElement('div')
    this.colorCache.id = 'colorCache'
    this.colorCache.className = 'color-cache'
    for (let i = 0; i < 8; i++) {
      const c = document.createElement('div')
      c.id = 'color' + i
      c.className = 'cached-color'
      // prefill with standard colours
      c.style.backgroundColor = [
        'rgba(255, 0, 0,1)',
        'rgba(0, 255, 0,1)',
        'rgb(0, 0, 255)',
        'rgba(255, 255, 0,1)',
        'rgb(255, 255, 255)',
        'rgba(0, 0, 0,1)',
        'rgba(154, 219, 180,1)',
        'rgba(219, 110, 103,1)',
      ][i]
      c.addEventListener('click', (e) => {
        const color = e.target.style.backgroundColor
        if (color) {
          this.colorPicker.color.rgbaString = e.target.style.backgroundColor
        }
      })
      this.colorCache.appendChild(c)
    }
    document
      .getElementById('colorPickerControls')
      .insertAdjacentElement('afterend', this.colorCache)
  }

  /**
   * attach a color picker to an element to recolour the background to that element
   * @param {string} wellId the id of the DOM element to attach the color picker to
   * @param {function} callback function to call when the color has been chosen, with that color as argument
   * @param {function} [onChange] called while the colour changes
   * @returns {void}
   */
  createColorPicker(wellId, callback, onChange) {
    const well = elem(wellId)
    well.style.backgroundColor = '#ffffff'
    this.attachTo(well, callback, onChange)
  }

  /**
   * attach a color picker to an element, which need not have an id or be in the document yet
   * @param {HTMLElement} well the element whose background colour is chosen
   * @param {function} callback called with the colour when the picker is closed
   * @param {function} [onChange] called each time the colour changes while the picker is open
   * @returns {void}
   */
  attachTo(well, callback, onChange) {
    // add listener to display picker when well clicked
    well.addEventListener('click', (event) => {
      this.container.style.display = 'block'
      const netPane = (this.boundsElement ?? elem('net-pane')).getBoundingClientRect()
      // locate picker so it does not go outside netPane
      let top = event.clientY + well.offsetHeight + 10
      if (top > netPane.bottom - this.container.offsetHeight) {
        top = netPane.bottom - this.container.offsetHeight - 10
      }
      if (top < netPane.top) top = netPane.top + 10
      let left = event.clientX - this.container.offsetWidth / 2
      if (left < netPane.left) left = netPane.left + 10
      if (left > netPane.right - this.container.offsetWidth) {
        left = netPane.right - this.container.offsetWidth - 10
      }
      this.container.style.top = `${top}px`
      this.container.style.left = `${left}px`
      this.container.well = well
      this.container.callback = callback
      this.container.onChange = onChange
      this.colorPicker.color.rgbaString = well.style.backgroundColor
      this.onclose = this.closeColorPicker.bind(this)
      document.addEventListener('click', this.onclose, true)

      // update well as color is changed
      this.colorPicker.on('color:change', (color) => {
        well.style.backgroundColor = color.rgbaString
        if (onChange) onChange()
      })
    })
  }
  /**
   * Report chosen colour when user clicks outside of picker (and well)
   * Hide the picker and save the colour choice in the previously selected colour grid
   * @param {Event} event
   * @returns {void}
   */
  closeColorPicker(event) {
    if (!(this.container.contains(event.target) || this.container.well.contains(event.target))) {
      this.container.style.display = 'none'
      document.removeEventListener('click', this.onclose, true)
      const color = this.container.well.style.backgroundColor
      // save the chosen color for future selection if it is not already there
      this.saveColor(color)

      const callback = this.container.callback
      if (callback) callback(color)
      this.colorPicker.off('color:change')
    }
  }
  /**
   * Save the color in the previously selected colour grid, if not already saved
   * into a free slot, or if there isn't one shift the current colours to the left
   * and save the new at the right end
   * @param {string} color
   * @returns {void}
   */
  saveColor(color) {
    const saveds = this.colorCache.children
    for (let i = 0; i < 8; i++) {
      if (saveds[i].style.backgroundColor === color) return
    }
    for (let i = 0; i < 8; i++) {
      if (saveds[i].style.backgroundColor === '') {
        saveds[i].style.backgroundColor = color
        return
      }
    }
    for (let i = 0, j = 1; j < 8; i++, j++) {
      saveds[i].style.backgroundColor = saveds[j].style.backgroundColor
    }
    saveds[7].style.backgroundColor = color
  }
}

/**
 * Returns a nicely formatted Date (or time if the date is today), given a Time value (from Date() )
 * @param {number} utc
 * @param {boolean} full - if true, don't use Today in date
 * @returns {string} Formatted local date and time.
 */
export function timeAndDate(utc, full = false) {
  const time = new Date()
  time.setTime(utc)
  if (!full && time.toDateString() === new Date().toDateString()) {
    // return Today, 12:34
    return (
      'Today, ' +
      time.toLocaleString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    )
  }
  if (!full && time.getFullYear() === new Date().getFullYear()) {
    // return 12 Sept, 12:34
    return time.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  // return 12 Sep 2023, 12:34
  return time
    .toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace('Sept', 'Sep')
}
