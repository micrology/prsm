/**
 *
 * PRSM 3D map view
 * generates a 'three dimensional'view of a PRSM map, build on threejs
 *
 *
 * */

import * as Y from 'yjs'
import {WebsocketProvider} from 'y-websocket'
import {Network} from 'vis-network/peer/'
import {DataSet} from 'vis-data/peer'
import {elem, listen, deepMerge, standardize_color} from './utils.js'
import {version} from '../package.json'
// For unknown reasons, ForceGraph3D crashes if loaded from node_modules, but works if loaded from a CDN
import ForceGraph3D from '3d-force-graph'
//global ForceGraph3D
import SpriteText from 'three-spritetext'
import * as THREE from 'three'

const shortAppName = 'PRSM'

var debug = ''
window.debug = debug
var room
const doc = new Y.Doc()
var websocket = 'wss://www.prsm.uk/wss' // web socket server URL
var clientID // unique ID for this browser
var yNodesMap // shared map of nodes
var yEdgesMap // shared map of edges
var yNetMap // shared map of network state
var ySamplesMap // shared map of styles
var myNameRec // my name etc.
var loadingDelayTimer // timer to delay the start of the loading animation for few moments
var graph // the 3D map

window.addEventListener('load', () => {
	loadingDelayTimer = setTimeout(() => {
		elem('loading').style.display = 'block'
	}, 100)
	elem('version').innerHTML = version
	let searchParams = new URL(document.location).searchParams
	if (searchParams.has('debug')) debug = searchParams.get('debug')
	startY()
})
/**
 * create a new shared document and connect to the WebSocket provider
 */
function startY() {
	// get the room number from the URL, or if none, complain
	let url = new URL(document.location)
	room = url.searchParams.get('room')
	if (room == null || room == '') alert('No room name')
	else room = room.toUpperCase()
	debug = [url.searchParams.get('debug')]
	document.title = document.title + ' ' + room
	// don't bother with a local storage provider
	const wsProvider = new WebsocketProvider(websocket, 'prsm' + room, doc)
	wsProvider.on('sync', () => {
		console.log(exactTime() + ' remote content loaded')
		display('white')
	})
	wsProvider.on('status', (event) => {
		console.log(exactTime() + event.status + (event.status == 'connected' ? ' to' : ' from') + ' room ' + room) // logs when websocket is "connected" or "disconnected"
	})

	yNodesMap = doc.getMap('nodes')
	yEdgesMap = doc.getMap('edges')
	yNetMap = doc.getMap('network')
	ySamplesMap = doc.getMap('samples')

	clientID = doc.clientID
	console.log('My client ID: ' + clientID)

	/* 
	for convenience when debugging
	 */
	window.debug = debug
	window.clientID = clientID
	window.yNodesMap = yNodesMap
	window.yEdgesMap = yEdgesMap
	window.yNetMap = yNetMap
	window.ySamplesMap = ySamplesMap

	// we only read changes made by other clients; this client never writes anything to the shared document
	yNodesMap.observe(() => {
		if (graph) {
			graph.graphData(convertData())
		}
	})
	yEdgesMap.observe(() => {
		if (graph) {
			graph.graphData(convertData())
		}
	})
	ySamplesMap.observe((event) => {
		yjsTrace('ySamplesMap.observe', event)
		legend()
	})
	yNetMap.observe((event) => {
		yjsTrace('YNetMap.observe', event.transaction.local, event)
		for (let key of event.keysChanged) {
			let obj = yNetMap.get(key)
			switch (key) {
				case 'mapTitle':
				case 'maptitle': {
					let title = obj
					let div = elem('maptitle')
					if (title == 'Untitled map') {
						div.classList.add('unsetmaptitle')
					} else {
						div.classList.remove('unsetmaptitle')
						document.title = `${title}: ${shortAppName} 3D View`
					}
					if (title !== div.innerText) div.innerText = title
					break
				}
				default:
					break
			}
		}
	})
	myNameRec = JSON.parse(localStorage.getItem('myName'))
	myNameRec.id = clientID
	console.log('My name: ' + myNameRec.name)
} // end startY()

function yjsTrace(where, source, what) {
	if (window.debug.includes('yjs')) {
		console.log(exactTime(), source ? 'local' : 'non-local', where, what)
	}
}
function exactTime() {
	let d = new Date()
	return `${d.toLocaleTimeString()}:${d.getMilliseconds()} `
}
function cancelLoading() {
	elem('loading').style.display = 'none'
	clearTimeout(loadingDelayTimer)
}

/**
 * Convert a node from the normal PRSM format to the one required by the 3d display
 * @param {Object} node
 * @returns Object
 */
function convertNode(node) {
	return {id: node.id, label: node.label, color: node.color.background, fontColor: node.font.color, val: 5}
}
/**
 * Convert an edge from the normal PRSM format to the one required by the 3d display
 * @param {object} edge
 * @returns object
 */
