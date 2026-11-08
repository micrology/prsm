/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Starts the PRSM 4 data view.
********************************************************************************************/

import { WebsocketProvider } from 'y-websocket'
import { MapStore } from '../graph/store.js'
import { TableView } from '../graph/tableview.js'
import { useColorPicker } from '../graph/colorwell.js'
import { CP } from '../../../js/utils.js'
import { History } from './history.js'
import { docName, roomFromUrl, serverUrl } from './room.js'
import { loadUser } from './user.js'
import '../graph/editors.css'

const url = new URL(location.href)
const room = roomFromUrl(url)
const status = document.getElementById('table-status')
const title = document.getElementById('table-title')
const container = document.getElementById('table')

if (!room) {
  status.textContent = 'No map room was specified. Open the data view from a map.'
} else {
  const store = new MapStore()
  const provider = new WebsocketProvider(serverUrl(url), docName(room), store.doc)
  store.userName = loadUser(provider.awareness.clientID).name
  const history = new History({ store, room, withUI: false })
  /**
   * Reflect the shared map title in the page and browser tab.
   * @returns {void}
   */
  const showTitle = () => {
    title.textContent = `${store.meta.get('title') || 'Untitled map'} — data view`
    document.title = title.textContent
  }
  store.meta.observe(showTitle)
  useColorPicker(new CP(container))
  const table = new TableView(container, store, {
    /**
     * Show clipboard errors in the table status.
     * @param {Error} error Clipboard error.
     * @returns {string} Status text.
     */
    onError: (error) => (status.textContent = `Could not copy the table: ${error.message}`),
    /**
     * Check whether the map uses the view-only interface.
     * @returns {boolean} Whether editing is disabled.
     */
    readOnly: () => Boolean(store.meta.get('viewOnly')),
  })
  const timer = setTimeout(() => {
    status.textContent = 'Could not connect to the map yet. Retrying...'
  }, 8000)
  provider.once('sync', () => {
    clearTimeout(timer)
    history.reset()
    store.undoManager.clear()
    showTitle()
    container.hidden = false
    table.render()
    status.textContent = store.meta.get('viewOnly')
      ? 'Read-only view (not server-enforced access control).'
      : 'Connected. Changes to the table are shared with the map.'
  })
  provider.on('status', ({ status: state }) => {
    if (state === 'disconnected') {
      status.textContent = 'Disconnected. Changes will be shared when the connection returns.'
    } else if (state === 'connected' && !container.hidden) {
      status.textContent = store.meta.get('viewOnly')
        ? 'Read-only view (not server-enforced access control).'
        : 'Connected. Changes to the table are shared with the map.'
    }
  })
}
