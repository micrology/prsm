/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Edits the properties of a factor or link.
********************************************************************************************/

/* ****************************************************************************************
elementeditor.js: the dialog that opens over a factor or link when it is double-clicked, to edit
its label and override its appearance. The fields are the same columns that the table uses
(columns.js), so reading and writing a value is done in exactly one place. Nothing is written
until Save is pressed, and then all the changes form a single undoable transaction.
**************************************************************************************** */
import { factorColumns, linkColumns } from './columns.js'
import { splitText } from './text.js'
import { colorWell } from './colorwell.js'
import { SHAPES, ARROWS, LINE_STYLES } from './styleeditor.js'

const SLIDER_MIN = 5
const FONT_SIZES = [
  ['Large', 24],
  ['Normal', 14],
  ['Small', 10],
]
/**
 * Make labelled choices from lowercase option values.
 * @param {Array<string>} list Option values.
 * @returns {Array<Array<string>>} Capitalized labels paired with their values.
 */
const CAPITALISED = (list) => list.map((s) => [s[0].toUpperCase() + s.slice(1), s])

const NODE_FIELDS = [
  { col: 'fill', kind: 'color', title: 'fill' },
  { col: 'borderColor', kind: 'color', title: 'border' },
  { col: 'fontColor', kind: 'color', title: 'font' },
  { col: 'shape', kind: 'select', options: CAPITALISED(SHAPES) },
  {
    col: 'borderStyle',
    kind: 'select',
    options: [
      ['Solid', 'Solid'],
      ['Dashed', 'Dashed'],
      ['Dotted', 'Dotted'],
      ['No border', 'None'],
    ],
  },
  { col: 'fontSize', kind: 'select', options: FONT_SIZES },
  { col: 'value', kind: 'size', title: 'size' },
]
const EDGE_FIELDS = [
  { col: 'color', kind: 'color', title: 'colour' },
  {
    col: 'width',
    kind: 'select',
    options: [
      ['Width: 1', 1],
      ['Width: 4', 4],
      ['Width: 8', 8],
    ],
  },
  { col: 'arrow', kind: 'select', options: CAPITALISED(ARROWS) },
  { col: 'lineStyle', kind: 'select', options: CAPITALISED(LINE_STYLES) },
  { col: 'fontSize', kind: 'select', options: FONT_SIZES },
]
const MARGIN = 8

/**
 * Make a DOM element
 * @param {string} tag
 * @param {object} [props]
 * @param {...(Node|string)} children
 * @returns {HTMLElement}
 */
function el(tag, props = {}, ...children) {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...children)
  return e
}

/**
 * The dialog for editing one factor or link. Only one is open at a time.
 */
export class ElementEditor {
  /**
   * Create an editor for graph elements.
   * @param {cytoscape.Core} cy the graph the dialog is shown over
   * @param {MapStore} store
   */
  constructor(cy, store) {
    this.cy = cy
    this.store = store
    this.box = null
  }

  /**
   * Open the dialog over a factor or link
   * @param {cytoscape.SingularElementReturnValue} ele
   * @returns {void}
   */
  open(ele) {
    this.close()
    const isNode = ele.isNode()
    const rec = (isNode ? this.store.nodes : this.store.edges).get(ele.id())
    if (!rec || rec.locked) return
    const cols = isNode ? factorColumns(this.store) : linkColumns(this.store)
    this.target = { id: ele.id(), isNode, rec }
    this.changes = new Map()
    this.label = el('textarea', {
      className: 'element-label',
      rows: 1,
      placeholder: isNode ? 'Factor label...' : 'Link label...',
      value: rec.label ?? '',
    })
    const fields = (isNode ? NODE_FIELDS : EDGE_FIELDS).map((f) => this.field(f, cols))
    this.box = el(
      'div',
      { className: 'element-editor' },
      el('div', { className: 'element-title' }, isNode ? 'Edit Factor' : 'Edit Link'),
      this.label,
      el('div', { className: 'element-grid' }, ...fields.filter(Boolean)),
      this.buttons()
    )
    this.box.addEventListener('keydown', (e) => this.onKey(e))
    this.label.addEventListener('input', () => this.fitLabel())
    // the graph listens on its container, so keep the dialog's own events away from it
    for (const type of ['mousedown', 'touchstart', 'wheel', 'dblclick']) {
      this.box.addEventListener(type, (e) => e.stopPropagation())
    }
    this.cy.container().append(this.box)
    this.fitLabel()
    this.place(ele)
    this.label.focus()
    this.label.select()
  }

  /**
   * Size the label box to show its entire contents.
   * @returns {void}
   */
  fitLabel() {
    this.label.style.height = 'auto'
    this.label.style.height = `${this.label.scrollHeight}px`
  }

  /**
   * Close the dialog without saving.
   * @returns {void}
   */
  close() {
    this.box?.remove()
    this.box = null
  }

