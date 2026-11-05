import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { dragElement, elem, listen, shorten, timeAndDate } from '../utils.js'
import { hasNote } from './badges.js'

const TOOLBAR = [
  'bold',
  'italic',
  'underline',
  'link',
  { list: 'ordered' },
  { list: 'bullet' },
  { indent: '-1' },
  { indent: '+1' },
]
const MIN_WIDTH = 150
const MIN_HEIGHT = 200

/** The ids of the parts of the panel that shows a factor, and of the one that shows a link */
const PARTS = {
  nodes: {
    panel: 'nodeNotePanel',
    header: 'nodeNoteHeader',
    label: 'nodeLabel',
    body: 'node-notes',
    prefix: 'node',
  },
  edges: {
    panel: 'edgeNotePanel',
    header: 'edgeNoteHeader',
    label: 'edgeLabel',
    body: 'edge-notes',
    prefix: 'edge',
  },
}

/**
 * Make a panel resizeable by dragging its two corner handles
 * @param {HTMLElement} panel
 */
function makeResizeable(panel) {
  grabHandle(panel.querySelector('.corner-handle'), panel, (box, dx, dy) => ({
    width: box.width + dx,
    height: box.height + dy,
  }))
  grabHandle(panel.querySelector('.corner-handle-top-left'), panel, (box, dx, dy) => ({
    width: box.width - dx,
    height: box.height - dy,
    left: box.left + dx,
    top: box.top + dy,
  }))
}

/**
 * @param {HTMLElement} handle
 * @param {HTMLElement} panel
 * @param {function} resize given the starting box and the pointer movement, returns the new box
 */
function grabHandle(handle, panel, resize) {
  let start = null
  handle.addEventListener('pointerdown', (e) => {
    const box = panel.getBoundingClientRect()
    const parent = panel.offsetParent.getBoundingClientRect()
    start = {
      x: e.clientX,
      y: e.clientY,
      box: {
        width: box.width,
        height: box.height,
        left: box.left - parent.left,
        top: box.top - parent.top,
      },
    }
    handle.setPointerCapture(e.pointerId)
  })
  handle.addEventListener('pointermove', (e) => {
    if (start) applyBox(panel, resize(start.box, e.clientX - start.x, e.clientY - start.y))
  })
  handle.addEventListener('pointerup', () => (start = null))
}

/**
 * @param {HTMLElement} panel
 * @param {{width:number,height:number,left?:number,top?:number}} box
 */
function applyBox(panel, box) {
  if (box.width < MIN_WIDTH || box.height < MIN_HEIGHT) return
  panel.style.width = `${box.width}px`
  panel.style.height = `${box.height}px`
  if (box.left !== undefined) panel.style.left = `${box.left}px`
  if (box.top !== undefined) panel.style.top = `${box.top}px`
}

/**
 * The panel that shows, and lets the user edit, the Notes of the selected factor or link.
 * It appears when exactly one factor or link is selected and Show notes is on.
 */
export class NotesPanel {
  /**
   * @param {object} app
   * @param {import('../../cy/store.js').MapStore} app.store
   * @param {cytoscape.Core} app.cy
   */
  constructor({ store, cy }) {
    this.store = store
    this.cy = cy
    this.shown = null
    this.pending = false
    this.editors = {}
    for (const [kind, parts] of Object.entries(PARTS)) this.setUpPanel(kind, parts)
    listen('pin', 'click', () => this.togglePin())
    cy.on('select unselect remove', () => this.requestRefresh())
    store.doc.on('afterTransaction', (tr) => this.onChange(tr))
    this.refresh()
  }

  /**
   * @param {'nodes'|'edges'} kind
   * @param {object} parts ids of the elements that make up the panel
   */
  setUpPanel(kind, parts) {
    const panel = elem(parts.panel)
    dragElement(panel, elem(parts.header))
    makeResizeable(panel)
    const editor = new Quill(`#${parts.body}`, {
      modules: { toolbar: TOOLBAR },
      placeholder: 'Notes',
      theme: 'snow',
    })
    editor.on('text-change', (delta, old, source) => source === 'user' && this.saveNote(kind))
    this.editors[kind] = editor
  }

