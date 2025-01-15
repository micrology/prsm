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
		let clusterNode = data.nodes.get(`cluster-${attribute}-${value}`)
		if (clusterNode === null) {
			let color = makeColor()
			clusterNode = makeClusterNode(`cluster-${attribute}-${value}`, `${yNetMap.get('attributeTitles')[attribute]} ${value}`, color)
		}
		clusterNode.hidden = false
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
		let clusterNode = data.nodes.get(`cluster-color-${color}`)
		if (clusterNode === null) {
			clusterNode = makeClusterNode(`cluster-color-${color}`, `Cluster ${++clusterNumber}`, color)
		}
		clusterNode.hidden = false
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
		// retrieve or create the cluster node (cluster nodes are re-used if they already exist)
		let clusterNode = data.nodes.get(`cluster-style-${style}`)
		if (clusterNode === null) {
			clusterNode = makeClusterNode(`cluster-style-${style}`, `${styles.nodes[style].groupLabel} cluster`, styles.nodes[style].color.background)
		}
		clusterNode.hidden = false
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
	return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg width="800" height="800" viewBox="0 0 1024 1024" class="icon" xmlns="http://www.w3.org/2000/svg">
  <path d="M697.051 674.158c-29.622 0-59.245 11.922-83.017 23.917l-202.02-155.209c5.924-17.92 11.849-35.84 11.849-59.757 0-23.918-5.852-41.838-11.85-59.758L606.428 273.92c17.774 17.92 47.47 29.842 77.166 29.842A147.456 147.456 0 0 0 832 154.332 147.456 147.456 0 0 0 683.52 4.9a147.456 147.456 0 0 0-148.26 149.43c0 29.916 11.849 59.831 23.698 83.676l-176.64 131.51c-29.696-35.84-65.317-59.757-106.789-65.755v-65.755c53.394-11.922 89.015-59.758 89.015-113.518C364.544 58.66 311.15 4.9 245.834 4.9S127.121 58.734 127.121 124.489c0 53.76 35.548 101.596 89.015 113.518v65.828c-89.015 17.847-154.331 89.527-154.331 179.2s65.316 161.427 148.407 173.349v65.755c-53.395 11.923-89.088 59.758-89.088 113.591 0 65.756 53.394 119.516 118.71 119.516S358.62 901.486 358.62 835.73c0-53.833-35.62-101.668-89.088-113.59v-65.756c41.546-5.998 83.09-29.915 106.862-65.755L572.416 739.84c-11.85 23.918-23.698 53.76-23.698 83.675 0 83.676 65.316 149.431 148.407 149.431a147.456 147.456 0 0 0 148.406-149.43 147.456 147.456 0 0 0-148.48-149.431zm-13.385-609.5c47.47 0 89.015 41.911 89.015 89.673 0 47.836-41.545 89.674-89.015 89.674-47.543 0-89.088-41.838-89.088-89.674 0-47.762 41.545-89.673 89.088-89.673M241.883 364.69c62.245 0 116.736 54.857 116.736 117.468 0 62.683-54.491 117.467-116.662 117.467s-116.663-54.857-116.663-117.467S179.712 364.69 241.957 364.69zm-61.293-240.2c0-35.84 23.771-59.832 59.319-59.832 35.62 0 59.392 23.918 59.392 59.831 0 35.84-23.772 59.758-59.392 59.758-35.548 0-59.32-23.918-59.32-59.758M299.3 841.727c0 35.84-23.77 59.83-59.391 59.83-35.548 0-59.32-23.917-59.32-59.83 0-35.84 23.772-59.758 59.32-59.758 35.62 0 59.392 23.918 59.392 59.758m397.898 71.534c-47.543 0-89.015-41.838-89.015-89.673s41.545-89.674 89.015-89.674c47.543 0 89.015 41.838 89.015 89.674s-41.546 89.673-89.015 89.673" style="fill:${color};stroke:${color};stroke-width:16;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none"/>
</svg>`)
}
/**
 * Create an object to format a new cluster node
 * The font is always black
 * @param {string} id cluster nodeId
 * @param {string} label cluster node label
 * @param {string} color of cluster node 
 * @returns 
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
