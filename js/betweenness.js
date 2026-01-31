'use strict'

/**

Calculate betweenness centrality for the current network factors

Since this can take several seconds, this calculation is passed off to a Web Worker
(i.e. a separate thread).

It is invoked every time the network changes (factors or links are added or deleted).
The centralities are cached after calculation, and can therefore be retrieved whenever
required.

 Code adapted from https://github.com/anvaka/ngraph.centrality/tree/master/src

 */

/*
Receive message from main thread, consisting of node and link objects, do calculation
and return it to the main thread
 */

self.onmessage = function (e) {
  const graph = {
    nodes: e.data[0], // array of node objects
    edges: e.data[1], // array of edge objects
  }
  if (checkComplete(graph)) self.postMessage(betweenness(graph))
  else self.postMessage('Corrupt network: links are connected to non-existent factors')
}

/**
 * Check whether all edges are connected to existing nodes
 * @param {object} graph - object with nodes and edges arrays
 * @returns {boolean} true if all edges have valid source and target nodes
 */
function checkComplete(graph) {
  // sanity check: do all the edges connect existing nodes
  let ok = true
  graph.edges.forEach((edge) => {
    if (!graph.nodes.find((node) => node.id === edge.from)) {
      console.log('Edge ' + edge.id + ' is missing a source node linked to it: ' + edge.from)
      ok = false
    }
    if (!graph.nodes.find((node) => node.id === edge.to)) {
      console.log('Edge ' + edge.id + ' is missing a destination node linked to it: ' + edge.to)
      ok = false
    }
  })
  return ok
}

let betweennessCache = { structure: [], betweenness: undefined }

/**
 * Calculate betweenness centrality for all nodes in the graph, using caching
 * @param {object} graph - object with nodes and edges arrays
 * @returns {object|null} object mapping node IDs to betweenness centrality values
 */
function betweenness(graph) {
  const struct = getIds(graph.nodes).concat(getIds(graph.edges))
  if (struct.length === 0) return null
  // check whether the network structure has changed;
  // if not, just return the previous result immediately
  if (eqArray(struct, betweennessCache.structure)) return betweennessCache.betweenness
  betweennessCache = { structure: struct, betweenness: betweenness1(graph) }
  return betweennessCache.betweenness
}

/**
 * Extract IDs from an array of node or link objects
 * @param {Array} arr - array of objects with id properties
 * @returns {Array} array of IDs
 */
function getIds(arr) {
  return arr.map(function (item) {
    return item.id
  })
}

/**
 * Check whether two arrays of IDs are the same
 * @param {Array} a - first array
 * @param {Array} b - second array
 * @returns {boolean} true if arrays contain the same IDs
 */
function eqArray(a, b) {
  if (a.length !== b.length) return false
  a = a.sort()
  b = b.sort()
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * Calculate betweenness centrality using Brandes' algorithm
 * @param {object} graph - object with nodes and edges arrays
 * @returns {object} object mapping node IDs to betweenness centrality values
 */
function betweenness1(graph) {
  // graph is an object: {nodes, edges} where nodes and edges are arrays of objects
  const Q = []
  const S = [] // Queue and Stack
  // list of predecessors on shortest paths from source
  const pred = Object.create(null)
  // distance from source
  const dist = Object.create(null)
  // number of shortest paths from source to key
  const sigma = Object.create(null)
  // dependency of source on key
  const delta = Object.create(null)

  let currentNode
  const centrality = Object.create(null)

  graph.nodes.forEach(setCentralityToZero)
  graph.nodes.forEach(calculateCentrality)

  return centrality

  /**
   * Initialize centrality to zero for a node
   * @param {object} node - node object
   */
  function setCentralityToZero(node) {
    centrality[node.id] = 0
  }

  /**
   * Calculate centrality contribution for a single source node
   * @param {object} node - node object
   */
  function calculateCentrality(node) {
    currentNode = node.id
    singleSourceShortestPath(currentNode)
    accumulate()
  }

  /**
   * Accumulate centrality contributions from shortest paths
   */
  function accumulate() {
    graph.nodes.forEach(setDeltaToZero)
    while (S.length) {
      const w = S.pop()
      const coeff = (1 + delta[w]) / sigma[w]
      const predecessors = pred[w]
      for (let idx = 0; idx < predecessors.length; ++idx) {
        const v = predecessors[idx]
        delta[v] += sigma[v] * coeff
      }
      if (w !== currentNode) {
        centrality[w] += delta[w]
      }
    }
  }

  /**
   * Initialize delta to zero for a node
   * @param {object} node - node object
   */
  function setDeltaToZero(node) {
    delta[node.id] = 0
  }

  /**
   * Compute single-source shortest paths from the given source node
   * @param {string} source - ID of the source node
   */
  function singleSourceShortestPath(source) {
    graph.nodes.forEach(initNode)
    dist[source] = 0
    sigma[source] = 1
    Q.push(source)

    while (Q.length) {
      const v = Q.shift()
      S.push(v)
      forEachLinkedNode(v, toId, v)
    }

    function toId(otherNode, link, v) {
      // NOTE: This code will also consider multi-edges, which are often
      // ignored by popular software (Gephi/NetworkX). Depending on your use
      // case this may not be desired and deduping needs to be performed. To
      // save memory I'm not deduping here...
      processNode(otherNode.id, v)
    }

    function initNode(node) {
      const nodeId = node.id
      pred[nodeId] = [] // empty list
      dist[nodeId] = -1
      sigma[nodeId] = 0
    }

    function processNode(w, v) {
      // path discovery
      if (dist[w] === -1) {
        // Node w is found for the first time
        dist[w] = dist[v] + 1
        Q.push(w)
      }
      // path counting
      if (dist[w] === dist[v] + 1) {
        // edge (v, w) on a shortest path
        sigma[w] += sigma[v]
        pred[w].push(v)
      }
    }

    function forEachLinkedNode(nodeId, callback, v) {
      const links = linksFrom(nodeId)
      if (links) {
        for (let i = 0; i < links.length; ++i) {
          const link = links[i]
          if (link.from === nodeId) {
            callback(getNode(link.to), link, v)
          }
        }
      }
    }

    // return all the link objects that start from the given node
    function linksFrom(nodeId) {
      return graph.edges.filter(function (item) {
        return item.from === nodeId
      })
    }

    // return the node object with the given Id
    function getNode(nodeId) {
      return graph.nodes.filter(function (item) {
        return item.id === nodeId
      })[0]
    }
  }
}
