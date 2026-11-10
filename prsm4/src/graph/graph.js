/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Defines the displayed graph and its styles.
********************************************************************************************/

/* ****************************************************************************************
graph.js: build a Cytoscape instance from a v2 map file (phase 2: read-only rendering test bed).
**************************************************************************************** */
import cytoscape from 'cytoscape'
import { edgeCurveStyle } from './curves.js'
import { normalizeShape } from './shapes.js'

const SELECT_COLOR = '#3399ff'

// Cytoscape deprecates `width: label` but offers no replacement for sizing a node to its label,
// and we choose the wheel sensitivity deliberately, so these two warnings are dropped.
const IGNORED_WARNINGS = [
  /value of `label` is deprecated/,
  /custom wheel sensitivity/,
  /has invalid endpoints/,
]
const nativeWarn = console.warn.bind(console)
/**
 * Suppress selected known Cytoscape warnings and report all others.
 * @param {...*} args Warning arguments.
 * @returns {void}
 */
console.warn = (...args) => {
  if (IGNORED_WARNINGS.some((re) => re.test(String(args[0])))) return
  nativeWarn(...args)
}

/**
 * Compile the v2 style table into a Cytoscape stylesheet
 * @param {object} styles file.styles
 * @returns {Array}
 */
export function compileStylesheet(styles) {
  const sheet = [
    { selector: 'node[label]', style: { label: 'data(label)' } },
    { selector: 'edge[label]', style: { label: 'data(label)' } },
    {
      selector: 'node',
      style: {
        'text-wrap': 'wrap',
        'text-halign': 'center',
        'text-valign': 'center',
        'font-family': 'Oxygen, sans-serif',
        'font-size': 14,
        'min-zoomed-font-size': 4,
      },
    },
    {
      selector: 'edge',
      style: {
        'text-wrap': 'wrap',
        'text-rotation': 'autorotate',
        'text-margin-y': -10,
        'font-family': 'Oxygen, sans-serif',
        'arrow-scale': 1,
      },
    },
  ]
  // the base styles come first so that the user styles override them
  /**
   * Identify the base stylesheet entries.
   * @param {string} id Style ID.
   * @returns {boolean} Whether the ID denotes a base style.
   */
  const isBase = (id) => id === 'nodeBase' || id === 'edgeBase'
  const ids = Object.keys(styles).sort((a, b) => isBase(b) - isBase(a))
  for (const id of ids) {
    const st = styles[id]
    sheet.push({
      selector: isBase(id) ? st.kind : `${st.kind}.${id}`,
      style: st.kind === 'node' ? normalizeShape(st.css) : st.css,
    })
  }
  sheet.push(
    {
      selector: 'node:selected',
      style: { 'underlay-color': SELECT_COLOR, 'underlay-opacity': 0.35, 'underlay-padding': 6 },
    },
    {
      selector: 'node, edge',
      style: { 'overlay-opacity': 0 },
    },
    {
      selector: 'edge:selected',
      style: { 'underlay-color': SELECT_COLOR, 'underlay-opacity': 0.35, 'underlay-padding': 4 },
    },
    { selector: '.hidden, .clusterHidden, .analysisHidden', style: { display: 'none' } },
    {
      selector: ':parent.expanded',
      style: {
        shape: 'round-rectangle',
        'background-opacity': 0.15,
        'border-width': 2,
        'border-style': 'dashed',
        padding: 20,
        'text-valign': 'top',
        'text-margin-y': -4,
      },
    },
    {
      selector: '.eh-handle',
      style: { 'background-color': SELECT_COLOR, width: 12, height: 12, shape: 'ellipse' },
    },
    {
      selector: '.eh-source, .eh-target',
      style: { 'border-width': 3, 'border-color': SELECT_COLOR },
    },
    {
      selector: '.eh-ghost-edge, .eh-preview',
      style: { 'line-color': SELECT_COLOR, 'target-arrow-color': SELECT_COLOR, opacity: 0.7 },
    },
    { selector: '.eh-ghost-edge.eh-preview-active', style: { opacity: 0 } }
  )
  return sheet
}

