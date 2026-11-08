/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Records map changes and restores earlier versions.
********************************************************************************************/

import localForage from 'localforage'
import { compressToUTF16, decompressFromUTF16 } from 'lz-string'
import { LOCAL } from '../graph/store.js'
import { alertMsg, dragElement, elem, listen, shorten, timeAndDate } from '../../../js/utils.js'

const MAX_ROLLBACKS = 15
const LABEL_LENGTH = 25
const MOVE_FIELDS = new Set(['x', 'y', 'modified'])
const NOUNS = { nodes: ['factor', 'factors'], edges: ['link', 'links'] }

const ROLLBACK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M1.161 8a6.84 6.84 0 1 0 6.842-6.84.58.58 0 1 1 0-1.16 8 8 0 1 1-6.556 3.412l-.663-.577a.58.58 0 0 1 .227-.997l2.52-.69a.58.58 0 0 1 .728.633l-.332 2.592a.58.58 0 0 1-.956.364l-.643-.56A6.812 6.812 0 0 0 1.16 8z"/><path d="M6.641 11.671V8.843h1.57l1.498 2.828h1.314L9.377 8.665c.897-.3 1.427-1.106 1.427-2.1 0-1.37-.943-2.246-2.456-2.246H5.5v7.352h1.141zm0-3.75V5.277h1.57c.881 0 1.416.499 1.416 1.32 0 .84-.504 1.324-1.386 1.324h-1.6z"/></svg><span class="tooltiptext rollbacktip">Rollback to before this action</span>`

/**
 * Describe the changed records by kind and label or count.
 * @param {'nodes'|'edges'} kind
 * @param {Array<object>} recs records that were changed in the same way
 * @returns {string} e.g. "factor 'Rain'" or "3 links"
 */
function nameOf(kind, recs) {
  const [one, many] = NOUNS[kind]
  if (recs.length > 1) return `${recs.length} ${many}`
  const label = (recs[0].label ?? '').replace(/\s+/g, ' ').trim()
  return label ? `${one} '${shorten(label, LABEL_LENGTH)}'` : `a ${one}`
}

/**
 * Check whether only a record's position and modification stamp changed.
 * @param {object} before record before the change
 * @param {object} after record after the change
 * @returns {boolean} whether only the position changed
 */
function onlyMoved(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].every(
    (k) => MOVE_FIELDS.has(k) || JSON.stringify(before[k]) === JSON.stringify(after[k])
  )
}

/**
 * Describe in words what a transaction did to the factors or links
 * @param {'nodes'|'edges'} kind
 * @param {Map<string, object>} before the records before the transaction, by id
 * @param {import('yjs').Map} ymap the records now
 * @param {Set<string>} ids the ids of the records the transaction changed
 * @returns {string[]} phrases such as "added factor 'Rain'"
 */
export function describeRecords(kind, before, ymap, ids) {
  const groups = { added: [], deleted: [], moved: [], edited: [] }
  for (const id of ids) {
    const old = before.get(id)
    const now = ymap.get(id)
    if (!old && now) groups.added.push(now)
    else if (old && !now) groups.deleted.push(old)
    else if (old && now) groups[onlyMoved(old, now) ? 'moved' : 'edited'].push(now)
  }
  return Object.entries(groups)
    .filter(([, recs]) => recs.length > 0)
    .map(([verb, recs]) => `${verb} ${nameOf(kind, recs)}`)
}

/**
 * The log of what each user did, shown in the history window, with rollback to the map as it was
 * before an action. The log is shared; the snapshots for rollback are kept in this browser, so a user can
 * roll back only their own actions.
 */
export class History {
  /**
   * Connect the shared history log and optional history window.
   * @param {object} app
   * @param {import('../graph/store.js').MapStore} app.store
   * @param {string} app.room
   * @param {boolean} [app.withUI] whether this page has the history window
   */
  constructor({ store, room, withUI = true }) {
    this.store = store
    this.room = room
    this.before = this.capture()
    store.doc.on('afterTransaction', (tr) => this.onTransaction(tr))
    if (!withUI) return
    this.window = elem('history-window')
    store.history.observe(() => this.render())
    dragElement(this.window, elem('history-header'))
    listen('showHistorySwitch', 'click', () => this.show(elem('showHistorySwitch').checked))
    listen('history-close', 'click', () => this.show(false))
    listen('history-copy', 'click', () => this.copy())
  }

  /**
   * Capture the map and records for comparison and rollback.
   * @returns {object} Current file and records keyed by ID.
   */
  capture() {
    const { store } = this
    return {
      file: store.toFile(),
      nodes: new Map(store.nodes.entries()),
      edges: new Map(store.edges.entries()),
    }
  }

  /**
   * Reset the comparison snapshot after loading a map.
   * @returns {void}
   */
  reset() {
    this.before = this.capture()
  }

  /**
   * Describe local transactions and update the comparison snapshot.
   * @param {import('yjs').Transaction} tr
   * @returns {void}
   */
  onTransaction(tr) {
    const text = tr.origin === LOCAL ? this.describe(tr) : null
    const before = this.before
    this.before = this.capture()
    if (text) this.log(text, before.file)
  }

