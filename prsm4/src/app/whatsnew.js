import { major, minor, valid } from 'semver'
import { elem } from '../shared/utils.js'

const SEEN_KEY = 'prsm4SeenWhatsNew'

/**
 * Check whether this version's release notes should be shown.
 * @param {string} version Current application version.
 * @param {Storage} storage User's local storage.
 * @returns {boolean} Whether there is a new release to show.
 */
export function shouldShowWhatsNew(version, storage) {
  if (!valid(version)) throw new Error(`Invalid PRSM version: ${version}`)
  if (storage.getItem('doneIntro') === null) return false
  const seen = storage.getItem(SEEN_KEY)
  if (seen === null) return true
  if (!valid(seen)) {
    console.warn(`Invalid saved What's New version: ${seen}`)
    return true
  }
  return (
    major(version) > major(seen) || (major(version) === major(seen) && minor(version) > minor(seen))
  )
}

/**
 * Load and show release notes, recording the version only after they are displayed.
 * @param {string} version Current application version.
 * @returns {Promise<void>}
 */
export async function showWhatsNew(version) {
  if (!shouldShowWhatsNew(version, localStorage)) return
  const response = await fetch('./whatsnew.html', { cache: 'no-cache' })
  if (!response.ok) throw new Error(`What's New request failed: ${response.status}`)
  const html = await response.text()
  const dialog = elem('whatsnew')
  elem('whatsnewversion').textContent = `Version ${version}`
  elem('whatsnewlist').innerHTML = html
  let pressedOutside = false
  const outside = (event) => {
    const rect = dialog.getBoundingClientRect()
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
  }
  dialog.addEventListener('pointerdown', (event) => (pressedOutside = outside(event)))
  dialog.addEventListener('pointerup', (event) => {
    if (pressedOutside && outside(event)) dialog.close()
    pressedOutside = false
  })
  // Keep window-level shortcuts from suppressing the dialog's native Escape handling.
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') event.stopPropagation()
  })
  dialog.showModal()
  localStorage.setItem(SEEN_KEY, version)
}
