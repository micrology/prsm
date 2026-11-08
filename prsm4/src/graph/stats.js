/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Calculates factor connectivity and centrality statistics.
********************************************************************************************/

/* ****************************************************************************************
stats.js: network statistics for factors (degree, leverage, betweenness), computed directly
from the records in a MapStore. Cluster nodes are not part of the analysis.
**************************************************************************************** */

/**
 * Build the directed adjacency of ordinary factors.
 * @param {MapStore} store
 * @returns {{ids: Array<string>, out: Map<string, Array<string>>}} factor ids and directed adjacency
 */
function adjacency(store) {
  const ids = [...store.nodes.entries()].filter(([, r]) => !r.cluster).map(([id]) => id)
  const out = new Map(ids.map((id) => [id, []]))
  for (const e of store.edges.values()) {
    if (out.has(e.source) && out.has(e.target)) out.get(e.source).push(e.target)
  }
  return { ids, out }
}

/**
 * Directed, unnormalised betweenness centrality by Brandes' algorithm. Parallel links count
 * separately, as in the original PRSM calculation.
 * @param {Array<string>} ids
 * @param {Map<string, Array<string>>} out successors of each node
 * @returns {Map<string, number>}
 */
export function betweenness(ids, out) {
  const centrality = new Map(ids.map((id) => [id, 0]))
  for (const source of ids) accumulateFrom(source, ids, out, centrality)
  return centrality
}

/**
 * Add the dependency of every node on one source node to the centralities
 * @param {string} source
 * @param {Array<string>} ids
 * @param {Map<string, Array<string>>} out
 * @param {Map<string, number>} centrality
 * @returns {void}
 */
function accumulateFrom(source, ids, out, centrality) {
  const { order, pred, sigma } = shortestPaths(source, ids, out)
  const delta = new Map(ids.map((id) => [id, 0]))
  while (order.length) {
    const w = order.pop()
    const coeff = (1 + delta.get(w)) / sigma.get(w)
    for (const v of pred.get(w)) delta.set(v, delta.get(v) + sigma.get(v) * coeff)
    if (w !== source) centrality.set(w, centrality.get(w) + delta.get(w))
  }
}

/**
 * Breadth-first search from a source, counting shortest paths
 * @param {string} source
 * @param {Array<string>} ids
 * @param {Map<string, Array<string>>} out
 * @returns {{order: Array<string>, pred: Map, sigma: Map}} nodes in visit order, predecessors, path counts
 */
function shortestPaths(source, ids, out) {
  const dist = new Map(ids.map((id) => [id, -1]))
  const sigma = new Map(ids.map((id) => [id, 0]))
  const pred = new Map(ids.map((id) => [id, []]))
  const queue = [source]
  const order = []
  dist.set(source, 0)
  sigma.set(source, 1)
  for (let i = 0; i < queue.length; i++) {
    const v = queue[i]
    order.push(v)
    for (const w of out.get(v)) {
      if (dist.get(w) === -1) {
        dist.set(w, dist.get(v) + 1)
        queue.push(w)
      }
      if (dist.get(w) === dist.get(v) + 1) {
        sigma.set(w, sigma.get(w) + sigma.get(v))
        pred.get(w).push(v)
      }
    }
  }
  return { order, pred, sigma }
}

/**
 * Statistics for every factor
 * @param {MapStore} store
 * @param {{centrality?:boolean}} [options] omit the expensive betweenness calculation when it is not needed
 * @returns {Map<string, {inDegree:number, outDegree:number, degree:number, leverage:number|null, betweenness:number}>}
 *   leverage is null when the factor has no incoming links
 */
export function computeStats(store, { centrality = true } = {}) {
  const { ids, out } = adjacency(store)
  const bc = centrality ? betweenness(ids, out) : new Map()
  const stats = new Map(
    ids.map((id) => [
      id,
      { inDegree: 0, outDegree: out.get(id).length, betweenness: bc.get(id) ?? 0 },
    ])
  )
  for (const targets of out.values()) for (const t of targets) stats.get(t).inDegree++
  for (const s of stats.values()) {
    s.degree = s.inDegree + s.outDegree
    s.leverage = s.inDegree === 0 ? null : s.outDegree / s.inDegree
  }
  return stats
}