  /** @returns {boolean} whether notes are to be shown */
  get enabled() {
    return this.store.meta.get('settings')?.showNotes ?? true
  }

  requestRefresh() {
    if (this.pending) return
    this.pending = true
    queueMicrotask(() => {
      this.pending = false
      this.refresh()
    })
  }

  /** Show the panel for the one selected factor or link, or hide it */
  refresh() {
    const selected = this.cy.elements(':selected').filter((e) => !e.hasClass('meta'))
    if (!this.enabled || selected.length !== 1) return this.hide()
    const ele = selected[0]
    const kind = ele.isNode() ? 'nodes' : 'edges'
    if (this.shown?.id === ele.id()) return this.showDetails(kind, ele.id())
    this.hide()
    this.shown = { kind, id: ele.id() }
    this.showDetails(kind, ele.id())
    this.editors[kind].setContents(this.contentsOf(kind, ele.id()), 'silent')
    elem(PARTS[kind].panel).classList.remove('hide')
  }

  hide() {
    if (!this.shown) return
    elem(PARTS[this.shown.kind].panel).classList.add('hide')
    document.getSelection().removeAllRanges()
    this.shown = null
  }

  /**
   * @param {'nodes'|'edges'} kind
   * @param {string} id
   * @returns {object} the note of the factor or link as a Quill delta
   */
  contentsOf(kind, id) {
    const note = this.store[kind].get(id)?.note
    if (note instanceof Object) return note
    return { ops: [{ insert: `${note ?? ''}\n` }] }
  }

  /**
   * Fill in the label, the creation and modification details and the pin
   * @param {'nodes'|'edges'} kind
   * @param {string} id
   */
  showDetails(kind, id) {
    const rec = this.store[kind].get(id)
    if (!rec) return
    const { label, prefix } = PARTS[kind]
    elem(label).textContent = shorten((rec.label ?? '').replace(/\n/g, ' '))
    this.showStamp(`${prefix}Creation`, `${prefix}Created`, rec.created)
    this.showStamp(`${prefix}Modification`, `${prefix}Modified`, rec.modified)
    if (kind === 'nodes') this.showPin(Boolean(rec.locked))
  }

  /**
   * @param {string} rowId
   * @param {string} textId
   * @param {{time:number,user:string}|undefined} stamp
   */
  showStamp(rowId, textId, stamp) {
    elem(rowId).classList.toggle('gone', !stamp)
    if (stamp) elem(textId).textContent = `${timeAndDate(stamp.time)} by ${stamp.user}`
  }

  /**
   * @param {boolean} pinned
   */
  showPin(pinned) {
    elem('fixed').classList.toggle('gone', !pinned)
    elem('unfixed').classList.toggle('gone', pinned)
  }

  togglePin() {
    if (this.shown?.kind !== 'nodes') return
    const locked = this.store.nodes.get(this.shown.id)?.locked
    this.store.update('nodes', this.shown.id, { locked: locked ? undefined : true })
  }

  /**
   * @param {'nodes'|'edges'} kind
   */
  saveNote(kind) {
    if (this.shown?.kind !== kind) return
    const note = { ops: this.editors[kind].getContents().ops }
    this.store.update(kind, this.shown.id, { note: hasNote(note) ? note : undefined })
  }

  /**
   * Keep the panel up to date with changes made by other users, by undo, or by the switch
   * @param {import('yjs').Transaction} tr
   */
  onChange(tr) {
    if (tr.changed.has(this.store.meta)) this.refresh()
    if (!this.shown) return
    const { kind, id } = this.shown
    if (!this.store[kind].has(id)) return this.refresh()
    if (!tr.changed.get(this.store[kind])?.has(id)) return
    this.showDetails(kind, id)
    this.syncContents(kind, id)
  }

  /**
   * Replace the text in the editor if the stored note is not what it shows
   * @param {'nodes'|'edges'} kind
   * @param {string} id
   */
  syncContents(kind, id) {
    const editor = this.editors[kind]
    const stored = this.contentsOf(kind, id)
    const shown = editor.getContents().ops
    if (JSON.stringify(stored.ops) === JSON.stringify(shown)) return
    if (!hasNote(stored) && !hasNote({ ops: shown })) return
    editor.setContents(stored, 'silent')
  }
}
