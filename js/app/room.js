export const PRODUCTION_SERVER = 'wss://www.prsm.uk/wss'
const LOCAL_SERVER_PORT = 1234
// version 4 maps use a different schema, so they must never share a room name with older maps
const ROOM_PREFIX = 'prsm4'

/**
 * @returns {string} a new random room name, such as ABC-DEF-GHI-JKL
 */
export function generateRoom() {
  const group = () =>
    Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join(
      ''
    )
  return Array.from({ length: 4 }, group).join('-')
}

/**
 * @param {URL} url the page's URL
 * @returns {string} the room named in the URL, or '' if there is none
 */
export function roomFromUrl(url) {
  return (url.searchParams.get('room') ?? '').toUpperCase()
}

/**
 * Send the browser to the same page with a new room in the URL
 * @param {string} room
 */
export function redirectToRoom(room) {
  const url = new URL(document.location)
  url.searchParams.set('room', room)
  window.location.replace(url)
}

/**
 * @param {URL} url the page's URL
 * @returns {string} the web socket address of the Yjs server: ?ws=... overrides the default,
 * and a page served from a non-standard port is assumed to be in development
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
 * @param {string} room
 * @returns {string} the name of the Yjs document for the room
 */
export function docName(room) {
  return `${ROOM_PREFIX}${room}`
}
