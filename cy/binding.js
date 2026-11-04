/* ****************************************************************************************
binding.js: keep a Cytoscape graph in step with a MapStore (one-way: store -> graph).
User gestures never change the graph directly; they call MapStore methods, whose changes come
back through here, whether they are local, undone, or made by another user.
**************************************************************************************** */
import { compileStylesheet, nodeElement, edgeElement, applyCurves } from './graph.js'
import { applyClusterView, VIEW_CLASSES } from './clusterview.js'

const POSITION_EPSILON = 0.01

/**
 * @param {object} data node data (or record)
 * @returns {string} a value that changes when the node's cluster membership changes
 */
function clusterKey(data) {
  return JSON.stringify([data.cluster, data.inCluster])
}

/**
 * Bring one node in the graph up to date with its record
 * @param {cytoscape.Core} cy
 * @param {string} id
 * @param {object|undefined} rec current record, undefined if deleted
 * @returns {boolean} true if clustering is affected
 */
function syncNode(cy, id, rec) {
  const ele = cy.getElementById(id)
  if (!rec) {
    const had = ele.nonempty() && clusterKey(ele.data()) !== clusterKey({})
    ele.remove()
    return had
  }
  const def = nodeElement({ id, ...rec })
  if (ele.empty()) {
    cy.add(def)
    cy.getElementById(id).scratch('_ov', def.style)
    return clusterKey(def.data) !== clusterKey({})
  }
  const before = clusterKey(ele.data())
  syncCommon(ele, def)
  const p = ele.position()
  if (
    Math.abs(p.x - def.position.x) > POSITION_EPSILON ||
    Math.abs(p.y - def.position.y) > POSITION_EPSILON
  ) {
    ele.position(def.position)
  }
  return before !== clusterKey(ele.data())
}

/**
 * Update data, classes and per-element style overrides of an existing element
 * @param {cytoscape.CollectionReturnValue} ele
 * @param {object} def element definition
 */
function syncCommon(ele, def) {
  const { source, target, ...data } = def.data
  for (const k of Object.keys(ele.data())) {
    if (!(k in def.data) && !['source', 'target', 'parent'].includes(k)) ele.removeData(k)
  }
  ele.data(data)
  const kept = ele.classes().filter((c) => VIEW_CLASSES.has(c))
  ele.classes([def.classes, ...kept].filter(Boolean))
  const old = ele.scratch('_ov')
  if (JSON.stringify(old) === JSON.stringify(def.style)) return
  if (old) ele.removeStyle(Object.keys(old).join(' '))
  if (def.style) ele.style(def.style)
  ele.scratch('_ov', def.style)
}

/**
 * Bring one edge in the graph up to date with its record
 * @param {cytoscape.Core} cy
 * @param {string} id
 * @param {object|undefined} rec
 * @returns {cytoscape.CollectionReturnValue|null} the edge if it is new or changed
 */
function syncEdge(cy, id, rec) {
  const ele = cy.getElementById(id)
  if (!rec) {
    ele.remove()
    return null
  }
  const def = edgeElement({ id, ...rec })
  if (ele.empty()) {
    if (cy.getElementById(rec.source).empty() || cy.getElementById(rec.target).empty()) return null
    const added = cy.add(def)
    added.scratch('_ov', def.style)
    return added
  }
  syncCommon(ele, def)
  return ele
}

/**
 * Apply the changes of a transaction to the graph
 * @param {cytoscape.Core} cy
 * @param {MapStore} store
 * @param {{nodes?:Set<string>,edges?:Set<string>,styles?:Set<string>}} changed keys changed, by map
 * @param {boolean} [full] look at everything
 */
function applyChanges(cy, store, changed, full = false) {
  const changedEdges = []
  let clustering = full
  cy.batch(() => {
    for (const id of full ? store.nodes.keys() : (changed.nodes ?? [])) {
      if (syncNode(cy, id, store.nodes.get(id))) clustering = true
    }
    for (const id of full ? store.edges.keys() : (changed.edges ?? [])) {
      const e = syncEdge(cy, id, store.edges.get(id))
      if (e) changedEdges.push(e)
    }
  })
  if (changed.styles) cy.style(compileStylesheet(Object.fromEntries(store.styles.entries())))
  const edges = cy.collection(changedEdges)
  // an edge whose source or target is new also needs its curve
  applyCurves(edges, cy.scratch('curveMode'))
  if (clustering || (changed.edges && cy.scratch('hasClusters'))) {
    cy.scratch('hasClusters', applyClusterView(cy))
    applyCurves(cy.edges('.meta'), cy.scratch('curveMode'))
  }
}

/**
 * Show the content of store in cy and keep it up to date
 * @param {cytoscape.Core} cy
 * @param {MapStore} store
 * @returns {function} call to stop listening
 */
export function bindGraph(cy, store) {
  cy.scratch('curveMode', store.meta.get('settings')?.curve ?? 'Curved')
  cy.style(compileStylesheet(Object.fromEntries(store.styles.entries())))
  applyChanges(cy, store, {}, true)
  applyCurves(cy, cy.scratch('curveMode'))
  // curves depend on the positions of both end points, so recompute them when nodes move
  cy.on('position', 'node', (evt) =>
    applyCurves(evt.target.connectedEdges(), cy.scratch('curveMode'))
  )
  const onTransaction = (tr) => {
    const changed = {}
    for (const [type, keys] of tr.changed) {
      if (type === store.nodes) changed.nodes = keys
      else if (type === store.edges) changed.edges = keys
      else if (type === store.styles) changed.styles = keys
    }
    if (changed.nodes || changed.edges || changed.styles) {
      applyChanges(cy, store, changed)
    }
    if (tr.changed.has(store.meta)) syncSettings(cy, store)
  }
  store.doc.on('afterTransaction', onTransaction)
  return () => store.doc.off('afterTransaction', onTransaction)
}

/**
 * React to a change of the map-wide settings
 * @param {cytoscape.Core} cy
 * @param {MapStore} store
 */
function syncSettings(cy, store) {
  const mode = store.meta.get('settings')?.curve ?? 'Curved'
  if (mode === cy.scratch('curveMode')) return
  cy.scratch('curveMode', mode)
  applyCurves(cy, mode)
}
