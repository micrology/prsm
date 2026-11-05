/* ****************************************************************************************
legacy.js: read a PRSM map file in any pre-Cytoscape format and convert it to the v2 format
(see doc/cytoscape-data-model.md).  Everything here is pure (no DOM, no Yjs), so it can run
in the browser and under Node.

  parseMapText(str)      -> JSON object  (handles LZ-compressed files)
  normaliseLegacy(json)  -> cleaned-up legacy object  (old-version quirks removed)
  legacyToV2(json)       -> { file, report }   v2 file object and a report of what was dropped/changed
**************************************************************************************** */
import lzString from 'lz-string'
import { styles as DEFAULT_STYLES } from '../js/samples.js'

export const SCHEMA_VERSION = 2

/**
 * Parse the text of a .prsm file, decompressing it if necessary
 * @param {string} str
 * @returns {object}
 */
export function parseMapText(str) {
  if (str[0] !== '{') str = lzString.decompressFromUTF16(str)
  return JSON.parse(str)
}

/* ------------------------------------------------------------------ small utilities */

function isPlainObject(x) {
  return Object.prototype.toString.call(x) === '[object Object]'
}

/**
 * Recursive merge; later arguments win.  Arrays and scalars are replaced, not merged.
 * @returns {object}
 */
export function deepMerge(...objs) {
  const out = {}
  for (const obj of objs) {
    if (!obj) continue
    for (const [k, v] of Object.entries(obj)) {
      out[k] = isPlainObject(v) ? deepMerge(out[k], v) : v
    }
  }
  return out
}

/**
 * Break a label into lines (copy of splitText() in js/utils.js, which cannot be imported here)
 * @param {string} txt
 * @param {number} width
 * @returns {string}
 */
