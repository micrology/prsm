/* ****************************************************************************************
graph.js: build a Cytoscape instance from a v2 map file (phase 2: read-only rendering test bed).
**************************************************************************************** */
import cytoscape from 'cytoscape'
import { edgeCurveStyle } from './curves.js'

const SELECT_COLOR = '#3399ff'

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
  const isBase = (id) => id === 'nodeBase' || id === 'edgeBase'
  const ids = Object.keys(styles).sort((a, b) => isBase(b) - isBase(a))
  for (const id of ids) {
    const st = styles[id]
    sheet.push({ selector: isBase(id) ? st.kind : `${st.kind}.${id}`, style: st.css })
  }
  sheet.push(
    {
      selector: 'node:selected',
      style: { 'underlay-color': SELECT_COLOR, 'underlay-opacity': 0.35, 'underlay-padding': 6 },
    },
    {
      selector: 'edge:selected',
      style: { 'underlay-color': SELECT_COLOR, 'underlay-opacity': 0.35, 'underlay-padding': 4 },
    },
    { selector: '.hidden', style: { display: 'none' } },
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
    classes: style,
    style: overrides,
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
  return { group: 'edges', data, classes: style, style: overrides }
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
 */
export function applyCurves(target, mode) {
  const edges = target.edges ? target.edges() : target
  const roundness = mode === 'Curved' ? 0.5 : 0
  edges.forEach((edge) => {
    edge.style(
      edgeCurveStyle(
        edge.source().position(),
        edge.target().position(),
        edge.data('curve'),
        roundness
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
