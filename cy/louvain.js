/****************************************************** Louvain clustering ******************************************************
 * Author: Corneliu S. (github.com/upphiminn)
 *
 * This is a javascript implementation of the Louvain
 * community detection algorithm (http://arxiv.org/abs/0803.0476)
 * Based on https://bitbucket.org/taynaud/python-louvain/overview
 *
 * Modernized to ES2023
 */

/*
 Original Author: Corneliu S. (github.com/upphiminn)

 This is a javascript implementation of the Louvain
 community detection algorithm (http://arxiv.org/abs/0803.0476)
 Based on https://bitbucket.org/taynaud/python-louvain/overview

 Modernized to ES2023 and with jsDoc comments added by Nigel Gilbert
 */
/**
 * jLouvain Community Detection Algorithm
 *
 * Usage:
 *   const result = jLouvain(nodes, edges, initialPartition);
 *
 * @param {Array} nodes - Array of node identifiers
 * @param {Array} edges - Array of edge objects with {source, target, weight} format
 * @param {Object} [initialPartition] - Optional initial partition mapping {nodeId: communityId}
 * @returns {Object} Community assignments {nodeId: communityId}
 */
export function jLouvain(nodes, edges, initialPartition = null) {
  // Constants
  const PASS_MAX = -1 // continue until no improvement
  const MIN_MODULARITY_IMPROVEMENT = 0.0000001

  /**
   * Remove duplicate values from array using Set
   * @param {Array} array - Input array with potential duplicates
   * @returns {Array} Array with unique values only
   */
  const uniqify = (array) => [...new Set(array)]

  /**
   * Calculate the total degree (weighted sum of edges) for a given node
   * @param {Object} graph - Graph object with _assocMat adjacency matrix
   * @param {number|string} node - Node identifier
   * @returns {number} Total weighted degree of the node
   */
  const getDegreeForNode = (graph, node) => {
    const neighbours = graph._assocMat[node] ? Object.keys(graph._assocMat[node]) : []

    return neighbours.reduce((weight, neighbour) => {
      let value = graph._assocMat[node][neighbour] ?? 1
      if (node === neighbour) {
        value *= 2 // Self-loops count double
      }
      return weight + value
    }, 0)
  }

  /**
   * Get all neighbouring nodes for a given node
   * @param {Object} graph - Graph object with _assocMat adjacency matrix
   * @param {number|string} node - Node identifier
   * @returns {string[]} Array of neighbour node identifiers (as strings)
   */
  const getNeighboursOfNode = (graph, node) => {
    return graph._assocMat[node] ? Object.keys(graph._assocMat[node]) : []
  }

  /**
   * Get the weight of an edge between two nodes
   * @param {Object} graph - Graph object with _assocMat adjacency matrix
   * @param {number|string} node1 - First node identifier
   * @param {number|string} node2 - Second node identifier
   * @returns {number|undefined} Edge weight or undefined if no edge exists
   */
  const getEdgeWeight = (graph, node1, node2) => {
    return graph._assocMat[node1]?.[node2]
  }

  /**
   * Calculate the total weight of all edges in the graph
   * @param {Object} graph - Graph object with edges array
   * @returns {number} Sum of all edge weights
   */
  const getGraphSize = (graph) => {
    return graph.edges.reduce((size, edge) => size + edge.weight, 0)
  }

  /**
   * Add an edge to the graph, updating both the edge list and adjacency matrix
   * @param {Object} graph - Graph object to modify
   * @param {Object} edge - Edge object with source, target, and weight properties
   * @param {Object} localState - Local state object with edgeIndex Map
   */
  const addEdgeToGraph = (graph, edge, localState) => {
    updateAssocMat(graph, edge)

    const edgeKey = `${edge.source}_${edge.target}`
    if (localState.edgeIndex.has(edgeKey)) {
      const index = localState.edgeIndex.get(edgeKey)
      graph.edges[index].weight = edge.weight
    } else {
      graph.edges.push(edge)
      localState.edgeIndex.set(edgeKey, graph.edges.length - 1)
    }
  }

  /**
   * Create an adjacency matrix from a list of edges
   * @param {Array} edgeList - Array of edge objects with source, target, and weight
   * @returns {Object} Adjacency matrix where mat[source][target] = weight
   */
  const makeAssocMat = (edgeList) => {
    const mat = {}

    edgeList.forEach(({ source, target, weight }) => {
      mat[source] ??= {}
      mat[source][target] = weight
      mat[target] ??= {}
      mat[target][source] = weight
    })

    return mat
  }

  /**
   * Update the adjacency matrix of a graph with a new edge
   * @param {Object} graph - Graph object with _assocMat property
   * @param {Object} edge - Edge object with source, target, and weight properties
   */
  const updateAssocMat = (graph, { source, target, weight }) => {
    graph._assocMat[source] ??= {}
    graph._assocMat[source][target] = weight
    graph._assocMat[target] ??= {}
    graph._assocMat[target][source] = weight
  }

  /**
   * Create a deep copy of an object using structuredClone
   * @param {*} obj - Object to clone
   * @returns {*} Deep copy of the input object
   */
  const clone = (obj) => {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }
    return structuredClone(obj)
  }

  // Core Algorithm
  /**
   * Initialize the status object for community detection algorithm
   * @param {Object} graph - Graph object with nodes and adjacency matrix
   * @param {Object} status - Status object to initialize (modified in place)
   * @param {Object|null} part - Optional initial partition, null for default initialization
   */
  const initStatus = (graph, status, part) => {
    status.nodes_to_com = {}
    status.total_weight = getGraphSize(graph)
    status.internals = {}
    status.degrees = {}
    status.gDegrees = {}
    status.loops = {}

    if (!part) {
      graph.nodes.forEach((node, i) => {
        status.nodes_to_com[node] = i

        const deg = getDegreeForNode(graph, node)

        if (deg < 0) {
          throw new TypeError('Graph should only have positive weights.')
        }

        status.degrees[i] = deg
        status.gDegrees[node] = deg
        status.loops[node] = getEdgeWeight(graph, node, node) ?? 0
        status.internals[i] = status.loops[node]
      })
    } else {
      graph.nodes.forEach((node) => {
        const com = part[node]
        status.nodes_to_com[node] = com
        const deg = getDegreeForNode(graph, node)
        status.degrees[com] = (status.degrees[com] ?? 0) + deg
        status.gDegrees[node] = deg

        const neighbours = getNeighboursOfNode(graph, node)
        const inc = neighbours.reduce((acc, neighbour) => {
          const weight = graph._assocMat[node][neighbour]

          if (weight <= 0) {
            throw new TypeError('Graph should only have positive weights.')
          }

          if (part[neighbour] === com) {
            return acc + (neighbour === node ? weight : weight / 2.0)
          }
          return acc
        }, 0)

        status.internals[com] = (status.internals[com] ?? 0) + inc
      })
    }
  }

  /**
   * Calculate the modularity score for the current community partition
   * @param {Object} status - Status object containing community assignments and metrics
   * @returns {number} Modularity score (higher is better)
   */
  const calculateModularity = (status) => {
    // eslint-disable-next-line camelcase
    const { total_weight: links, nodes_to_com, internals, degrees } = status
    const communities = uniqify(Object.values(nodes_to_com))

    return communities.reduce((result, com) => {
      const inDegree = internals[com] ?? 0
      const degree = degrees[com] ?? 0
      if (links > 0) {
        return result + inDegree / links - Math.pow(degree / (2.0 * links), 2)
      }
      return result
    }, 0.0)
  }

  /**
   * Get the communities of neighbouring nodes and their edge weights
   * @param {number|string} node - Node identifier
   * @param {Object} graph - Graph object with adjacency matrix
   * @param {Object} status - Status object with community assignments
   * @returns {Object} Object mapping community IDs to total edge weights
   */
  const getNeighbourCommunities = (node, graph, status) => {
    // Compute the communities in the neighbourhood of the node
    const weights = {}
    const neighbourhood = getNeighboursOfNode(graph, node)

    neighbourhood.forEach((neighbour) => {
      // Convert neighbour to same type as node for comparison
      // Since neighbour comes from Object.keys(), it's a string
      if (String(neighbour) !== String(node)) {
        const weight = graph._assocMat[node][neighbour] ?? 1
        const neighbourCom = status.nodes_to_com[neighbour]
        weights[neighbourCom] = (weights[neighbourCom] ?? 0) + weight
      }
    })

    return weights
  }

  /**
   * Insert a node into a community and update the status accordingly
   * @param {number|string} node - Node identifier
   * @param {number|string} com - Community identifier
   * @param {number} weight - Weight of edges to this community
   * @param {Object} status - Status object to update
   */
  const insertNode = (node, com, weight, status) => {
    // Insert node into community and modify status
    status.nodes_to_com[node] = +com
    status.degrees[com] = (status.degrees[com] ?? 0) + (status.gDegrees[node] ?? 0)
    status.internals[com] = (status.internals[com] ?? 0) + weight + (status.loops[node] ?? 0)
  }

  /**
   * Remove a node from a community and update the status accordingly
   * @param {number|string} node - Node identifier
   * @param {number|string} com - Community identifier
   * @param {number} weight - Weight of edges to this community
   * @param {Object} status - Status object to update
   */
  const removeNode = (node, com, weight, status) => {
    // Remove node from community and modify status
    status.degrees[com] = (status.degrees[com] ?? 0) - (status.gDegrees[node] ?? 0)
    status.internals[com] = (status.internals[com] ?? 0) - weight - (status.loops[node] ?? 0)
    status.nodes_to_com[node] = -1
  }

  /**
   * Renumber communities to have consecutive IDs starting from 0
   * @param {Object} dict - Dictionary mapping nodes to community IDs
   * @returns {Object} New dictionary with renumbered community IDs
   */
  const renumberCommunities = (dict) => {
    const ret = clone(dict)
    const newValues = new Map()
    let count = 0

    Object.keys(dict).forEach((key) => {
      const value = dict[key]

      if (!newValues.has(value)) {
        newValues.set(value, count++)
      }

      ret[key] = newValues.get(value)
    })

    return ret
  }

  /**
   * Perform one level of the Louvain algorithm - optimize community assignments
   * @param {Object} graph - Graph object with nodes and adjacency matrix
   * @param {Object} status - Status object with current community assignments (modified in place)
   */
  const computeOneLevel = (graph, status) => {
    // Compute one level of the Communities Dendrogram
    let modifiedFlag = true
    let nbPassDone = 0
    let curMod = calculateModularity(status)
    let newMod = curMod

    while (modifiedFlag && nbPassDone !== PASS_MAX) {
      curMod = newMod
      modifiedFlag = false
      nbPassDone += 1

      graph.nodes.forEach((node) => {
        const comNode = status.nodes_to_com[node]
        const degcTotw = (status.gDegrees[node] ?? 0) / (status.total_weight * 2.0)
        const neighCommunities = getNeighbourCommunities(node, graph, status)

        removeNode(node, comNode, neighCommunities[comNode] ?? 0.0, status)

        const { bestCom } = Object.keys(neighCommunities).reduce(
          (best, com) => {
            const incr = neighCommunities[com] - (status.degrees[com] ?? 0.0) * degcTotw

            if (incr > best.bestIncrease) {
              return { bestCom: com, bestIncrease: incr }
            }
            return best
          },
          { bestCom: comNode, bestIncrease: 0 }
        )

        insertNode(node, bestCom, neighCommunities[bestCom] ?? 0, status)

        if (bestCom !== comNode) {
          modifiedFlag = true
        }
      })

      newMod = calculateModularity(status)

      if (newMod - curMod < MIN_MODULARITY_IMPROVEMENT) {
        break
      }
    }
  }

  /**
   * Create an induced graph where nodes are communities from the partition
   * @param {Object} partition - Mapping of original nodes to community IDs
   * @param {Object} graph - Original graph object
   * @param {Object} localState - Local state for edge indexing
   * @returns {Object} New graph where each node represents a community
   */
  const createInducedGraph = (partition, graph, localState) => {
    const ret = { nodes: [], edges: [], _assocMat: {} }

    // Add nodes from partition values
    const partitionValues = Object.values(partition)
    ret.nodes = uniqify(partitionValues)

    graph.edges.forEach(({ source, target, weight = 1 }) => {
      const com1 = partition[source]
      const com2 = partition[target]
      const wPrec = getEdgeWeight(ret, com1, com2) ?? 0
      const newWeight = wPrec + weight
      addEdgeToGraph(ret, { source: com1, target: com2, weight: newWeight }, localState)
    })

    localState.edgeIndex.clear()

    return ret
  }

  /**
   * Extract the partition at a specific level of the dendrogram
   * @param {Array} dendrogram - Array of partitions at each level
   * @param {number} level - Level to extract (0 = first level, higher = more aggregated)
   * @returns {Object} Node to community mapping at the specified level
   */
  const partitionAtLevel = (dendrogram, level) => {
    const partition = clone(dendrogram[0])

    for (let i = 1; i <= level; i++) {
      Object.keys(partition).forEach((key) => {
        const node = key
        const com = partition[key]
        partition[node] = dendrogram[i][com]
      })
    }

    return partition
  }

  /**
   * Generate the complete dendrogram (hierarchy) of community partitions
   * @param {Object} graph - Input graph with nodes, edges, and adjacency matrix
   * @param {Object|null} partInit - Optional initial partition
   * @param {Object} localState - Local state for algorithm execution
   * @returns {Array} Array of partitions, each representing a level in the hierarchy
   */
  const generatedendrogram = (graph, partInit, localState) => {
    if (graph.edges.length === 0) {
      return Object.fromEntries(graph.nodes.map((node) => [node, node]))
    }

    const status = {}

    initStatus(graph, status, partInit)
    let mod = calculateModularity(status)
    const statusList = []

    computeOneLevel(graph, status)
    let newMod = calculateModularity(status)
    let partition = renumberCommunities(status.nodes_to_com)
    statusList.push(partition)
    mod = newMod

    let currentGraph = createInducedGraph(partition, graph, localState)
    initStatus(currentGraph, status)

    while (true) {
      computeOneLevel(currentGraph, status)
      newMod = calculateModularity(status)

      if (newMod - mod < MIN_MODULARITY_IMPROVEMENT) {
        break
      }

      partition = renumberCommunities(status.nodes_to_com)
      statusList.push(partition)

      mod = newMod
      currentGraph = createInducedGraph(partition, currentGraph, localState)
      initStatus(currentGraph, status)
    }

    return statusList
  }

  // Create local state for this instance
  const localState = {
    edgeIndex: new Map(),
  }

  // Build the graph structure
  const assocMat = makeAssocMat(edges)
  const graph = {
    nodes,
    edges,
    _assocMat: assocMat,
  }

  // Generate dendrogram and return final partition
  const dendrogram = generatedendrogram(graph, initialPartition, localState)
  return partitionAtLevel(dendrogram, 0)
}
