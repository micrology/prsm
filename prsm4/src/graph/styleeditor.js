/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Edits factor and link styles.
********************************************************************************************/

/* ****************************************************************************************
styleeditor.js: a panel for editing the map's styles (the css held in store.styles), for
choosing the style of the selected factors and links, and for per-element overrides.
Every change goes through MapStore methods, so it is undoable and shared like any other.
**************************************************************************************** */
import { nodeStyleToCss } from './legacy.js'
import { colorWell } from './colorwell.js'
import { shapeName } from './shapes.js'

export const SHAPES = [
  'ellipse',
  'box',
  'disc',
  'text',
  'square',
  'triangle',
  'hexagon',
  'diamond',
  'star',
]
export const FONTS = ['Oxygen', 'Arial', 'Georgia', 'Courier New', 'Times New Roman', 'Verdana']
export const LINE_STYLES = ['solid', 'dashed', 'dotted']
export const ARROWS = ['none', 'triangle', 'vee', 'circle', 'diamond', 'tee', 'square']
const SHAPE_KEYS = [
  'text-valign',
  'text-margin-y',
  'width',
  'height',
  'padding',
  'background-opacity',
]
const EDGE_COLOR_PROPS = [
  'line-color',
  'target-arrow-color',
  'source-arrow-color',
  'mid-target-arrow-color',
]

const NODE_FIELDS = [
  { prop: 'shape', label: 'Shape', type: 'select', options: SHAPES },
  { prop: 'background-color', label: 'Fill', type: 'color' },
  { prop: 'border-color', label: 'Border', type: 'color' },
  { prop: 'border-width', label: 'Border width', type: 'number' },
  {
    prop: 'border-style',
    label: 'Border style',
    type: 'select',
    options: [...LINE_STYLES, 'double'],
  },
  { prop: 'color', label: 'Font colour', type: 'color' },
  { prop: 'font-size', label: 'Font size', type: 'number' },
  { prop: 'font-family', label: 'Font', type: 'select', options: FONTS },
]
const EDGE_FIELDS = [
  { prop: 'line-color', label: 'Colour', type: 'color' },
  { prop: 'width', label: 'Width', type: 'number' },
  { prop: 'line-style', label: 'Line', type: 'select', options: LINE_STYLES },
  { prop: 'target-arrow-shape', label: 'Arrow at end', type: 'select', options: ARROWS },
  { prop: 'source-arrow-shape', label: 'Arrow at start', type: 'select', options: ARROWS },
  { prop: 'color', label: 'Font colour', type: 'color' },
  { prop: 'font-size', label: 'Font size', type: 'number' },
]

/**
 * Make a DOM element
 * @param {string} tag
 * @param {object} [props] properties to assign (className, textContent, ...)
 * @param {...(Node|string)} children
 * @returns {HTMLElement}
 */
function el(tag, props = {}, ...children) {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...children)
  return e
}

/**
 * Choose the display name for a style.
 * @param {string} id style id
 * @param {{name:string}} st
 * @returns {string} name to show for the style
 */
function styleName(id, st) {
  if (st.name) return st.name
  return id.endsWith('Base') ? 'Default' : `(unnamed ${id})`
}

let colorContext = null

/**
 * Convert a CSS colour to a hexadecimal input value.
 * @param {string} color any CSS colour
 * @returns {string} #rrggbb, as needed by an <input type="color">
 */
export function toHex(color) {
  colorContext ??= document.createElement('canvas').getContext('2d')
  colorContext.fillStyle = '#000000'
  colorContext.fillStyle = color || '#000000'
  const v = colorContext.fillStyle
  if (v.startsWith('#')) return v
  const [r, g, b] = v.match(/[\d.]+/g).map(Number)
  return `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`
}

/**
 * The properties that change when an edge or node colour is changed
 * @param {'node'|'edge'} kind
 * @param {string} prop the property chosen in the form
 * @param {string} value
 * @returns {object}
 */
export function colorPatch(kind, prop, value) {
  if (kind === 'edge' && prop === 'line-color') {
    return Object.fromEntries(EDGE_COLOR_PROPS.map((p) => [p, value]))
  }
  return { [prop]: value }
}

/**
 * Properties to set when the shape of a node style changes (undefined values are removed)
 * @param {string} shape one of SHAPES
 * @param {object} css current css of the style
 * @returns {object}
 */
export function shapePatch(shape, css) {
  const fresh = nodeStyleToCss({ shape, font: { size: css['font-size'] ?? 14 } })
  const patch = { shape: fresh.shape }
  for (const k of SHAPE_KEYS) patch[k] = fresh[k]
  if (shape === 'text') patch['border-width'] = 0
  return patch
}

/**
 * The style editing panel. It works on one view (store and graph) at a time.
 */
export class StyleEditor {
  /**
   * Create a style editor for a container.
   * @param {HTMLElement} container
   * @param {object} [options]
   * @param {boolean} [options.single] show only the form for the current style, not the list of styles
   */
  constructor(container, { single = false } = {}) {
    this.container = container
    this.single = single
    this.view = null
    this.current = null
    this.pending = false
    this.typing = false
  }

