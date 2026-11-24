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
import { LINK_TYPES } from './curves.js'

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
const COLOR_OPACITY = {
  'background-color': 'background-opacity',
  'border-color': 'border-opacity',
  'line-color': 'line-opacity',
  color: 'text-opacity',
}

/**
 * Combine a CSS colour with a separate Cytoscape opacity for a colour well.
 * @param {string} color Colour.
 * @param {number} opacity Opacity from zero to one.
 * @returns {string} CSS colour including alpha.
 */
export function colorWithOpacity(color, opacity = 1) {
  const hex = toHex(color)
  return `${hex.slice(0, 7)}${Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0')}`
}

/**
 * Identify the Cytoscape opacity corresponding to a colour property.
 * @param {string} prop Colour property.
 * @returns {string|undefined} Opacity property.
 */
export function colorOpacityProperty(prop) {
  return COLOR_OPACITY[prop]
}

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
  {
    prop: 'curve-style',
    label: 'Link type',
    type: 'select',
    options: LINK_TYPES,
    inherit: 'Use network setting',
  },
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
  const rgba = value.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i
  )
  const alpha = rgba
    ? Number(rgba[4] ?? 1)
    : /^#[\da-f]{8}$/i.test(value)
      ? parseInt(value.slice(7), 16) / 255
      : 1
  const color = rgba
    ? `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`
    : value.startsWith('#')
      ? value.slice(0, 7)
      : value
  const opacity = COLOR_OPACITY[prop]
  const patch = opacity ? { [opacity]: alpha } : {}
  if (kind === 'edge' && prop === 'line-color') {
    return { ...patch, ...Object.fromEntries(EDGE_COLOR_PROPS.map((p) => [p, color])) }
  }
  return { ...patch, [prop]: color }
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
      let value = field.inherit
        ? st.css[field.prop]
        : field.prop === 'shape'
          ? shapeName({ ...base?.css, ...st.css })
          : (st.css[field.prop] ?? base?.css[field.prop])
      if (field.type === 'color') {
        const opacity = colorOpacityProperty(field.prop)
        value = colorWithOpacity(value, st.css[opacity] ?? base?.css[opacity] ?? 1)
      }
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
      this.setStyle(id, { ...this.view.store.styles.get(id), name: input.value })
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
    const well = colorWell(value, {
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
      const options = field.options.map((o) =>
        Array.isArray(o)
          ? el('option', { value: o[1], textContent: o[0] })
          : el('option', { value: o, textContent: o })
      )
      if (field.inherit) options.unshift(el('option', { value: '', textContent: field.inherit }))
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
    if (field.inherit && value === '') patch = { [field.prop]: undefined }
    if (field.type === 'color') patch = colorPatch(st.kind, field.prop, value)
    if (field.prop === 'shape') patch = shapePatch(value, st.css)
    if (field.prop === 'font-family') patch = { [field.prop]: `${value}, sans-serif` }
    const css = { ...st.css, ...patch }
    for (const k of Object.keys(css)) if (css[k] === undefined) delete css[k]
    this.setStyle(id, { ...st, css })
  }

  /**
   * Apply a style edit, marking live dialog changes as previews.
   * @param {string} id Style identifier.
   * @param {object} style Updated style.
   * @returns {void}
   */
  setStyle(id, style) {
    const { store } = this.view
    store.transact((transaction) => {
      if (this.single) transaction.meta.set('stylePreview', id)
      store.setStyle(id, style)
    })
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
    const colorValue = colorWithOpacity(
      eles[0].style(colorProp),
      eles[0].numericStyle(colorOpacityProperty(colorProp))
    )
    const color = this.row({ label: 'Colour', type: 'color' }, colorValue, (v) =>
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
