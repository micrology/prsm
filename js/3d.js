import * as Y from 'yjs'
import {WebsocketProvider} from 'y-websocket'
import {Network} from 'vis-network/peer/'
import {DataSet} from 'vis-data/peer'
import {elem, deepMerge, standardize_color} from './utils.js'
import {version} from '../package.json'
import ForceGraphVR from '3d-force-graph-vr'
import ForceGraph3D from '3d-force-graph'

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
var graphNodes
var graphEdges
var VR = false // use VR mode

window.addEventListener('load', () => {
	loadingDelayTimer = setTimeout(() => {
		elem('loading').style.display = 'block'
	}, 100)
	elem('version').innerHTML = version
	let searchParams = new URL(document.location).searchParams
	if (searchParams.has('debug')) debug = searchParams.get('debug')
	// use VR version if specified in query string of URL, as "&mode='VR'""
	VR = searchParams.has('mode') && (searchParams.get('mode').toUpperCase()  == 'VR')
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
	const wsProvider = new WebsocketProvider(websocket, 'prsm' + room, doc)
	wsProvider.on('sync', () => {
		console.log(exactTime() + ' remote content loaded')
		display()
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

	yNodesMap.observe(() => {
		if (graph) {
			convertData()
			graph.graphData({nodes: graphNodes, links: graphEdges})
		}
	})
	yEdgesMap.observe(() => {
		if (graph) {
			convertData()
			graph.graphData({nodes: graphNodes, links: graphEdges})
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
	return {id: node.id, name: node.label, color: node.color.background, val: 5 * Math.log(2 + node.bc)}
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
		color: standardize_color(edge.color.color) === '#000000' ? 'white' : edge.color.color,
	}
}
/**
 * Convert the map data fromPRSM format to 3d display format
 * Avoid cluster nodes
 */
function convertData() {
	graphNodes = Array.from(yNodesMap.values())
		.filter((n) => !n.isCluster)
		.map((n) => {
			return convertNode(n)
		})
	graphEdges = Array.from(yEdgesMap.values()).map((e) => {
		return convertEdge(e)
	})
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
	let legendBox = document.createElement('div')
	legendBox.className = 'legend'
	legendBox.id = 'legendBox'
	elem('3dgraph').appendChild(legendBox)
	let title = document.createElement('p')
	title.id = 'Legend'
	title.className = 'legendTitle'
	title.appendChild(document.createTextNode('Legend'))
	legendBox.appendChild(title)
	legendBox.style.height = LEGENDSPACING * nItems + title.offsetHeight + 'px'
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
				.find((a) => a[1].node.groupLabel == nodes[i])[1].node
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
				.find((a) => a[1].edge.groupLabel == edges[i])[1].edge
		)
		edge.label = edge.groupLabel
		edge.id = i + 10000
		edge.from = i + 20000
		edge.to = i + 30000
		edge.smooth = 'horizontal'
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

/**
 * Display the map as a 3D network
 */
function display() {
	convertData()
	cancelLoading()
	let threeDGraphDiv = elem('3dgraph')
	let width = threeDGraphDiv.clientWidth
	let height = threeDGraphDiv.clientHeight
	graph = (VR ? ForceGraphVR() : ForceGraph3D()) (threeDGraphDiv)
		.width(width)
		.height(height)
		.graphData({nodes: graphNodes, links: graphEdges})
		.linkWidth(1)
		.linkDirectionalArrowLength(4)
		.linkDirectionalArrowRelPos(1.0)
		.backgroundColor('black')
		.nodeOpacity(1.0)
		.linkDirectionalParticles(10)
	legend()
}
