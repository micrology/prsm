/* ****************************************************************************************
tableview.js: the tabular view of a map. Rows come straight from a MapStore; every edit calls a
MapStore method (through the setters in columns.js), so undo/redo and sharing work as for the
graph. The table is re-drawn (after a short delay) after any change to the store.
**************************************************************************************** */
import { computeStats } from './stats.js'
import { factorColumns, linkColumns } from './columns.js'
import {
  cellValue,
  displayValue,
  sortRows,
  filterRows,
  footerValue,
  FILTER_OPS,
} from './tablemodel.js'
import { editNote } from './noteeditor.js'
import { NOTE_PREVIEW_LENGTH } from './columns.js'

const GROUP_TITLES = {
  factors: {
    main: '',
    format: 'Format',
    statistics: 'Statistics',
    attributes: 'Attributes',
    notes: 'Notes',
  },
  links: { main: '', format: 'Style', attributes: 'Attributes', notes: 'LinkNotes' },
}

/**
 * @param {string} text
 * @param {number} limit
 * @returns {string} text on one line, cut to limit characters with an ellipsis if longer
 */
function shorten(text, limit) {
  const flat = text.replace(/\s+/g, ' ')
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat
}

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
 * The table window's content: tabs, toolbar, the table itself
 */
export class TableView {
  /**
   * @param {HTMLElement} container
   * @param {MapStore} store
   * @param {{onSelect?: function(Set<string>):void}} [options] onSelect is called when the user
   *   changes which rows are selected
   */
  constructor(container, store, options = {}) {
    this.container = container
    this.store = store
    this.onSelect = options.onSelect ?? (() => {})
    this.tab = 'factors'
    this.sort = null
    this.filter = { field: 'label', op: 'like', value: '' }
    this.filterOpen = false
    this.collapsed = new Set()
    this.selected = new Set()
    this.editing = false
    this.pending = false
    this.statsDirty = true
    this.knownNodes = new Set()
    this.build()
    store.doc.on('afterTransaction', (tr) => this.onTransaction(tr))
    this.render()
  }

  /** @param {Y.Transaction} tr */
  onTransaction(tr) {
    const nodeKeys = tr.changed.get(this.store.nodes)
    if (tr.changed.has(this.store.edges)) this.statsDirty = true
    if (nodeKeys) {
      for (const k of nodeKeys) {
        if (!this.knownNodes.has(k) || !this.store.nodes.has(k)) this.statsDirty = true
      }
    }
    this.schedule()
  }

  schedule() {
    if (this.pending) return
    this.pending = true
    setTimeout(() => {
      this.pending = false
      if (this.editing) this.dirty = true
      else this.render()
    }, 16)
  }

  /**
   * Set which rows are shown as selected (used to follow the selection in the graph)
   * @param {Set<string>} ids
   */
  setSelection(ids) {
    this.selected = new Set(ids)
    this.schedule()
  }

  build() {
    this.tabs = ['factors', 'links'].map((t) =>
      el('button', { textContent: t === 'factors' ? 'Factors' : 'Links', className: 'tab' })
    )
    this.tabs.forEach((b, i) =>
      b.addEventListener('click', () => {
        this.tab = i ? 'links' : 'factors'
        this.sort = null
        this.filter.field = this.tab === 'factors' ? 'label' : 'from'
        this.render()
      })
    )
    const button = (text, fn) => {
      const b = el('button', { textContent: text })
      b.addEventListener('click', fn)
      return b
    }
    this.addColumnButton = button('Add column', () => this.store.addAttribute())
    const bar = el(
      'div',
      { className: 'table-bar' },
      ...this.tabs,
      button('Filter', () => this.toggleFilter()),
      button('Copy', () => this.copy()),
      this.addColumnButton,
      button('Undo', () => this.store.undo()),
      button('Redo', () => this.store.redo())
    )
    this.filterBar = el('div', { className: 'table-filter', hidden: true })
    this.scroller = el('div', { className: 'table-scroll' })
    this.container.replaceChildren(bar, this.filterBar, this.scroller)
  }

  /** @returns {Array<object>} the columns of the current tab */
  columns() {
    return this.tab === 'factors' ? factorColumns(this.store) : linkColumns(this.store)
  }

