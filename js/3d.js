import * as Y from 'yjs'
import {WebsocketProvider} from 'y-websocket'
import {elem, standardize_color} from './utils.js'
import {version} from '../package.json'
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
var myNameRec // my name etc.
var loadingDelayTimer // timer to delay the start of the loading animation for few moments

window.addEventListener('load', () => {
	loadingDelayTimer = setTimeout(() => {
		elem('loading').style.display = 'block'
	}, 100)
	elem('version').innerHTML = version
	startY()
})

/**
 * add event listeners
 */

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

function convertNode(node) {
	return {id: node.id, name: node.label, color: node.color.background}
}

function convertEdge(edge) {
	return {source: edge.from, target: edge.to, color: (standardize_color(edge.color.color) === '#000000'? 'white': edge.color.color)}
}

function display() {
	let nodes = Array.from(yNodesMap.values())
		.filter((n) => !n.isCluster)
		.map((n) => {
			return convertNode(n)
		})
	console.log(nodes)
	let edges = Array.from(yEdgesMap.values()).map((e) => {
		return convertEdge(e)
	})
	console.log(edges)
	cancelLoading()
	ForceGraph3D()(elem('3d-graph'))
		.graphData({nodes: nodes, links: edges})
		.linkWidth(1)
        .linkDirectionalArrowLength(4)
        .linkDirectionalArrowRelPos(1.0)
        .backgroundColor('black')
    .linkDirectionalParticles(10)
}
