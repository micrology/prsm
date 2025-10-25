/*********************************************************************************************************************  

PRSM Participatory System Mapper 

    Copyright (C) 2022  Nigel Gilbert prsm@prsm.uk

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.


This module clusters factors  
 ******************************************************************************************************************** */

import {
	elem,
	uuidv4,
	deepMerge,
	alertMsg,
	mostFrequentString,
	standardize_color,
	makeColor,
	setNodeHidden,
	setEdgeHidden,
} from "./utils.js"
import { styles } from "./samples.js"
import { network, data, doc, yNetMap, unSelect, debug } from "./prsm.js"

/**
 * Cluster nodes according to the selected attribute.
 *
 * This is the public entrypoint used by the UI to apply clustering.
 *
 * @param {string} attribute - The clustering mode or attribute name ('none', 'color', 'style', 'louvain', or attribute key)
 * @returns {void}
 */
export function cluster(attribute) {
	if (!attribute) return
	doc.transact(() => {
		unCluster()
		switch (attribute) {
			case "none":
				break
			case "color":
				clusterByColor()
				break
			case "style":
				clusterByStyle()
				break
			case "louvain":
				clusterByLouvain()
				break
			default:
				clusterByAttribute(attribute)
				break
		}
	})
}

/**
 *
 * @param {String} attribute
 */
function clusterByAttribute(attribute) {
	if (!attribute) return
	// collect all different values of the attribute that are in use
	const attValues = new Set()
	data.nodes.get().forEach((node) => {
		if (!node.isCluster && node[attribute]) attValues.add(node[attribute])
	})
	// build groups map value -> member nodes
	const groups = {}
	for (const value of attValues) {
		groups[value] = data.nodes.get({
			filter: (node) =>
				node[attribute] === value && !node.clusteredIn && !node.isCluster,
		})
	}
	clusterGroups(groups, (value) => {
		return {
			id: `cluster-${attribute}-${value}`,
			label: `${yNetMap.get("attributeTitles")[attribute]} ${value}`,
			color: makeColor(),
		}
	})
}

/**
 * Cluster nodes by their background color.
 *
 * Groups nodes that share the same standardized background color and creates a cluster node
 * placed at the members' centroid.
 *
 * @returns {void}
 */
function clusterByColor() {
	// collect all different values of the attribute that are in use
	const colors = new Set()
	data.nodes.get().forEach((node) => {
		if (!node.isCluster) colors.add(standardize_color(node.color.background))
	})
	// build groups map color -> member nodes
	const groups = {}
	for (const color of colors) {
		groups[color] = data.nodes.get({
			filter: (node) =>
				standardize_color(node.color.background) === color &&
				!node.clusteredIn &&
				!node.isCluster,
		})
	}
	let clusterNumber = 0
	clusterGroups(groups, (color) => {
		return {
			id: `cluster-color-${color}`,
			label: `Cluster ${++clusterNumber}`,
			color,
		}
	})
}

/**
 * Cluster nodes by their visual style group.
 *
 * Groups nodes by their grp value (visual style) and creates cluster nodes using
 * the style's configured color and label.
 *
 * @returns {void}
 */
function clusterByStyle() {
	// collect all different values of the style that are in use
	const stylesInUse = new Set()
	data.nodes.get().forEach((node) => {
		if (!node.isCluster) stylesInUse.add(node.grp)
	})
	// build groups map style -> member nodes
	const groups = {}
	for (const style of stylesInUse) {
		groups[style] = data.nodes.get({
			filter: (node) =>
				node.grp === style && !node.clusteredIn && !node.isCluster,
		})
	}
	clusterGroups(groups, (style) => {
		return {
			id: `cluster-style-${style}`,
			label: `${styles.nodes[style].groupLabel} cluster`,
			color: styles.nodes[style].color.background,
		}
	})
}

/**
 * Clusters the nodes in the graph using the Louvain method.
 * @returns {void}
 */