  /**
   * Describe a map transaction for the history log.
   * @param {import('yjs').Transaction} tr
   * @returns {string} what the transaction did, or an empty string
   */
  describe(tr) {
    const { store } = this
    const mergeAction = tr.meta.get('mergeAction')
    if (mergeAction) {
      return `merged a map: added ${mergeAction.nodes} factors and ${mergeAction.edges} links, ${mergeAction.conflicts} renamed factor conflicts`
    }
    const clusterAction = tr.meta.get('clusterAction')
    if (clusterAction) {
      if (clusterAction.mode === 'none') return 'removed clustering'
      const names = { style: 'Style', color: 'Colour', louvain: 'Community' }
      const name =
        names[clusterAction.mode] ??
        store.attributeTitles()[clusterAction.mode] ??
        clusterAction.mode
      return clusterAction.count
        ? `clustered the factors according to their ${name}`
        : `found no clusters according to ${name}`
    }
    const parts = []
    for (const kind of ['nodes', 'edges']) {
      const ids = tr.changed.get(store[kind])
      if (ids) parts.push(...describeRecords(kind, this.before[kind], store[kind], ids))
    }
    if (tr.changed.has(store.styles)) parts.push('edited a style')
    const meta = tr.changed.get(store.meta)
    if (meta?.has('title')) parts.push('renamed the map')
    if (meta && [...meta].some((key) => key !== 'title')) parts.push('changed the map settings')
    return parts.join(', ')
  }

  /**
   * Add a record to the log, and keep the map as it was for rollback
   * @param {string} action
   * @param {object} [state] the map before the action; omit if it can't be rolled back to
   * @returns {Promise<void>} Resolves after saving any rollback snapshot.
   */
  async log(action, state) {
    const time = Date.now()
    this.store.history.push([{ time, user: this.store.userName, action }])
    if (!state) return
    await localForage.setItem(this.key(time), compressToUTF16(JSON.stringify(state)))
    this.prune()
  }

  /**
   * Build the local-storage key for a room's rollback snapshot.
   * @param {number} time Action timestamp.
   * @returns {string} Storage key.
   */
  key(time) {
    return `${this.room}${time}`
  }

  /**
   * Delete snapshots of all but the most recent actions.
   * @returns {void}
   */
  prune() {
    const recs = this.store.history.toArray()
    for (const rec of recs.slice(0, Math.max(0, recs.length - MAX_ROLLBACKS))) {
      localForage.removeItem(this.key(rec.time))
    }
  }

  /**
   * Show or hide the history window.
   * @param {boolean} on Whether the window should be visible.
   * @returns {void}
   */
  show(on) {
    this.window.classList.toggle('show', on)
    elem('showHistorySwitch').checked = on
    if (on) this.render()
  }

  /**
   * Render the shared history and scroll to its latest entry.
   * @returns {void}
   */
  render() {
    if (!this.window.classList.contains('show')) return
    const log = elem('history-log')
    log.replaceChildren(...this.store.history.toArray().flatMap((rec) => this.entry(rec)))
    const wrapper = elem('history-log-wrapper')
    wrapper.scrollTop = wrapper.scrollHeight
  }

  /**
   * Create the cells for one history entry.
   * @param {{time:number,user:string,action:string}} rec
   * @returns {HTMLElement[]} the three cells of a row of the log
   */
  entry(rec) {
    const time = document.createElement('div')
    time.className = 'history-time'
    time.textContent = `${timeAndDate(rec.time)}: `
    const action = document.createElement('div')
    action.className = 'history-action'
    action.textContent = `${rec.user} ${rec.action}`
    const rollback = document.createElement('div')
    rollback.className = 'history-rollback'
    localForage
      .getItem(this.key(rec.time))
      .then((state) => state && this.addRollback(rollback, rec))
    return [time, action, rollback]
  }

  /**
   * Add a rollback control for an action with a saved snapshot.
   * @param {HTMLElement} cell Rollback cell.
   * @param {object} rec History record.
   * @returns {void}
   */
  addRollback(cell, rec) {
    const tip = document.createElement('div')
    tip.className = 'tooltip'
    tip.innerHTML = ROLLBACK_ICON
    tip.addEventListener('click', () => this.rollback(rec.time))
    cell.append(tip)
  }

  /**
   * Put the map back as it was before an action
   * @param {number} time identifies the action
   * @returns {Promise<void>} Resolves after rollback completes or is cancelled.
   */
  async rollback(time) {
    const state = await localForage.getItem(this.key(time))
    if (!state) return
    if (!confirm(`Roll back the map to what it was before ${timeAndDate(time)}?`)) return
    this.store.loadFile(JSON.parse(decompressFromUTF16(state)))
    localForage.removeItem(this.key(time))
    this.reset()
    this.log(`rolled back the map to what it was before ${timeAndDate(time, true)}`)
    alertMsg('The map has been rolled back', 'info')
  }

  /**
   * Copy the shared history log to the clipboard.
   * @returns {void}
   */
  copy() {
    const text = this.store.history
      .toArray()
      .map((rec) => `${timeAndDate(rec.time, true)}: ${rec.user} ${rec.action}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    alertMsg('History copied to the clipboard', 'info')
  }
}
