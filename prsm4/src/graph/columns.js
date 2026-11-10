/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Defines the fields displayed in the map data view.
********************************************************************************************/

/* ****************************************************************************************
columns.js: the columns of the Factors and Links tables, as data. Each column says how to read
its value from a record (and the style it inherits from), how to write a new value back to the
MapStore, and how to total it in the table footer. The table view, sorting, filtering and
copy-to-clipboard are all driven from these lists.
**************************************************************************************** */
import { toHex, shapePatch, SHAPES, ARROWS, LINE_STYLES, colorPatch } from './styleeditor.js'
import { shapeName } from './shapes.js'

export { shapeName } from './shapes.js'

/** Labels longer than this are shortened with an ellipsis in the tables */
export const LABEL_PREVIEW_LENGTH = 30

export const NOTE_PREVIEW_LENGTH = 30
const EM_DASH = '—'
const BORDER_STYLES = ['Solid', 'Dashed', 'Dotted', 'None']

/**
 * The value of a css property for one element: its own override, else its style, else the base style
 * @param {MapStore} store
 * @param {'node'|'edge'} kind
 * @param {object} rec node or edge record
 * @param {string} prop Cytoscape style property
 * @returns {*}
 */
export function resolve(store, kind, rec, prop) {
  return (
    rec.overrides?.[prop] ??
    store.styles.get(rec.style)?.css[prop] ??
    store.styles.get(`${kind}Base`)?.css[prop]
  )
}

/**
 * Extract plain text from a stored note.
 * @param {object|string|undefined} note a Quill delta ({ops}) or plain text
 * @returns {string} the plain text of the note
 */
export function noteText(note) {
  if (!note) return ''
  if (typeof note === 'string') return note
  return (note.ops ?? [])
    .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
    .join('')
    .trim()
}

/**
 * Calculate a colour's hue for sorting.
 * @param {string} hex #rrggbb
 * @returns {number} hue in degrees, with greys (no hue) sorted first by lightness
 */