function clusterByLouvain() {
	const nodes = data.nodes.get({ filter: (node) => !node.isCluster })
	const edges = data.edges
		.get({ filter: (edge) => !edge.isClusterEdge })
		.map(({ from, to, weight, ...rest }) => ({
			source: from,
			target: to,
			weight: weight || 1.0,
			...rest,
		}))
	if (edges.length === 0) {
		alertMsg(
			"No edges in the network - cannot cluster by Louvain method",
			"error"
		)
		elem("clustering").value = "none"
		return
	}
	const nodeIds = nodes.map((n) => n.id)
	const result = jLouvain(nodeIds, edges)
	// result is an object with props nodeId: community number
	// Group nodes by community to ensure one cluster node per community
	const communities = {}
	for (const n of nodes) {
		const comm = result[n.id]
		if (comm === undefined) continue
		// skip already clustered or cluster nodes
		if (n.clusteredIn || n.isCluster) continue
		communities[comm] ??= []
		communities[comm].push(n)
	}
	// find the most frequent background colour in the nodes of each each community
	// and use it to color the cluster node
	const commColors = {}
	for (const comm in communities) {
		commColors[comm] = mostFrequentString(
			communities[comm].map((n) => n.color.background)
		)
	}
	clusterGroups(communities, (comm) => {
		return {
			id: `cluster-louvain-${comm}`,
			label: `Cluster ${comm}`,
			color: commColors[comm],
		}
	})
}

/**
 * Generic grouping-based clustering routine.
 * Builds cluster nodes for each entry in `groups` using the provided
 * `makeProps(key, members)` function which must return { id, label, color }.
 *
 * @param {Object} groups - map of groupKey -> Array<node>
 * @param {function(string, Array): {id:string, label:string, color:string}} makeProps
 */
function clusterGroups(groups, makeProps) {
	unSelect()
	const nodesToUpdate = []
	for (const [key, members] of Object.entries(groups)) {
		// clusters must have at least 2 nodes
		if (!members || members.length <= 1) continue

		const { id, label, color } = makeProps(key, members)
		let clusterNode = makeClusterNode(id, label, color)

		let sumx = 0
		let sumy = 0
		let nInCluster = 0
		for (const node of members) {
			node.clusteredIn = clusterNode.id
			setNodeHidden(node, true)
			sumx += node.x
			sumy += node.y
			nInCluster++
			nodesToUpdate.push(node)
		}
		// place cluster node at centroid
		clusterNode.x = sumx / nInCluster
		clusterNode.y = sumy / nInCluster
		nodesToUpdate.push(clusterNode)
	}
	data.nodes.update(nodesToUpdate)
	showClusterLinks()
}
/**
 * Return a data url for an image to represent a cluster shaded with the given colour
 * @param {string} color
 * @returns data-url
 */
function clusterImage(color) {
	return (
		"data:image/svg+xml;charset=utf-8," +
		encodeURIComponent(
			`<svg width="800px" height="800px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
             <path fill="${color}" fill-rule="evenodd" d="M8 0a2.25 2.25 0 00-.75 4.372v.465a3.25 3.25 
             0 00-1.797 1.144l-.625-.366a2.25 2.25 0 10-1.038 1.13l1.026.602a3.261 3.261 0 000 
             1.306l-1.026.601a2.25 2.25 0 101.038 1.13l.625-.366a3.25 3.25 0 001.797 1.145v.465a2.25 
             2.25 0 101.5 0v-.465a3.25 3.25 0 001.797-1.145l.625.366a2.25 2.25 0 
             101.038-1.13l-1.026-.6a3.26 3.26 0 000-1.307l1.026-.601a2.25 2.25 0 
             10-1.038-1.13l-.625.365A3.251 3.251 0 008.75 4.837v-.465A2.25 2.25 0 
             008 0zm-.75 2.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM2.75 4a.75.75 0 
             100 1.5.75.75 0 000-1.5zm0 6.5a.75.75 0 100 1.5.75.75 0 000-1.5zm4.5 
             3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zm6-3.25a.75.75 0 100 1.5.75.75 
             0 000-1.5zm0-6.5a.75.75 0 100 1.5.75.75 0 000-1.5zM6.395 7.3a1.75 1.75 0 
             113.21 1.4 1.75 1.75 0 01-3.21-1.4z" clip-rule="evenodd"/>
            </svg>`
		)
	)
}
/**
 * Create an object to format a new cluster node
 * The font is always black
 * @param {string} id cluster nodeId
 * @param {string} label cluster node label
 * @param {string} color of cluster node
 * @returns {object} cluster node object
 */
