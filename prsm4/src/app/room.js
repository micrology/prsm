/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Creates room identifiers and determines the collaboration server and document name.
********************************************************************************************/

export const PRODUCTION_SERVER = 'wss://www.prsm.uk/wss'
const LOCAL_SERVER_PORT = 1234
// version 4 maps use a different schema, so they must never share a room name with older maps
const ROOM_PREFIX = 'prsm4'

/**
 * Generate a room identifier.
 * @returns {string} A new random room name, such as ABC-DEF-GHI-JKL.
 */
export function generateRoom() {
  /**
   * Generate one three-letter segment of a room name.
   * @returns {string} Room segment.
   */
  const group = () =>
    Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join(
      ''
    )
  return Array.from({ length: 4 }, group).join('-')
}

/**
 * Read the room identifier from a page URL.
 * @param {URL} url The page's URL.
 * @returns {string} The room named in the URL, or '' if there is none.
 */
export function roomFromUrl(url) {
  return (url.searchParams.get('room') ?? '').toUpperCase()
}

/**
 * Send the browser to the same page with a new room in the URL.
 * @param {string} room The room identifier.
 * @returns {void}
 */
export function redirectToRoom(room) {
  const url = new URL(document.location)
  url.searchParams.set('room', room)
  window.location.replace(url)
}

/**
 * Choose the collaboration server for a page URL.
 * @param {URL} url The page's URL.
 * @returns {string} The Yjs server address, taking account of any URL override.
 */
export function serverUrl(url) {
  const override = url.searchParams.get('ws')
  if (override) return override
  if (url.port && !['80', '443'].includes(url.port)) {
    return `ws://${url.hostname}:${LOCAL_SERVER_PORT}`
  }
  return PRODUCTION_SERVER
}

/**
 * Get the PRSM 4 document name for a room.
 * @param {string} room The room identifier.
 * @returns {string} The name of the Yjs document.
 */
export function docName(room) {
  return `${ROOM_PREFIX}${room}`
}
