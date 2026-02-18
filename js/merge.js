/**
 * Some functions for examining and merging maps - not for public consumption, but useful
 * for diagnosing problems and for special operations on maps
 */

import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"
import { DataSet } from "vis-data/esnext"
import { doc, websocket, data, logHistory, room } from "./prsm.js"
import { uuidv4, deepCopy, objectEquals, alertMsg } from "./utils.js"
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

let bwsp //  websocket to other room
let bdata // the data from the other room
let bNodesMap // map of nodes from the other room
let bEdgesMap //  map of edges from the other room

export function openOtherDoc(otherRoom) {
	const bDoc = new Y.Doc()
	bwsp = new WebsocketProvider(websocket, `prsm${otherRoom}`, bDoc)
	bwsp.disconnectBc()
	bNodesMap = bDoc.getMap("nodes")
	bEdgesMap = bDoc.getMap("edges")
	const bNodes = new DataSet()
	const bEdges = new DataSet()
	bdata = {
		nodes: bNodes,
		edges: bEdges,
	}
}

function mergeMaps() {
	let history = "" // collect history log entries, so that the log can be updated all at once
	doc.transact(() => {
		const nodesToAdd = [] // collect new nodes to add to map A
		const edgesToAdd = [] // and edges
		const substitutes = new Map() // when two nodes have different ids, but identical labels,
		// use this as a conversion look up table from one id to the other
		const newNodes = new Map()
		for (const BNode of bdata.nodes.get()) {
			if (BNode.isCluster) continue
			// for each node in the other map
			let ANode = data.nodes.get(BNode.id) // see whether there is a node in this map with the same id
			// if not, see whether there is a node in this map with the same label, and treat this node as the same as the node in the other map
			if (!ANode) {
				const sameLabelNodes = data.nodes
					.get()
					.filter(
						(an) =>
							an.label.replace(/\s/g, "") === BNode.label.replace(/\s/g, "")
					)
				if (sameLabelNodes.length > 1) {
					console.log(
						`%cMatching factors by label ('${BNode.label}'), but there are two or more factors with this label in this map`,
						"color: red"
					)
					alertMsg(
						`Matching factors by label ('${BNode.label}'), but there are two or more factors with this label in the map`,
						"warn"
					)
				}
				ANode = sameLabelNodes[0]
				if (ANode) {
					// map works both ways - OK since ids are unique
					substitutes.set(BNode.id, ANode.id)
					substitutes.set(ANode.id, BNode.id)
				}
			}
			if (ANode) {
				// if there is, check whether the label is the same
				if (ANode.label.replace(/\s/g, "") !== BNode.label.replace(/\s/g, "")) {
					// if not, make a clone of the other node with a new id
					logMerge(
						`'${ANode.label}' Factor in this map does not match Factor from other map with new label: '${BNode.label}'. Factor with new label added.`
					)
					// generate a new id for BNode.  change border to dashed red.  Add it to the map
					const newNode = deepCopy(BNode)
					newNode.id = uuidv4()
					newNode.shapeProperties.borderDashes = true
					newNode.borderWidth = 4
					newNode.borderWidthSelected = 4
					newNode.color.border = "#ff0000"
					newNode.color.highlight.border = "#ff0000"
					newNode.x = ANode.x + 30
					newNode.y = ANode.y + 30
					// add it to this map
					nodesToAdd.push(newNode)
					// add to lookup table of existing node id to clone node id
					newNodes.set(BNode.id, newNode.id)
				} else {
					if (ANode.grp !== BNode.grp) {
						// label is the same, but style is not - just report this
						logMerge(
							`Style: '${ANode.grp}' does not match style: '${BNode.grp}' from other map for Factor: '${ANode.label}. Existing style retained.`
						)
					}
					if (!objectEquals(ANode.note, BNode.note)) {
						// if the note is different, change it to the note from the other map
						ANode.note = BNode.note
						logMerge(
							`Note for the Factor: '${ANode.label}' changed to the Note from the Factor in the other map`
						)
						nodesToAdd.push(ANode)
					}
				}
			} else {
				// the node is on the other map, but not on this one - add it.
				nodesToAdd.push(BNode)
				logMerge(`added new Factor: '${BNode.label}'`)
			}
		}
		data.nodes.update(nodesToAdd)

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
				newEdge.color.color = "rgb(255, 0, 0)"
				edgesToAdd.push(newEdge)
				logMerge(
					`added Link between new Factor(s): '${data.nodes.get(newEdge.from).label}' to '${
						data.nodes.get(newEdge.to).label
					}'`
				)
			}
			// now deal with the other map's edges
			let AEdge = data.edges.get(BEdge.id)
			if (!AEdge) {
				// check to see if there is a link in map A that goes from and to the same nodes as
				// this link in map B, although it has a different id, remembering that the map A
				// and map B nodes may have been matched by label, rather than id.
				let from = BEdge.from
				if (substitutes.get(from)) from = substitutes.get(from)
				let to = BEdge.to
				if (substitutes.get(to)) to = substitutes.get(to)
				const sameEdges = data.edges
					.get()
					.filter((e) => e.from === from && e.to === to)
				if (sameEdges) AEdge = sameEdges[0]
			}
			if (BEdge.label && BEdge.label.trim() === "") BEdge.label = undefined
			const edgeName =
				BEdge.label ||
				`from [${bdata.nodes.get(BEdge.from).label}] to [${bdata.nodes.get(BEdge.to).label}]`
			if (AEdge) {
				if (
					((AEdge.label && AEdge.label.trim() !== "") ||
						(BEdge.label && BEdge.label.trim() !== "")) &&
					AEdge.label !== BEdge.label
				) {
					logMerge(
						`Link with label: '${AEdge.label}' does not match link from other map with label: '${BEdge.label}'.  Existing label retained.`
					)
				} else {
					if (AEdge.grp !== BEdge.grp) {
						logMerge(
							`Link with style: '${AEdge.grp}' does not match style: '${BEdge.grp}' from other map for link '${edgeName}'. Existing style retained.`
						)
					}
					if (!objectEquals(AEdge.note, BEdge.note)) {
						AEdge.note = BEdge.note
						logMerge(
							`Note for Link: '${edgeName}' changed to the Note from the Link in the other map`
						)
						edgesToAdd.push(AEdge)
					}
				}
			} else {
				// if BEdge's from or to nodes have been substituted for a node in the A map
				// with the same label, change the from or to ids to the A map version
				if (substitutes.get(BEdge.from))
					BEdge.from = substitutes.get(BEdge.from)
				if (substitutes.get(BEdge.to)) BEdge.to = substitutes.get(BEdge.to)
				edgesToAdd.push(BEdge)
				logMerge(`added new Link: '${edgeName}'`)
			}
		})
		// now check that all edges in the existing map are also in the other map
		data.edges.forEach((AEdge) => {
			let BEdge = bdata.edges.get(AEdge.id)
			if (!BEdge) {
				let from = AEdge.from
				if (substitutes.get(from)) from = substitutes.get(from)
				let to = AEdge.to
				if (substitutes.get(to)) to = substitutes.get(to)
				const sameEdges = bdata.edges
					.get()
					.filter((e) => e.from === from && e.to === to)
				if (sameEdges) BEdge = sameEdges[0]
			}
		})
		data.nodes.update(nodesToAdd)
		data.edges.update(edgesToAdd)
	})
	logHistory(history, "Merge")

	function logMerge(action) {
		history += "<br />" + action
	}
}

