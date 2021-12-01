/******************************************* Clustering ************************************************************ */

import {elem, pushnew, uuidv4, deepMerge, standardize_color, makeColor, lightOrDark} from './utils.js'
import {styles} from './samples.js'
import {network, data, doc, yNetMap, unSelect, debug} from './prsm.js'

export function cluster(attribute) {
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
 * superimpose 'wait' animation over the net pane(or remove it)
 * @param {Boolean} on
 
function displayWaitAnimation(on) {
	let loading = elem('loading');
	loading.style.display = on ? 'block' : 'none';
	loading.style.zIndex = on ? 1000 : 0;
	loading.style.backgroundColor = 'red';
}*/
/**
 *
 * @param {String} attribute
 */
function clusterByAttribute(attribute) {
	// collect all different values of the attribute that are in use
	let attValues = new Set()
	data.nodes.get().forEach((node) => {
		if (!node.isCluster) attValues.add(node[attribute])
	})
	unSelect()
	let nodesToUpdate = []
	// for each cluster
	for (let value of attValues) {
		// collect relevant nodes that are not already in a cluster and are not cluster nodes
		let nodesInCluster = data.nodes.get({
			filter: (node) => node[attribute] === value && !node.clusteredIn && !node.isCluster,
		})
		// clusters must have at least 2 nodes
		if (nodesInCluster.length <= 1) continue
		let sumx = 0
		let sumy = 0
		let nInCluster = 0
		if (!value) value = '[none]'
		let clusterNode = data.nodes.get(`cluster-${attribute}-${value}`)
		if (clusterNode === null) {
			let color = makeColor()
			clusterNode = deepMerge(styles.nodes['cluster'], {
				id: `cluster-${attribute}-${value}`,
				isCluster: true,
				label: `${yNetMap.get('attributeTitles')[attribute]} ${value}`,
				color: {background: color},
				font: {color: lightOrDark(color) == 'light' ? 'black' : 'white'},
				hidden: false,
			})
		} else clusterNode.hidden = false
		for (let node of nodesInCluster) {
			// for each factor that should be in the cluster
			node.clusteredIn = clusterNode.id
			node.hidden = true
			node.whyHidden = pushnew(node.whyHidden, 'cluster')
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
			clusterNode = deepMerge(styles.nodes['cluster'], {
				id: `cluster-color-${color}`,
				isCluster: true,
				label: `Cluster ${++clusterNumber}`,
				color: {background: color},
				font: {color: lightOrDark(color) == 'light' ? 'black' : 'white'},
				hidden: false,
			})
		} else clusterNode.hidden = false
		for (let node of nodesInCluster) {
			// for each factor that should be in the cluster
			node.clusteredIn = clusterNode.id
			node.hidden = true
			node.whyHidden = pushnew(node.whyHidden, 'cluster')
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
		if (!node.isCluster && node.groupLabel != 'Sample') stylesInUse.add(node.grp)
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
			clusterNode = deepMerge(styles.nodes['cluster'], {
				id: `cluster-style-${style}`,
				isCluster: true,
				label: `${styles.nodes[style].groupLabel} cluster`,
				color: {background: styles.nodes[style].color.background},
				font: {color: styles.nodes[style].font.color},
				hidden: false,
			})
		} else clusterNode.hidden = false
		for (let node of nodesInCluster) {
			// for each factor that should be in the cluster
			node.clusteredIn = clusterNode.id
			node.hidden = true
			node.whyHidden = pushnew(node.whyHidden, 'cluster')
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

/**
 * Create links to cluster nodes and hide links that are now inside clustered nodes
 */
function showClusterLinks() {
	// hide all links between clusters initially
	let edgesToUpdate = []
	data.edges.get().forEach((edge) => {
		if (edge.isClusterEdge) edge.hidden = true
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
		edge.whyHidden = pushnew(edge.whyHidden, 'cluster')
		if (!fromNode.clusteredIn && !toNode.clusteredIn) {
			edge.whyHidden = edge.whyHidden.filter((item) => item !== 'cluster')
			edge.hidden = edge.whyHidden.length > 0
		} else if (fromNode.clusteredIn == toNode.clusteredIn) {
			edge.hidden = true
			edge.whyHidden = pushnew(edge.whyHidden, 'cluster')
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
		let edge = data.edges.get({filter: (e) => fromId == e.from && toId == e.to}).shift()
		if (!edge) {
			edge = deepMerge(styles.edges['cluster'], {
				id: `cledge-${uuidv4()}`,
				from: fromId,
				to: toId,
				isClusterEdge: true,
			})
		}
		edge.hidden = false
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
	// if user has right clicked on a factor that is not a cluster, do nothing
	if (!clusterNode.isCluster) return
	doc.transact(() => {
		unSelect()
		let nodesToUpdate = []
		let edgesToRemove = []
		let nodesInCluster = data.nodes.get({filter: (node) => node.clusteredIn === clusterNode.id})
		for (let node of nodesInCluster) {
			node.whyHidden = node.whyHidden.filter((item) => item !== 'cluster')
			node.hidden = node.whyHidden.length > 0
			node.clusteredIn = null
			nodesToUpdate.push(node)
		}
		// hide the cluster node
		clusterNode.hidden = true
		clusterNode.whyHidden = ['cluster']
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
	if (data.nodes.get({filter: (n) => n.isCluster && !n.hidden}).length === 0) {
		// all clusters have been opened; reset the cluster select to None
		elem('clustering').value = 'none'
	}
}

function unCluster() {
	let nodesToUpdate = []
	let edgesToRemove = []
	data.nodes.get({filter: (node) => node.isCluster}).forEach((clusterNode) => {
		let nodesInCluster = data.nodes.get({filter: (node) => node.clusteredIn === clusterNode.id})
		for (let node of nodesInCluster) {
			node.whyHidden = node.whyHidden.filter((item) => item !== 'cluster')
			node.hidden = node.whyHidden.length > 0
			node.clusteredIn = null
			nodesToUpdate.push(node)
		}
		clusterNode.hidden = true
		clusterNode.whyHidden = ['cluster']
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
