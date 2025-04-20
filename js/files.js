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


This module provides import and export functions, to read and save map files in a variety of formats.  
 ******************************************************************************************************************** */

import { Network, parseGephiNetwork, parseDOTNetwork } from "vis-network/peer"
import {
	data,
	doc,
	room,
	network,
	container,
	logHistory,
	yUndoManager,
	yNetMap,
	ySamplesMap,
	yPointsArray,
	yHistory,
	lastNodeSample,
	lastLinkSample,
	clearMap,
	debug,
	drawMinimap,
	toggleDeleteButton,
	undoRedoButtonStatus,
	updateLastSamples,
	setMapTitle,
	setSideDrawer,
	disableSideDrawerEditing,
	doSnapToGrid,
	setCurve,
	setBackground,
	setLegend,
	setCluster,
	sizing,
	recreateClusteringMenu,
	markMapSaved,
	saveState,
	fit,
	yDrawingMap,
} from "./prsm.js"
import {
	elem,
	uuidv4,
	deepMerge,
	deepCopy,
	splitText,
	standardize_color,
	rgbIsLight,
	rgbToArray,
	strip,
	statusMsg,
	alertMsg,
	lowerFirstLetter,
	stripNL,
} from "./utils.js"
import { styles } from "./samples.js"
import {
	canvas,
	refreshFromMap,
	setUpBackground,
	upgradeFromV1,
} from "./background.js"
import { refreshSampleNode, refreshSampleLink, updateLegend } from "./styles.js"
import Quill from "quill"
import { saveAs } from "file-saver"
//import * as quillToWord from 'quill-to-word'  //dynamically loaded in exportNotes
import { read, writeFileXLSX, utils } from "xlsx"
import { compressToUTF16, decompressFromUTF16 } from "lz-string"
import { XMLParser } from "fast-xml-parser"
import { fabric } from "fabric"
import { version } from "../package.json"

const NODEWIDTH = 10 // chars for label splitting

var lastFileName = "" // the name of the file last read in
let msg = ""
/**
 * Get the name of a map file to read and load it
 * @param {event} e
 */

export function readSingleFile(e) {
	var file = e.target.files[0]
	if (!file) {
		return
	}
	let fileName = file.name
	lastFileName = fileName
	document.body.style.cursor = "wait"
	statusMsg("Reading '" + fileName + "'")
	msg = ""
	e.target.value = ""
	var reader = new FileReader()
	reader.onloadend = function (e) {
		try {
			document.body.style.cursor = "wait"
			loadFile(e.target.result)
			if (!msg) alertMsg("Read '" + fileName + "'", "info")
		} catch (err) {
			document.body.style.cursor = "default"
			alertMsg("Error reading '" + fileName + "': " + err.message, "error")
			console.log(err)
			clearMap()
		}
		document.body.style.cursor = "default"
	}
	reader.readAsArrayBuffer(file)
}

export function openFile() {
	elem("fileInput").click()
}
/**
 * Allow user to open a file by dragging and dropping it over the PRSM window
 */
elem("container").addEventListener("drop", (e) => {
	e.preventDefault()
	let dt = e.dataTransfer
	let files = dt.files
	if (files.length > 0) {
		readSingleFile({ target: { files: files } })
	}
})
elem("container").addEventListener("dragover", (e) => {
	e.preventDefault()
})
/**
 * determine what kind of file it is, parse it and replace any current map with the one read from the file
 * @param {string} contents - what is in the file
 */
function loadFile(contents) {
	if (data.nodes.length > 0)
		if (
			!confirm(
				"Loading a file will delete the current network.  Are you sure you want to replace it?"
			)
		)
			return
	saveState()
	// load the file as one single yjs transaction to reduce server traffic
	clearMap()
	doc.transact(() => {
		switch (lastFileName.split(".").pop().toLowerCase()) {
			case "csv":
				loadCSV(arrayBufferToString(contents))
				break
			case "graphml":
				loadGraphML(arrayBufferToString(contents))
				break
			case "gml":
				loadGML(arrayBufferToString(contents))
				break
			case "json":
			case "prsm":
				loadPRSMfile(arrayBufferToString(contents))
				break
			case "gv":
			case "dot":
				loadDOTfile(arrayBufferToString(contents))
				break
			case "xlsx":
			case "xls":
				loadExcelfile(contents)
				break
			case "gexf":
				loadGEXFfile(arrayBufferToString(contents))
				break
			default:
				throw new Error("Unrecognised file name suffix")
		}
		let nodesToUpdate = []
		data.nodes.get().forEach((n) => {
			// ensure that all nodes have a grp property (converting 'group' property for old format files)
			if (!n.grp) n.grp = n.group ? "group" + (n.group % 9) : "group0"
			// reassign the sample properties to the nodes
			n = deepMerge(styles.nodes[n.grp], n)
			// version 1.6 made changes to label scaling
			n.scaling = {
				label: { enabled: false, max: 40, min: 10 },
				max: 100,
				min: 10,
			}
			nodesToUpdate.push(n)
		})
		data.nodes.update(nodesToUpdate)

		// same for edges
		let edgesToUpdate = []
		data.edges.get().forEach((e) => {
			// ensure that all edges have a grp property (converting 'group' property for old format files)
			if (!e.grp) e.grp = e.group ? "edge" + (e.group % 9) : "edge0"
			// reassign the sample properties to the edges
			e = deepMerge(styles.edges[e.grp], e)
			edgesToUpdate.push(e)
		})
		data.edges.update(edgesToUpdate)

		fit()
		updateLegend()
		logHistory("loaded &lt;" + lastFileName + "&gt;")
	})
	yUndoManager.clear()
	undoRedoButtonStatus()
	toggleDeleteButton()
	drawMinimap()
}
/**
 * convert an ArrayBuffer to String
 * @param {arrayBuffer} contents
 * @returns string
 */
function arrayBufferToString(contents) {
	let decoder = new TextDecoder("utf-8")
	return decoder.decode(new DataView(contents))
}
/**
 * Parse and load a PRSM map file, or a JSON file exported from Gephi
 * @param {string} str
 */