  /** @returns {{rows: Array<object>, clusters: number}} unsorted, unfiltered rows */
  allRows() {
    if (this.statsDirty) this.refreshStats()
    const rows = []
    let clusters = 0
    const source = this.tab === 'factors' ? this.store.nodes : this.store.edges
    for (const [id, rec] of source.entries()) {
      if (rec.cluster) clusters++
      else rows.push({ id, rec, stats: this.stats.get(id) })
    }
    return { rows, clusters }
  }

  refreshStats() {
    this.stats = computeStats(this.store)
    this.knownNodes = new Set(this.store.nodes.keys())
    this.statsDirty = false
  }

  /** @returns {Array<object>} the rows to show, filtered and sorted */
  shownRows(cols, rows) {
    const col = cols.find((c) => c.id === this.filter.field)
    let shown = this.filterOpen ? filterRows(rows, col, this.filter.op, this.filter.value) : rows
    if (this.sort) {
      const sortCol = cols.find((c) => c.id === this.sort.id)
      if (sortCol) shown = sortRows(shown, sortCol, this.sort.dir, this.selected)
    }
    return shown
  }

  render() {
    this.dirty = false
    const scroll = { top: this.scroller.scrollTop, left: this.scroller.scrollLeft }
    const cols = this.columns()
    const { rows, clusters } = this.allRows()
    const shown = this.shownRows(cols, rows)
    this.tabs.forEach((b, i) => b.classList.toggle('on', (i === 0) === (this.tab === 'factors')))
    const table = el(
      'table',
      { className: 'prsm-table' },
      el('thead', {}, this.groupRow(cols), this.titleRow(cols, shown)),
      el('tbody', {}, ...shown.map((row) => this.bodyRow(cols, row))),
      el('tfoot', {}, this.footerRow(cols, shown, clusters))
    )
    this.scroller.replaceChildren(table)
    Object.assign(this.scroller, { scrollTop: scroll.top, scrollLeft: scroll.left })
    this.renderFilter(cols)
  }

  /**
   * @param {Array<object>} cols
   * @returns {Array<{name: string, cols: Array<object>}>} consecutive columns with the same group
   */
  groups(cols) {
    const out = []
    for (const c of cols) {
      if (out.at(-1)?.name === c.group) out.at(-1).cols.push(c)
      else out.push({ name: c.group, cols: [c] })
    }
    return out
  }

  /** @returns {Array<object>} the columns that are not hidden inside a collapsed group */
  visible(cols) {
    return cols.filter((c) => !this.collapsed.has(c.group))
  }

  groupRow(cols) {
    const tr = el('tr', { className: 'groups' })
    for (const g of this.groups(cols)) {
      const closed = this.collapsed.has(g.name)
      const title = GROUP_TITLES[this.tab][g.name] ?? ''
      const th = el('th', {
        colSpan: closed ? 1 : g.cols.length,
        textContent: title ? `${closed ? '▸' : '▾'} ${title}` : '',
      })
      if (title) {
        th.classList.add('collapsible')
        th.addEventListener('click', () => {
          if (closed) this.collapsed.delete(g.name)
          else this.collapsed.add(g.name)
          this.render()
        })
      }
      tr.append(th)
    }
    return tr
  }

  titleRow(cols, shown) {
    const tr = el('tr', { className: 'titles' })
    for (const g of this.groups(cols)) {
      if (this.collapsed.has(g.name)) tr.append(el('th'))
      else g.cols.forEach((c) => tr.append(this.headerCell(c, shown)))
    }
    return tr
  }

  /**
   * @param {object} col
   * @param {Array<object>} shown rows now shown (for the select-all box)
   * @returns {HTMLElement}
   */
  headerCell(col, shown) {
    const th = el('th', { className: col.editable ? 'editable' : '', title: col.tip ?? '' })
    if (col.type === 'select-row') th.append(this.selectAllBox(shown))
    else th.append(this.titleText(col))
    const arrow = el('button', {
      className: 'sort',
      textContent: this.arrowFor(col),
      title: 'Sort',
    })
    arrow.addEventListener('click', () => this.sortBy(col))
    if (this.sort?.id === col.id) {
      th.setAttribute('aria-sort', this.sort.dir === 1 ? 'ascending' : 'descending')
    }
    th.append(arrow)
    if (col.attribute) th.append(this.deleteButton(col))
    return th
  }

