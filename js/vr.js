/**
 *
 * PRSM VR map view
 * generates a 'three dimensional' view of a PRSM map for VR, build on threejs and A-FRAME
 *
 *
 * */

import * as Y from 'yjs'
import {WebsocketProvider} from 'y-websocket'
import {object_equals, standardize_color, timeAndDate} from './utils.js'
import Quill from 'quill'
import {QuillDeltaToHtmlConverter} from 'quill-delta-to-html'

var room
const doc = new Y.Doc()
var websocket = 'wss://www.prsm.uk/wss' // web socket server URL
var clientID // unique ID for this browser
var yNodesMap // shared map of nodes
var yEdgesMap // shared map of edges

window.addEventListener('load', () => {
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
	document.title = document.title + ' ' + room
	// don't bother with a local storage provider
	const wsProvider = new WebsocketProvider(websocket, 'prsm' + room, doc)
	wsProvider.on('sync', () => {
		console.log(exactTime() + ' remote content loaded')
	})
	wsProvider.on('status', (event) => {
		console.log(exactTime() + event.status + (event.status == 'connected' ? ' to' : ' from') + ' room ' + room) // logs when websocket is "connected" or "disconnected"
	})

	yNodesMap = doc.getMap('nodes')
	yEdgesMap = doc.getMap('edges')

	clientID = doc.clientID
	console.log('My client ID: ' + clientID)

	/* 
	for convenience when debugging
	 */
	window.clientID = clientID
	window.yNodesMap = yNodesMap
	window.yEdgesMap = yEdgesMap

	// we only read changes made by other clients; this client never writes anything to the shared document
	yNodesMap.observe(() => {
		showForceGraph()
	})
	yEdgesMap.observe(() => {
		showForceGraph()
	})
} // end startY()

function exactTime() {
	let d = new Date()
	return `${d.toLocaleTimeString()}:${d.getMilliseconds()} `
}
/* set up a div to aid conversion of notes from Quill to HTML */
let dummyDiv = document.createElement('div')
dummyDiv.id = 'dummy-div'
dummyDiv.style.display = 'none'
document.querySelector('body').appendChild(dummyDiv)
let qed = new Quill('#dummy-div')
/**
 * Convert a node from the normal PRSM format to the one required by the 3d display
 * @param {Object} node
 * @returns Object
 */
function convertNode(node) {
	let note = ''
	if (node.created || node.modified || node.note) {
		note = '<div style="padding: 12px; border-radius: 4px; border: 2px grey solid; background-color: white">'
		if (node.created) note += `<p>Created at ${timeAndDate(node.created.time, true)} by ${node.created.user}</p>`
		if (node.modified)
			note += `<p>Modified at ${timeAndDate(node.modified.time, true)} by ${node.modified.user}</p>`
		if (node.note) {
			qed.setContents(node.note)
			// convert Quill formatted note to HTML, escaping all "
			note += new QuillDeltaToHtmlConverter(qed.getContents().ops, {
				inlineStyles: true,
			})
				.convert()
				.replaceAll('"', '""')
		}
		note += '</div>'
	}
	return {
		id: node.id,
		label: node.label,
		color: node.color.background,
		fontColor: node.font.color,
		val: 5,
		note: note,
	}
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
	return {nodes: graphNodes, links: graphEdges}
}
var previousData

function showForceGraph() {
	let graphData = convertData()
	if (object_equals(previousData, graphData)) return
	previousData = graphData
	const fgEl = document.getElementById('fg')
	fgEl.replaceChildren()
	fgEl.setAttribute('forcegraph', {
		nodes: JSON.stringify(graphData.nodes),
		links: JSON.stringify(graphData.links),
		nodeResolution: 32,
		nodeRelSize: 6,
		nodeOpacity: 1.0,
		linkWidth: 0,
		linkOpacity: 1.0,
		linkDirectionalArrowLength: 1.5,
		linkDirectionalArrowRelPos: 1,
		onEngineStop: console.log('Engine stopped'),
		onEngineTick: console.log('tick')
	})
	// draw a sphere entity around each node
	fgEl.setAttribute('spherize', {})
}