  /**
   * Check whether the dialog is open.
   * @returns {boolean} Whether the dialog is open.
   */
  get isOpen() {
    return Boolean(this.box)
  }

  /**
   * Create an editing control for a supported field.
   * @param {object} field description from NODE_FIELDS or EDGE_FIELDS
   * @param {Array<object>} cols the table columns
   * @returns {HTMLElement|null} a labelled control for the field
   */
  field(field, cols) {
    const col = cols.find((c) => c.id === field.col)
    if (!col) return null
    const current = col.get(this.target)
    const control =
      field.kind === 'color'
        ? this.colorControl(col, current)
        : field.kind === 'size'
          ? this.sizeControl(col, current)
          : this.selectControl(field, col, current)
    const wide = field.kind === 'size' ? ' wide' : ''
    return el(
      'label',
      { className: `element-field${wide}` },
      el('span', { className: 'element-field-title', textContent: field.title ?? '' }),
      control
    )
  }

  /**
   * Create a colour control that stages changes to a column.
   * @param {object} col Column definition.
   * @param {*} current Current colour.
   * @returns {HTMLElement} Colour control.
   */
  colorControl(col, current) {
    return colorWell(current, {
      /**
       * Stage a changed colour.
       * @param {string} color Chosen colour.
       * @returns {Map} Pending changes.
       */
      onInput: (color) => this.changes.set(col, color),
    })
  }

  /**
   * Create a slider that stages factor-size changes.
   * @param {object} col Column definition.
   * @param {number} current Current size.
   * @returns {HTMLElement} Size control.
   */
  sizeControl(col, current) {
    const input = el('input', {
      type: 'range',
      min: 0,
      max: 100,
      value: current >= SLIDER_MIN ? current : 0,
    })
    input.addEventListener('input', () => {
      this.changes.set(col, input.value >= SLIDER_MIN ? Number(input.value) : undefined)
    })
    return input
  }

  /**
   * Create a choice control that stages field changes.
   * @param {object} field Field and options.
   * @param {object} col Column definition.
   * @param {*} current Current value.
   * @returns {HTMLElement} Selection control.
   */
  selectControl(field, col, current) {
    const options = field.options.map(([text, value]) => el('option', { textContent: text, value }))
    const select = el('select', {}, el('option', { value: '', textContent: `${col.title}...` }))
    select.append(...options)
    const match = options.find(
      (o) => String(o.value).toLowerCase() === String(current).toLowerCase()
    )
    if (match) select.value = match.value
    else if (current !== undefined && current !== null) {
      select.append(el('option', { value: current, textContent: String(current) }))
      select.value = current
    }
    select.addEventListener('change', () => {
      if (select.value === '') return
      this.changes.set(col, col.type === 'number' ? Number(select.value) : select.value)
    })
    return select
  }

  /**
   * Create the editor's save and cancel controls.
   * @returns {HTMLElement} Button container.
   */
  buttons() {
    const save = el('button', { className: 'element-save', textContent: 'Save' })
    const cancel = el('button', { className: 'element-cancel', textContent: '✕', title: 'Cancel' })
    save.addEventListener('click', () => this.save())
    cancel.addEventListener('click', () => this.close())
    return el('div', { className: 'element-buttons' }, cancel, save)
  }

  /**
   * Handle save and cancel shortcuts inside the editor.
   * @param {KeyboardEvent} e Key event.
   * @returns {void}
   */
  onKey(e) {
    e.stopPropagation()
    if (e.key === 'Escape') this.close()
    else if (e.key === 'Enter' && !e.shiftKey && e.target === this.label) {
      e.preventDefault()
      this.save()
    }
  }

  /**
   * Save the label and changed fields as one undoable step and close.
   * @returns {void}
   */
  save() {
    const { id, isNode, rec } = this.target
    const name = isNode ? 'nodes' : 'edges'
    const label = isNode ? splitText(this.label.value) : this.label.value
    const labelEmpty = isNode && label.trim() === ''
    this.close()
    if (labelEmpty) return
    this.store.transact(() => {
      if (label !== (rec.label ?? '')) this.store.update(name, id, { label })
      for (const [col, value] of this.changes) col.set([id], value)
    })
  }

  /**
   * Put the dialog over the element, but keep it inside the graph
   * @param {cytoscape.SingularElementReturnValue} ele
   * @returns {void}
   */
  place(ele) {
    const centre = ele.isNode() ? ele.renderedPosition() : ele.renderedMidpoint()
    const { width, height } = this.cy.container().getBoundingClientRect()
    const w = this.box.offsetWidth
    const h = this.box.offsetHeight
    const left = Math.min(Math.max(centre.x - w / 2, MARGIN), Math.max(MARGIN, width - w - MARGIN))
    const top = Math.min(Math.max(centre.y - h / 2, MARGIN), Math.max(MARGIN, height - h - MARGIN))
    this.box.style.setProperty('--x', `${left}px`)
    this.box.style.setProperty('--y', `${top}px`)
  }
}