  arrowFor(col) {
    if (this.sort?.id !== col.id) return '↕'
    return this.sort.dir === 1 ? '▲' : '▼'
  }

  sortBy(col) {
    const dir = this.sort?.id === col.id ? -this.sort.dir : 1
    this.sort = { id: col.id, dir }
    this.render()
  }

  titleText(col) {
    if (!col.attribute) return el('span', { textContent: col.title })
    const span = el('span', {
      textContent: col.title,
      contentEditable: 'plaintext-only',
      className: 'attribute-title',
    })
    span.addEventListener('focus', () => (this.editing = true))
    span.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), span.blur()))
    span.addEventListener('blur', () => {
      this.endEdit()
      const title = span.textContent.trim()
      if (title && title !== col.title) this.store.setAttributeTitle(col.id, title)
    })
    return span
  }

  deleteButton(col) {
    const b = el('button', { textContent: '×', title: 'Delete column', className: 'delete-column' })
    b.addEventListener('click', () => this.store.setAttributeTitle(col.id, '*deleted*'))
    return b
  }

  selectAllBox(shown) {
    const box = el('input', { type: 'checkbox', title: 'Select all' })
    box.checked = shown.length > 0 && shown.every((r) => this.selected.has(r.id))
    box.addEventListener('change', () => {
      for (const r of shown) {
        if (box.checked) this.selected.add(r.id)
        else this.selected.delete(r.id)
      }
      this.onSelect(this.selected)
      this.render()
    })
    return box
  }

  bodyRow(cols, row) {
    const tr = el('tr', { className: this.selected.has(row.id) ? 'selected' : '' })
    for (const g of this.groups(cols)) {
      if (this.collapsed.has(g.name)) tr.append(el('td', { className: 'collapsed' }))
      else g.cols.forEach((c) => tr.append(this.cell(c, row)))
    }
    return tr
  }

  /**
   * @param {object} col
   * @param {object} row
   * @returns {HTMLElement} the table cell
   */
  cell(col, row) {
    const td = el('td', { className: `cell-${col.type}` })
    if (col.type === 'select-row') return this.rowBox(td, row)
    if (col.type === 'bool') return this.flagBox(td, col, row)
    if (col.type === 'color') return this.swatch(td, col, row)
    const full = displayValue(col, row)
    const limit = col.type === 'note' ? NOTE_PREVIEW_LENGTH : col.truncate
    td.textContent = limit ? shorten(full, limit) : full
    if (limit && full.length > limit) td.title = full
    if (col.editable) td.addEventListener('click', () => this.startEdit(td, col, row))
    return td
  }

  rowBox(td, row) {
    const box = el('input', { type: 'checkbox', checked: this.selected.has(row.id) })
    box.addEventListener('change', () => {
      if (box.checked) this.selected.add(row.id)
      else this.selected.delete(row.id)
      this.onSelect(this.selected)
      this.render()
    })
    td.append(box)
    return td
  }

  flagBox(td, col, row) {
    const box = el('input', { type: 'checkbox', checked: Boolean(cellValue(col, row)) })
    box.addEventListener('change', () => col.set(this.targets(row), box.checked))
    td.append(box)
    return td
  }

  swatch(td, col, row) {
    const color = cellValue(col, row)
    const input = el('input', { type: 'color', value: color, className: 'swatch-input' })
    input.addEventListener('focus', () => (this.editing = true))
    input.addEventListener('change', () => {
      this.editing = false
      col.set(this.targets(row), input.value)
    })
    input.addEventListener('blur', () => this.endEdit())
    td.append(input)
    return td
  }

  /**
   * An edit applies to all selected rows if the edited row is one of them
   * @param {object} row
   * @returns {Array<string>} ids to change
   */
  targets(row) {
    if (!this.selected.has(row.id)) return [row.id]
    const source = this.tab === 'factors' ? this.store.nodes : this.store.edges
    return [...this.selected].filter((id) => source.has(id))
  }

  endEdit() {
    this.editing = false
    if (this.dirty) this.render()
  }

  /**
   * Replace the content of a cell by an editor suited to the column
   * @param {HTMLElement} td
   * @param {object} col
   * @param {object} row
   */
  async startEdit(td, col, row) {
    if (this.editing) return
    if (col.type === 'note') {
      this.editing = true
      const note = await editNote(col.value(row))
      if (note !== undefined) col.set(this.targets(row), note ?? undefined)
      this.endEdit()
      return
    }
    this.editing = true
    const input = col.type === 'select' ? this.selectInput(col, row) : this.textInput(col, row)
    td.replaceChildren(input)
    input.focus()
    if (col.type === 'select') input.showPicker?.()
  }

  selectInput(col, row) {
    const current = col.value ? col.value(row) : cellValue(col, row)
    const options = col.options().map(([value, text]) => el('option', { value, textContent: text }))
    const select = el('select', {}, ...options)
    select.value = current
    select.addEventListener('change', () => {
      this.editing = false
      col.set(this.targets(row), select.value)
    })
    select.addEventListener('blur', () => this.endEdit())
    return select
  }

  textInput(col, row) {
    const v = col.editValue ? col.editValue(row).replace(/\n/g, ' ') : cellValue(col, row)
    const input = el('input', {
      type: col.type === 'number' ? 'number' : 'text',
      value: v ?? '',
      step: 'any',
    })
    let cancelled = false
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cancelled = true
      if (e.key === 'Enter' || e.key === 'Escape') input.blur()
    })
    input.addEventListener('blur', () => {
      if (!cancelled && String(v ?? '') !== input.value) this.commitText(col, row, input.value)
      this.endEdit()
    })
    return input
  }

  commitText(col, row, text) {
    if (col.type !== 'number') return col.set(this.targets(row), text)
    const n = parseFloat(text)
    if (text === '') col.set(this.targets(row), undefined)
    else if (!isNaN(n)) col.set(this.targets(row), n)
  }

  footerRow(cols, rows, clusters) {
    const tr = el('tr')
    for (const g of this.groups(cols)) {
      if (this.collapsed.has(g.name)) tr.append(el('td'))
      else {
        g.cols.forEach((c) =>
          tr.append(el('td', { textContent: this.footerText(c, rows, clusters) }))
        )
      }
    }
    return tr
  }

  footerText(col, rows, clusters) {
    const text = footerValue(col, rows)
    return clusters && col.id === 'label' ? `${text} (+${clusters} clusters)` : text
  }

  toggleFilter() {
    this.filterOpen = !this.filterOpen
    this.render()
  }

  /** @param {Array<object>} cols */
  renderFilter(cols) {
    this.filterBar.hidden = !this.filterOpen
    if (!this.filterOpen || this.filterBar.contains(document.activeElement)) return
    const fields = cols.filter((c) => c.type !== 'color' && c.type !== 'select-row')
    const field = el(
      'select',
      {},
      ...fields.map((c) => el('option', { value: c.id, textContent: c.tip ?? c.title }))
    )
    const op = el(
      'select',
      {},
      ...FILTER_OPS.map(([v, t]) => el('option', { value: v, textContent: t }))
    )
    const value = el('input', { type: 'text', value: this.filter.value })
    field.value = this.filter.field
    op.value = this.filter.op
    const update = () => {
      this.filter = { field: field.value, op: op.value, value: value.value }
      this.render()
      this.filterBar.querySelector('input').focus()
    }
    for (const control of [field, op]) control.addEventListener('change', update)
    value.addEventListener('input', update)
    this.filterBar.replaceChildren('Filter: ', field, op, value)
  }

  /** Copy the shown rows (or just the selected ones) to the clipboard as tab-separated text */
  copy() {
    const cols = this.visible(this.columns()).filter((c) => c.type !== 'select-row')
    let rows = this.shownRows(this.columns(), this.allRows().rows)
    if (this.selected.size) rows = rows.filter((r) => this.selected.has(r.id))
    const lines = [
      cols.map((c) => c.tip ?? c.title),
      ...rows.map((r) => cols.map((c) => this.copyText(c, r))),
    ]
    return navigator.clipboard.writeText(lines.map((l) => l.join('\t')).join('\n'))
  }

  copyText(col, row) {
    return col.type === 'note'
      ? displayValue(col, row).replace(/\s+/g, ' ')
      : displayValue(col, row)
  }
}