function convertEdge(edge) {
	return {
		source: edge.from,
		target: edge.to,
		// black links are invisible on a black background, so change them to grey,
		// so that they are visible on either white or black backgrounds
		color: standardize_color(edge.color.color) === '#000000' ? 'lightgrey' : edge.color.color,
	}
}
/**
 * Convert the map data from PRSM format to 3d display format
 * Avoid cluster nodes
 * Add lists of links and neighbours to each node
 * @return {object} {nodes; links}
 */
function convertData() {
	let graphNodes = Array.from(yNodesMap.values())
		.filter((n) => !n.isCluster)
		.map((n) => {
			return convertNode(n)
		})
	let graphEdges = Array.from(yEdgesMap.values()).map((e) => {
		return convertEdge(e)
	})
	// note neighbouring nodes and links to those for each node
	// (used for highlighting links when hovering over nodes)
	graphEdges.forEach((link) => {
		const a = graphNodes.find((n) => n.id === link.source)
		const b = graphNodes.find((n) => n.id === link.target)
		!a.neighbors && (a.neighbors = [])
		!b.neighbors && (b.neighbors = [])
		a.neighbors.push(b)
		b.neighbors.push(a)
		!a.links && (a.links = [])
		!b.links && (b.links = [])
		a.links.push(link)
		b.links.push(link)
	})
	return {nodes: graphNodes, links: graphEdges}
}

/**
 * Display the map as a 3D network
 * @param {string} backColor - background color: white or black
 */
function display() {
	cancelLoading()
	let threeDGraphDiv = elem('3dgraph')
	let width = threeDGraphDiv.clientWidth
	let height = threeDGraphDiv.clientHeight
	const highlightNodes = new Set()
	const highlightLinks = new Set()
	let hoverNode = null
	let backColor = elem('mode').value === 'light' ? 'white' : 'black'
	elem('info').style.color = elem('mode').value === 'light' ? 'black' : 'white'

	graph = ForceGraph3D()(threeDGraphDiv)
		//		.cooldownTicks(0)
		.width(width)
		.height(height)
		.graphData(convertData())
		.showNavInfo(false)
		.linkWidth((link) => (highlightLinks.has(link) ? 1 : 0))
		.linkDirectionalArrowLength(2)
		.linkDirectionalArrowRelPos(1)
		.backgroundColor(backColor)
		.nodeOpacity(1.0)
		.linkOpacity(0.7)
		.linkDirectionalParticles(5)
		.nodeThreeObjectExtend(false)
		.nodeThreeObject((node) => {
			// extend node with text sprite
			const sprite = new SpriteText(`${node.label}`)
			sprite.color = node.fontColor
			sprite.textHeight = 3
			sprite.padding = 1
			sprite.backgroundColor = node.color
			sprite.borderWidth = 1
			sprite.borderRadius = 4
			return sprite
		})
		.onNodeDragEnd((node) => {
			if (node.fx) {
				// unfix fixed node
				node.fx = null
				node.fy = null
				node.fz = null
			} else {
				// fix nodes if they have been dragged
				node.fx = node.x
				node.fy = node.y
				node.fz = node.z
			}
		})
		.onNodeHover(doHover)
		.onNodeClick((node) => {
			// Aim at node from outside it
			const distance = 80
			const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)
			graph.cameraPosition(
				{x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio}, // new position
				node, // lookAt ({ x, y, z })
				3000, // ms transition duration
			)
		})
	axes()
	legend()
	/**
	 * Highlight those links (i.e. makes them thicker) that connect to the node being hovered over
	 * @param {object} node
	 */
	function doHover(node) {
		// no state change
		if ((!node && !highlightNodes.size) || (node && hoverNode === node)) return

		highlightNodes.clear()
		highlightLinks.clear()
		if (node) {
			highlightNodes.add(node)
			if (node.neighbors) node.neighbors.forEach((neighbor) => highlightNodes.add(neighbor))
			if (node.links) node.links.forEach((link) => highlightLinks.add(link))
		}
		hoverNode = node || null

		// trigger update of highlighted objects in scene
		graph
			.nodeColor(graph.nodeColor())
			.linkWidth(graph.linkWidth())
			.linkDirectionalParticles(graph.linkDirectionalParticles())
	}
	// fit graph to window on double click
	listen('3dgraph', 'dblclick', () => {
		let width = threeDGraphDiv.clientWidth
		let height = threeDGraphDiv.clientHeight
		graph.width(width).height(height).zoomToFit(200, 0)
	})
	// change background colour using select menu in nav bar
	listen('mode', 'change', (e) => {
		if (e.target.value === 'dark') {
			graph.backgroundColor('black')
			elem('info').style.color = 'white'
		} else {
			graph.backgroundColor('white')
			elem('info').style.color = 'black'
		}
	})
	var timeout = false // debounce timer
	var delay = 250 // delay after event is "complete" to run callback
	window.addEventListener('resize', () => {
		clearTimeout(timeout)
		timeout = setTimeout(() => {
			setvh()
			let backColor = elem('mode').value === 'light' ? 'white' : 'black'
			elem('info').style.color = elem('mode').value === 'light' ? 'black' : 'white'
			let width = window.innerWidth
			let height = window.innerHeight - elem('navbar').clientHeight
			graph.width(width).height(height).backgroundColor(backColor)
		}, delay)
	})
	window.addEventListener('orientationchange', () => setvh())

	/**
	 * to handle iOS weirdness in fixing the vh unit (see https://css-tricks.com/the-trick-to-viewport-units-on-mobile/)
	 */
	function setvh() {
		document.body.height = window.innerHeight
		// First we get the viewport height and we multiple it by 1% to get a value for a vh unit
		let vh = window.innerHeight * 0.01
		// Then we set the value in the --vh custom property to the root of the document
		document.documentElement.style.setProperty('--vh', `${vh}px`)
	}
	/**
	 * draw axes across scene
	 */
	function axes() {
		graph
			.scene()
			.add(
				new THREE.Line(
					new THREE.BufferGeometry().setFromPoints([
						new THREE.Vector3(0, 0, -1000),
						new THREE.Vector3(0, 0, 1000),
					]),
					new THREE.LineBasicMaterial({color: 'blue'}),
				),
			)
			.add(
				new THREE.Line(
					new THREE.BufferGeometry().setFromPoints([
						new THREE.Vector3(-1000, 0, 0),
						new THREE.Vector3(1000, 0, 0),
					]),
					new THREE.LineBasicMaterial({color: 'red'}),
				),
			)
			.add(
				new THREE.Line(
					new THREE.BufferGeometry().setFromPoints([
						new THREE.Vector3(0, -1000, 0),
						new THREE.Vector3(0, 1000, 0),
					]),
					new THREE.LineBasicMaterial({color: 'green'}),
				),
			)
	}
}

