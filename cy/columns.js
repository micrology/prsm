/* ****************************************************************************************
columns.js: the columns of the Factors and Links tables, as data. Each column says how to read
its value from a record (and the style it inherits from), how to write a new value back to the
MapStore, and how to total it in the table footer. The table view, sorting, filtering and
copy-to-clipboard are all driven from these lists.
**************************************************************************************** */
import { toHex, shapePatch, SHAPES, ARROWS, LINE_STYLES, colorPatch } from './styleeditor.js'

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
 * @param {object} css resolved css of a node
 * @returns {string} name of the shape as offered in the shape menus
 */
export function shapeName(css) {
  const shape = css.shape
  if (shape === 'round-rectangle') return 'box'
  if (shape === 'barrel') return 'database'
  if (shape === 'rectangle') return css['background-opacity'] === 0 ? 'text' : 'square'
  return shape ?? 'ellipse'
}

/**
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
    get: ({ rec }) => resolve(store, kind, rec, prop),
    set: (ids, v) => store.setOverrides(mapName, ids, toPatch(v)),
    ...extra,
  }
}

/**
 * @param {MapStore} store
 * @param {'node'|'edge'} kind
 * @param {string} prop css property holding a colour
 * @param {object} extra
 * @returns {object} a colour column
 */
function colorColumn(store, kind, prop, extra) {
  const patch = (v) => colorPatch(kind, prop, v)
  const col = cssColumn(store, kind, prop, { type: 'color', ...extra }, patch)
  const raw = col.get
  col.get = (row) => toHex(raw(row))
  return col
}

/**
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
    get: ({ rec }) => Boolean(rec[field]),
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
    options: () =>
      [...store.styles.entries()]
        .filter(([, s]) => s.kind === kind)
        .map(([id, s]) => [id, s.name || (id.endsWith('Base') ? 'Default' : id)]),
    get: ({ rec }) =>
      store.styles.get(rec.style)?.name || (store.styles.has(rec.style) ? 'Default' : EM_DASH),
    value: ({ rec }) => rec.style,
    set: (ids, v) => store.setElementStyle(mapName, ids, v),
  }
}

/** @returns {object} the Modified column */
function modifiedColumn() {
  return {
    id: 'modified',
    title: 'Modified',
    group: 'main',
    type: 'date',
    get: ({ rec }) => rec.modified?.time ?? rec.created?.time ?? null,
  }
}

/**
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
    get: ({ rec }) => noteText(rec.note),
    value: ({ rec }) => rec.note,
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
      get: ({ rec }) => rec[field] ?? '',
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
  const stat = (id, title, aggregate, extra = {}) => ({
    id,
    title,
    group: 'statistics',
    type: 'number',
    get: ({ stats }) => stats?.[id] ?? null,
    aggregate,
    ...extra,
  })
  const count = (field, id, title) => ({
    id,
    title,
    group: 'statistics',
    type: 'number',
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
 * @param {MapStore} store
 * @returns {Array<object>} the formatting columns of the Factors table
 */
function nodeFormatColumns(store) {
  const css = (prop, extra, toPatch) => cssColumn(store, 'node', prop, extra, toPatch)
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
        options: () => SHAPES.map((s) => [s, s]),
        get: ({ rec }) =>
          shapeName({
            shape: resolve(store, 'node', rec, 'shape'),
            'background-opacity': resolve(store, 'node', rec, 'background-opacity'),
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
      get: ({ rec }) => rec.value ?? null,
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
    options: () => BORDER_STYLES.map((s) => [s, s]),
    get: ({ rec }) => {
      if (!resolve(store, 'node', rec, 'border-width')) return 'None'
      const style = resolve(store, 'node', rec, 'border-style') ?? 'solid'
      return style[0].toUpperCase() + style.slice(1)
    },
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
      get: ({ rec }) => (rec.label ?? '').replace(/\n/g, ' '),
      editValue: ({ rec }) => rec.label ?? '',
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
  const css = (prop, extra, toPatch) =>
    cssColumn(store, 'edge', prop, { group: 'format', ...extra }, toPatch)
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
      get: ({ rec }) => (rec.label ?? '').replace(/\n/g, ' '),
      editValue: ({ rec }) => rec.label ?? '',
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
      options: () => ARROWS.map((s) => [s, s]),
    }),
    colorColumn(store, 'edge', 'line-color', { id: 'color', title: 'Colour', group: 'format' }),
    css('width', { id: 'width', title: 'Width', type: 'number' }),
    css('line-style', {
      id: 'lineStyle',
      title: 'Line style',
      type: 'select',
      options: () => LINE_STYLES.map((s) => [s, s]),
    }),
    css('font-size', { id: 'fontSize', title: 'Font size', type: 'number' }),
    colorColumn(store, 'edge', 'color', { id: 'fontColor', title: 'Font colour', group: 'format' }),
    ...attributeColumns(store, 'edges'),
    notesColumn(store, 'edges'),
  ]
}