function makeClusterNode(id, label, color) {
	return deepMerge(styles.nodes["cluster"], {
		id: id,
		label: label,
		isCluster: true,
		hidden: false,
		shape: "image",
		image: clusterImage(color),
		size: 50,
		font: { color: "rgb(0,0,0)" },
	})
}
/**
 * Create links to cluster nodes and hide links that are now inside clustered nodes
 */
function showClusterLinks() {
	// hide all links between clusters initially
	const edgesToUpdate = []
	data.edges.get().forEach((edge) => {
		if (edge.isClusterEdge) {
			edge.hidden = true
			edge.label = ""
		}
	})
	for (const edge of data.edges.get()) {
		if (edge.isClusterEdge) continue
		// if edge is between two nodes neither of which are in a cluster, show it
		// if edge is from and to nodes that are in the same cluster, hide it
		// if edge is from a node not in a cluster, and to a node in a cluster, hide it and make a cluster edge for it
		// and vice versa
		// if edge is between two nodes both in (different) clusters, hide it and make a cluster edge for it
		let fromNode = data.nodes.get(edge.from)
		let toNode = data.nodes.get(edge.to)
		setEdgeHidden(edge, true)
		if (!fromNode.clusteredIn && !toNode.clusteredIn) {
			setEdgeHidden(edge, false)
		} else if (fromNode.clusteredIn == toNode.clusteredIn) {
			setEdgeHidden(edge, true)
		} else if (!fromNode.clusteredIn && toNode.clusteredIn)
			makeClusterLink(edge.from, toNode.clusteredIn)
		else if (fromNode.clusteredIn && !toNode.clusteredIn)
			makeClusterLink(fromNode.clusteredIn, edge.to)
		else if (fromNode.clusteredIn && toNode.clusteredIn)
			makeClusterLink(fromNode.clusteredIn, toNode.clusteredIn)
		else setEdgeHidden(edge, false) // shouldn't happen
		edgesToUpdate.push(edge)
	}
	data.edges.update(edgesToUpdate)
	if (/cluster/.test(debug)) {
		console.log("Nodes")
		data.nodes.get().forEach((n) => {
			console.log([n.id, n.label, n.hidden, n.clusteredIn])
		})
		console.log("Edges")
		data.edges.get().forEach((e) => {
			console.log([
				e.id,
				data.nodes.get(e.from).label,
				data.nodes.get(e.to).label,
				e.hidden,
			])
		})
	}
	/**
	 * Reuse existing edge or create a new one
	 * @param {string} fromId
	 * @param {string} toId
	 */
	function makeClusterLink(fromId, toId) {
		let edge = edgesToUpdate
			.filter((e) => fromId == e.from && toId == e.to)
			.shift()
		if (!edge) {
			edge = deepMerge(styles.edges["cluster"], {
				id: `cledge-${uuidv4()}`,
				from: fromId,
				to: toId,
				isClusterEdge: true,
			})
		}
		edge.hidden = false
		edge.label = edge.label ? (parseInt(edge.label) + 1).toString() : "1"
		edgesToUpdate.push(edge)
	}
}
/**
 * Hide the cluster node and unhide the nodes it was clustering (and their edges)
 * called by right clicking the cluster node
 * @param {string} clusterNodeId
 */
export function openCluster(clusterNodeId) {
	const clusterNode = data.nodes.get(clusterNodeId)
	// if user has right clicked on a factor that is not a cluster, and clustering is
	// set, re-cluster
	if (!clusterNode.isCluster) {
		const attribute = elem("clustering").value
		if (attribute !== "none") cluster(attribute)
		return
	}
	doc.transact(() => {
		unSelect()
		const nodesToUpdate = []
		const edgesToRemove = []
		const nodesInCluster = data.nodes.get({
			filter: (node) => node.clusteredIn === clusterNode.id,
		})
		for (const node of nodesInCluster) {
			setNodeHidden(node, false)
			node.clusteredIn = null
			nodesToUpdate.push(node)
		}
		// hide the cluster node
		clusterNode.hidden = true
		// and the edges that link it
		const eIds = network.getConnectedEdges(clusterNode.id)
		for (const eId of eIds) {
			edgesToRemove.push(eId)
		}
		nodesToUpdate.push(clusterNode)
		data.nodes.update(nodesToUpdate)
		data.edges.remove(edgesToRemove)
		showClusterLinks()
	})
	if (
		data.nodes.get({ filter: (n) => n.isCluster && !n.hidden }).length === 0
	) {
		// all clusters have been opened; reset the cluster select to None
		elem("clustering").value = "none"
	}
}