function loadPRSMfile(str) {
	if (str[0] != "{") str = decompressFromUTF16(str)
	let json = JSON.parse(str)
	if (json.version && version.substring(0, 3) > json.version.substring(0, 3)) {
		alertMsg("Warning: file was created in an earlier version", "warn")
		msg = "old version"
	}
	updateLastSamples(json.lastNodeSample, json.lastLinkSample)
	if (json.buttons) setButtonStatus(json.buttons)
	if (json.mapTitle) yNetMap.set("mapTitle", setMapTitle(json.mapTitle))
	/* if (json.recentMaps) {
		let recents = JSON.parse(localStorage.getItem('recents')) || {}
		localStorage.setItem('recents', JSON.stringify(Object.assign(json.recentMaps, recents)))
	} */
	if (json.attributeTitles) yNetMap.set("attributeTitles", json.attributeTitles)
	else yNetMap.set("attributeTitles", {})
	if (json.edges.length > 0 && "source" in json.edges[0]) {
		// the file is from Gephi and needs to be translated
		let parsed = parseGephiNetwork(json, {
			edges: {
				inheritColors: false,
			},
			nodes: {
				fixed: false,
				parseColor: true,
			},
		})
		data.nodes.add(parsed.nodes)
		data.edges.add(parsed.edges)
	} else {
		json.nodes.forEach((n) => {
			// at version 1.5, the title: property was renamed to note:
			if (!n.note && n.title) n.note = n.title.replace(/<br>|<p>/g, "\n")
			delete n.title
			if (n.note && !(n.note instanceof Object))
				n.note = { ops: [{ insert: n.note }] }
		})
		data.nodes.add(json.nodes)
		json.edges.forEach((e) => {
			if (!e.note && e.title) e.note = e.title.replace(/<br>|<p>/g, "\n")
			delete e.title
			if (e.note && !(e.note instanceof Object))
				e.note = { ops: [{ insert: e.note }] }
		})
		data.edges.add(json.edges)
	}
	// before v1.4, the style array was called samples
	if (json.samples) json.styles = json.samples
	if (json.styles) {
		styles.nodes = deepMerge(styles.nodes, json.styles.nodes)
		for (let n in styles.nodes) {
			delete styles.nodes[n].chosen
		}
		styles.edges = deepMerge(styles.edges, json.styles.edges)
		for (let e in styles.edges) {
			delete styles.edges[e].chosen
		}
		for (let groupId in styles.nodes) {
			ySamplesMap.set(groupId, {
				node: styles.nodes[groupId],
			})
			if (groupId.match(/\d+/)?.[0]) refreshSampleNode(groupId)
		}
		for (let edgeId in styles.edges) {
			ySamplesMap.set(edgeId, {
				edge: styles.edges[edgeId],
			})
			if (edgeId.match(/\d+/)?.[0]) refreshSampleLink(edgeId)
		}
	}
	yDrawingMap.clear()
	canvas.clear()
	yPointsArray.delete(0, yPointsArray.length)
	if (json.underlay) {
		// background from v1; update it
		yPointsArray.insert(0, json.underlay)
		if (yPointsArray.length > 0) upgradeFromV1(yPointsArray.toArray())
	}
	if (json.background) {
		setUpBackground()
		let map = JSON.parse(json.background)
		for (const [key, value] of Object.entries(map)) {
			yDrawingMap.set(key, value)
		}
		refreshFromMap(Object.keys(map))
	}
	yHistory.delete(0, yHistory.length)
	if (json.history) yHistory.insert(0, json.history)
	if (json.description) {
		yNetMap.set("mapDescription", json.description)
		disableSideDrawerEditing()
		setSideDrawer(json.description)
	}
	// node sizing has to be done after nodes have been created
	sizing(yNetMap.get("sizing"))
}
/**
 * parse and load a GraphViz (.DOT or .GV) file
 *  uses the vis-network DOT parser, which is pretty hopeless -
 *  e.g. it does not manage dotted or dashed node borders and
 *  requires some massaging of the parameters it does recognise
 *
 * @param {string} graph contents of DOT file
 * @returns nodes and edges as an object
 */
function loadDOTfile(graph) {
	let parsedData = parseDOTNetwork(graph)
	data.nodes.add(
		parsedData.nodes.map((node) => {
			let n = strip(node, ["id", "label", "color", "shape", "font", "width"])
			if (!n.id) n.id = uuidv4()
			if (!n.color) n.color = deepCopy(styles.nodes["group0"].color)
			if (!n.font) n.font = deepCopy(styles.nodes["group0"].font)
			if (!n.shape) n.shape = deepCopy(styles.nodes["group0"].shape)
			if (n.font?.size) n.font.size = parseInt(n.font.size)
			if (n.width) n.borderWidth = parseInt(n.width)
			if (n.shape === "plaintext") {
				n.shape = "text"
				n.borderWidth = 0
			}
			return n
		})
	)
	data.edges.add(
		parsedData.edges.map((edge) => {
			let e = strip(edge, ["id", "from", "to", "label", "color", "dashes"])
			if (!e.id) e.id = uuidv4()
			if (!e.color) e.color = deepCopy(styles.edges["edge0"].color)
			if (!e.dashes) e.dashes = deepCopy(styles.edges["edge0"].dashes)
			if (!e.width)
				e.width = e.width ? parseInt(e.width) : styles.edges["edge0"].width
			return e
		})
	)
}
/**
 * parse and load a graphML file
 * @param {string} graphML
 */
function loadGraphML(graphML) {
	let options = {
		ignoreAttributes: false,
		attributeNamePrefix: "",
		alwaysCreateTextNode: false,
		isArray: (name, jpath) => {
			// Define which elements should always be arrays
			const arrayPaths = [
				"graphml.key",
				"graphml.graph.node",
				"graphml.graph.edge",
				"graphml.graph.node.data",
				"graphml.graph.edge.data",
			]
			return arrayPaths.includes(jpath)
		},
		textNodeName: "#text",
		trimValues: true,
	}
	const parser = new XMLParser(options)
	const parsedData = parser.parse(graphML)
	if (parsedData.graphml && parsedData.graphml.graph) {
		let attributeNames = {}
		if (parsedData.graphml.key) {
			parsedData.graphml.key.forEach((key) => {
				attributeNames[key.id] = key["attr.name"]
			})
		}
		const nodes = parsedData.graphml.graph.node.map((node) => {
			const nodeData = {}
			if (node.data) {
				node.data.forEach((data) => {
					nodeData[attributeNames[data["key"]]] = data["#text"]
				})
			}
			return {
				id: node["id"],
				...nodeData,
			}
		})
		const edges = parsedData.graphml.graph.edge.map((edge) => {
			const edgeData = {}
			if (edge.data) {
				edge.data.forEach((data) => {
					edgeData[attributeNames[data["key"]]] = data["#text"]
				})
			}
			return {
				id: edge["id"],
				source: edge["source"],
				target: edge["target"],
				...edgeData,
			}
		})
		let nodesToUpdate = []
		nodes.forEach((node) => {
			let n = deepCopy(styles.nodes.group0)
			if (!node.id) throw new Error(`No ID for node ${node.label}`)
			n.id = node.id
			n.label = node.label ? node.label : node.id
			if (node.size) n.size = node.size
			if (node.x) n.x = node.x
			if (node.y) n.y = node.y
			if (node.r != undefined && node.g != undefined && node.b != undefined) {
				n.color.background = `rgb(${node.r},${node.g},${node.b})`
				n.font.color = rgbIsLight(node.r, node.g, node.b)
					? "rgb(0,0,0)"
					: "rgb(255,255,255)"
			}
			nodesToUpdate.push(n)
		})
		data.nodes.update(nodesToUpdate)
		// and each edge
		let edgesToUpdate = []
		edges.forEach((edge) => {
			let e = deepCopy(styles.edges.edge0)
			if (!edge.id) throw new Error("Missing edge ID")
			e.id = edge.id
			if (!data.nodes.get(edge.source))
				throw new Error(
					`No node ${edge.source} for source of edge ID ${edge.id}`
				)
			e.from = edge.source
			if (!data.nodes.get(edge.target))
				throw new Error(
					`No node ${edge.target} for source of edge ID ${edge.id}`
				)
			e.to = edge.target
			e.width = edge.weight > 20 ? 20 : edge.weight < 1 ? 1 : edge.weight
			edgesToUpdate.push(e)
		})
		data.edges.update(edgesToUpdate)
	} else {
		alertMsg("Bad format in GraphML file", "error")
		throw new Error("Bad format in GraphML file")
	}
}
/**
 * Parse and load a Gephi GEXF file
 * First transforms the file from XML to JSON and then loads
 * the PRSM data structures from the JSON data
 * @param {string} gexf  XML string from file
 */