const MIN_RELATIVE_SIZE = 5

/**
 * Construct the classes representing an element's style and visibility.
 * @param {string} style style id
 * @param {object} data element data
 * @returns {string} Cytoscape classes: the style, and 'hidden' if the user has hidden the element
 */
function classesOf(style, data) {
  return data.hidden ? `${style} hidden` : style
}

/**
 * Relative size is a percentage: 5% is 32.5px across and 100% is 270px (as in the old size slider).
 * It is applied as a per-element style so that it also beats a shape's own size.
 * @param {object|undefined} overrides the element's style overrides
 * @param {number|undefined} value relative size, in percent
 * @returns {object|undefined} overrides with width and height added if a size is set
 */
function withRelativeSize(overrides, value) {
  if (!(value >= MIN_RELATIVE_SIZE)) return overrides
  const size = 32.5 + ((Math.min(value, 100) - MIN_RELATIVE_SIZE) * (270 - 32.5)) / 95
  return { ...overrides, width: size, height: size }
}

/**
 * Convert a v2 node record to a Cytoscape element definition
 * @param {object} rec node record (id included)
 * @returns {object}
 */
export function nodeElement(rec) {
  const { x, y, style, overrides, ...data } = rec
  data.label ??= ''
  return {
    group: 'nodes',
    data,
    position: { x: x ?? 0, y: y ?? 0 },
    classes: classesOf(style, data),
    style: withRelativeSize(normalizeShape(overrides), data.value),
  }
}

/**
 * Convert a v2 edge record to a Cytoscape element definition
 * @param {object} rec edge record (id included)
 * @returns {object}
 */
export function edgeElement(rec) {
  const { style, overrides, ...data } = rec
  data.label ??= ''
  return { group: 'edges', data, classes: classesOf(style, data), style: overrides }
}

/**
 * Convert the v2 node and edge records to Cytoscape element definitions
 * @param {object} file v2 file object
 * @returns {Array}
 */
export function toElements(file) {
  return [...file.nodes.map(nodeElement), ...file.edges.map(edgeElement)]
}

/**
 * Set the curve geometry of edges from the current node positions
 * @param {cytoscape.Core|cytoscape.EdgeCollection} target
 * @param {string} mode 'Curved' or 'Straight' (the map-wide setting)
 * @returns {void}
 */
export function applyCurves(target, mode) {
  const edges = target.edges ? target.edges() : target
  const roundness = mode === 'Curved' ? 0.5 : 0
  edges.forEach((edge) => {
    /**
     * Measure half the rendered dimensions of a factor.
     * @param {cytoscape.NodeSingular} n Factor.
     * @returns {{hw:number,hh:number}} Half-width and half-height.
     */
    const half = (n) => ({ hw: n.outerWidth() / 2, hh: n.outerHeight() / 2 })
    const sizes = { src: half(edge.source()), tgt: half(edge.target()) }
    edge.style(
      edgeCurveStyle(
        edge.source().position(),
        edge.target().position(),
        edge.data('curve'),
        roundness,
        sizes
      )
    )
  })
}

/**
 * Create a Cytoscape instance in container showing the map
 * @param {HTMLElement} container
 * @param {object} file v2 file object
 * @returns {cytoscape.Core}
 */
export function createGraph(container, file) {
  const mode = file.meta.settings.curve
  const cy = cytoscape({
    container,
    elements: toElements(file),
    style: compileStylesheet(file.styles),
    layout: { name: 'preset' },
    wheelSensitivity: 0.3,
    selectionType: 'additive',
    boxSelectionEnabled: true,
    minZoom: 0.02,
    maxZoom: 8,
  })
  applyCurves(cy, mode)
  // curves depend on the positions of both end points, so recompute them when nodes move
  cy.on('position', 'node', (evt) =>
    applyCurves(evt.target.connectedEdges(), cy.scratch('curveMode'))
  )
  cy.scratch('curveMode', mode)
  cy.fit(undefined, 30)
  return cy
}
