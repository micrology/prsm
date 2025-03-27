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

import { elem, uuidv4, deepMerge, standardize_color, makeColor } from './utils.js'
import { styles } from './samples.js'
import { network, data, doc, yNetMap, unSelect, debug } from './prsm.js'

export function cluster(attribute) {
	if (!attribute) return
	doc.transact(() => {
		unCluster()
		switch (attribute) {
			case 'none':
				break
			case 'color':
				clusterByColor()
				break
			case 'style':
				clusterByStyle()
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
	// collect all different values of the attribute that are in use
	let attValues = new Set()
	data.nodes.get().forEach((node) => {
		if (!node.isCluster && node[attribute]) attValues.add(node[attribute])
	})
	unSelect()
	let nodesToUpdate = []
	// for each cluster
	for (let value of attValues) {
		// collect relevant nodes that are not already in a cluster and are not cluster nodes
		// and the attribute value is not blank
		let nodesInCluster = data.nodes.get({
			filter: (node) => node[attribute] === value && !node.clusteredIn && !node.isCluster,
		})
		// clusters must have at least 2 nodes
		if (nodesInCluster.length <= 1) continue
		let sumx = 0
		let sumy = 0
		let nInCluster = 0
		let clusterNode = makeClusterNode(`cluster-${attribute}-${value}`, `${yNetMap.get('attributeTitles')[attribute]} ${value}`, makeColor())
		for (let node of nodesInCluster) {
			// for each factor that should be in the cluster
			node.clusteredIn = clusterNode.id
			node.hidden = true
			sumx += node.x
			sumy += node.y
			nInCluster++
			nodesToUpdate.push(node)
		}
		// locate the cluster node at the centroid of the constituent nodes
		clusterNode.x = sumx / nInCluster
		clusterNode.y = sumy / nInCluster
		nodesToUpdate.push(clusterNode)
	}
	data.nodes.update(nodesToUpdate)
	showClusterLinks()
}

function clusterByColor() {
	// collect all different values of the attribute that are in use
	let colors = new Set()
	data.nodes.get().forEach((node) => {
		if (!node.isCluster) colors.add(standardize_color(node.color.background))
	})
	unSelect()
	let clusterNumber = 0
	let nodesToUpdate = []
	// for each cluster
	for (const color of colors) {
		// collect relevant nodes that are not already in a cluster and are not cluster nodes
		let nodesInCluster = data.nodes.get({
			filter: (node) =>
				standardize_color(node.color.background) === color && !node.clusteredIn && !node.isCluster,
		})
		// clusters must have at least 2 nodes
		if (nodesInCluster.length <= 1) continue
		let sumx = 0
		let sumy = 0
		let nInCluster = 0
		let clusterNode = makeClusterNode(`cluster-color-${color}`, `Cluster ${++clusterNumber}`, color)
		for (let node of nodesInCluster) {
			// for each factor that should be in the cluster
			node.clusteredIn = clusterNode.id
			node.hidden = true
			sumx += node.x
			sumy += node.y
			nInCluster++
			nodesToUpdate.push(node)
		}
		// locate the cluster node at the centroid of the constituent nodes
		clusterNode.x = sumx / nInCluster
		clusterNode.y = sumy / nInCluster
		nodesToUpdate.push(clusterNode)
	}
	data.nodes.update(nodesToUpdate)
	showClusterLinks()
}

function clusterByStyle() {
	// collect all different values of the style that are in use
	let stylesInUse = new Set()
	data.nodes.get().forEach((node) => {
		if (!node.isCluster) stylesInUse.add(node.grp)
	})
	unSelect()
	let nodesToUpdate = []
	// for each cluster
	for (const style of stylesInUse) {
		// collect relevant nodes that are not already in a cluster and are not cluster nodes
		let nodesInCluster = data.nodes.get({
			filter: (node) => node.grp === style && !node.clusteredIn && !node.isCluster,
		})
		// clusters must have at least 2 nodes
		if (nodesInCluster.length <= 1) continue
		let sumx = 0
		let sumy = 0
		let nInCluster = 0
		let clusterNode = makeClusterNode(`cluster-style-${style}`, `${styles.nodes[style].groupLabel} cluster`, styles.nodes[style].color.background)
		for (let node of nodesInCluster) {
			// for each factor that should be in the cluster
			node.clusteredIn = clusterNode.id
			node.hidden = true
			sumx += node.x
			sumy += node.y
			nInCluster++
			nodesToUpdate.push(node)
		}
		// locate the cluster node at the centroid of the constituent nodes
		clusterNode.x = sumx / nInCluster
		clusterNode.y = sumy / nInCluster
		nodesToUpdate.push(clusterNode)
	}
	data.nodes.update(nodesToUpdate)
	showClusterLinks()
}
function clusterImage(color) {
	return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg width="800px" height="800px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="white"><rect width="100%" height="100%" fill="white"/><path fill="${color}" fill-rule="evenodd" d="M8 0a2.25 2.25 0 00-.75 4.372v.465a3.25 3.25 0 00-1.797 1.144l-.625-.366a2.25 2.25 0 10-1.038 1.13l1.026.602a3.261 3.261 0 000 1.306l-1.026.601a2.25 2.25 0 101.038 1.13l.625-.366a3.25 3.25 0 001.797 1.145v.465a2.25 2.25 0 101.5 0v-.465a3.25 3.25 0 001.797-1.145l.625.366a2.25 2.25 0 101.038-1.13l-1.026-.6a3.26 3.26 0 000-1.307l1.026-.601a2.25 2.25 0 10-1.038-1.13l-.625.365A3.251 3.251 0 008.75 4.837v-.465A2.25 2.25 0 008 0zm-.75 2.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM2.75 4a.75.75 0 100 1.5.75.75 0 000-1.5zm0 6.5a.75.75 0 100 1.5.75.75 0 000-1.5zm4.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zm6-3.25a.75.75 0 100 1.5.75.75 0 000-1.5zm0-6.5a.75.75 0 100 1.5.75.75 0 000-1.5zM6.395 7.3a1.75 1.75 0 113.21 1.4 1.75 1.75 0 01-3.21-1.4z" clip-rule="evenodd"/></svg>`)
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
	return deepMerge(styles.nodes['cluster'], {
		id: id,
		label: label,
		isCluster: true,
		hidden: false,
		shape: 'image',
		image: clusterImage(color),
		font: { color: 'rgb(0,0,0)' }
	})
}
/**
 * Create links to cluster nodes and hide links that are now inside clustered nodes
 */
function showClusterLinks() {
	// hide all links between clusters initially
	let edgesToUpdate = []
	data.edges.get().forEach((edge) => {
		if (edge.isClusterEdge) {
			edge.hidden = true
			edge.label = ''
		}
	})
	for (let edge of data.edges.get()) {
		if (edge.isClusterEdge) continue
		// if edge is between two nodes neither of which are in a cluster, show it
		// if edge is from and to nodes that are in the same cluster, hide it
		// if edge is from a node not in a cluster, and to a node in a cluster, hide it and make a cluster edge for it
		// and vice versa
		// if edge is between two nodes both in (different) clusters, hide it and make a cluster edge for it
		let fromNode = data.nodes.get(edge.from)
		let toNode = data.nodes.get(edge.to)
		edge.hidden = true
		if (!fromNode.clusteredIn && !toNode.clusteredIn) {
			edge.hidden = false
		} else if (fromNode.clusteredIn == toNode.clusteredIn) {
			edge.hidden = true
		} else if (!fromNode.clusteredIn && toNode.clusteredIn) makeClusterLink(edge.from, toNode.clusteredIn)
		else if (fromNode.clusteredIn && !toNode.clusteredIn) makeClusterLink(fromNode.clusteredIn, edge.to)
		else if (fromNode.clusteredIn && toNode.clusteredIn) makeClusterLink(fromNode.clusteredIn, toNode.clusteredIn)
		else edge.hidden = false // shouldn't happen
		edgesToUpdate.push(edge)
	}
	data.edges.update(edgesToUpdate)
	if (/cluster/.test(debug)) {
		console.log('Nodes')
		data.nodes.get().forEach((n) => {
			console.log([n.id, n.label, n.hidden, n.clusteredIn])
		})
		console.log('Edges')
		data.edges.get().forEach((e) => {
			console.log([e.id, data.nodes.get(e.from).label, data.nodes.get(e.to).label, e.hidden])
		})
	}
	/**
	 * Reuse existing edge or create a new one
	 * @param {string} fromId
	 * @param {string} toId
	 */
	function makeClusterLink(fromId, toId) {
		let edge = edgesToUpdate.filter((e) => fromId == e.from && toId == e.to).shift()
		if (!edge) {
			edge = deepMerge(styles.edges['cluster'], {
				id: `cledge-${uuidv4()}`,
				from: fromId,
				to: toId,
				isClusterEdge: true,
			})
		}
		edge.hidden = false
		edge.label = edge.label ? (parseInt(edge.label) + 1).toString() : '1'
		edgesToUpdate.push(edge)
	}
}
/**
 * Hide the cluster node and unhide the nodes it was clustering (and their edges)
 * called by right clicking the cluster node
 * @param {string} clusterNodeId
 */
export function openCluster(clusterNodeId) {
	let clusterNode = data.nodes.get(clusterNodeId)
	// if user has right clicked on a factor that is not a cluster, and clustering is
	// set, re-cluster
	if (!clusterNode.isCluster) {
		let attribute = elem('clustering').value
		if (attribute !== 'none') cluster(attribute)
		return
	}
	doc.transact(() => {
		unSelect()
		let nodesToUpdate = []
		let edgesToRemove = []
		let nodesInCluster = data.nodes.get({ filter: (node) => node.clusteredIn === clusterNode.id })
		for (let node of nodesInCluster) {
			node.hidden = false
			node.clusteredIn = null
			nodesToUpdate.push(node)
		}
		// hide the cluster node
		clusterNode.hidden = true
		// and the edges that link it
		let eIds = network.getConnectedEdges(clusterNode.id)
		for (let eId of eIds) {
			edgesToRemove.push(eId)
		}
		nodesToUpdate.push(clusterNode)
		data.nodes.update(nodesToUpdate)
		data.edges.remove(edgesToRemove)
		showClusterLinks()
	})
	if (data.nodes.get({ filter: (n) => n.isCluster && !n.hidden }).length === 0) {
		// all clusters have been opened; reset the cluster select to None
		elem('clustering').value = 'none'
	}
}

function unCluster() {
	let nodesToUpdate = []
	let edgesToRemove = []
	data.nodes.get({ filter: (node) => node.isCluster }).forEach((clusterNode) => {
		let nodesInCluster = data.nodes.get({ filter: (node) => node.clusteredIn === clusterNode.id })
		for (let node of nodesInCluster) {
			node.hidden = false
			node.clusteredIn = null
			nodesToUpdate.push(node)
		}
		clusterNode.hidden = true
		// and the edges that link it
		let eIds = network.getConnectedEdges(clusterNode.id)
		for (let eId of eIds) {
			edgesToRemove.push(eId)
		}
		nodesToUpdate.push(clusterNode)
	})
	data.nodes.update(nodesToUpdate)
	data.edges.remove(edgesToRemove)
	showClusterLinks()
}