function loadGEXFfile(gexf) {
	// Configure XML parser options with namespace support
	const options = {
		ignoreAttributes: false,
		attributeNamePrefix: "",
		processEntities: true,
		isArray: (name) => {
			return ["node", "edge", "attribute", "attvalue"].includes(name)
		},
		// Handle viz namespace
		transformTagName: (tagName) => {
			if (tagName.startsWith("viz:")) {
				return tagName.replace("viz:", "viz_")
			}
			return tagName
		},
	}

	const parser = new XMLParser(options)
	const jsonObj = parser.parse(gexf)

	// Extract the graph object
	const graph = jsonObj.gexf?.graph || jsonObj.graph
	if (!graph) throw new Error("Invalid GEXF format: no graph found")

	// Process attributes (nodes and edges)
	const attributes = processAttributes(graph.attributes)

	// Process nodes with visualization attributes
	const nodes = (graph.nodes?.node || []).map((node) => ({
		id: node.id,
		label: node.label || node.id,
		attributes: processAttributeValues(node.attvalues?.attvalue || []),
		...processVizAttributes(node),
		...processNodePosition(node),
	}))

	// Process edges with visualization attributes
	const edges = (graph.edges?.edge || []).map((edge) => ({
		id: edge.id,
		source: edge.source,
		target: edge.target,
		type: edge.type || graph.defaultedgetype || "directed",
		weight: parseFloat(edge.weight) || 1,
		attributes: processAttributeValues(edge.attvalues?.attvalue || []),
		...processEdgeVizAttributes(edge),
	}))

	// transform into PRSM nodes and edges
	// copy Attribute names from GEXF data
	let attributeNames = yNetMap.get("attributeTitles") || {}
	Object.keys(attributes.nodes).forEach((attr) => {
		attributeNames[attr] = attributes.nodes[attr].title
	})
	yNetMap.set("attributeTitles", attributeNames)
	recreateClusteringMenu(attributeNames)
	// process each node
	let nodesToUpdate = []
	nodes.forEach((node) => {
		let n = deepCopy(styles.nodes.group0)
		if (!node.id) throw new Error(`No ID for node ${node.label}`)
		n.id = node.id
		n.label = node.label || node.id
		n.x = node?.position?.x
		n.y = node?.position?.y
		n.size = node?.viz?.size
		if (node?.viz?.color) {
			let color = node.viz.color
			n.color.background = `rgba(${color.r},${color.g},${color.b},${color.a})`
			n.font.color = rgbIsLight(color.r, color.g, color.b)
				? "rgb(0,0,0)"
				: "rgb(255,255,255)"
		}
		n.shape = node?.viz?.shape
		if (node.attributes) {
			n = { ...n, ...node.attributes }
		}
		n.shape = node?.viz?.shape
		nodesToUpdate.push(n)
	})
	data.nodes.update(nodesToUpdate)
	// and each edge
	let edgesToUpdate = []
	edges.forEach((edge) => {
		let e = deepCopy(styles.edges.edge0)
		if (!edge.id) throw new Error("Missing edge ID")
		e.id = edge.id
		if (!data.nodes.get(edge.source))
			throw new Error(`No node ${edge.source} for source of edge ID ${edge.id}`)
		e.from = edge.source
		if (!data.nodes.get(edge.target))
			throw new Error(`No node ${edge.target} for source of edge ID ${edge.id}`)
		e.to = edge.target
		if (edge.weight) {
			e.width = edge.weight > 20 ? 20 : edge.weight < 1 ? 1 : edge.weight
		}
		if (edge?.viz?.color) {
			let color = edge.viz.color
			e.color = `rgba(${color.r},${color.g},${color.b},${color.a})`
		}
		edgesToUpdate.push(e)
	})
	data.edges.update(edgesToUpdate)
	// Helper functions
	function processAttributes(attributesNode) {
		const result = { nodes: {}, edges: {} }

		if (!attributesNode) return result

		const attrs = Array.isArray(attributesNode)
			? attributesNode
			: [attributesNode]

		attrs.forEach((attrGroup) => {
			const target = attrGroup.class === "node" ? "nodes" : "edges"
			if (attrGroup.attribute) {
				attrGroup.attribute.forEach((attr) => {
					result[target][attr.id] = {
						title: attr.title || attr.name,
						type: attr.type || "string",
					}
				})
			}
		})

		return result
	}

	function processAttributeValues(attvalues) {
		const result = {}
		if (!Array.isArray(attvalues)) return result

		attvalues.forEach((av) => {
			if (av.for !== undefined && av.value !== undefined) {
				result[av.for] = av.value
			}
		})
		return result
	}

	function processVizAttributes(element) {
		const viz = {}

		// Process size
		if (element.viz_size) {
			viz.size = parseFloat(element.viz_size.value)
			if (element.viz_size.size) viz.size = parseFloat(element.viz_size.size) // alternative
		}

		// Process color
		if (element.viz_color) {
			viz.color = {
				r: parseInt(element.viz_color.r || 0),
				g: parseInt(element.viz_color.g || 0),
				b: parseInt(element.viz_color.b || 0),
				a: parseFloat(element.viz_color.a || 1.0),
			}
		}

		// Process position (handled separately in processNodePosition)
		// Process shape if present
		if (element.viz_shape) {
			viz.shape = element.viz_shape.value
		}

		// Process thickness for edges (handled in processEdgeVizAttributes)

		return Object.keys(viz).length > 0 ? { viz } : {}
	}

	function processNodePosition(node) {
		const position = {}
		let hasPosition = false

		// Check viz:position first
		if (node.viz_position) {
			position.x = parseFloat(node.viz_position.x || 0)
			position.y = parseFloat(node.viz_position.y || 0)
			position.z = parseFloat(node.viz_position.z || 0)
			hasPosition = true
		}
		// Fallback to direct attributes
		else {
			if (node.x !== undefined) {
				position.x = parseFloat(node.x)
				hasPosition = true
			}
			if (node.y !== undefined) {
				position.y = parseFloat(node.y)
				hasPosition = true
			}
			if (node.z !== undefined) {
				position.z = parseFloat(node.z)
				hasPosition = true
			}
		}

		return hasPosition ? { position } : {}
	}

	function processEdgeVizAttributes(edge) {
		const viz = {}

		// Process thickness
		if (edge.viz_thickness) {
			viz.thickness = parseFloat(edge.viz_thickness.value)
		}

		// Process color
		if (edge.viz_color) {
			viz.color = {
				r: parseInt(edge.viz_color.r || 0),
				g: parseInt(edge.viz_color.g || 0),
				b: parseInt(edge.viz_color.b || 0),
				a: parseFloat(edge.viz_color.a || 1.0),
			}
		}

		// Process shape
		if (edge.viz_shape) {
			viz.shape = edge.viz_shape.value
		}

		return Object.keys(viz).length > 0 ? { viz } : {}
	}
}
/**
 * Parse and load a GML file
 * @param {string} gml
 */
