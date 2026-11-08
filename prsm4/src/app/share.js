/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Provides links for sharing maps and opening the data view.
********************************************************************************************/

import QRCode from 'qrcode'
import { alertMsg, elem, listen } from '../../../js/utils.js'
import { initialiseClone } from './clone.js'
import { generateRoom, serverUrl } from './room.js'

/**
 * Wait until the copy tab has joined its new room.
 * @param {Window} tab Copy tab.
 * @param {string} room Expected room identifier.
 * @returns {Promise<void>} Resolves when the tab has synchronized.
 */
function waitForCopy(tab, room) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const timer = setInterval(() => {
      try {
        if (tab.closed) throw new Error('The copy tab was closed')
        if (tab.prsm?.room === room && tab.prsm.provider.synced) {
          clearInterval(timer)
          resolve()
        } else if (Date.now() - start > 15000) {
          throw new Error('The copy could not connect to its room')
        }
      } catch (error) {
        clearInterval(timer)
        reject(error)
      }
    }, 100)
  })
}

/** Sharing the current editable room with other participants. */
export class Share {
  /**
   * Connect sharing controls to the current map.
   * @param {object} options Sharing dependencies.
   * @param {import('../graph/store.js').MapStore} options.store Current map.
   * @param {import('y-websocket').WebsocketProvider} options.provider Collaboration connection.
   */
  constructor({ store, provider }) {
    this.store = store
    this.provider = provider
    this.dialog = elem('shareModal')
    listen('share', 'click', () => this.open())
    listen('modal-close', 'click', () => this.dialog.close())
    listen('copy-text', 'click', () => this.copy())
    listen('table-button', 'click', () => this.openTable())
    listen('clone-button', 'click', () => this.openClone())
    listen('view-button', 'click', () => this.openClone(true))
    listen('copy-map', 'click', () => this.openClone())
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.dialog.close()
    })
  }

  /**
   * Create a separate editable or read-only copy without changing the current room.
   * @param {boolean} [viewOnly] Whether the copy should use the view-only interface.
   * @returns {Promise<void>} Resolves after the copy opens or an error is reported.
   */
  async openClone(viewOnly = false) {
    if (!this.provider.synced) {
      alertMsg('Connect to the map before creating a copy.', 'error')
      return
    }
    const tab = window.open('about:blank', '_blank')
    if (!tab) {
      alertMsg('Could not open the copy. Please allow pop-ups for PRSM.', 'error')
      return
    }
    const buttons = ['clone-button', 'view-button', 'copy-map'].map(elem)
    buttons.forEach((button) => (button.disabled = true))
    const url = new URL(location.href)
    const room = generateRoom()
    const file = this.store.toFile()
    delete file.meta.viewOnly
    delete file.meta.allowCopy
    if (viewOnly) {
      file.meta.viewOnly = true
      file.meta.allowCopy = elem('addCopyButton').checked
    }
    let release
    try {
      release = await initialiseClone(file, serverUrl(url), room)
      url.search = ''
      url.searchParams.set('room', room)
      const server = new URL(location.href).searchParams.get('ws')
      if (server) url.searchParams.set('ws', server)
      url.hash = ''
      tab.location.replace(url.href)
      await waitForCopy(tab, room)
      if (this.dialog.open) this.dialog.close()
    } catch (error) {
      tab.close()
      alertMsg(`Could not create the copy: ${error.message}`, 'error')
    } finally {
      release?.()
      buttons.forEach((button) => (button.disabled = false))
    }
  }

  /**
   * Open a separate table view of the same room and server.
   * @returns {void}
   */
  openTable() {
    const url = new URL('table4.html', window.location.href)
    const current = new URL(window.location.href)
    for (const key of ['room', 'ws']) {
      if (current.searchParams.has(key)) url.searchParams.set(key, current.searchParams.get(key))
    }
    if (!window.open(url.href, '_blank')) {
      alertMsg('Could not open the data view. Please allow pop-ups for PRSM.', 'error')
      return
    }
    this.dialog.close()
  }

  /**
   * Show the room link and a QR code containing the same link.
   * @returns {Promise<void>} Resolves after the QR code is created or an error is reported.
   */
  async open() {
    const url = new URL(window.location.href)
    for (const key of [...url.searchParams.keys()]) {
      if (!['room', 'ws'].includes(key)) url.searchParams.delete(key)
    }
    url.hash = ''
    const link = url.href
    elem('text-to-copy').value = link
    const viewOnly = Boolean(this.store.meta.get('viewOnly'))
    elem('share-invite').textContent = viewOnly
      ? 'Share this read-only map using the QR code or link:'
      : 'To invite others to participate in developing this map, show them the QR code or send them the link:'
    elem('share-clone').hidden = viewOnly && !this.store.meta.get('allowCopy')
    elem('clone-button').hidden = elem('share-clone').hidden
    elem('share-view').hidden = viewOnly
    elem('view-button').hidden = viewOnly
    elem('copied-text').classList.remove('show')
    const image = elem('qr-code')
    image.removeAttribute('src')
    this.dialog.showModal()
    try {
      const source = await QRCode.toDataURL(link)
      if (this.dialog.open && elem('text-to-copy').value === link) image.src = source
    } catch (error) {
      alertMsg(`Could not create the QR code: ${error.message}`, 'error')
    }
  }

  /**
   * Copy the link, or select it for manual copying if clipboard access is unavailable.
   * @returns {Promise<void>} Resolves after copying or reporting an error.
   */
  async copy() {
    const input = elem('text-to-copy')
    try {
      await navigator.clipboard.writeText(input.value)
      elem('copied-text').classList.add('show')
    } catch (error) {
      input.focus()
      input.select()
      alertMsg(
        `Could not copy the link: ${error.message}. Copy the selected link manually.`,
        'error'
      )
    }
  }
}