/**
 * Draw the legend floating above the 3d display
 */
var legendData = {nodes: new DataSet(), edges: new DataSet()}
var legendNetwork = null
const LEGENDSPACING = 60
const HALFLEGENDWIDTH = 60
function legend() {
	let nodes = Array.from(ySamplesMap)
		.filter((a) => a[1].node)
		.map((a) => a[1].node.groupLabel)
		.filter((a) => a !== 'Sample')
	let edges = Array.from(ySamplesMap)
		.filter((a) => a[1].edge)
		.map((a) => a[1].edge.groupLabel)
		.filter((a) => a !== 'Sample')
	let nItems = nodes.length + edges.length
	if (nItems == 0) return
	let legendBox = document.createElement('div')
	legendBox.className = 'legend'
	legendBox.id = 'legendBox'
	elem('3dgraph').appendChild(legendBox)
	let title = document.createElement('p')
	title.id = 'Legend'
	title.className = 'legendTitle'
	title.appendChild(document.createTextNode('Legend'))
	legendBox.appendChild(title)
	let boxheight = LEGENDSPACING * nItems + title.offsetHeight
	let threeDGraphDiv = elem('3dgraph')
	legendBox.style.height =
		(boxheight < threeDGraphDiv.clientHeight - 100 ? boxheight : threeDGraphDiv.clientHeight - 100) + 'px'
	legendBox.style.width = HALFLEGENDWIDTH * 2 + 'px'
	let canvas = document.createElement('div')
	canvas.className = 'legendCanvas'
	canvas.style.height = LEGENDSPACING * nItems + 'px'
	legendBox.appendChild(canvas)

	legendNetwork = new Network(canvas, legendData, {
		physics: {enabled: false},
		interaction: {zoomView: false, dragView: false},
	})
	let height = legendNetwork.DOMtoCanvas({x: 0, y: 0}).y
	for (let i = 0; i < nodes.length; i++) {
		let node = deepMerge(
			Array.from(ySamplesMap)
				.filter((a) => a[1].node)
				.find((a) => a[1].node.groupLabel == nodes[i])[1].node,
		)
		node.id = i + 10000
		node.label = node.groupLabel
		node.fixed = true
		node.chosen = false
		node.margin = 10
		node.x = 0
		node.y = 0
		node.widthConstraint = 40
		node.heightConstraint = 40
		node.font.size = 10
		legendData.nodes.update(node)
		let bbox = legendNetwork.getBoundingBox(node.id)
		node.y = (bbox.bottom - bbox.top) / 2 + height
		height += bbox.bottom - bbox.top
		legendData.nodes.update(node)
	}
	height += 50
	for (let i = 0; i < edges.length; i++) {
		let edge = deepMerge(
			Array.from(ySamplesMap)
				.filter((a) => a[1].edge)
				.find((a) => a[1].edge.groupLabel == edges[i])[1].edge,
		)
		edge.label = edge.groupLabel
		edge.id = i + 10000
		edge.from = i + 20000
		edge.to = i + 30000
		edge.smooth = {type: 'straightCross'}
		edge.font = {size: 12, color: 'black', align: 'top', vadjust: -10}
		edge.widthConstraint = 80
		edge.chosen = false
		let nodes = [
			{
				id: edge.from,
				size: 5,
				shape: 'dot',
				x: -25,
				y: height,
				fixed: true,
				chosen: false,
			},
			{
				id: edge.to,
				shape: 'dot',
				size: 5,
				x: +25,
				y: height,
				fixed: true,
				chosen: false,
			},
		]
		legendData.nodes.update(nodes)
		legendData.edges.update(edge)
		height += 50
	}
	legendNetwork.fit({})
}