function loadGML(gml) {
	if (gml.search("graph") < 0) throw new Error("invalid GML format")
	let tokens = gml.match(/"[^"]+"|[\w]+|\[|\]/g)
	let node
	let edge
	let edgeId = 0
	let tok = tokens.shift()
	while (tok) {
		switch (tok) {
			case "graph":
				break
			case "node":
				tokens.shift() // [
				node = {}
				tok = tokens.shift()
				while (tok != "]") {
					switch (tok) {
						case "id":
							node.id = tokens.shift().toString()
							break
						case "label":
							node.label = splitText(
								tokens.shift().replace(/"/g, ""),
								NODEWIDTH
							)
							break
						case "color":
						case "colour":
							node.color = {}
							node.color.background = tokens.shift().replace(/"/g, "")
							break
						case "[": // skip embedded groups
							while (tok != "]") tok = tokens.shift()
							break
						default:
							break
					}
					tok = tokens.shift() // ]
				}
				if (node.label == undefined) node.label = node.id
				data.nodes.add(node)
				break
			case "edge":
				tokens.shift() // [
				edge = {}
				tok = tokens.shift()
				while (tok != "]") {
					switch (tok) {
						case "id":
							edge.id = tokens.shift().toString()
							break
						case "source":
							edge.from = tokens.shift().toString()
							break
						case "target":
							edge.to = tokens.shift().toString()
							break
						case "label":
							edge.label = tokens.shift().replace(/"/g, "")
							break
						case "color":
						case "colour":
							edge.color = tokens.shift().replace(/"/g, "")
							break
						case "[": // skip embedded groups
							while (tok != "]") tok = tokens.shift()
							break
						default:
							break
					}
					tok = tokens.shift() // ]
				}
				if (edge.id == undefined) edge.id = (edgeId++).toString()
				data.edges.add(edge)
				break
			default:
				break
		}
		tok = tokens.shift()
	}
}
/**
 * Read a comma separated values file consisting of 'From' label and 'to' label, on each row,
	 with a header row (ignored) 
	optional, cols 3 and 4 can include the groups (styles) of the from and to nodes,
	column 5 can include the style of the edge.  All these must be integers between 1 and 9
 * @param {string} csv 
 */
function loadCSV(csv) {
	let lines = csv.split(/\r\n|\n/)
	let labels = new Map()
	let links = []

	for (let i = 1; i < lines.length; i++) {
		if (lines[i].length <= 2) continue // empty line
		let line = splitCSVrow(lines[i])
		let from = node(line[0], line[2], i)
		let to = node(line[1], line[3], i)
		let grp = line[4]
		if (grp) grp = "edge" + (parseInt(grp.trim()) - 1)
		links.push({
			id: uuidv4(),
			from: from.id,
			to: to.id,
			grp: grp,
		})
	}
	data.nodes.add(Array.from(labels.values()))
	data.edges.add(links)
	/**
	 * Parse a CSV row, accounting for commas inside quotes
	 * @param {string} row
	 * @returns array of fields
	 */
	function splitCSVrow(row) {
		let insideQuote = false,
			entries = [],
			entry = []
		row.split("").forEach(function (character) {
			if (character === '"') {
				insideQuote = !insideQuote
			} else {
				if (character == "," && !insideQuote) {
					entries.push(entry.join(""))
					entry = []
				} else {
					entry.push(character)
				}
			}
		})
		entries.push(entry.join(""))
		return entries
	}
	/**
	 * retrieves or creates a (new) node object with given label and style,
	 * @param {string} label
	 * @param {number} grp
	 * @param {number} lineNo the file line where this node was read from
	 * @returns the node object
	 */
	function node(label, grp, lineNo) {
		label = label.trim()
		if (grp) {
			let styleNo = parseInt(grp)
			if (isNaN(styleNo) || styleNo < 1 || styleNo > 9) {
				throw new Error(
					`Line ${lineNo}: Columns 3 and 4 must be values between 1 and 9 or blank (found ${grp})`
				)
			}
			grp = "group" + (styleNo - 1)
		}
		if (labels.get(label) == undefined) {
			labels.set(label, { id: uuidv4(), label: label.toString(), grp: grp })
		}
		return labels.get(label)
	}
}
/**
 * Reads map data from an Excel file.  The file must have two spreadsheets in the workbook, named Factors and Links
 * In the spreadsheet, there must be a header row, and columns for (minimally) Label (and for links, also From and To,
 * with entries with the exact same text as the Labels in the Factor sheet.  There may be a Style column, which is used
 * to specify the style for the Factor or Link (numbered from 1 to 9).  There may be a Description (or note or Note)
 * column, the contents of which are treated as a Factor or Link note.  Any other columns are treated as holding values
 * for additional Attributes.
 *
 * Uses https://sheetjs.com/
 *
 * @param {*} contents
 * @returns nodes and edges data
 */
function loadExcelfile(contents) {
	let workbook = read(contents)
	let factorsSS = workbook.Sheets["Factors"]
	if (!factorsSS) throw new Error("Sheet named Factors not found in Workbook")
	let linksSS = workbook.Sheets["Links"]
	if (!linksSS) throw new Error("Sheet named Links not found in Workbook")

	// attributeNames is an object with properties attributeField: attributeTitle
	let attributeNames = {}

	/* 
	 Transform data about factors into an array of objects, with properties named after the column headings
	 (with first letter lower cased if necessary) and values from that row's cells.
	 add a GUID to the object,  change 'Style' property to 'grp'
	 Style is a style number
	 Put value of Description or Notes property into notes
	 Check that any other property names are not in the list of known attribute names; if so add that property name to the attribute name list 
	 Place the factor either at the given x and y coordinates or at some random location
	 */

	// convert data from Factors sheet into an array of objects with properties starting with lower case letters
	let factors = utils
		.sheet_to_json(factorsSS)
		.map((f) => lowerInitialLetterOfProps(f))
	let maxIndexOfFactorStyles = Object.keys(styles.nodes).length - 1
	factors.forEach((f) => {
		f.id = uuidv4()
		if (f.style) {
			let styleNo = parseInt(f.style)
			if (isNaN(styleNo) || styleNo < 1 || styleNo > maxIndexOfFactorStyles) {
				throw new Error(
					`Factors - Line ${f.__rowNum__}: Style must be a number between 1 and ${maxIndexOfFactorStyles} or blank (found ${f.style})`
				)
			}
			f.grp = "group" + (styleNo - 1)
			if (f.groupLabel) {
				let styleDataSet = Array.from(
					document.getElementsByClassName("sampleNode")
				)[styleNo - 1].dataSet
				let styleNode = styleDataSet.get("1")
				styleNode.label = f.groupLabel
				styleNode.groupLabel = f.groupLabel
				styleDataSet.update(styleNode)
				styles.nodes[f.grp].groupLabel = f.groupLabel
			}
			delete f.style
		}
		if (!f.label)
			throw new Error(
				`Factors - Line ${f.__rowNum__}: Factor does not have a Label`
			)
		let note = f.description || f.note
		if (note) {
			f.note = { ops: [{ insert: note + "\n" }] }
			delete f.description
		}
		if (f.creator) {
			f.created = {
				time: f.createdTime ? Date.parse(f.createdTime) : Date.now(),
				user: f.creator,
			}
			delete f.createdTime
		}
		if (f.modifier) {
			f.modified = {
				time: f.modifiedTime ? Date.parse(f.modifiedTime) : Date.now(),
				user: f.modifier,
			}
			delete f.modifiedTime
		}
		// filter out known properties, leaving the rest to become attributes
		Object.keys(f)
			.filter(
				(k) =>
					![
						"id",
						"grp",
						"label",
						"groupLabel",
						"shape",
						"note",
						"created",
						"createdTime",
						"creator",
						"modified",
						"modifiedTime",
						"modifier",
						"x",
						"y",
						"__rowNum__",
					].includes(k)
			)
			.forEach((k) => {
				let attributeField = Object.keys(attributeNames).find(
					(prop) => attributeNames[prop] === k
				)
				if (!attributeField) {
					// not found, so add
					attributeField = "att" + (Object.keys(attributeNames).length + 1)
					attributeNames[attributeField] = k
				}
				f[attributeField] = f[k]
				delete f[k]
			})
		f.x = parseInt(f.x)
		if (!f.x || isNaN(f.x)) f.x = Math.random() * 500
		f.y = parseInt(f.y)
		if (!f.y || isNaN(f.y)) f.y = Math.random() * 500
	})
	/* for each row of links
	add a GUID
	look up from and to in factor objects and replace with their ids
	add other attributes as for factors */

	let links = utils
		.sheet_to_json(linksSS)
		.map((l) => lowerInitialLetterOfProps(l))
	links.forEach((l) => {
		l.id = uuidv4()
		if (l.style) {
			let styleNo = parseInt(l.style)
			if (isNaN(styleNo) || styleNo < 1 || styleNo > 9) {
				throw new Error(
					`Links - Line ${l.__rowNum__}: Style must be a number between 1 and 9, a style name, or blank (found ${l.style})`
				)
			}
			l.grp = "edge" + (styleNo - 1)
			if (l.groupLabel) {
				let styleDataSet = Array.from(
					document.getElementsByClassName("sampleLink")
				)[styleNo - 1].dataSet
				let styleEdge = styleDataSet.get("1")
				styleEdge.label = l.groupLabel
				styleEdge.groupLabel = l.groupLabel
				styleDataSet.update(styleEdge)
				styles.edges[l.grp].groupLabel = l.groupLabel
			}
			delete l.style
		}
		if (l.creator) {
			l.created = {
				time: l.createdTime ? Date.parse(l.createdTime) : Date.now(),
				user: l.creator,
			}
			delete l.createdTime
		}
		if (l.modifier) {
			l.modified = {
				time: l.modifiedTime ? Date.parse(l.modifiedTime) : Date.now(),
				user: l.modifier,
			}
			delete l.modifiedTime
		}
		let fromFactor = factors.find((factor) => factor.label === l.from)
		if (fromFactor) l.from = fromFactor.id
		else
			throw new Error(
				`Links - Line ${l.__rowNum__}: From factor (${l.from}) not found for link`
			)
		let toFactor = factors.find((factor) => factor.label === l.to)
		if (toFactor) l.to = toFactor.id
		else
			throw new Error(
				`Links - Line ${l.__rowNum__}: To factor (${l.to}) not found for link`
			)

		let note = l.description || l.note
		if (note) {
			l.note = { ops: [{ insert: note + "\n" }] }
			delete l.description
		}
		Object.keys(l)
			.filter(
				(k) =>
					![
						"id",
						"from",
						"to",
						"grp",
						"groupLabel",
						"creator",
						"created",
						"label",
						"modified",
						"modifier",
						"note",
						"__rowNum__",
					].includes(k)
			)
			.forEach((k) => {
				let attributeField = Object.keys(attributeNames).find(
					(prop) => attributeNames[prop] === k
				)
				if (!attributeField) {
					// not found, so add
					attributeField = "att" + (Object.keys(attributeNames).length + 1)
					attributeNames[attributeField] = k
				}
				l[attributeField] = l[k]
				delete l[k]
			})
	})
	factors.forEach((f) => {
		f.label = splitText(f.label, NODEWIDTH)
	})
	data.nodes.add(factors)
	data.edges.add(links)
	yNetMap.set("attributeTitles", attributeNames)
	recreateClusteringMenu(attributeNames)

	/**
	 * ensure the initial letter of each property of obj is lower case
	 * @param {object} obj
	 * @returns copy of object
	 */
	function lowerInitialLetterOfProps(obj) {
		return Object.fromEntries(
			Object.entries(obj).map(([k, v]) => [lowerFirstLetter(k), v])
		)
	}
}

/**
 * save the current map as a PRSM file (in JSON format)
 */
export function savePRSMfile() {
	network.storePositions()
	let attributes = yNetMap.get("attributeTitles") || []
	let nodeFields = [
		"id",
		"label",
		"grp",
		"x",
		"y",
		"color",
		"font",
		"borderWidth",
		"shape",
		"shapeProperties",
		"margin",
		"thumbUp",
		"thumbDown",
		"created",
		"modified",
	]
	let json = JSON.stringify(
		{
			saved: new Date(Date.now()).toLocaleString(),
			version: version,
			room: room,
			mapTitle: elem("maptitle").innerText,
			// 			security risk to save recent maps to a file
			//			recentMaps: JSON.parse(localStorage.getItem('recents')),
			lastNodeSample: lastNodeSample,
			lastLinkSample: lastLinkSample,
			// clustering, and up/down, paths between and x links away settings are not saved (and hidden property is not saved)
			buttons: getButtonStatus(),
			attributeTitles: yNetMap.get("attributeTitles"),
			styles: styles,
			nodes: data.nodes.get({
				fields: [...nodeFields, ...Object.keys(attributes)],
				filter: (n) => !n.isCluster,
			}),
			edges: data.edges.get({
				fields: [
					"id",
					"arrows",
					"color",
					"created",
					"dashes",
					"font",
					"from",
					"grp",
					"label",
					"modified",
					"note",
					"to",
					"width",
				],
				filter: (e) => !e.isClusterEdge,
			}),
			background: JSON.stringify(yDrawingMap.toJSON()),
			history: yHistory.map((s) => {
				s.state = null
				return s
			}),
			description: yNetMap.get("mapDescription"),
		},
		null,
		"\t"
	)
	if (!/plain/.test(debug)) json = compressToUTF16(json)
	saveStr(json, "prsm")
	markMapSaved()
}
/**
 * return an object with the current Network panel setting for saving
 * settings for link radius and up/down stream are not saved
 * @return an object with the Network panel settings
 */
function getButtonStatus() {
	return {
		snapToGrid: elem("snaptogridswitch").checked,
		curve: elem("curveSelect").value,
		background: elem("netBackColorWell").style.backgroundColor,
		legend: elem("showLegendSwitch").checked,
		sizing: elem("sizing").value,
	}
}
/**
 * Set the Network panel buttons to their values loaded from a file
 * @param {Object} settings
 */
function setButtonStatus(settings) {
	yNetMap.set("snapToGrid", settings.snapToGrid)
	doSnapToGrid(settings.snapToGrid)
	yNetMap.set("curve", settings.curve)
	setCurve(settings.curve)
	yNetMap.set("background", settings.background || "#ffffff")
	setBackground(yNetMap.get("background"))
	yNetMap.set("legend", settings.legend)
	setLegend(settings.legend)
	yNetMap.set("sizing", settings.sizing)
	// sizing done after the nodes have been created: sizing(settings.sizing)
	yNetMap.set("radius", { radiusSetting: "All", selected: [] })
	yNetMap.set("stream", { streamSetting: "All", selected: [] })
	yNetMap.set("paths", { pathsSetting: "All", selected: [] })
	yNetMap.set("cluster", "none")
	setCluster("none")
}

/**
 * Save the string to a local file
 * @param {string} str file contents
 * @param {string} extn file extension
 *
 * Browser will only ask for name and location of the file to be saved if
 * it has a user setting to do so.  Otherwise, it is saved at a default
 * download location with a default name.
 */
function saveStr(str, extn) {
	setFileName(extn)
	const blob = new Blob([str], { type: "text/plain;charset=utf-8" })
	saveAs(blob, lastFileName, { autoBom: true })
}
/**
 * save the map as a PNG image file
 */

const maxScale = 5 // max upscaling for image (avoids blowing up very small networks excessively)

export function exportPNGfile() {
	setFileName("png")

	// create a very large canvas, so we can download at high resolution
	network.storePositions()

	// first, create a large offscreen div to hold a copy of the network at the required width
	const bigWidth = 4096 / window.devicePixelRatio // half the number of pixels in the image file (also half the height, as the image is square)
	const bigMargin = 256 / window.devicePixelRatio // white space around network so not too close to printable edge

	let bigNetDiv = document.createElement("div")
	bigNetDiv.id = "big-net-pane"
	bigNetDiv.style.position = "absolute"
	bigNetDiv.style.top = "-9999px"
	bigNetDiv.style.left = "-9999px"
	bigNetDiv.style.width = `${bigWidth}px`
	bigNetDiv.style.height = `${bigWidth}px`
	elem("main").appendChild(bigNetDiv)

	// create an offscreen canvas of the same size to apply the background to
	let bigBackgroundCanvas = new OffscreenCanvas(bigWidth, bigWidth)
	bigBackgroundCanvas.id = "big-background-canvas"
	let bigFabricCanvas = new fabric.StaticCanvas("big-background-canvas", {
		width: bigWidth,
		height: bigWidth,
	})

	// make a network with the same nodes and links as the original map
	let bigNetwork = new Network(bigNetDiv, data, {
		physics: { enabled: false },
		edges: {
			smooth: {
				enabled: elem("curveSelect").value === "Curved",
				type: "cubicBezier",
			},
		},
	})

	bigNetwork.on("afterDrawing", (bigNetContext) => {
		// copy the background objects to the big fabric canvas
		bigFabricCanvas.loadFromJSON(JSON.stringify(canvas), () => {
			// adjust the fabric canvas scale and center to match the big network and match the background colour
			bigFabricCanvas.setZoom(bigNetwork.getScale())
			let fcCenter = bigFabricCanvas.getVpCenter()
			bigFabricCanvas.relativePan({
				x: bigNetwork.getScale() * (fcCenter.x - center.x),
				y: bigNetwork.getScale() * (fcCenter.y - center.y),
			})

			bigFabricCanvas.setBackgroundColor(
				elem("underlay").style.backgroundColor || "rgb(255, 255, 255)"
			)
			bigFabricCanvas.requestRenderAll()

			// create an image version of the background and copy it onto the big network canvas
			let bigBackgroundImage = document.createElement("img")
			bigBackgroundImage.onload = function () {
				bigNetContext.globalCompositeOperation = "destination-over"
				bigNetContext.drawImage(bigBackgroundImage, 0, 0, bigWidth, bigWidth)

				// save the canvas to a file
				bigNetContext.canvas.toBlob((blob) => saveAs(blob, lastFileName))

				// clean up
				bigNetwork.destroy()
				bigNetDiv.remove()
				bigFabricCanvas.dispose()
			}
			bigBackgroundImage.src = bigFabricCanvas.toDataURL()
		})
	})

	let box = mapBoundingBox(network, canvas, network.getSelectedNodes())
	let scale =
		network.getScale() *
		Math.min(
			(bigWidth - bigMargin) / (box.right - box.left),
			(bigWidth - bigMargin) / (box.bottom - box.top)
		)
	if (scale > maxScale) scale = maxScale
	let center = network.DOMtoCanvas({
		x: 0.5 * (box.right + box.left),
		y: 0.5 * (box.bottom + box.top),
	})
	bigNetwork.moveTo({
		scale: scale,
		position: center,
	})

	/**
	 * Get a bounding box for everything on the map (the nodes and the background objects)
	 * @param {object} ntwk the map on which the nodes are placed
	 * @param {array} selectedNodes Ids of selected nodes, if any
	 * @returns box as an object, with dimensions in DOM coords
	 */
	function mapBoundingBox(ntwk, fabCanvas, selectedNodes = []) {
		let top = Infinity,
			bottom = -Infinity,
			left = Infinity,
			right = -Infinity
		// use all nodes if none selected
		if (selectedNodes.length === 0) selectedNodes = data.nodes.map((n) => n.id)
		selectedNodes.forEach((nodeId) => {
			let canvasBB = ntwk.getBoundingBox(nodeId)
			let tl = ntwk.canvasToDOM({ x: canvasBB.left, y: canvasBB.top })
			let br = ntwk.canvasToDOM({ x: canvasBB.right, y: canvasBB.bottom })
			if (left > tl.x) left = tl.x
			if (right < br.x) right = br.x
			if (top > tl.y) top = tl.y
			if (bottom < br.y) bottom = br.y
		})
		// only include background objects if no nodes are selected
		if (selectedNodes.length === 0) {
			fabCanvas.forEachObject((obj) => {
				let boundingBox = obj.getBoundingRect()
				console.log(obj, boundingBox)
				if (left > boundingBox.left) left = boundingBox.left
				if (right < boundingBox.left + boundingBox.width)
					right = boundingBox.left + boundingBox.width
				if (top > boundingBox.top) top = boundingBox.top
				if (bottom < boundingBox.top + boundingBox.height)
					bottom = boundingBox.top + boundingBox.height
			})
		}
		if (left === Infinity) {
			top = bottom = left = right = 0
		}
		return { left: left, right: right, top: top, bottom: bottom }
	}
}
/**
 * save a local file containing all the node and edge notes, plus the map description, as a Word document
 */
export async function exportNotes() {
	let delta = { ops: [{ insert: "\n" }] }
	// start with the title of the map if there is one
	let title = elem("maptitle").innerText
	if (title !== "Untitled map") {
		delta = {
			ops: [{ insert: title }, { attributes: { header: 1 }, insert: "\n" }],
		}
	}
	// get contents of map note if there is one
	if (yNetMap.get("mapDescription")) {
		delta.ops = delta.ops.concat(
			[
				{ insert: "Description of the map" },
				{ attributes: { header: 2 }, insert: "\n" },
			],
			yNetMap.get("mapDescription").text.ops
		)
	}
	// add notes for factors
	data.nodes
		.get()
		.toSorted((a, b) => a.label.localeCompare(b.label))
		.forEach((n) => {
			delta.ops = delta.ops.concat(
				[
					{ insert: `Factor: ${stripNL(n.label)}` },
					{ attributes: { header: 2 }, insert: "\n" },
				],
				n.note ? n.note.ops : [{ insert: "[No note]\n" }]
			)
		})
	// add notes for links
	data.edges.forEach((e) => {
		let heading = `Link from '${stripNL(data.nodes.get(e.from).label)}' to '${stripNL(data.nodes.get(e.to).label)}'`
		delta.ops = delta.ops.concat([
			{ insert: heading },
			{ attributes: { header: 2 }, insert: "\n" },
		])
		delta.ops = delta.ops.concat(
			e.note ? e.note.ops : [{ insert: "[No note]\n" }]
		)
	})
	// save the delta as a Word file
	const quillToWordConfig = {
		exportAs: "blob",
		paragraphStyles: {
			normal: {
				paragraph: {
					spacing: {
						line: 240,
					},
				},
			},
		},
	}
	const ql = await import("quill-to-word")
	const docAsBlob = await ql.generateWord(delta, quillToWordConfig)
	setFileName("docx")
	saveAs(docAsBlob, lastFileName)
}
/**
 * resets lastFileName to a munged version of the map title, with the supplied extension
 * if lastFileName is null, uses the map title, or if no map title, 'network' as the filename
 * @param {string} extn filename extension to apply
 */
export function setFileName(extn = "prsm") {
	let title = elem("maptitle").innerText
	if (title === "Untitled map") lastFileName = "network"
	else
		lastFileName = title.replace(/\s+/g, "").replaceAll(".", "_").toLowerCase()
	lastFileName += "." + extn
}
/**
 * Save the map as CSV files, one for nodes and one for edges
 * Only node and edge labels and style ids are saved
 *
 * Now obsolete, as the Excel file format is much more useful
 */
/* export function exportCVS() {
	let dummyDiv = document.createElement('div')
	dummyDiv.id = 'dummy-div'
	dummyDiv.style.display = 'none'
	container.appendChild(dummyDiv)
	let qed = new Quill('#dummy-div')
	let str = 'Id,Label,Style,Note\n'
	for (let node of data.nodes.get()) {
		str += node.id + ','
		if (node.label) str += '"' + node.label.replaceAll('\n', ' ') + '"'
		str += ',' + node.grp + ','
		if (node.note) {
			qed.setContents(node.note)
			// convert Quill formatted note to HTML, escaping all "
			str +=
				'"' +
				new QuillDeltaToHtmlConverter(qed.getContents().ops, {
					inlineStyles: true,
				})
					.convert()
					.replaceAll('"', '""') +
				'"'
		}
		str += '\n'
	}
	saveStr(str, 'nodes.csv')
	str = 'Source,Target,Type,Id,Label,Style,Note\n'
	for (let edge of data.edges.get()) {
		str += edge.from + ','
		str += edge.to + ','
		str += 'directed,'
		str += edge.id + ','
		if (edge.label) str += edge.label.replaceAll('\n', ' ') + '"'
		str += ',' + edge.grp + ','
		if (edge.note) {
			qed.setContents(edge.note)
			// convert Quill formatted note to HTML, escaping all "
			str +=
				'"' +
				new QuillDeltaToHtmlConverter(qed.getContents().ops, {
					inlineStyles: true,
				})
					.convert()
					.replaceAll('"', '""') +
				'"'
		}
		str += '\n'
	}
	saveStr(str, 'edges.csv')
	dummyDiv.remove()
} */
/**
 * Save the map in an Excel workbook, with two sheets: Factors and Links
 */
export function exportExcel() {
	// set up Quill note conversion
	let dummyDiv = document.createElement("div")
	dummyDiv.id = "dummy-div"
	dummyDiv.style.display = "none"
	container.appendChild(dummyDiv)
	let qed = new Quill("#dummy-div")
	// create workbook
	const workbook = utils.book_new()
	// Factors
	let rows = data.nodes
		.get()
		.filter((n) => !n.isCluster)
		.map((n) => {
			if (n.created) {
				n.creator = n.created.user
				n.createdTime = new Date(n.created.time).toISOString()
			}
			if (n.modified) {
				n.modifier = n.modified.user
				n.modifiedTime = new Date(n.modified.time).toISOString()
			}
			n.style = parseInt(n.grp.substring(5)) + 1
			if (n.note) n.Note = quillToText(n.note)
			// don't save any of the listed properties
			return omit(n, [
				"bc",
				"borderWidth",
				"borderWidthSelected",
				"color",
				"created",
				"fixed",
				"font",
				"grp",
				"hidden",
				"id",
				"clusteredIn",
				"level",
				"labelHighlightBold",
				"locked",
				"margin",
				"modified",
				"nodeHidden",
				"opacity",
				"oldFont",
				"oldFontColor",
				"oldLabel",
				"note",
				"scaling",
				"shadow",
				"shapeProperties",
				"size",
				"heightConstraint",
				"val",
				"value",
				"wasFixed",
				"widthConstraint",
			])
		})

	let factorWorksheet = utils.json_to_sheet(rows)
	utils.book_append_sheet(workbook, factorWorksheet, "Factors")

	// Links
	let edges = deepCopy(data.edges.get().filter((e) => !e.isClusterEdge))
	rows = edges.map((e) => {
		if (e.created) {
			e.creator = e.created.user
			e.createdTime = new Date(e.created.time).toISOString()
		}
		if (e.modified) {
			e.modifier = e.modified.user
			e.modifiedTime = new Date(e.modified.time).toISOString()
		}
		e.style = parseInt(e.grp.substring(4)) + 1
		e.from = data.nodes.get(e.from).label
		e.to = data.nodes.get(e.to).label
		if (e.note) e.Note = quillToText(e.note)
		return omit(e, [
			"arrows",
			"color",
			"created",
			"dashes",
			"font",
			"grp",
			"hoverWidth",
			"id",
			"note",
			"selectionWidth",
			"width",
		])
	})
	let linksWorksheet = utils.json_to_sheet(rows)
	utils.book_append_sheet(workbook, linksWorksheet, "Links")

	setFileName("xlsx")
	writeFileXLSX(workbook, lastFileName)
	dummyDiv.remove()

	function omit(obj, props) {
		return Object.keys(obj)
			.filter((key) => props.indexOf(key) < 0)
			.reduce((obj2, key) => ((obj2[key] = obj[key]), obj2), {})
	}
	/**
	 *
	 * @param {object} ops
	 * @returns contents of Quill note as plain text
	 */
	function quillToText(ops) {
		qed.setContents(ops)
		// use qed.root.innerHTML to convert to HTML if that is preferred
		return qed.getText()
	}
}
/**
 * Save the map as a GML file
 * See https://web.archive.org/web/20190303094704/http://www.fim.uni-passau.de:80/fileadmin/files/lehrstuhl/brandenburg/projekte/gml/gml-technical-report.pdf for the format
 */
export function exportGML() {
	let str =
		'Creator "prsm ' +
		version +
		" on " +
		new Date(Date.now()).toLocaleString() +
		'"\ngraph\n[\n\tdirected 1\n'
	let nodeIds = data.nodes.map((n) => n.id) //use integers, not GUIDs for node ids
	for (let node of data.nodes.get()) {
		str += "\tnode\n\t[\n\t\tid " + nodeIds.indexOf(node.id)
		if (node.label) str += '\n\t\tlabel "' + node.label.replace(/"/g, "'") + '"'
		let color = node.color.background || styles.nodes.group0.color.background
		str += '\n\t\tcolor "' + color + '"'
		str += "\n\t]\n"
	}
	for (let edge of data.edges.get()) {
		str += "\tedge\n\t[\n\t\tsource " + nodeIds.indexOf(edge.from)
		str += "\n\t\ttarget " + nodeIds.indexOf(edge.to)
		if (edge.label) str += '\n\t\tlabel "' + edge.label + '"'
		let color = edge.color.color || styles.edges.edge0.color.color
		str += '\n\t\tcolor "' + color + '"'
		str += "\n\t]\n"
	}
	str += "\n]"
	saveStr(str, "gml")
}
/**
 * Save the map as GraphViz file
 * See https://graphviz.org/doc/info/lang.html
 */
export function exportDOT() {
	let str = `/* Creator PRSM ${version} on ${new Date(Date.now()).toLocaleString()} */\ndigraph {\n`
	for (let node of data.nodes.get()) {
		str += `"${node.id}" [label="${node.label}", 
			color="${standardize_color(node.color.border)}", fillcolor="${standardize_color(node.color.background)}",
			shape="${node.shape == "text" ? "plaintext" : node.shape}",
			${gvNodeStyle(node)},
			fontsize="${node.font.size}", fontcolor="${standardize_color(node.font.color)}"]\n`
	}
	for (let edge of data.edges.get()) {
		str += `"${edge.from}" -> "${edge.to}" [label="${edge.label || ""}", 
			color="${standardize_color(edge.color.color)}"
			style="${gvConvertEdgeStyle(edge)}"]\n`
	}
	str += "}\n"
	saveStr(str, "gv")

	function gvNodeStyle(node) {
		let bDashes = node.shapeProperties.borderDashes
		let val = 'style="filled'
		if (Array.isArray(bDashes)) val += ", dotted"
		else val += `, ${bDashes ? "dashed" : "solid"}`
		val += `", penwidth="${node.borderWidth}"`
		return val
	}
	function gvConvertEdgeStyle(edge) {
		let bDashes = edge.dashes
		let val = "solid"
		if (Array.isArray(bDashes)) {
			if (bDashes[0] == 10) val = "dashed"
			else val = "dotted"
		}
		return val
	}
}
/*
 * Save the map as a GraphML file
 * See https://graphml.graphdrawing.org/pmwiki/pmwiki.php?n=Main.GraphML
 * GraphML is an XML-based file format for graphs. It is a W3C standard and is used by many graph visualization tools.
 * The GraphML format is a simple and flexible way to represent graphs, including nodes, edges, and their attributes.
 * It is widely used in graph visualization and analysis tools, such as Gephi, Cytoscape, and Graphviz.
 * GraphML files can be easily generated and parsed by various programming languages and libraries, making it a popular choice for graph data exchange.
 * The GraphML format is based on XML, which means it is human-readable and can be easily edited with a text editor.
 * GraphML files can be used to represent directed and undirected graphs, as well as weighted and unweighted edges.
 * GraphML files can also include metadata, such as node and edge labels, colors, and styles.
 */
export function exportGraphML() {
	let str = `<?xml version="1.0" encoding="UTF-8"?>
	<graphml xmlns="http://graphml.graphdrawing.org/xmlns" 
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
	<key id="d0" for="node" attr.name="label" attr.type="string"/>
	<key id="d1" for="node" attr.name="style" attr.type="int"/>
	<key id="d2" for="node" attr.name="color" attr.type="string"/>
	<key id="d3" for="node" attr.name="shape" attr.type="string"/>
	<key id="d4" for="node" attr.name="x" attr.type="float"/>
	<key id="d5" for="node" attr.name="y" attr.type="float"/>
	<key id="d6" for="node" attr.name="r" attr.type="int"/>
	<key id="d7" for="node" attr.name="g" attr.type="int"/>
	<key id="d8" for="node" attr.name="b" attr.type="int"/>
	<key id="d9" for="node" attr.name="size" attr.type="int"/>
	<key id="d10" for="edge" attr.name="label" attr.type="string"/>
	<key id="d11" for="edge" attr.name="style" attr.type="int"/>
	<key id="d12" for="edge" attr.name="color" attr.type="string"/>
	<key id="d13" for="edge" attr.name="r" attr.type="int"/>
	<key id="d14" for="edge" attr.name="g" attr.type="int"/>
	<key id="d15" for="edge" attr.name="b" attr.type="int"/>
	<key id="d16" for="edge" attr.name="weight" attr.type="int"/>
	<graph id="${elem("maptitle").innerText}" edgedefault="directed">`
	for (let node of data.nodes.get()) {
		let color = node.color.background || styles.nodes.group0.color.background
		let rgb = rgbToArray(color)
		str += `
		<node id="${node.id}">
			<data key="d0">${node.label}</data>
			<data key="d1">${parseInt(node.grp.substring(5)) + 1}</data>
			<data key="d2">${color}</data>
			<data key="d3">${node.shape}</data>
			<data key="d4">${node.x}</data>
			<data key="d5">${node.y}</data>
			<data key="d6">${rgb[0]}</data>
			<data key="d7">${rgb[1]}</data>
			<data key="d8">${rgb[2]}</data>
			<data key="d9">${node.size}</data>
		</node>`
	}
	for (let edge of data.edges.get()) {
		let color = edge.color.color || styles.edges.edge0.color.background
		let rgb = rgbToArray(color)
		str += `
		<edge id="${edge.id}" source="${edge.from}" target="${edge.to}">
			<data key="d10">${edge.label || ""}</data>
			<data key="d11">${parseInt(edge.grp.substring(4)) + 1}</data>
			<data key="d12">${color}</data>
			<data key="d13">${rgb[0]}</data>
			<data key="d14">${rgb[1]}</data>
			<data key="d15">${rgb[2]}</data>
			<data key="d16">${edge.width}</data>
		</edge>`
	}
	str += `
	</graph>
	</graphml>`
	saveStr(str, "graphml")
}
/**
 * Save the map as a GEXF format file, for input to Gephi etc.
 */
export function exportGEXF() {
	let str = `<?xml version='1.0' encoding='UTF-8'?>
		<gexf xmlns="http://gexf.net/1.3" version="1.3" xmlns:viz="http://gexf.net/1.3/viz" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://gexf.net/1.3 http://gexf.net/1.3/gexf.xsd">
		<meta lastmodifieddate="${new Date(Date.now()).toISOString().slice(0, 10)}">
			<creator>PRSM ${version}</creator>
			<title>${elem("maptitle").innerText}</title>
			<description>Generated from ${window.location.href}</description>
		</meta>
		<graph defaultedgetype="directed" mode="static">`
	let attributeNames = yNetMap.get("attributeTitles") || {}
	if (attributeNames) {
		str += `
			<attributes class="node" mode="static">
	`
		Object.keys(attributeNames).forEach((attr) => {
			str += `		<attribute id="${attr}" title="${attributeNames[attr]}" type="string"/>
	`
		})
		str += `		</attributes>`
	}
	str += `
		<nodes>`

	data.nodes.forEach((node) => {
		str += `
			<node id="${node.id}"
			label="${node.label}">`
		if (attributeNames) {
			str += `
			<attvalues>`
			Object.keys(attributeNames).forEach((attr) => {
				if (node[attr]) str += `
				<attvalue for="${attr}" value="${node[attr]}"/>`
			})
			str += `
			</attvalues>`
		}
		str += `
			<viz:size value="${node.size}"/>
			<viz:position x="${node.x}" y="${node.y}"/>
			</node>`
	})
	str += `
		</nodes>
		<edges>
    `
	data.edges.forEach((edge) => {
		str += `
		<edge id="${edge.id}" 
		source="${edge.from}" 
		target="${edge.to}"/>
		`
	})

	str += `
		</edges>
      </graph>
	</gexf>`

	saveStr(str, "gexf")
}
