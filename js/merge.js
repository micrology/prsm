/**
 * Some functions for examining and merging maps - not for public consumption, but useful
 * for diagnosing problems and for special operations on maps
 */

import * as Y from 'yjs'
import {WebsocketProvider} from 'y-websocket'
import {DataSet} from 'vis-data/peer'
import {websocket, data, logHistory, room} from './prsm.js'
import {uuidv4, deepCopy} from './utils.js'
/* --------------------------------- Merge maps ----------------------------- */
/*
 * Evaluate mergeRoom(string: room code) e.g. mergeRoom('WBI-CRD-ROB-XDK')
 *   adds all factors and links in the 'other' map to this one
 *   if a factor occurs in both maps and is identical in both, nothing is added
 *   if a factor is in both maps, but the label is different, a new factor is added
 *     that is a clone of the 'other' factor, but with a dashed red border and with
 *     cloned links that are dashed.
 *
 * Evaluate diffRoom(string: room code) e.g. diffRoom('WBI-CRD-ROB-XDK')
 *  to list all the differences in the console
 */

var bwsp //  websocket to other room
var bdata // the data from the other room
var bNodesMap // map of nodes from the other room
var bEdgesMap //  map of edges from the other room

export function openOtherDoc(otherRoom) {
	let bDoc = new Y.Doc()
	bwsp = new WebsocketProvider(websocket, 'prsm' + otherRoom, bDoc)
	bwsp.disconnectBc()
	bNodesMap = bDoc.getMap('nodes')
	bEdgesMap = bDoc.getMap('edges')
	let bNodes = new DataSet()
	let bEdges = new DataSet()
	bdata = {
		nodes: bNodes,
		edges: bEdges,
	}
}

function mergeMaps() {
	let newNodes = new Map()
	bdata.nodes.get().forEach((BNode) => {
		// for each node in the other map
		let ANode = data.nodes.get(BNode.id) // see whether there is a node in this map with the same id
		// if not, see whether there is a node in this map with the same label, and treat this node as the same as the node in the other map
		if (!ANode) {
			let sameLabelNodes = data.nodes.get().filter((an) => an.label === BNode.label)
			if (sameLabelNodes.length> 1) console.log(`%cMatching factors by label ('${BNode.label}'), but there are two or more factors with this label in this map`, 'color: red')
			ANode = sameLabelNodes[0]
		}
		if (ANode) {
			// if there is, check whether the label is the same
			if (ANode.label != BNode.label) {
				// if not, make a clone of the other node with a new id
				logHistory(
					`existing Factor label: '${ANode.label}' does not match new label: '${BNode.label}'. Factor with new label added.`,
					'Merge'
				)
				// generate a new id for BNode.  change border to dashed red.  Add it to the map
				let newNode = deepCopy(BNode)
				newNode.id = uuidv4()
				newNode.shapeProperties.borderDashes = true
				newNode.borderWidth = 4
				newNode.borderWidthSelected = 4
				newNode.color.border = '#ff0000'
				newNode.color.highlight.border = '#ff0000'
				newNode.x = ANode.x + 30
				newNode.y = ANode.y + 30
				// add it to this map
				data.nodes.add(newNode)
				// add to lookup table of existing node id to clone node id
				newNodes.set(BNode.id, newNode.id)
			} else if (ANode.grp != BNode.grp)
				// label is the same, but style is not - just report this
				logHistory(
					`existing style: '${ANode.grp}' does not match new style: '${BNode.grp}' for Factor: '${ANode.label}. Existing style retained.`,
					'Merge'
				)
		} else {
			// the node is on the other map, but not on this one - add it.
			data.nodes.add(BNode)
			logHistory(`added new Factor: '${BNode.label}'`, 'Merge')
		}
	})

	bdata.edges.get().forEach((BEdge) => {
		// Some edges on the other map may have been going to/from nodes that have been cloned and given a new id.
		// Clone these edges, giving them the new from: or to: node ids and make them dashed.
		let newEdge = null
		if (newNodes.has(BEdge.from)) {
			// this edge goes from a node that has been cloned - adjust the from: id
			newEdge = deepCopy(BEdge)
			newEdge.from = newNodes.get(BEdge.from)
			// it might also go to a cloned node -if so, adjust the to: id
			if (newNodes.has(newEdge.to)) newEdge.to = newNodes.get(newEdge.to)
		} else if (newNodes.has(BEdge.to)) {
			// this edge goes to a cloned node
			newEdge = deepCopy(BEdge)
			newEdge.to = newNodes.get(BEdge.to)
		}
		if (newEdge) {
			// give the cloned edge a new id
			newEdge.id = uuidv4()
			// make the edge dashed, red and thick
			newEdge.dashes = true
			newEdge.width = 4
			newEdge.color.color = 'rgb(255, 0, 0)'
			data.edges.add(newEdge)
			logHistory(
				`added Link between new Factor(s): '${data.nodes.get(newEdge.from).label}' to '${
					data.nodes.get(newEdge.to).label
				}'`,
				'Merge'
			)
		}
		// now deal with the other map's edges
		let AEdge = data.edges.get(BEdge.id)
		if (BEdge.label && BEdge.label.trim() === '') BEdge.label = undefined
		let edgeName =
			BEdge.label || `from [${bdata.nodes.get(BEdge.from).label}] to [${bdata.nodes.get(BEdge.to).label}]`
		if (AEdge) {
			if (
				((AEdge.label && AEdge.label.trim() != '') || (BEdge.label && BEdge.label.trim() != '')) &&
				AEdge.label != BEdge.label
			)
				logHistory(
					`existing Link label: '${AEdge.label}' does not match new label: '${BEdge.label}'.  Existing label retained.`,
					'Merge'
				)
			else if (AEdge.grp != BEdge.grp)
				logHistory(
					`existing Link style: '${AEdge.grp}' does not match new style: '${BEdge.grp}' for link '${edgeName}'. Existing style retained.`,
					'Merge'
				)
		} else {
			data.edges.add(BEdge)
			logHistory(`added new Link: '${edgeName}'`, 'Merge')
		}
	})
	// now check that all edges in the existing map are also in the other map
	data.edges.forEach((AEdge) => {
		if (!bdata.edges.get(AEdge.id)) {
			let edgeName =
				AEdge.label || `from [${data.nodes.get(AEdge.from).label}] to [${data.nodes.get(AEdge.to).label}]`
			logHistory(`existing link: ${edgeName}' is not in other map.  Existing link retained.`, 'Merge')
		}
	})
}

