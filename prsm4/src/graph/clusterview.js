/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Displays collapsed and expanded clusters.
********************************************************************************************/

/* ****************************************************************************************
clusterview.js: how clusters look in the graph, worked out from the node records.
  collapsed cluster: its members are hidden and links to them are summarised by a "meta"
                     link between the cluster node and the other end, labelled with the count
  expanded cluster:  a compound node drawn as a box around its members
Nothing here is stored; it is recomputed whenever a record that matters changes.
**************************************************************************************** */

const SEPARATOR = '\n'

// classes set by this module; the binding must keep them when it resets a node's style classes
export const VIEW_CLASSES = new Set([
  'clusterHidden',
  'collapsed',
  'expanded',
  'meta',
  'analysisHidden',
])

/**
 * Check whether a node represents a cluster.
 * @param {cytoscape.NodeSingular} node
 * @returns {boolean} true if the node is a cluster node
 */
export function isCluster(node) {
  return Boolean(node.data('cluster'))
}

/**
 * Work out which cluster node each factor is currently collapsed into
 * @param {cytoscape.Core} cy
 * @returns {Map<string, string>} factor id -> id of the collapsed cluster that hides it
 */
function collapsedMap(cy) {
  const hiddenIn = new Map()
  cy.nodes().forEach((n) => {
    const cid = n.data('inCluster')
    if (!cid) return
    const c = cy.getElementById(cid)
    if (c.nonempty() && c.data('cluster').collapsed) hiddenIn.set(n.id(), cid)
  })
  return hiddenIn
}

/**
 * Show members of expanded clusters inside their cluster and hide members of collapsed ones
 * @param {cytoscape.Core} cy
 * @param {Map<string, string>} hiddenIn
 * @returns {void}
 */
function placeMembers(cy, hiddenIn) {
  cy.nodes().forEach((n) => {
    const cid = n.data('inCluster')
    const collapsed = hiddenIn.has(n.id())
    n.toggleClass('clusterHidden', collapsed)
    if (collapsed) n.unselect()
    if (isCluster(n)) {
      const c = n.data('cluster').collapsed
      n.toggleClass('collapsed', c)
      n.toggleClass('expanded', !c)
    }
    const parent = !collapsed && cid && cy.getElementById(cid).nonempty() ? cid : null
    if ((n.data('parent') ?? null) !== parent) n.move({ parent })
  })
}

/**
 * Replace the summary links with up-to-date ones
 * @param {cytoscape.Core} cy
 * @param {Map<string, string>} hiddenIn
 * @returns {void}
 */
function summariseLinks(cy, hiddenIn) {
  cy.remove('.meta')
  const counts = new Map()
  cy.edges().forEach((e) => {
    const source = e.data('source')
    const target = e.data('target')
    const s = hiddenIn.get(source) ?? source
    const t = hiddenIn.get(target) ?? target
    if ((s === source && t === target) || s === t) return
    const key = `${s}${SEPARATOR}${t}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  const metas = [...counts].map(([key, n]) => {
    const [source, target] = key.split(SEPARATOR)
    return {
      group: 'edges',
      data: { id: `meta:${source}:${target}`, source, target, label: String(n) },
      classes: 'meta clusterEdge',
    }
  })
  cy.add(metas).unselectify()
}

/**
 * Bring the appearance of clusters up to date
 * @param {cytoscape.Core} cy
 * @returns {boolean} true if there are any clusters
 */
export function applyClusterView(cy) {
  const hiddenIn = collapsedMap(cy)
  cy.batch(() => {
    placeMembers(cy, hiddenIn)
    summariseLinks(cy, hiddenIn)
  })
  return cy.nodes().some(isCluster)
}
