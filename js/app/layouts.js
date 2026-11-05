import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import dagre from 'cytoscape-dagre'
import { trophicPositions } from '../../cy/trophic.js'

cytoscape.use(fcose)
cytoscape.use(dagre)

const VERTICAL_GAP = 10

export const LAYOUTS = {
  off: 'Off',
  trophic: 'Trophic',
  fan: 'Fan',
  force: 'Force-directed',
  hierarchical: 'Hierarchical',
}

/**
 * @param {cytoscape.Core} cy
 * @returns {cytoscape.NodeCollection} the factors that are on show (not hidden, not inside a closed cluster)
 */
function visibleFactors(cy) {
  return cy.nodes().not('.hidden, .clusterHidden, :parent')
}

/**
 * @param {cytoscape.NodeCollection} nodes
 * @returns {Object<string,{x:number,y:number}>} their present positions
 */
function positionsOf(nodes) {
  const positions = {}
  nodes.forEach((n) => (positions[n.id()] = { ...n.position() }))
  return positions
}

/**
 * Trophic layout: causes to the left, effects to the right
 * @param {cytoscape.Core} cy
 * @returns {Object<string,{x:number,y:number}>} new positions
 */
function trophicLayout(cy) {
  const nodes = visibleFactors(cy)
  const links = nodes.edgesWith(nodes).map((e) => ({ from: e.source().id(), to: e.target().id() }))
  const records = nodes.map((n) => ({ id: n.id(), ...n.position() }))
  return trophicPositions(records, links, (id) => cy.getElementById(id).outerHeight())
}

/**
 * Factors reachable from the selected ones by following links one way, in rows by distance
 * @param {cytoscape.Core} cy
 * @param {string} direction 'to' (follow links forwards) or 'from' (backwards)
 * @returns {Map<string, number>} the level (links away from the selection) of each factor
 */
function fanLevels(cy, direction) {
  const shown = visibleFactors(cy)
  const levels = new Map()
  let frontier = cy.nodes(':selected').intersection(shown)
  frontier.forEach((n) => levels.set(n.id(), 0))
  for (let level = 1; frontier.nonempty(); level++) {
    const reached = direction === 'to' ? frontier.outgoers('node') : frontier.incomers('node')
    frontier = reached.intersection(shown).filter((n) => !levels.has(n.id()))
    frontier.forEach((n) => levels.set(n.id(), level))
  }
  return levels
}

/**
 * Fan layout: the selected factors in one column, and the factors they lead to (or come from)
 * in columns further and further away
 * @param {cytoscape.Core} cy
 * @returns {Object<string,{x:number,y:number}>} new positions
 */
function fanLayout(cy) {
  const selected = cy.nodes(':selected')
  if (selected.empty()) throw new Error('At least one Factor needs to be selected')
  const direction =
    selected.outgoers('node').length > selected.incomers('node').length ? 'to' : 'from'
  const levels = fanLevels(cy, direction)
  const nodes = visibleFactors(cy)
  const minX = Math.min(...nodes.map((n) => n.position('x')))
  const maxX = Math.max(...nodes.map((n) => n.position('x')))
  const last = Math.max(...levels.values(), 1)
  const positions = {}
  for (let l = 0; l <= last; l++) {
    const x =
      direction === 'to' ? minX + (l * (maxX - minX)) / last : maxX - (l * (maxX - minX)) / last
    const row = nodes
      .filter((n) => (levels.get(n.id()) ?? 0) === l)
      .sort((a, b) => a.position('y') - b.position('y'))
    const heights = row.map((n) => n.outerHeight() + VERTICAL_GAP)
    let y = -heights.reduce((a, b) => a + b, 0) / 2
    row.forEach((n, i) => {
      positions[n.id()] = { x, y }
      y += heights[i]
    })
  }
  return positions
}

/**
 * Run one of the Cytoscape layout extensions on the visible factors
 * @param {cytoscape.Core} cy
 * @param {object} options layout options
 * @returns {Promise<Object<string,{x:number,y:number}>>} the positions it chose
 */
function runExtension(cy, options) {
  const nodes = visibleFactors(cy)
  const before = positionsOf(nodes)
  const layout = nodes
    .union(nodes.edgesWith(nodes))
    .layout({ animate: false, fit: false, ...options })
  return new Promise((resolve) => {
    layout.one('layoutstop', () => {
      const after = positionsOf(nodes)
      nodes.forEach((n) => n.position(before[n.id()]))
      resolve(after)
    })
    layout.run()
  })
}

/**
 * Compute the positions that a layout would give the factors of the map
 * @param {string} name a key of LAYOUTS
 * @param {cytoscape.Core} cy
 * @returns {Promise<Object<string,{x:number,y:number}>>} new positions, by factor id
 */
export async function layoutPositions(name, cy) {
  switch (name) {
    case 'trophic':
      return trophicLayout(cy)
    case 'fan':
      return fanLayout(cy)
    case 'force':
      return runExtension(cy, { name: 'fcose', randomize: false, quality: 'default' })
    case 'hierarchical':
      return runExtension(cy, { name: 'dagre', rankDir: 'LR', nodeSep: 30, rankSep: 80 })
    default:
      return {}
  }
}