  /**
   * Listen to the store and graph of a view
   * @param {{store: MapStore, cy: cytoscape.Core}} view
   * @returns {void}
   */
  attach(view) {
    /**
     * Schedule a refresh only for the active view.
     * @returns {void|boolean} False when the view is inactive.
     */
    const refresh = () => view === this.view && this.schedule()
    view.store.doc.on('afterTransaction', refresh)
    view.cy.on('select unselect', refresh)
  }

  /**
   * Select the map and graph whose styles are being edited.
   * @param {{store: MapStore, cy: cytoscape.Core}} view the view to edit
   * @returns {void}
   */
  setView(view) {
    if (view === this.view) return
    this.view = view
    this.current = null
    this.render()
  }

  /**
   * Coalesce editor redraws into the next animation frame.
   * @returns {void}
   */
  schedule() {
    if (this.pending) return
    this.pending = true
    requestAnimationFrame(() => {
      this.pending = false
      this.render()
    })
  }

  /**
   * List styles of a kind, with the base style first.
   * @param {'node'|'edge'} kind Element kind.
   * @returns {Array<[string, object]>} Style IDs and records.
   */
  stylesOf(kind) {
    const all = [...this.view.store.styles.entries()].filter(([, s]) => s.kind === kind)
    return all.sort(([a], [b]) => (b === `${kind}Base`) - (a === `${kind}Base`))
  }

  /**
   * Render the current style editor and selection controls.
   * @returns {void}
   */
  render() {
    if (!this.view) return
    if (this.typing) {
      this.renderList()
      return
    }
    const { store } = this.view
    if (!store.styles.has(this.current)) this.current = null
    if (this.single) {
      this.container.replaceChildren(this.current ? this.form(this.current) : '')
      return
    }
    this.container.replaceChildren(
      el('h2', { textContent: 'Styles' }),
      (this.list = el('div', { className: 'style-list' })),
      this.selectionSection(),
      this.current ? this.form(this.current) : el('p', { textContent: 'Choose a style to edit.' })
    )
    this.renderList()
  }

  /**
   * Refresh the style list without replacing an active input.
   * @returns {void}
   */
  renderList() {
    if (!this.list) return
    this.list.replaceChildren()
    for (const kind of ['node', 'edge']) {
      this.list.append(el('h3', { textContent: kind === 'node' ? 'Factors' : 'Links' }))
      for (const [id, st] of this.stylesOf(kind)) this.list.append(this.listItem(id, st))
      this.list.append(this.addButton(kind))
    }
  }

  /**
   * Create a style list entry.
   * @param {string} id
   * @param {object} st
   * @returns {HTMLElement}
   */
  listItem(id, st) {
    const swatch = el('span', { className: 'swatch' })
    swatch.style.setProperty('--c', toHex(st.css['background-color'] ?? st.css['line-color']))
    const name = styleName(id, st)
    const b = el('button', { className: id === this.current ? 'on' : '' }, swatch, name)
    b.addEventListener('click', () => {
      this.current = id
      this.render()
    })
    return b
  }

  /**
   * Create a button for adding a style.
   * @param {'node'|'edge'} kind
   * @returns {HTMLElement}
   */
  addButton(kind) {
    const b = el('button', { textContent: '+ new style', className: 'add' })
    b.addEventListener('click', () => {
      const { store } = this.view
      const base = store.styles.get(this.current)?.kind === kind ? this.current : `${kind}Base`
      this.current = store.addStyle(kind, 'New style', { ...store.styles.get(base).css })
    })
    return b
  }

  /**
   * Create the editing form for a style.
   * @param {string} id
   * @returns {HTMLElement} form for editing the style
   */
  form(id) {
    const { store } = this.view
    const st = store.styles.get(id)
    const base = store.styles.get(`${st.kind}Base`)
    const fields = st.kind === 'node' ? NODE_FIELDS : EDGE_FIELDS
    const f = el('div', { className: 'style-form' }, this.nameRow(id, st))
    for (const field of fields) {
      const value =
        field.prop === 'shape'
          ? shapeName({ ...base?.css, ...st.css })
          : (st.css[field.prop] ?? base?.css[field.prop])
      f.append(this.row(field, value, (v) => this.editStyle(id, field, v)))
    }
    if (!this.single && !id.endsWith('Base') && !id.startsWith('cluster')) {
      f.append(this.deleteButton(id, st.kind))
    }
    return f
  }

  /**
   * Create the style name input.
   * @param {string} id Style ID.
   * @param {object} st Style record.
   * @returns {HTMLElement} Label and input.
   */
  nameRow(id, st) {
    const input = el('input', { type: 'text', value: st.name ?? '' })
    input.addEventListener('change', () => {
      this.view.store.setStyle(id, { ...this.view.store.styles.get(id), name: input.value })
    })
    return el('label', {}, 'Name', input)
  }