export function mergeRoom(otherRoom) {
	openOtherDoc(otherRoom)
	console.log(`%cDiffing map at ${room} (map A) with map at ${otherRoom} (map B)`, 'font-weight: bold')
	bwsp.on('sync', (status) => {
		if (!status) return
		bNodesMap.forEach((n) => bdata.nodes.update(n))
		bEdgesMap.forEach((e) => bdata.edges.update(e))
		mergeMaps()
		bwsp.disconnect()
	})
}

/**
 * Print to console the differences between the given map and the current map
 */
function diffMaps() {
	bdata.nodes.get().forEach((BNode) => {
		// for each node in the other map
		let ANode = data.nodes.get(BNode.id) // see whether there is a node in this map with the same id
		if (ANode) {
			// if there is, check whether the label is the same
			if (ANode.label != BNode.label) {
				console.log(
					`Factor label in map A: [%c${inline(ANode.label)}%c] does not match label in map B: [%c${inline(
						BNode.label
					)}%c].`,
					'color:green',
					'color:black',
					'color:green',
					'color:black'
				)
			} else if (ANode.grp != BNode.grp)
				// label is the same, but style is not - just report this
				console.log(
					`Factor style in map A : ${ANode.grp} does not match style in map B: ${
						BNode.grp
					} for Factor: [%c${inline(ANode.label)}%c]. `,
					'color:green',
					'color:black'
				)
		} else {
			// the node is on the other map, but not on this one - add it.
			console.log(`Factor: [%c${inline(BNode.label)}%c] in map B is not in map A`, 'color:green', 'color:black')
		}
	})
	// now check that all nodes in the existing map are also in the other map
	data.nodes.forEach((ANode) => {
		if (!bdata.nodes.get(ANode.id))
			console.log(`Factor: [%c${inline(ANode.label)}%c] in map A is not in map B`, 'color:green', 'color:black')
	})

	// now deal with the other map's edges
	bdata.edges.get().forEach((BEdge) => {
		let AEdge = data.edges.get(BEdge.id)
		if (BEdge.label && BEdge.label.trim() === '') BEdge.label = undefined
		let edgeName =
			BEdge.label || `from [${bdata.nodes.get(BEdge.from).label}] to [${bdata.nodes.get(BEdge.to).label}]`
		if (AEdge) {
			if (
				((AEdge.label && AEdge.label.trim() != '') || (BEdge.label && BEdge.label.trim() != '')) &&
				AEdge.label != BEdge.label
			)
				console.log(
					`Link label in map A: [%c${inline(AEdge.label)}%c] does not match label:[%c${inline(
						BEdge.label
					)}%c] in map B.  `,
					'color:green',
					'color:black',
					'color:green',
					'color:black'
				)
			else if (AEdge.grp != BEdge.grp)
				console.log(
					`Link style: '${AEdge.grp}' in map A does not match style: '${
						BEdge.grp
					}' in map B for link [%c${inline(edgeName)}%c]. `,
					'color:green',
					'color:black'
				)
		} else {
			console.log(
				`Map A does not include the link: %c${inline(edgeName)}%c in map B. `,
				'color:green',
				'color:black'
			)
		}
	})
	// now check that all edges in the existing map are also in the other map
	data.edges.forEach((AEdge) => {
		if (!bdata.edges.get(AEdge.id)) {
			let edgeName =
				AEdge.label || `from [${data.nodes.get(AEdge.from).label}] to [${data.nodes.get(AEdge.to).label}]`
			console.log(`Link [%c${inline(edgeName)}%c] in map A is not in map B`, 'color:green', 'color:black')
		}
	})
}
export function diffRoom(otherRoom) {
	openOtherDoc(otherRoom)
	console.log(`%cComparing map at ${room} (map A) with map at ${otherRoom} (map B)`, 'font-weight: bold')
	bwsp.on('sync', (status) => {
		if (!status) return
		bNodesMap.forEach((n) => bdata.nodes.update(n))
		bEdgesMap.forEach((e) => bdata.edges.update(e))
		diffMaps()
		bwsp.disconnect()
	})
	return true
}

/**
 * find a node with the given id and return its label
 * @param {string} id
 * @returns string
 */
export function nodeIdToLabel(id) {
	if (!id) return id
	let node = data.nodes.get(id)
	if (!node) return 'node not found'
	return node.label
}
/**
 * replace all white space with single space characters
 * @param {string} label
 * @returns string
 */
function inline(label) {
	return label.replace(/\s+/g, ' ').trim()
}
/**
 * anonymise a map by removing all user names
 */
export function anon() {
	let nodes = data.nodes.get()
	nodes.forEach((n) => {
		if (n.created) n.created = undefined
		if (n.modified) n.modified = undefined
	})
	data.nodes.update(nodes)
	let edges = data.edges.get()
	edges.forEach((e) => {
		if (e.created) e.created = undefined
		if (e.modified) e.modified = undefined
	})
	data.edges.update(edges)
}