export function splitText(txt, width = 10) {
  let lines = ''
  txt
    .trim()
    .split('\n')
    .forEach((chunk) => {
      const words = chunk.trim().split(/\s/)
      const nChars = chunk.trim().length
      if (nChars > 2 * width) width = Math.floor(Math.sqrt(nChars))
      for (let i = 0, linelength = 0; i < words.length; i++) {
        lines += words[i]
        if (i === words.length - 1) break
        linelength += words[i].length
        if (linelength > width) {
          lines += '\n'
          linelength = 0
        } else lines += ' '
      }
      lines += '\n'
    })
  return lines.trim()
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/* ------------------------------------------------------------------ normalise */

/**
 * Remove the quirks of old file versions.  Does not change the vocabulary (still vis-network style);
 * that is done by legacyToV2().  Mutates and returns json.
 * @param {object} json
 * @returns {object}
 */
export function normaliseLegacy(json) {
  if (!json.nodes) json.nodes = []
  if (!json.edges) json.edges = []
  // before v1.4, the style array was called samples
  if (json.samples && !json.styles) json.styles = json.samples
  json.nodes.forEach((n) => {
    // at version 1.5, the title: property was renamed to note:
    if (!n.note && n.title) n.note = n.title.replace(/<br>|<p>/g, '\n')
    delete n.title
    if (n.note && !(n.note instanceof Object)) n.note = { ops: [{ insert: n.note }] }
    n.label = splitText(String(n.label ?? ''))
    if (n.x == null) n.x = 0
    if (n.y == null) n.y = 0
  })
  json.edges.forEach((e) => {
    if (!e.note && e.title) e.note = e.title.replace(/<br>|<p>/g, '\n')
    delete e.title
    if (e.note && !(e.note instanceof Object)) e.note = { ops: [{ insert: e.note }] }
    if (e.label) e.label = splitText(String(e.label))
  })
  // old versions double-stringified the background
  if (typeof json.background === 'string') {
    try {
      json.background = JSON.parse(json.background)
    } catch {
      delete json.background
    }
  }
  return json
}

/* ------------------------------------------------------------------ vocabulary: vis -> cytoscape */

const NODE_SHAPES = {
  ellipse: 'ellipse',
  circle: 'ellipse',
  box: 'round-rectangle',
  database: 'barrel',
  text: 'rectangle',
  dot: 'ellipse',
  square: 'rectangle',
  triangle: 'triangle',
  triangleDown: 'triangle',
  hexagon: 'hexagon',
  diamond: 'diamond',
  star: 'star',
}
// vis-network draws the label inside these shapes; for all others it is drawn below the shape
const LABEL_INSIDE = new Set(['ellipse', 'circle', 'box', 'database', 'text'])

const ARROW_SHAPES = {
  vee: 'vee',
  arrow: 'triangle',
  circle: 'circle',
  diamond: 'diamond',
  bar: 'tee',
  box: 'square',
  curve: 'vee',
}

/**
 * @param {object} s vis-network node options
 * @returns {number} the node's margin in pixels (default 20)
 */
function marginOf(s) {
  if (s.margin == null) return 20
  return isPlainObject(s.margin) ? (s.margin.left ?? 10) : s.margin
}

/**
 * Convert a (resolved) vis-network node style into Cytoscape style properties
 * @param {object} s vis-network node options (any subset)
 * @param {object} report to record unmapped properties
 * @returns {object} Cytoscape css
 */
export function nodeStyleToCss(s, report = null) {
  const css = {}
  if (s.shape) {
    css.shape = NODE_SHAPES[s.shape] || 'ellipse'
    if (!NODE_SHAPES[s.shape]) report?.unmapped.add(`node shape ${s.shape}`)
    if (s.shape === 'text') {
      css['background-opacity'] = 0
      css['border-width'] = 0
    }
    if (!LABEL_INSIDE.has(s.shape)) {
      css['text-valign'] = 'bottom'
      css['text-margin-y'] = 5
      // same overall height as a label-sized box (one line of text plus the margins)
      const height = (s.font?.size ?? 14) + 2 * marginOf(s)
      css.height = height
      css.width = s.shape === 'hexagon' ? Math.round(height * 1.15) : height
      css.padding = 0
    } else {
      css['text-valign'] = 'center'
      css.width = 'label'
      css.height = 'label'
    }
  }
  if (s.color) {
    if (s.color.background) css['background-color'] = s.color.background
    if (s.color.border) css['border-color'] = s.color.border
  }
  if (s.borderWidth != null && s.shape !== 'text') css['border-width'] = s.borderWidth
  if (s.shapeProperties && 'borderDashes' in s.shapeProperties) {
    css['border-style'] = s.shapeProperties.borderDashes ? 'dashed' : 'solid'
  }
  if (s.font) {
    if (s.font.color) css.color = s.font.color
    if (s.font.size) css['font-size'] = s.font.size
    if (s.font.face) css['font-family'] = `${s.font.face}, sans-serif`
    css['font-style'] = 'normal'
    css['font-weight'] = 'normal'
  }
  if (s.margin != null && LABEL_INSIDE.has(s.shape ?? 'ellipse')) css.padding = marginOf(s)
  return css
}

/**
 * Convert a (resolved) vis-network edge style into Cytoscape style properties
 * @param {object} s vis-network edge options (any subset)
 * @param {object} report
 * @returns {object}
 */
export function edgeStyleToCss(s, report = null) {
  const css = {}
  if (s.color?.color) {
    css['line-color'] = s.color.color
    css['target-arrow-color'] = s.color.color
    css['source-arrow-color'] = s.color.color
    css['mid-target-arrow-color'] = s.color.color
  }
  if (s.width != null) css.width = s.width
  if ('dashes' in s) css['line-style'] = dashesToLineStyle(s.dashes, css)
  if (s.arrows) {
    for (const [pos, prop] of [
      ['to', 'target'],
      ['from', 'source'],
      ['middle', 'mid-target'],
    ]) {
      const a = s.arrows[pos]
      if (!a) continue
      if (a.enabled === false) css[`${prop}-arrow-shape`] = 'none'
      else if (a.enabled || a.type) {
        // a 'middle' arrow of type image is how the old app showed that a link has a note
        if (a.type === 'image') {
          css[`${prop}-arrow-shape`] = 'none'
          continue
        }
        const shape = ARROW_SHAPES[a.type || 'arrow']
        if (!shape) report?.unmapped.add(`arrow type ${a.type}`)
        css[`${prop}-arrow-shape`] = shape || 'triangle'
      }
    }
  }
  if (s.font) {
    if (s.font.size) css['font-size'] = s.font.size
    if (s.font.color) css.color = s.font.color
    if (s.font.background) {
      css['text-background-color'] = s.font.background
      css['text-background-opacity'] = 1
      css['text-background-padding'] = 2
    }
  }
  return css
}

function dashesToLineStyle(dashes, css) {
  if (!dashes) return 'solid'
  if (dashes === true) return 'dashed'
  if (Array.isArray(dashes)) {
    if (dashes[0] <= 3 && dashes[1] <= 3) return 'dotted'
    css['line-dash-pattern'] = dashes
    return 'dashed'
  }
  return 'solid'
}

/** keep entries of `css` that differ from `base` */
function cssDiff(css, base) {
  const out = {}
  for (const [k, v] of Object.entries(css)) if (!sameValue(v, base[k])) out[k] = v
  return out
}

/* ------------------------------------------------------------------ curves */

/**
 * Convert a legacy edge.smooth to the v2 edge curve record, or undefined if the edge uses the map default.
 * The fork's drag-to-curve feature stored curvedSymmetricCW / CCW with a roundness; the control point was
 * perpendicular to the mid-point of the edge at a distance of roundness * length / 2.
 * v2 stores {side: 1|-1, roundness}.
 * @param {object} smooth
 * @returns {{side: number, roundness: number}|undefined}
 */
export function smoothToCurve(smooth) {
  if (!smooth || typeof smooth !== 'object') return undefined
  if (smooth.type === 'curvedSymmetricCW') return { side: 1, roundness: smooth.roundness ?? 0 }
  if (smooth.type === 'curvedSymmetricCCW') return { side: -1, roundness: smooth.roundness ?? 0 }
  return undefined
}

/* ------------------------------------------------------------------ legacy -> v2 */

/**
 * Convert a legacy (normalised) map to the v2 file format
 * @param {object} legacy result of normaliseLegacy()
 * @returns {{file: object, report: object}}
 */
export function legacyToV2(legacy) {
  const report = {
    warnings: [],
    unmapped: new Set(),
    idRemaps: 0,
    overrides: 0,
    curves: 0,
    droppedEdges: 0,
    unknownStyles: 0,
  }
  if (legacy.edges.length > 0 && 'source' in legacy.edges[0]) {
    report.warnings.push('Gephi-format file: needs the new importer')
    return { file: null, report }
  }
  const { styles, legacyStyles } = convertStyles(legacy.styles, report)
  const nodeIds = new Set(legacy.nodes.map((n) => String(n.id)))
  const nodes = legacy.nodes.map((n) => convertNode(n, legacyStyles, report))
  const edgeIds = new Set()
  const edges = legacy.edges
    .filter((e) => {
      const ok = nodeIds.has(String(e.from)) && nodeIds.has(String(e.to))
      if (!ok) report.droppedEdges++
      return ok
    })
    .map((e) => convertEdge(e, nodeIds, edgeIds, legacyStyles, report))
  const b = legacy.buttons || {}
  const file = {
    format: 'prsm2',
    schemaVersion: SCHEMA_VERSION,
    saved: legacy.saved,
    room: legacy.room,
    meta: {
      title: legacy.mapTitle,
      description: legacy.description,
      attributeTitles: legacy.attributeTitles || {},
      settings: {
        curve: b.curve === 'Straight' ? 'Straight' : 'Curved',
        snapToGrid: !!b.snapToGrid,
        background: b.background || '#ffffff',
        legend: !!b.legend,
        sizing: b.sizing || 'Off',
        lastNodeStyle: legacy.lastNodeSample,
        lastEdgeStyle: legacy.lastLinkSample,
      },
    },
    styles,
    nodes,
    edges,
    // Fabric drawings are converted to regions in a later phase
    background: legacy.background || null,
    history: legacy.history || [],
  }
  return { file, report }
}

/**
 * Build the v2 style table and the resolved legacy styles (used to compute per-element overrides)
 */
/**
 * Node and edge styles share an id space in v2, so the names used by both tables must be made distinct
 * @param {string} kind 'node' or 'edge'
 * @param {string} id vis-network style id
 * @returns {string}
 */
function styleId(kind, id) {
  if (id === 'base') return `${kind}Base`
  return id === 'cluster' ? `${kind}Cluster` : id
}

/** the old app labelled unnamed styles 'Sample' */
function placeholderName(name) {
  return !name || name === 'Sample' ? '' : name
}

function convertStyles(fileStyles, report) {
  const merged = {
    nodes: deepMerge(DEFAULT_STYLES.nodes, fileStyles?.nodes),
    edges: deepMerge(DEFAULT_STYLES.edges, fileStyles?.edges),
  }
  const styles = {}
  const legacyStyles = { nodes: {}, edges: {} }
  for (const kind of ['node', 'edge']) {
    const table = merged[`${kind}s`]
    const toCss = kind === 'node' ? nodeStyleToCss : edgeStyleToCss
    for (const [id, st] of Object.entries(table)) {
      delete st.chosen
      const resolved = id === 'base' ? st : deepMerge(table.base, st)
      legacyStyles[`${kind}s`][id] = resolved
      styles[styleId(kind, id)] = {
        kind,
        name: placeholderName(st.groupLabel ?? resolved.groupLabel),
        css: toCss(resolved, report),
      }
    }
  }
  return { styles, legacyStyles }
}

const NODE_KEEP = [
  'label',
  'note',
  'created',
  'modified',
  'locked',
  'thumbUp',
  'thumbDown',
  'value',
]

function convertNode(n, legacyStyles, report) {
  let style = n.grp || 'group0'
  if (!legacyStyles.nodes[style]) {
    // the old app showed such a node with just its own properties
    report.unknownStyles++
    style = 'nodeBase'
  }
  const out = { id: String(n.id), x: n.x, y: n.y, style }
  for (const k of NODE_KEEP) if (n[k] !== undefined) out[k] = n[k]
  if (n.nodeHidden) out.hidden = true
  // a pinned factor (vis-network `fixed`) cannot be dragged
  if (n.fixed === true) out.locked = true
  // user attributes: att1, att2, ...
  for (const k of Object.keys(n)) if (/^att\d+$/.test(k)) out[k] = n[k]
  const base = legacyStyles.nodes[n.grp] || legacyStyles.nodes.base
  const own = nodeStyleToCss(
    {
      color: n.color,
      font: n.font,
      borderWidth: n.borderWidth,
      shape: n.shape,
      shapeProperties: n.shapeProperties,
      margin: n.margin,
    },
    report
  )
  const overrides = cssDiff(own, nodeStyleToCss(base))
  if (Object.keys(overrides).length) {
    out.overrides = overrides
    report.overrides++
  }
  return out
}

function convertEdge(e, nodeIds, edgeIds, legacyStyles, report) {
  let id = String(e.id)
  // Cytoscape has a single id space for nodes and edges
  while (nodeIds.has(id) || edgeIds.has(id)) {
    id = `${id}-e`
    report.idRemaps++
  }
  edgeIds.add(id)
  let style = e.grp || 'edge0'
  if (!legacyStyles.edges[style]) {
    report.unknownStyles++
    style = 'edgeBase'
  }
  const out = { id, source: String(e.from), target: String(e.to), style }
  for (const k of ['label', 'note', 'created', 'modified']) if (e[k] !== undefined) out[k] = e[k]
  if (e.edgeHidden) out.hidden = true
  const base = legacyStyles.edges[e.grp] || legacyStyles.edges.base
  const own = edgeStyleToCss(
    { color: e.color, dashes: e.dashes, width: e.width, font: e.font, arrows: e.arrows },
    report
  )
  const overrides = cssDiff(own, edgeStyleToCss(base))
  if (Object.keys(overrides).length) {
    out.overrides = overrides
    report.overrides++
  }
  const curve = smoothToCurve(e.smooth)
  if (curve) {
    out.curve = curve
    report.curves++
  } else if (e.smooth) report.unmapped.add(`smooth ${JSON.stringify(e.smooth).slice(0, 40)}`)
  return out
}