  /**
   * Create a button that deletes a style and reassigns its elements.
   * @param {string} id Style ID.
   * @param {'node'|'edge'} kind Element kind.
   * @returns {HTMLElement} Delete button.
   */
  deleteButton(id, kind) {
    const b = el('button', { textContent: 'Delete style' })
    b.addEventListener('click', () => {
      this.view.store.deleteStyle(id, `${kind}Base`)
      this.current = null
    })
    return b
  }

  /**
   * Create a labelled control for a style property.
   * @param {object} field entry of NODE_FIELDS or EDGE_FIELDS
   * @param {*} value current value
   * @param {function(string|number):void} onChange
   * @returns {HTMLElement}
   */
  row(field, value, onChange) {
    if (field.type === 'color') return this.colorRow(field, value, onChange)
    const input = this.input(field, value)
    const live = field.type !== 'select'
    input.addEventListener(live ? 'input' : 'change', () => {
      onChange(field.type === 'number' ? Number(input.value) : input.value)
    })
    return el('label', {}, field.label, input)
  }

  /**
   * Create a labelled colour control for a style property.
   * @param {object} field
   * @param {string} value current colour
   * @param {function(string):void} onChange
   * @returns {HTMLElement} a labelled colour well
   */
  colorRow(field, value, onChange) {
    const well = colorWell(toHex(value), {
      /**
       * Apply a live colour change while retaining the current editor.
       * @param {string} color Chosen colour.
       * @returns {void}
       */
      onInput: (color) => {
        this.typing = true
        onChange(color)
        this.typing = false
      },
    })
    return el('label', {}, field.label, well)
  }

  /**
   * Create a numeric or selection input for a style field.
   * @param {object} field Field definition.
   * @param {*} value Current value.
   * @returns {HTMLElement} Input element.
   */
  input(field, value) {
    if (field.type === 'select') {
      const shown = String(value ?? '')
        .split(',')[0]
        .trim()
      const options = field.options.map((o) => el('option', { value: o, textContent: o }))
      return Object.assign(el('select', {}, ...options), { value: shown })
    }
    return el('input', { type: 'number', min: 0, step: 1, value: value ?? 0 })
  }

  /**
   * Change one property of a style
   * @param {string} id
   * @param {object} field
   * @param {string|number} value
   * @returns {void}
   */
  editStyle(id, field, value) {
    const { store } = this.view
    const st = store.styles.get(id)
    let patch = { [field.prop]: value }
    if (field.type === 'color') patch = colorPatch(st.kind, field.prop, value)
    if (field.prop === 'shape') patch = shapePatch(value, st.css)
    if (field.prop === 'font-family') patch = { [field.prop]: `${value}, sans-serif` }
    const css = { ...st.css, ...patch }
    for (const k of Object.keys(css)) if (css[k] === undefined) delete css[k]
    store.setStyle(id, { ...st, css })
  }

  /**
   * Create controls for the selected factors and links.
   * @returns {HTMLElement} Selection section.
   */
  selectionSection() {
    const { cy } = this.view
    const nodes = cy.nodes(':selected').filter('[!cluster]')
    const edges = cy.edges(':selected').not('.meta')
    const s = el('div', { className: 'selection' })
    if (!nodes.length && !edges.length) {
      s.append(
        el('h3', { textContent: 'Selection' }),
        el('p', { textContent: 'Nothing selected.' })
      )
      return s
    }
    s.append(el('h3', { textContent: `Selection: ${nodes.length} factors, ${edges.length} links` }))
    if (nodes.length) s.append(this.selectionControls('node', nodes))
    if (edges.length) s.append(this.selectionControls('edge', edges))
    return s
  }

  /**
   * Create style and override controls for selected elements.
   * @param {'node'|'edge'} kind
   * @param {cytoscape.Collection} eles selected elements of that kind
   * @returns {HTMLElement}
   */
  selectionControls(kind, eles) {
    const { store } = this.view
    const mapName = `${kind}s`
    const ids = eles.map((e) => e.id())
    const used = new Set(ids.map((id) => store[mapName].get(id)?.style))
    const choices = this.stylesOf(kind).map(([id, st]) =>
      el('option', { value: id, textContent: styleName(id, st) })
    )
    const select = el('select', {}, ...choices)
    select.value = used.size === 1 ? [...used][0] : ''
    select.addEventListener('change', () => store.setElementStyle(mapName, ids, select.value))
    const colorProp = kind === 'node' ? 'background-color' : 'line-color'
    const color = this.row({ label: 'Colour', type: 'color' }, eles[0].style(colorProp), (v) =>
      store.setOverrides(mapName, ids, colorPatch(kind, colorProp, v))
    )
    const reset = el('button', { textContent: 'Clear overrides' })
    reset.addEventListener('click', () => store.setOverrides(mapName, ids, null))
    return el(
      'div',
      {},
      el('label', {}, kind === 'node' ? 'Factor style' : 'Link style', select),
      color,
      reset
    )
  }
}