export function mergeRoom(otherRoom) {
	openOtherDoc(otherRoom)
	console.log(
		"%cMerging map at %s (map A) with map at %s (map B)",
		"font-weight: bold",
		room,
		otherRoom
	)
	bwsp.on("sync", (status) => {
		if (!status) return
		bNodesMap.forEach((n) => bdata.nodes.update(n))
		bEdgesMap.forEach((e) => bdata.edges.update(e))
		mergeMaps()
		bwsp.disconnect()
		console.log("Finished")
	})
	return "Please wait..."
}

/**
 * Print to console the differences between the given map and the current map
 */
function diffMaps() {
	for (const BNode of bdata.nodes.get()) {
		if (BNode.isCluster) continue
		// for each node in the other map
		let ANode = data.nodes.get(BNode.id) // see whether there is a node in this map with the same id
		if (!ANode) {
			const sameLabelNodes = data.nodes
				.get()
				.filter(
					(an) => an.label.replace(/\s/g, "") === BNode.label.replace(/\s/g, "")
				)
			if (sameLabelNodes.length > 1) {
				console.log(
					`%cMatching factors by label [%c${inline(
						BNode.label
					)}%c], but there are two or more factors with this label in this map`,
					"color: red",
					"color:green",
					"color:red"
				)
			} else {
				if (sameLabelNodes.length === 1) {
					console.log(
						`%cMatching factors by label [%c${inline(
							BNode.label
						)}%c] because there is no pair of factors with the same id`,
						"color: black",
						"color:green",
						"color: black"
					)
				}
			}
			ANode = sameLabelNodes[0]
		}
		if (ANode) {
			// if there is, check whether the label is the same
			if (ANode.label.replace(/\s/g, "") !== BNode.label.replace(/\s/g, "")) {
				console.log(
					`Factor label in map A: [%c${inline(ANode.label)}%c] does not match label in map B: [%c${inline(
						BNode.label
					)}%c].`,
					"color:green",
					"color:black",
					"color:green",
					"color:black"
				)
			} else if (
				ANode.grp !== BNode.grp
			) // label is the same, but style is not - just report this
			{
				console.log(
					`Factor style in map A : ${ANode.grp} does not match style in map B: ${
						BNode.grp
					} for Factor: [%c${inline(ANode.label)}%c]. `,
					"color:green",
					"color:black"
				)
			}
		} else {
			// the node is on the other map, but not on this one - add it.
			console.log(
				`Factor: [%c${inline(BNode.label)}%c] in map B is not in map A`,
				"color:green",
				"color:black"
			)
		}
	}
	// now check that all nodes in the existing map are also in the other map
	for (const ANode of data.nodes.get()) {
		if (ANode.isCluster) continue
		if (!bdata.nodes.get(ANode.id)) {
			console.log(
				`Factor: [%c${inline(ANode.label)}%c] in map A is not in map B`,
				"color:green",
				"color:black"
			)
		}
	}

	// now deal with the other map's edges
	bdata.edges.get().forEach((BEdge) => {
		const AEdge = data.edges.get(BEdge.id)
		if (BEdge.label && BEdge.label.trim() === "") BEdge.label = undefined
		const edgeName =
			BEdge.label ||
			`[${bdata.nodes.get(BEdge.from).label}] --> [${bdata.nodes.get(BEdge.to).label}]`
		if (AEdge) {
			if (
				((AEdge.label && AEdge.label.trim() !== "") ||
					(BEdge.label && BEdge.label.trim() !== "")) &&
				AEdge.label !== BEdge.label
			) {
				console.log(
					`Link label in map A: [%c${inline(AEdge.label)}%c] does not match label:[%c${inline(
						BEdge.label
					)}%c] in map B.  `,
					"color:green",
					"color:black",
					"color:green",
					"color:black"
				)
			} else if (AEdge.grp !== BEdge.grp) {
				console.log(
					`Link style: '${AEdge.grp}' in map A does not match style: '${
						BEdge.grp
					}' in map B for link [%c${inline(edgeName)}%c]. `,
					"color:green",
					"color:black"
				)
			}
		} else {
			console.log(
				`Map A does not include the link: %c${inline(edgeName)}%c in map B. `,
				"color:green",
				"color:black"
			)
		}
	})
	// now check that all edges in the existing map are also in the other map
	data.edges.forEach((AEdge) => {
		if (!bdata.edges.get(AEdge.id)) {
			const edgeName =
				(AEdge.label && AEdge.label.trim() !== "") ||
				`[${data.nodes.get(AEdge.from).label}] --> [${data.nodes.get(AEdge.to).label}]`
			console.log(
				`Link %c${inline(edgeName)}%c in map A is not in map B`,
				"color:green",
				"color:black"
			)
		}
	})
}
export function diffRoom(otherRoom) {
	openOtherDoc(otherRoom)
	console.log(
		"%cComparing map at %s (map A) with map at %s (map B)",
		"font-weight: bold",
		room,
		otherRoom
	)
	bwsp.on("sync", (status) => {
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
	const node = data.nodes.get(id)
	if (!node) return "node not found"
	return node.label
}
/**
 * replace all white space with single space characters
 * @param {string} label
 * @returns string
 */
function inline(label) {
	return label.replace(/\s+/g, " ").trim()
}
/**
 * anonymise a map by removing all user names
 */
export function anon() {
	const nodes = data.nodes.get()
	nodes.forEach((n) => {
		if (n.created) n.created = undefined
		if (n.modified) n.modified = undefined
	})
	data.nodes.update(nodes)
	const edges = data.edges.get()
	edges.forEach((e) => {
		if (e.created) e.created = undefined
		if (e.modified) e.modified = undefined
	})
	data.edges.update(edges)
}

export function sanityCheck(del = false) {
	// check all factors have labels
	data.nodes.get().forEach((n) => {
		if (!n.label || n.label === "" || n.label.trim() === "") {
			console.log("Bad factor:", n)
			if (del) {
				data.nodes.remove(n.id)
				console.log("Deleted factor", n)
			}
		}
	})
	// check all links have existing to and from factors
	data.edges.get().forEach((e) => {
		let ok = true
		if (!data.nodes.get(e.from)) {
			console.log("Missing from factor", e)
			ok = false
		}
		if (!data.nodes.get(e.to)) {
			console.log("Missing to factor", e)
			ok = false
		}
		if (!ok && del) {
			data.edges.remove(e.id)
			console.log("Deleted edge: ", e)
		}
	})
}
window.sanityCheck = sanityCheck
