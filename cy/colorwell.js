/* ****************************************************************************************
colorwell.js: a small coloured square that opens PRSM's colour picker (the iro.js one in
utils.js) when clicked. The same picker is used everywhere so that it looks and behaves the
same on every system. Where no picker has been installed (the test bed), a native colour input
is used instead.
**************************************************************************************** */

let picker = null

/**
 * @param {object} colorPicker the CP object from utils.js
 */
export function useColorPicker(colorPicker) {
  picker = colorPicker
}

/**
 * @param {string} value any CSS colour
 * @param {object} [handlers]
 * @param {function(string):void} [handlers.onInput] called with the colour as it is being changed
 * @param {function(string):void} [handlers.onCommit] called with the colour when the picker closes
 * @returns {HTMLElement} the element to put in the page
 */
export function colorWell(value, { onInput, onCommit } = {}) {
  if (!picker) return nativeWell(value, onInput, onCommit)
  const well = document.createElement('div')
  well.className = 'color-well'
  well.style.backgroundColor = value || '#ffffff'
  picker.attachTo(
    well,
    (color) => onCommit?.(color),
    () => onInput?.(well.style.backgroundColor)
  )
  return well
}

function nativeWell(value, onInput, onCommit) {
  const input = document.createElement('input')
  input.type = 'color'
  input.value = value
  input.addEventListener('input', () => onInput?.(input.value))
  input.addEventListener('change', () => onCommit?.(input.value))
  return input
}
