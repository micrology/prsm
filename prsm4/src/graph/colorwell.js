/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Provides colour selection for graph editors.
********************************************************************************************/

/* ****************************************************************************************
colorwell.js: a small coloured square that opens PRSM's colour picker (the iro.js one in
utils.js) when clicked. The same picker is used everywhere so that it looks and behaves the
same on every system. Where no picker has been installed (the test bed), a native colour input
is used instead.
**************************************************************************************** */

let picker = null

/**
 * Install the shared colour picker used by editor wells.
 * @param {object} colorPicker the CP object from utils.js
 * @returns {void}
 */
export function useColorPicker(colorPicker) {
  picker = colorPicker
}

/**
 * Create a colour well with live and committed change handlers.
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

/**
 * Create a native colour input when no shared picker is installed.
 * @param {string} value Initial colour.
 * @param {function} [onInput] Called as the value changes.
 * @param {function} [onCommit] Called when the value is committed.
 * @returns {HTMLInputElement} Native colour input.
 */
function nativeWell(value, onInput, onCommit) {
  const input = document.createElement('input')
  input.type = 'color'
  input.value = value
  input.addEventListener('input', () => onInput?.(input.value))
  input.addEventListener('change', () => onCommit?.(input.value))
  return input
}
