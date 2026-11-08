/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Finds paths and reachable factors in a map.
********************************************************************************************/

const PATH_WORK_LIMIT = 200000

export class PathSearchLimitError extends Error {}

/**
 * Collect nodes reachable from the roots, following the chosen direction and distance.
 * @param {cytoscape.CollectionReturnValue} graph
 * @param {cytoscape.NodeCollection} roots
 * @param {'upstream'|'downstream'|'All'} direction
 * @param {number} limit
 * @returns {cytoscape.NodeCollection}
 */
export function reachable(graph, roots, direction, limit) {
  if (direction === 'All') {
    return reachable(graph, roots, 'upstream', limit).union(
      reachable(graph, roots, 'downstream', limit)
    )
  }
  let found = roots
  let frontier = roots
  for (let distance = 0; distance < limit && frontier.nonempty(); distance++) {
    let edges = frontier.connectedEdges().intersection(graph)
    if (direction === 'upstream') edges = edges.filter((e) => frontier.contains(e.target()))
    if (direction === 'downstream') edges = edges.filter((e) => frontier.contains(e.source()))
    const next = edges.connectedNodes().intersection(graph).difference(found)
    found = found.union(next)
    frontier = next
  }
  return found
}

/**
 * Find the links on simple directed paths between selected nodes.
 * Search is bounded so a dense map cannot freeze the interface.
 * @param {cytoscape.CollectionReturnValue} graph
 * @param {cytoscape.NodeCollection} roots
 * @param {boolean} shortest
 * @returns {cytoscape.CollectionReturnValue}
 */
export function pathsBetween(graph, roots, shortest) {
  const cy = graph.cy()
  let result = cy.collection()
  let work = 0
  for (const source of roots) {
    for (const target of roots) {
      if (source.id() === target.id()) continue
      if (shortest) {
        const path = graph.dijkstra({ root: source, directed: true }).pathTo(target)
        if (path.edges().nonempty()) result = result.union(path)
        continue
      }
      const visited = new Set([source.id()])
      const path = []
      /**
       * Collect links on simple paths from this node to the target.
       * @param {cytoscape.NodeSingular} node Current path endpoint.
       * @returns {void}
       * @throws {PathSearchLimitError} When path exploration exceeds the work limit.
       */
      const visit = (node) => {
        if (++work > PATH_WORK_LIMIT) {
          throw new PathSearchLimitError('Too many paths to analyse; narrow the selection first')
        }
        if (node.id() === target.id()) {
          result = result.union(cy.collection(path)).union(source).union(target)
          return
        }
        for (const edge of node.outgoers('edge').intersection(graph)) {
          const next = edge.target()
          if (visited.has(next.id())) continue
          visited.add(next.id())
          path.push(edge)
          visit(next)
          path.pop()
          visited.delete(next.id())
        }
      }
      visit(source)
    }
  }
  return result.union(result.edges().connectedNodes())
}