/**
 * Remove all clusters, unhide member nodes and restore their edges.
 *
 * This reverses any clustering previously applied by hiding cluster nodes,
 * revealing their member nodes and removing cluster edges.
 *
 * @returns {void}
 */
function unCluster() {
	const nodesToUpdate = []
	const edgesToRemove = []
	data.nodes
		.get({ filter: (node) => node.isCluster })
		.forEach((clusterNode) => {
			const nodesInCluster = data.nodes.get({
				filter: (node) => node.clusteredIn === clusterNode.id,
			})
			for (const node of nodesInCluster) {
				setNodeHidden(node, false)
				node.clusteredIn = null
				nodesToUpdate.push(node)
			}
			clusterNode.hidden = true
			// and the edges that link it
			const eIds = network.getConnectedEdges(clusterNode.id)
			for (const eId of eIds) {
				edgesToRemove.push(eId)
			}
			nodesToUpdate.push(clusterNode)
		})
	data.nodes.update(nodesToUpdate)
	data.edges.remove(edgesToRemove)
	showClusterLinks()
}
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
function jLouvain(nodes, edges, initialPartition = null) {
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
		const neighbours = graph._assocMat[node]
			? Object.keys(graph._assocMat[node])
			: []

		return neighbours.reduce((weight, neighbour) => {
			let value = graph._assocMat[node][neighbour] ?? 1
			if (node === neighbour) {
				value *= 2 // Self-loops count double
			}
			return weight + value
		}, 0)
	}

	/**
	 * Get all neighboring nodes for a given node
	 * @param {Object} graph - Graph object with _assocMat adjacency matrix
	 * @param {number|string} node - Node identifier
	 * @returns {string[]} Array of neighbor node identifiers (as strings)
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
		if (obj === null || typeof obj !== "object") {
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
					throw new TypeError("Graph should only have positive weights.")
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
						throw new TypeError("Graph should only have positive weights.")
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
	 * Get the communities of neighboring nodes and their edge weights
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
		status.degrees[com] =
			(status.degrees[com] ?? 0) + (status.gDegrees[node] ?? 0)
		status.internals[com] =
			(status.internals[com] ?? 0) + weight + (status.loops[node] ?? 0)
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
		status.degrees[com] =
			(status.degrees[com] ?? 0) - (status.gDegrees[node] ?? 0)
		status.internals[com] =
			(status.internals[com] ?? 0) - weight - (status.loops[node] ?? 0)
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
		// Compute one level of the Communities Dendogram
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
				const degcTotw =
					(status.gDegrees[node] ?? 0) / (status.total_weight * 2.0)
				const neighCommunities = getNeighbourCommunities(node, graph, status)

				removeNode(node, comNode, neighCommunities[comNode] ?? 0.0, status)

				const { bestCom } = Object.keys(neighCommunities).reduce(
					(best, com) => {
						const incr =
							neighCommunities[com] - (status.degrees[com] ?? 0.0) * degcTotw

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
			addEdgeToGraph(
				ret,
				{ source: com1, target: com2, weight: newWeight },
				localState
			)
		})

		localState.edgeIndex.clear()

		return ret
	}

	/**
	 * Extract the partition at a specific level of the dendogram
	 * @param {Array} dendogram - Array of partitions at each level
	 * @param {number} level - Level to extract (0 = first level, higher = more aggregated)
	 * @returns {Object} Node to community mapping at the specified level
	 */
	const partitionAtLevel = (dendogram, level) => {
		let partition = clone(dendogram[0])

		for (let i = 1; i <= level; i++) {
			Object.keys(partition).forEach((key) => {
				const node = key
				const com = partition[key]
				partition[node] = dendogram[i][com]
			})
		}

		return partition
	}

	/**
	 * Generate the complete dendogram (hierarchy) of community partitions
	 * @param {Object} graph - Input graph with nodes, edges, and adjacency matrix
	 * @param {Object|null} partInit - Optional initial partition
	 * @param {Object} localState - Local state for algorithm execution
	 * @returns {Array} Array of partitions, each representing a level in the hierarchy
	 */
	const generateDendogram = (graph, partInit, localState) => {
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

	// Generate dendogram and return final partition
	const dendogram = generateDendogram(graph, initialPartition, localState)
	return partitionAtLevel(dendogram, 0)
}