export function hueOf(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (d === 0) return -1 + max
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

/**
 * Create a column that reads and edits one style property.
 * @param {MapStore} store
 * @param {'node'|'edge'} kind
 * @param {string} prop css property
 * @param {object} extra properties of the column
 * @param {function(*):object} [toPatch] converts the entered value to css properties
 * @returns {object} a column showing and editing one css property
 */
function cssColumn(store, kind, prop, extra, toPatch = (v) => ({ [prop]: v })) {
  const mapName = `${kind}s`
  return {
    editable: true,
    /**
     * Read the resolved style property from a row.
     * @param {object} row Table row.
     * @returns {*} Resolved property value.
     */
    get: ({ rec }) => resolve(store, kind, rec, prop),
    /**
     * Apply the entered style property to the selected records.
     * @param {Array<string>} ids Record IDs.
     * @param {*} v Entered value.
     * @returns {void}
     */
    set: (ids, v) => store.setOverrides(mapName, ids, toPatch(v)),
    ...extra,
  }
}

/**
 * Create an editable colour column.
 * @param {MapStore} store
 * @param {'node'|'edge'} kind
 * @param {string} prop css property holding a colour
 * @param {object} extra
 * @returns {object} a colour column
 */
function colorColumn(store, kind, prop, extra) {
  /**
   * Build the style patch for a colour.
   * @param {string} v Selected colour.
   * @returns {object} Colour style properties.
   */
  const patch = (v) => colorPatch(kind, prop, v)
  const col = cssColumn(store, kind, prop, { type: 'color', ...extra }, patch)
  const raw = col.get
  /**
   * Get a row's colour as a hexadecimal value.
   * @param {object} row Table row.
   * @returns {string} Hexadecimal colour.
   */
  col.get = (row) => toHex(raw(row))
  return col
}

/**
 * Create an editable boolean flag column.
 * @param {MapStore} store
 * @param {'nodes'|'edges'} mapName
 * @param {string} field boolean record field
 * @param {object} extra
 * @returns {object} a checkbox column for a flag held in the record
 */
function flagColumn(store, mapName, field, extra) {
  return {
    type: 'bool',
    editable: true,
    /**
     * Read the flag from a row.
     * @param {object} row Table row.
     * @returns {boolean} Flag state.
     */
    get: ({ rec }) => Boolean(rec[field]),
    /**
     * Set or clear the flag on selected records.
     * @param {Array<string>} ids Record IDs.
     * @param {boolean} v New flag state.
     * @returns {void}
     */
    set: (ids, v) => {
      store.transact(() =>
        ids.forEach((id) => store.update(mapName, id, { [field]: v || undefined }))
      )
    },
    aggregate: 'countTrue',
    ...extra,
  }
}

/**
 * Create the column for selecting an element's style.
 * @param {MapStore} store
 * @param {'node'|'edge'} kind
 * @returns {object} the Style column
 */
function styleColumn(store, kind) {
  const mapName = `${kind}s`
  return {
    id: 'style',
    title: 'Style',
    group: 'format',
    type: 'select',
    editable: true,
    /**
     * List the available styles of this kind.
     * @returns {Array<Array<string>>} Style IDs and labels.
     */
    options: () =>
      [...store.styles.entries()]
        .filter(([, s]) => s.kind === kind)
        .map(([id, s]) => [id, s.name || (id.endsWith('Base') ? 'Default' : id)]),
    /**
     * Get the display name of a row's style.
     * @param {object} row Table row.
     * @returns {string} Style name.
     */
    get: ({ rec }) =>
      store.styles.get(rec.style)?.name || (store.styles.has(rec.style) ? 'Default' : EM_DASH),
    /**
     * Get the selected style ID for editing.
     * @param {object} row Table row.
     * @returns {string} Style ID.
     */
    value: ({ rec }) => rec.style,
    /**
     * Apply a style to selected records.
     * @param {Array<string>} ids Record IDs.
     * @param {string} v Style ID.
     * @returns {void}
     */
    set: (ids, v) => store.setElementStyle(mapName, ids, v),
  }
}

/**
 * Create the last-modified date column.
 * @returns {object} Column definition.
 */
function modifiedColumn() {
  return {
    id: 'modified',
    title: 'Modified',
    group: 'main',
    type: 'date',
    /**
     * Get a row's modification or creation time.
     * @param {object} row Table row.
     * @returns {number|null} Timestamp, if available.
     */
    get: ({ rec }) => rec.modified?.time ?? rec.created?.time ?? null,
  }
}

/**
 * Create an editable notes column.
 * @param {MapStore} store
 * @param {'nodes'|'edges'} mapName
 * @returns {object} the Notes column
 */
function notesColumn(store, mapName) {
  return {
    id: 'note',
    title: 'Notes',
    group: 'notes',
    type: 'note',
    editable: true,
    /**
     * Get the note text for display.
     * @param {object} row Table row.
     * @returns {string} Plain note text.
     */
    get: ({ rec }) => noteText(rec.note),
    /**
     * Get the stored note for editing.
     * @param {object} row Table row.
     * @returns {*} Stored note.
     */
    value: ({ rec }) => rec.note,
    /**
     * Save a note to selected records.
     * @param {Array<string>} ids Record IDs.
     * @param {*} note New note.
     * @returns {void}
     */
    set: (ids, note) => {
      store.transact(() => ids.forEach((id) => store.update(mapName, id, { note })))
    },
  }
}

/**
 * Columns for the user-defined attributes
 * @param {MapStore} store
 * @param {'nodes'|'edges'} mapName
 * @returns {Array<object>}
 */
function attributeColumns(store, mapName) {
  return Object.entries(store.attributeTitles())
    .filter(([, title]) => title !== '*deleted*')
    .map(([field, title]) => ({
      id: field,
      title,
      group: 'attributes',
      type: 'text',
      editable: true,
      attribute: true,
      /**
       * Get the row's attribute value.
       * @param {object} row Table row.
       * @returns {*} Attribute value or empty text.
       */
      get: ({ rec }) => rec[field] ?? '',
      /**
       * Set the attribute on selected records.
       * @param {Array<string>} ids Record IDs.
       * @param {*} v Attribute value.
       * @returns {void}
       */
      set: (ids, v) => {
        store.transact(() =>
          ids.forEach((id) => store.update(mapName, id, { [field]: v || undefined }))
        )
      },
    }))
}

/**
 * The statistics columns of the Factors table
 * @returns {Array<object>}
 */
function statColumns() {
  /**
   * Create a numeric graph-statistics column.
   * @param {string} id Statistic ID.
   * @param {string} title Column title.
   * @param {string} [aggregate] Footer aggregate.
   * @param {object} [extra] Additional column properties.
   * @returns {object} Column definition.
   */
  const stat = (id, title, aggregate, extra = {}) => ({
    id,
    title,
    group: 'statistics',
    type: 'number',
    /**
     * Get the row's statistic.
     * @param {object} row Table row.
     * @returns {number|null} Statistic value, if available.
     */
    get: ({ stats }) => stats?.[id] ?? null,
    aggregate,
    ...extra,
  })
  /**
   * Create a column counting votes in a record field.
   * @param {string} field Record field.
   * @param {string} id Column ID.
   * @param {string} title Column title.
   * @returns {object} Column definition.
   */
  const count = (field, id, title) => ({
    id,
    title,
    group: 'statistics',
    type: 'number',
    /**
     * Count a row's votes.
     * @param {object} row Table row.
     * @returns {number} Vote count.
     */
    get: ({ rec }) => (Array.isArray(rec[field]) ? rec[field].length : 0),
  })
  return [
    stat('inDegree', 'In-degree', 'mean'),
    stat('outDegree', 'Out-degree', 'mean'),
    stat('degree', 'Total degree', 'mean'),
    stat('leverage', 'Leverage'),
    stat('betweenness', 'Betweenness', 'max'),
    { ...count('thumbUp', 'thumbUp', '👍'), tip: 'Thumbs up' },
    { ...count('thumbDown', 'thumbDown', '👎'), tip: 'Thumbs down' },
  ]
}

/**
 * Create the factor formatting columns.
 * @param {MapStore} store
 * @returns {Array<object>} the formatting columns of the Factors table
 */
function nodeFormatColumns(store) {
  /**
   * Create a factor style property column.
   * @param {string} prop Style property.
   * @param {object} extra Additional column properties.
   * @param {function} [toPatch] Value-to-style conversion.
   * @returns {object} Column definition.
   */
  const css = (prop, extra, toPatch) => cssColumn(store, 'node', prop, extra, toPatch)
  /**
   * Get the base factor style properties.
   * @returns {object} Base CSS properties.
   */
  const base = () => store.styles.get('nodeBase')?.css ?? {}
  return [
    styleColumn(store, 'node'),
    css(
      'shape',
      {
        id: 'shape',
        title: 'Shape',
        group: 'format',
        type: 'select',
        /**
         * List the available factor shapes.
         * @returns {Array<Array<string>>} Shape values and labels.
         */
        options: () => SHAPES.map((s) => [s, s]),
        /**
         * Get the factor's shape name.
         * @param {object} row Table row.
         * @returns {string} Shape name.
         */
        get: ({ rec }) =>
          shapeName({
            shape: resolve(store, 'node', rec, 'shape'),
            'background-opacity': resolve(store, 'node', rec, 'background-opacity'),
            'text-valign': resolve(store, 'node', rec, 'text-valign'),
          }),
      },
      (v) => shapeOverride(v, base())
    ),
    flagColumn(store, 'nodes', 'hidden', { id: 'hidden', title: 'Hidden', group: 'format' }),
    flagColumn(store, 'nodes', 'locked', { id: 'locked', title: 'Locked', group: 'format' }),
    {
      id: 'value',
      title: 'Relative size',
      group: 'format',
      type: 'number',
      editable: true,
      /**
       * Get the factor's relative size.
       * @param {object} row Table row.
       * @returns {number|null} Relative size, if set.
       */
      get: ({ rec }) => rec.value ?? null,
      /**
       * Set the relative size of selected factors.
       * @param {Array<string>} ids Factor IDs.
       * @param {number} v Relative size.
       * @returns {void}
       */
      set: (ids, v) =>
        store.transact(() => ids.forEach((id) => store.update('nodes', id, { value: v }))),
    },
    colorColumn(store, 'node', 'background-color', {
      id: 'fill',
      title: 'Fill colour',
      group: 'format',
    }),
    css('border-width', {
      id: 'borderWidth',
      title: 'Border width',
      group: 'format',
      type: 'number',
    }),
    colorColumn(store, 'node', 'border-color', {
      id: 'borderColor',
      title: 'Border colour',
      group: 'format',
    }),
    borderStyleColumn(store),
    colorColumn(store, 'node', 'color', { id: 'fontColor', title: 'Font colour', group: 'format' }),
    css('font-size', { id: 'fontSize', title: 'Font size', group: 'format', type: 'number' }),
  ]
}

/**
 * The css to override when a shape is chosen: the shape's own size and label placement, with
 * the base style's values where the shape has none
 * @param {string} shape name as offered in the menu
 * @param {object} baseCss css of the base node style
 * @returns {object}
 */
function shapeOverride(shape, baseCss) {
  const patch = shapePatch(shape, {})
  for (const k of Object.keys(patch)) {
    if (patch[k] === undefined && k !== 'shape') patch[k] = baseCss[k]
  }
  return patch
}

/**
 * Create the factor border style column.
 * @param {MapStore} store
 * @returns {object} the Border style column (Solid, Dashed, Dotted, None)
 */
function borderStyleColumn(store) {
  return {
    id: 'borderStyle',
    title: 'Border style',
    group: 'format',
    type: 'select',
    editable: true,
    /**
     * List the border style choices.
     * @returns {Array<Array<string>>} Style values and labels.
     */
    options: () => BORDER_STYLES.map((s) => [s, s]),
    /**
     * Get the factor's current border style.
     * @param {object} row Table row.
     * @returns {string} Border style label.
     */
    get: ({ rec }) => {
      if (!resolve(store, 'node', rec, 'border-width')) return 'None'
      const style = resolve(store, 'node', rec, 'border-style') ?? 'solid'
      return style[0].toUpperCase() + style.slice(1)
    },
    /**
     * Set the border style on selected factors.
     * @param {Array<string>} ids Factor IDs.
     * @param {string} v Border style label.
     * @returns {void}
     */
    set: (ids, v) => {
      const patch = v === 'None' ? { 'border-width': 0 } : { 'border-style': v.toLowerCase() }
      store.transact(() => {
        for (const id of ids) {
          const rec = store.nodes.get(id)
          const width = resolve(store, 'node', rec, 'border-width')
          store.setOverrides(
            'nodes',
            [id],
            v === 'None' || width ? patch : { ...patch, 'border-width': 1 }
          )
        }
      })
    },
  }
}

/**
 * Columns of the Factors table
 * @param {MapStore} store
 * @returns {Array<object>}
 */
export function factorColumns(store) {
  return [
    { id: 'select', title: 'Select', group: 'main', type: 'select-row', editable: true },
    {
      id: 'label',
      title: 'Label',
      group: 'main',
      type: 'text',
      editable: true,
      truncate: LABEL_PREVIEW_LENGTH,
      /**
       * Get a factor label on one line.
       * @param {object} row Table row.
       * @returns {string} Display label.
       */
      get: ({ rec }) => (rec.label ?? '').replace(/\n/g, ' '),
      /**
       * Get the unflattened factor label for editing.
       * @param {object} row Table row.
       * @returns {string} Stored label.
       */
      editValue: ({ rec }) => rec.label ?? '',
      /**
       * Set selected factor labels.
       * @param {Array<string>} ids Factor IDs.
       * @param {string} v New label.
       * @returns {void}
       */
      set: (ids, v) =>
        store.transact(() => ids.forEach((id) => store.update('nodes', id, { label: v }))),
      aggregate: 'count',
    },
    modifiedColumn(),
    ...nodeFormatColumns(store),
    ...statColumns(),
    ...attributeColumns(store, 'nodes'),
    notesColumn(store, 'nodes'),
  ]
}

/**
 * Columns of the Links table
 * @param {MapStore} store
 * @returns {Array<object>}
 */
export function linkColumns(store) {
  /**
   * Create a link style property column.
   * @param {string} prop Style property.
   * @param {object} extra Additional column properties.
   * @param {function} [toPatch] Value-to-style conversion.
   * @returns {object} Column definition.
   */
  const css = (prop, extra, toPatch) =>
    cssColumn(store, 'edge', prop, { group: 'format', ...extra }, toPatch)
  /**
   * Create a reader for an endpoint's factor label.
   * @param {string} key Endpoint field.
   * @returns {function(object):string} Endpoint label reader.
   */
  const end =
    (key) =>
    ({ rec }) =>
      (store.nodes.get(rec[key])?.label ?? '').replace(/\n/g, ' ')
  return [
    { id: 'select', title: 'Select', group: 'main', type: 'select-row', editable: true },
    {
      id: 'from',
      title: 'From',
      group: 'main',
      type: 'text',
      truncate: LABEL_PREVIEW_LENGTH,
      get: end('source'),
      aggregate: 'count',
    },
    {
      id: 'to',
      title: 'To',
      group: 'main',
      type: 'text',
      truncate: LABEL_PREVIEW_LENGTH,
      get: end('target'),
    },
    {
      id: 'label',
      title: 'Label',
      group: 'main',
      type: 'text',
      truncate: LABEL_PREVIEW_LENGTH,
      editable: true,
      /**
       * Get a link label on one line.
       * @param {object} row Table row.
       * @returns {string} Display label.
       */
      get: ({ rec }) => (rec.label ?? '').replace(/\n/g, ' '),
      /**
       * Get the unflattened link label for editing.
       * @param {object} row Table row.
       * @returns {string} Stored label.
       */
      editValue: ({ rec }) => rec.label ?? '',
      /**
       * Set selected link labels.
       * @param {Array<string>} ids Link IDs.
       * @param {string} v New label.
       * @returns {void}
       */
      set: (ids, v) =>
        store.transact(() => ids.forEach((id) => store.update('edges', id, { label: v }))),
    },
    modifiedColumn(),
    styleColumn(store, 'edge'),
    flagColumn(store, 'edges', 'hidden', { group: 'format', id: 'hidden', title: 'Hidden' }),
    css('target-arrow-shape', {
      id: 'arrow',
      title: 'Arrow',
      type: 'select',
      /**
       * List the available arrow shapes.
       * @returns {Array<Array<string>>} Arrow values and labels.
       */
      options: () => ARROWS.map((s) => [s, s]),
    }),
    colorColumn(store, 'edge', 'line-color', { id: 'color', title: 'Colour', group: 'format' }),
    css('width', { id: 'width', title: 'Width', type: 'number' }),
    css('line-style', {
      id: 'lineStyle',
      title: 'Line style',
      type: 'select',
      /**
       * List the available link line styles.
       * @returns {Array<Array<string>>} Line style values and labels.
       */
      options: () => LINE_STYLES.map((s) => [s, s]),
    }),
    css('font-size', { id: 'fontSize', title: 'Font size', type: 'number' }),
    colorColumn(store, 'edge', 'color', { id: 'fontColor', title: 'Font colour', group: 'format' }),
    ...attributeColumns(store, 'edges'),
    notesColumn(store, 'edges'),
  ]
}
