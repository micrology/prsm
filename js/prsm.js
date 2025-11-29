/********************************************************************************************* 

PRSM Participatory System Mapper 

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk

This software is licenced under the PolyForm Noncommercial License 1.0.0

<https://polyformproject.org/licenses/noncommercial/1.0.0>

See the file LICENSE.md for details.


This is the main entry point for PRSM.  
********************************************************************************************/

import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { Network } from 'vis-network/peer'
import { DataSet } from 'vis-data/peer'
import diff from 'microdiff'
import localForage from 'localforage'
import {
	listen,
	elem,
	getScaleFreeNetwork,
	uuidv4,
	isEmpty,
	deepMerge,
	deepCopy,
	splitText,
	dragElement,
	standardize_color,
	setNodeHidden,
	setEdgeHidden,
	factorSizeToPercent,
	setFactorSizeFromPercent,
	convertDashes,
	getDashes,
	object_equals,
	generateName,
	statusMsg,
	alertMsg,
	cancelAlertMsg,
	clearStatusBar,
	shorten,
	initials,
	CP,
	timeAndDate,
	setEndOfContenteditable,
	exactTime,
	humanSize,
	isQuillEmpty,
	displayHelp,
} from './utils.js'
import {
	openFile,
	savePRSMfile,
	exportPNGfile,
	setFileName,
	exportExcel,
	exportDOT,
	exportGML,
	exportGraphML,
	exportGEXF,
	exportNotes,
	readSingleFile,
} from './files.js'
import Tutorial from './tutorial.js'
import { styles } from './samples.js'
import { trophic } from './trophic.js'
import { cluster, openCluster } from './cluster.js'
import { mergeRoom, diffRoom } from './merge.js'
import Quill from 'quill'
import {
	setUpSamples,
	reApplySampleToNodes,
	refreshSampleNode,
	reApplySampleToLinks,
	refreshSampleLink,
	legend,
	clearLegend,
} from './styles.js'
import {
	canvas,
	nChanges,
	setUpBackground,
	updateFromRemote,
	redraw,
	resizeCanvas,
	zoomCanvas,
	panCanvas,
	deselectTool,
	copyBackgroundToClipboard,
	pasteBackgroundFromClipboard,
	upgradeFromV1,
	updateFromDrawingMap,
} from './background.js'
import { getAIresponse } from './ai.js'
import { version } from '../package.json'
import { compressToUTF16, decompressFromUTF16 } from 'lz-string'

const appName = 'Participatory System Mapper'
const shortAppName = 'PRSM'
const GRIDSPACING = 50 // for snap to grid
const NODEWIDTH = 10 // chars for label splitting
const TIMETOSLEEP = 15 * 60 * 1000 // if no mouse movement for this time, user is assumed to have left or is sleeping
const TIMETOEDIT = 5 * 60 * 1000 // if node/edge edit dialog is not saved after this time, the edit is cancelled
const magnification = 3 // magnification of the loupe (magnifier 'glass')
export const NLEVELS = 20 // max. number of levels for trophic layout
const ROLLBACKS = 10 // max. number of versions stored for rollback

export var network
export var room
/* debug options (add to the URL thus: &debug=yjs,gui)
 * yjs - display yjs observe events on console
 * changes - show details of changes to yjs types
 * trans - all transactions
 * gui - show all mouse events
 * plain - save PRSM file as plain text, not compressed
 * cluster - show creation of clusters
 * aware - show awareness traffic
 * round - round trip timing
 * back - drawing on background
 */
export var debug = ''
var viewOnly // when true, user can only view, not modify, the network
var showCopyMapButton = false // show the Copy Map button on the navbar in viewOnly mode
var nodes // a dataset of nodes
var edges // a dataset of edges
export var data // an object with the nodes and edges datasets as properties
export const doc = new Y.Doc()
export var websocket = 'wss://www.prsm.uk/wss' // web socket server URL
var wsProvider // web socket provider
export var clientID // unique ID for this browser
var yNodesMap // shared map of nodes
var yEdgesMap // shared map of edges
export var ySamplesMap // shared map of styles
export var yNetMap // shared map of global network settings
export var yPointsArray // shared array of the background drawing commands
export var yDrawingMap // shared map of background objects
export var yUndoManager // shared list of commands for undo
var dontUndo // when non-null, don't add an item to the undo stack
var yAwareness // awareness channel
export var yHistory // log of actions
export var container //the DOM body element
export var netPane // the DOM pane showing the network
var panel // the DOM right side panel element
var myNameRec // the user's name record {actual name, type, etc.}
export var lastNodeSample = 'group0' // the last used node style
export var lastLinkSample = 'edge0' // the last used edge style
/** @type {(string|boolean)} */
var inAddMode = false // true when adding a new Factor to the network; used to choose cursor pointer
var inEditMode = false //true when node or edge is being edited (dialog is open)
var snapToGridToggle = false // true when snapping nodes to the (unseen) grid
export var drawingSwitch = false // true when the drawing layer is uppermost
var showNotesToggle = true // show notes when factors and links are selected
var showVotingToggle = false // whether to show the voting thumb up/down buttons under factors
// if set, there are  nodes that need to be hidden when the map is drawn for the first time
var hiddenNodes = {
	radiusSetting: null,
	streamSetting: null,
	pathsSetting: null,
	selected: [],
}
var tutorial = new Tutorial() // object driving the tutorial
export var cp = new CP()
// color picker
var checkMapSaved = false // if the map is new (no 'room' in URL), or has been imported from a file, and changes have been made, warn user before quitting
var dirty = false // map has been changed by user and may need saving
var followme // clientId of user's cursor to follow
var editor = null // Quill editor
var popupWindow = null // window for editing Notes
var popupEditor = null // Quill editor in popup window
var sideDrawEditor = null // Quill editor in side drawer
var loadingDelayTimer // timer to delay the start of the loading animation for few moments
var netLoaded = false // becomes true when map is fully displayed
var savedState = '' // the current state of the map (nodes, edges, network settings) before current user action
var unknownRoomTimeout = null // timer to check if the room exists
var setupStartTime = Date.now() // time when setup started
/**
 * top level function to initialise everything
 */
window.addEventListener('load', () => {
	loadingDelayTimer = setTimeout(() => {
		elem('loading').style.display = 'block'
	}, 200)
	addEventListeners()
	setUpPage()
	setUpBackground()
	startY()
	setUpUserName()
	setUpAwareness()
	setUpShareDialog()
	draw()
})
/**
 * Clean up before user departs
 */

window.onbeforeunload = function (event) {
	unlockAll()
	yAwareness.setLocalStateField('addingFactor', { state: 'done' })
	yAwareness.setLocalState(null)
	// get confirmation from user before exiting if there are unsaved changes
	if (checkMapSaved && dirty) {
		event.preventDefault()
		event.returnValue = 'You have unsaved unchanges.  Are you sure you want to leave?'
	}
}

/**
 * Set up all the permanent event listeners
 */
function addEventListeners() {
	listen('maptitle', 'keydown', (e) => {
		//disallow Enter key
		if (e.key === 'Enter') {
			e.preventDefault()
		}
	})
	listen('net-pane', 'keydown', (e) => {
		if (e.which === 8 || e.which === 46) deleteNode()
	})
	listen('recent-rooms-caret', 'click', createTitleDropDown)
	listen('maptitle', 'keydown', (e) => {
		if (e.target.innerText === 'Untitled map') window.getSelection().selectAllChildren(e.target)
	})
	listen('maptitle', 'keyup', mapTitle)
	listen('maptitle', 'paste', pasteMapTitle)
	listen('maptitle', 'click', (e) => {
		if (e.target.innerText === 'Untitled map') window.getSelection().selectAllChildren(e.target)
	})
	listen('body', 'keydown', (e) => {
		if (e.ctrlKey && e.key == "s" || e.metaKey && e.key == "s") {
			savePRSMfile()
			e.preventDefault()
		}
	})
	listen('body', 'keydown', (e) => {
		if (e.ctrlKey && e.key == "o" || e.metaKey && e.key == "o") {
			openFile()
			e.preventDefault()
		}
	})
	listen('body', 'keydown', (e) => {
		if (e.ctrlKey && e.key == "z" || e.metaKey && e.key == "z") {
			undo()
			e.preventDefault()
		}
	})
	listen('body', 'keydown', (e) => {
		if (e.ctrlKey && e.key == "y" || e.metaKey && e.key == "y") {
			redo()
			e.preventDefault()
		}
	})

	listen('addNode', 'click', plusNode)
	listen('net-pane', 'contextmenu', contextMenu)
	listen('net-pane', 'click', unFollow)
	listen('net-pane', 'click', removeTitleDropDown)
	listen('drawer-handle', 'click', () => {
		elem('drawer-wrapper').classList.toggle('hide-drawer')
	})
	listen('addLink', 'click', plusLink)
	listen('deleteNode', 'click', deleteNode)
	listen('undo', 'click', undo)
	listen('redo', 'click', redo)
	listen('fileInput', 'change', readSingleFile)
	listen('openFile', 'click', openFile)
	listen('replaceMap', 'click', openFile)
	listen('mergeMap', 'click', mergeMap)
	listen('merge', 'click', doMerge)
	listen('mergeClose', 'click', () => elem('mergeDialog').close())
	listen('saveFile', 'click', savePRSMfile)
	listen('exportPRSM', 'click', savePRSMfile)
	listen('exportImage', 'click', exportPNGfile)
	listen('exportExcel', 'click', exportExcel)
	listen('exportGML', 'click', exportGML)
	listen('exportDOT', 'click', exportDOT)
	listen('exportGraphML', 'click', exportGraphML)
	listen('exportGEXF', 'click', exportGEXF)
	listen('exportNotes', 'click', exportNotes)
	listen('copy-map', 'click', () => doClone(false))
	listen('search', 'click', search)
	listen('help', 'click', displayHelp)
	listen('panelToggle', 'click', togglePanel)
	listen('zoom', 'change', zoomnet)
	listen('navbar', 'dblclick', fit)
	listen('zoomminus', 'click', () => {
		zoomincr(-0.1)
	})
	listen('zoomplus', 'click', () => {
		zoomincr(0.1)
	})
	listen('nodesButton', 'click', () => {
		openTab('nodesTab')
	})
	listen('linksButton', 'click', () => {
		openTab('linksTab')
	})
	listen('networkButton', 'click', () => {
		openTab('networkTab')
	})
	listen('analysisButton', 'click', () => {
		openTab('analysisTab')
	})
	listen('layoutSelect', 'change', autoLayout)
	listen('snaptogridswitch', 'click', snapToGridSwitch)
	listen('curveSelect', 'change', selectCurve)
	listen('drawing', 'click', toggleDrawingLayer)
	listen('allFactors', 'click', selectAllFactors)
	listen('allLinks', 'click', selectAllLinks)
	listen('showLegendSwitch', 'click', legendSwitch)
	listen('showVotingSwitch', 'click', votingSwitch)
	listen('showUsersSwitch', 'click', showUsersSwitch)
	listen('showHistorySwitch', 'click', showHistorySwitch)
	listen('showNotesSwitch', 'click', showNotesSwitch)
	listen('clustering', 'change', selectClustering)
	listen('lock', 'click', setFixed)
	listen('newNodeWindow', 'click', openNotesWindow)
	listen('newEdgeWindow', 'click', openNotesWindow)
	listen('sparklesNode', 'click', genAINode)
	listen('sparklesEdge', 'click', genAIEdge)
	listen('sparklesSideNote', 'click', genAISideNote)


	Array.from(document.getElementsByName('radius')).forEach((elem) => {
		elem.addEventListener('change', analyse)
	})
	Array.from(document.getElementsByName('stream')).forEach((elem) => {
		elem.addEventListener('change', analyse)
	})
	Array.from(document.getElementsByName('paths')).forEach((elem) => {
		elem.addEventListener('change', analyse)
	})
	listen('sizing', 'change', sizingSwitch)
	Array.from(document.getElementsByClassName('sampleNode')).forEach((elem) =>
		elem.addEventListener('click', (event) => {
			applySampleToNode(event)
		}),
	)
	Array.from(document.getElementsByClassName('sampleLink')).forEach((elem) =>
		elem.addEventListener('click', (event) => {
			applySampleToLink(event)
		}),
	)
	listen('nodeStyleEditFactorSize', 'input', (event) => progressBar(event.target))

	listen('history-copy', 'click', copyHistoryToClipboard)

	listen('body', 'copy', copyToClipboard)
	listen('body', 'paste', pasteFromClipboard)
	// change pointer when entering drag handles
	Array.from(document.getElementsByClassName('drag-handle')).forEach((el) => {
		el.addEventListener('pointerenter', () => (el.style.cursor = 'move'))
		el.addEventListener('pointerout', () => (el.style.cursor = 'auto'))
	})
	// if user has changed to this  tab, ensure that the network has been drawn
	document.addEventListener('visibilitychange', () => {
		network.redraw()
	})
}

/**
 * create all the DOM elements on the web page
 */
function setUpPage() {
	elem('version').innerHTML = version
	container = elem('container')
	netPane = elem('net-pane')
	panel = elem('panel')
	// check debug options set on URL: ?debug=yjs|gui|cluster|viewing|start|copyButton
	// each of these generates trace output on the console
	let searchParams = new URL(document.location).searchParams
	if (searchParams.has('debug')) debug = searchParams.get('debug')
	// don't allow user to change anything if URL includes ?viewing
	// this is now obsolete, but retained for backwards compatibility
	viewOnly = searchParams.has('viewing')
	if (viewOnly) hideNavButtons()
	if (searchParams.has('copyButton')) showCopyMapButton = true
	// treat user as first time user if URL includes ?start=true
	if (searchParams.has('start')) localStorage.setItem('doneIntro', 'false')
	panel.classList.add('hide')
	container.panelHidden = true
	cp.createColorPicker('netBackColorWell', updateNetBack)
	setUpPinchZoom()
	setUpSamples()
	updateLastSamples(lastNodeSample, lastLinkSample)
	makeNotesPanelResizeable(elem('nodeNotePanel'))
	makeNotesPanelResizeable(elem('edgeNotePanel'))
	dragElement(elem('nodeNotePanel'), elem('nodeNoteHeader'))
	dragElement(elem('edgeNotePanel'), elem('edgeNoteHeader'))
	hideNotes()
	setUpSideDrawer()
	displayWhatsNew()
}
const sliderColor = getComputedStyle(document.documentElement).getPropertyValue('--slider')
/**
 * draw the solid bar to the left of the thumb on a slider
 * @param {HTMLElement} sliderEl input[type=range] element
 */
export function progressBar(sliderEl) {
	const sliderValue = sliderEl.value
	sliderEl.style.background = `linear-gradient(to right, ${sliderColor} ${sliderValue}%, #ccc ${sliderValue}%)`
}
/**
 * show the What's New modal dialog unless this is a new user or user has already seen this dialog
 * for this (Major.Minor) version
 */
function displayWhatsNew() {
	//new user - don't tell them what is new
	if (!localStorage.getItem('doneIntro')) return
	let versionDecoded = version.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/)
	let seen = localStorage.getItem('seenWN')
	if (seen) {
		let seenDecoded = seen.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/)
		// if this is a new minor version, show the What's New dialog
		if (seenDecoded && versionDecoded[1] === seenDecoded[1] && versionDecoded[2] === seenDecoded[2]) return
	}
	elem('whatsnewversion').innerHTML = `Version ${version}`
	elem('whatsnew').style.display = 'flex'
	elem('net-pane').addEventListener('click', hideWhatsNew, { once: true })
}
/**
 * hide the What's New dialog when the user has clicked Continue, and note tha the user has seen it
 */
function hideWhatsNew() {
	localStorage.setItem('seenWN', version)
	elem('whatsnew').style.display = 'none'
}
/**
 * create a new shared document and start the WebSocket provider
 */
function startY(newRoom) {
	let url = new URL(document.location)
	if (newRoom) room = newRoom
	else {
		// get the room number from the URL, or if none, generate a new one
		room = url.searchParams.get('room')
	}
	if (room == null || room === '') {
		room = generateRoom()
		checkMapSaved = true
	} else room = room.toUpperCase()
	// if debug flag includes 'local' or using a non-standard port (i.e neither 80 nor 443)
	// assume that the websocket port is 1234 in the same domain as the url
	if (/local/.test(debug) || (url.port && url.port !== 80 && url.port !== 443))
		websocket = `ws://${url.hostname}:1234`
	wsProvider = new WebsocketProvider(websocket, `prsm${room}`, doc)
	wsProvider.on('synced', () => {
		// if this is a clone, load the cloned data
		initiateClone()
		// (if the room already exists, wait until the map data is loaded before displaying it)
		if (url.searchParams.get('room') !== null) {
			observed('synced')
			if (/load/.test(debug)) console.log(`Nodes: ${yNodesMap.size} Edges: ${yEdgesMap.size} Samples: ${ySamplesMap.size} Network settings: ${yNetMap.size}	Points: ${yPointsArray.length} Drawing objects: ${yDrawingMap.size} History entries: ${yHistory.length}	`)
			unknownRoomTimeout = setTimeout(() => {
				if (!netLoaded) {
					displayNetPane(
						`${exactTime()} Timed out waiting for ${room} to load. Found only ${Array.from(foundMaps).join(", ")} maps.`,
					)
				}
			}, 6000)
		} else {
			// if this is a new map, display it
			displayNetPane(`${exactTime()} no remote content loaded from ${websocket}`)
		}
	})
	wsProvider.disconnectBc()
	wsProvider.on('status', (event) => {
		console.log(`${exactTime()}${event.status}${event.status === 'connected' ? ' to' : ' from'} room ${room} using ${websocket}`)
	})

	/* 
	create a yMap for the nodes and one for the edges (we need two because there is no 
	guarantee that the the ids of nodes will differ from the ids of edges) 
	 */
	yNodesMap = doc.getMap('nodes')
	yEdgesMap = doc.getMap('edges')
	ySamplesMap = doc.getMap('samples')
	yNetMap = doc.getMap('network')
	yPointsArray = doc.getArray('points')
	yDrawingMap = doc.getMap('drawing')
	yHistory = doc.getArray('history')
	yAwareness = wsProvider.awareness

	/* create a dummy item in yNodesMap and yEdgesMap to stop having to wait for the these maps 
	if there are no nodes or edges (thus allowing to distinguish between zero nodes/edges and 
	no node/edge map yet loaded) */
	yNodesMap.set('_dummy_', { dummy: true })
	yEdgesMap.set('_dummy_', { dummy: true })

	/* set up observers to listen for changes in the yMaps */

	doc.on('afterTransaction', () => {
		if (!netLoaded) { fit() }
	})
	if (/trans/.test(debug))
		doc.on('afterTransaction', (tr) => {
			console.log(`${exactTime()} transaction (${JSON.stringify(tr)})  (${tr.local ? 'local' : 'remote'})`)
			console.log('netLoaded', netLoaded)
			const nodesEvent = tr.changed.get(yNodesMap)
			if (nodesEvent) console.log(nodesEvent)
			const edgesEvent = tr.changed.get(yEdgesMap)
			if (edgesEvent) console.log(edgesEvent)
			const sampleEvent = tr.changed.get(ySamplesMap)
			if (sampleEvent) console.log(sampleEvent)
			const netEvent = tr.changed.get(yNetMap)
			if (netEvent) console.log(netEvent)
		})

	clientID = doc.clientID
	console.log(`My client ID: ${clientID}`)

	/* set up the undo managers */
	yUndoManager = new Y.UndoManager([yNodesMap, yEdgesMap, yNetMap], {
		trackedOrigins: new Set([null]), // add undo items to the stack by default
	})
	dontUndo = null

	nodes = new DataSet()
	edges = new DataSet()
	data = {
		nodes: nodes,
		edges: edges,
	}

	/* 
	for convenience when debugging
	 */
	window.debug = debug
	window.data = data
	window.clientID = clientID
	window.yNodesMap = yNodesMap
	window.yEdgesMap = yEdgesMap
	window.ySamplesMap = ySamplesMap
	window.yNetMap = yNetMap
	window.yUndoManager = yUndoManager
	window.yHistory = yHistory
	window.yPointsArray = yPointsArray
	window.yDrawingMap = yDrawingMap
	window.styles = styles
	window.yAwareness = yAwareness
	window.mergeRoom = mergeRoom
	window.diffRoom = diffRoom
	window.wsProvider = wsProvider

	let foundMaps = new Set()
	/**
	 * note that one of the required yMaps has been loaded; if all have been found, display the map
	 * @param {string} what name of the yMap that has just been loaded
	 */
	function observed(what) {
		// do nothing if the map is already displayed
		if (netLoaded) return
		if (/load/.test(debug)) {
			console.log(`${exactTime()} Observed: ${what}`)
		}
		foundMaps.add(what)
		if (foundMaps.has('nodes') && foundMaps.has('edges') && foundMaps.has('network') && foundMaps.has('synced')) {
			displayNetPane(`${exactTime()} all content loaded from ${websocket}`)
			if (/load/.test(debug)) console.log(`Nodes: ${yNodesMap.size} Edges: ${yEdgesMap.size} Samples: ${ySamplesMap.size} Network settings: ${yNetMap.size} Points: ${yPointsArray.length} Drawing objects: ${yDrawingMap.size} History entries: ${yHistory.length}	`)
		}
	}

	/* 
	nodes.on listens for when local nodes or edges are changed (added, updated or removed).
	If a local node is removed, the yMap is updated to broadcast to other clients that the node 
	has been deleted. If a local node is added or updated, that is also broadcast.
	 */
	nodes.on('*', (evt, properties, origin) => {
		yjsTrace('nodes.on', `${evt}  ${JSON.stringify(properties.items)} origin: ${origin} dontUndo: ${dontUndo}`)
		clearTimeout(unknownRoomTimeout)
		doc.transact(() => {
			properties.items.forEach((id) => {
				if (origin === null) {
					// this is a local change
					if (evt === 'remove') {
						yNodesMap.delete(id.toString())
					} else {
						yNodesMap.set(id.toString(), deepCopy(nodes.get(id)))
					}
				}
			})
		}, dontUndo)
		dontUndo = null
	})
	/* 
	yNodesMap.observe listens for changes in the yMap, receiving a set of the keys that have
	had changed values.  If the change was to delete an entry, the corresponding node and all links to/from it are
	removed from the local nodes dataSet. Otherwise, if the received node differs from the local one, 
	the local node dataSet is updated (which includes adding a new node if it does not already exist locally).
	 */
	yNodesMap.observe((evt) => {
		yjsTrace('yNodesMap.observe', evt)
		let nodesToUpdate = []
		let nodesToRemove = []
		for (let key of evt.keysChanged) {
			if (yNodesMap.has(key)) {
				let obj = yNodesMap.get(key)
				if (object_equals(obj, { dummy: true })) continue // skip dummy entry
				if (!object_equals(obj, data.nodes.get(key))) {
					// fix nodes if this is a view only copy
					if (viewOnly) obj.fixed = true
					nodesToUpdate.push(deepCopy(obj))
					// if a note on a node is being remotely edited and is on display here, update the local note and the padlock
					if (editor && editor.id === key && evt.transaction.local === false) {
						editor.setContents(obj.note)
						elem('fixed').style.display = obj.fixed ? 'inline' : 'none'
						elem('unfixed').style.display = obj.fixed ? 'none' : 'inline'
					}
				}
			} else {
				hideNotes()
				if (data.nodes.get(key)) network.getConnectedEdges(key).forEach((edge) => nodesToRemove.push(edge))
				nodesToRemove.push(key)
			}
		}
		if (nodesToUpdate.length > 0) nodes.update(nodesToUpdate, 'remote')
		if (nodesToRemove.length > 0) nodes.remove(nodesToRemove, 'remote')
		if (/changes/.test(debug) && (nodesToUpdate.length > 0 || nodesToRemove.length > 0)) showChange(evt, yNodesMap)
		observed('nodes')
	})
	/* 
	See comments above about nodes
	 */
	edges.on('*', (evt, properties, origin) => {
		yjsTrace('edges.on', `${evt}  ${JSON.stringify(properties.items)} origin: ${origin} dontUndo: ${dontUndo}`)
		doc.transact(() => {
			properties.items.forEach((id) => {
				if (origin === null) {
					if (evt === 'remove') yEdgesMap.delete(id.toString())
					else {
						yEdgesMap.set(id.toString(), deepCopy(edges.get(id)))
					}
				}
			})
		}, dontUndo)
		dontUndo = null
	})
	yEdgesMap.observe((evt) => {
		yjsTrace('yEdgesMap.observe', evt)
		let edgesToUpdate = []
		let edgesToRemove = []
		for (let key of evt.keysChanged) {
			if (yEdgesMap.has(key)) {
				let obj = yEdgesMap.get(key)
				if (object_equals(obj, { dummy: true })) continue // skip dummy entry
				if (!object_equals(obj, data.edges.get(key))) {
					edgesToUpdate.push(deepCopy(obj))
					if (editor && editor.id === key && evt.transaction.local === false) editor.setContents(obj.note)
				}
			} else {
				hideNotes()
				edgesToRemove.push(key)
			}
		}
		if (edgesToUpdate.length > 0) edges.update(edgesToUpdate, 'remote')
		if (edgesToRemove.length > 0) edges.remove(edgesToRemove, 'remote')
		if (edgesToUpdate.length > 0 || edgesToRemove.length > 0) {
			// if user is in mid-flight adding a Link, and someone else has just added a link,
			// vis-network will cancel the edit mode for this user.  Re-instate it.
			if (inAddMode === 'addLink') network.addEdgeMode()
		}
		if (/changes/.test(debug) && (edgesToUpdate.length > 0 || edgesToRemove.length > 0)) showChange(evt, yEdgesMap)
		observed('edges')
	})
	/**
	 * utility trace function that prints the change in the value of a YMap property to the console
	 * @param {YEvent} evt
	 * @param {MapType} ymap
	 */
	function showChange(evt, ymap) {
		evt.changes.keys.forEach((change, key) => {
			if (change.action === 'add') {
				console.log(
					`Property "${key}" was added. 
				Initial value: `,
					ymap.get(key),
				)
			} else if (change.action === 'update') {
				console.log(
					`Property "${key}" was updated. 
					New value: "`,
					ymap.get(key),
					`"
					Previous value: "`,
					change.oldValue,
					`" 
					Difference: "`,
					typeof change.oldValue === 'object' && typeof ymap.get(key) === 'object'
						? diff(change.oldValue, ymap.get(key))
						: `${change.oldValue} ${ymap.get(key)}`,
					`"`,
				)
			} else if (change.action === 'delete') {
				console.log(
					`Property "${key}" was deleted. 
				Previous value: `,
					change.oldValue,
				)
			}
		})
	}
	ySamplesMap.observe((evt) => {
		yjsTrace('ySamplesMap.observe', evt)
		let nodesToUpdate = []
		let edgesToUpdate = []
		for (let key of evt.keysChanged) {
			let sample = ySamplesMap.get(key)
			if (sample.node !== undefined) {
				if (!object_equals(styles.nodes[key], sample.node)) {
					styles.nodes[key] = sample.node
					refreshSampleNode(key)
					nodesToUpdate.push(key)
				}
			} else {
				if (!object_equals(styles.edges[key], sample.edge)) {
					styles.edges[key] = sample.edge
					refreshSampleLink(key)
					edgesToUpdate.push(key)
				}
			}
		}
		if (nodesToUpdate) {
			reApplySampleToNodes(nodesToUpdate)
		}
		if (edgesToUpdate) {
			reApplySampleToLinks(edgesToUpdate)
		}
		observed('samples')
	})
	/*
	Map controls (those on the Network tab) are of three kinds:
	1. Those that affect only the local map and are not promulgated to other users
	e.g zoom, show drawing layer, show history
	2. Those where the control status (e.g. whether a switch is on or off) is promulgated,
	but the effect of the switch is handled by yNodesMap and yEdgesMap (e.g. Show Factors
		x links away; Size Factors to)
	3. Those whose effects are promulgated and switches controlled here by yNetMap (e.g
		Background)
	For cases 2 and 3, the functions called here must not invoke yNetMap.set() to avoid loops
	*/
	yNetMap.observe((evt) => {
		yjsTrace('YNetMap.observe', evt)

		if (evt.transaction.origin)
			// evt is not local
			for (let key of evt.keysChanged) {
				let obj = yNetMap.get(key)
				switch (key) {
					case 'viewOnly': {
						viewOnly = viewOnly || obj
						if (viewOnly) {
							hideNavButtons()
							disableSideDrawerEditing()
						}
						break
					}
					case 'mapTitle':
					case 'maptitle': {
						setMapTitle(obj)
						break
					}
					case 'snapToGrid': {
						doSnapToGrid(obj)
						break
					}
					case 'curve': {
						setCurve(obj)
						break
					}
					case 'background': {
						setBackground(obj)
						break
					}
					case 'legend': {
						setLegend(obj, false)
						break
					}
					case 'voting': {
						setVoting(obj)
						break
					}
					case 'showNotes': {
						doShowNotes(obj)
						break
					}
					case 'radius': {
						hiddenNodes.radiusSetting = obj.radiusSetting
						hiddenNodes.selected = obj.selected
						setRadioVal('radius', hiddenNodes.radiusSetting)
						break
					}
					case 'stream': {
						hiddenNodes.streamSetting = obj.streamSetting
						hiddenNodes.selected = obj.selected
						setRadioVal('stream', hiddenNodes.streamSetting)
						break
					}
					case 'paths': {
						hiddenNodes.pathsSetting = obj.pathsSetting
						hiddenNodes.selected = obj.selected
						setRadioVal('paths', hiddenNodes.pathsSetting)
						break
					}
					case 'sizing': {
						sizing(obj)
						break
					}
					case 'hideAndStream':
					case 'linkRadius':
						// old settings (before v1.6) - ignore
						break
					case 'factorsHiddenByStyle': {
						updateFactorsOrLinksHiddenByStyle(obj)
						break
					}
					case 'linksHiddenByStyle': {
						updateFactorsOrLinksHiddenByStyle(obj)
						break
					}
					case 'attributeTitles': {
						recreateClusteringMenu(obj)
						break
					}
					case 'cluster': {
						setCluster(obj)
						break
					}
					case 'mapDescription': {
						setSideDrawer(obj)
						break
					}
					case 'lastLoaded':
					case 'version': {
						// ignore these  - for info only
						break
					}
					default:
						console.log('Bad key in yMapNet.observe: ', key)
				}
			}
		observed('network')
	})
	yPointsArray.observe((evt) => {
		yjsTrace('yPointsArray.observe', yPointsArray.get(yPointsArray.length - 1))
		if (evt.transaction.local === false) upgradeFromV1(yPointsArray.toArray())
	})
	yDrawingMap.observe((evt) => {
		yjsTrace('yDrawingMap.observe', evt)
		updateFromRemote(evt)
		observed('drawing')
	})
	yHistory.observe(() => {
		yjsTrace('yHistory.observe', yHistory.get(yHistory.length - 1))
		if (elem('showHistorySwitch').checked) showHistory()
		observed('history')
	})
	yUndoManager.on('stack-item-added', (evt) => {
		yjsTrace('yUndoManager.on stack-item-added', evt)
		if (/changes/.test(debug))
			evt.changedParentTypes.forEach((v) => {
				showChange(v[0], v[0].target)
			})
		undoRedoButtonStatus()
	})
	yUndoManager.on('stack-item-popped', (evt) => {
		yjsTrace('yUndoManager.on stack-item-popped', evt)
		if (/changes/.test(debug))
			evt.changedParentTypes.forEach((v) => {
				showChange(v[0], v[0].target)
			})
		pruneDanglingEdges()
		undoRedoButtonStatus()
	})
	/**
	 * In some slightly obscure circumstances, (specifically, client A undoes the creation of a factor that
	 * client B has subsequently linked to another factor), the undo operation can result in a link that
	 * has no source or destination factor.  Tracking such a situation is rather complex, so this cleans
	 * up the mess without bothering about its cause.
	 */
	function pruneDanglingEdges() {
		data.edges.forEach((edge) => {
			if (data.nodes.get(edge.from) === null) {
				dontUndo = 'danglingEdge'
				data.edges.remove(edge.id)
			}
			if (data.nodes.get(edge.to) == null) {
				dontUndo = 'danglingEdge'
				data.edges.remove(edge.id)
			}
		})
	}
} // end startY()

/**
 * load cloned data from localStorage
 * if there is no clone, returns without doing anything
 */
function initiateClone() {
	localForage
		.getItem('clone')
		.then((clone) => {
			localForage
				.removeItem('clone')
				.then(() => {
					// if there is no clone, clone will be null
					if (clone) {
						let state = JSON.parse(decompressFromUTF16(clone))
						data.nodes.update(state.nodes)
						data.edges.update(state.edges)
						doc.transact(() => {
							for (const k in state.net) {
								yNetMap.set(k, state.net[k])
							}
							viewOnly = state.options.viewOnly
							yNetMap.set('viewOnly', viewOnly)
							data.nodes.get().forEach((obj) => (obj.fixed = viewOnly))
							if (viewOnly) hideNavButtons()
							for (const k in state.samples) {
								ySamplesMap.set(k, state.samples[k])
							}
							if (state.paint) {
								yPointsArray.delete(0, yPointsArray.length)
								yPointsArray.insert(0, state.paint)
							}
							if (state.drawing) {
								for (const k in state.drawing) {
									yDrawingMap.set(k, state.drawing[k])
								}
								updateFromDrawingMap()
							}
							logHistory(state.options.created.action, state.options.created.actor)
						}, 'clone')
						unSelect()
						fit()
					}
				})
				.catch((err) => {
					console.log('Cant delete localForage clone key: ', err)
				})
		})
		.catch((err) => {
			console.log('Cant get localForage clone key: ', err)
		})
}
/**
 * Display observed yjs event
 * @param {string} where
 * @param {object} what
 */
function yjsTrace(where, what) {
	if (/yjs/.test(debug)) {
		console.log(exactTime(), where, what)
	}
}
/**
 * create a random string of the form AAA-BBB-CCC-DDD
 */
function generateRoom() {
	let room = ''
	for (let i = 0; i < 4; i++) {
		for (let j = 0; j < 3; j++) {
			room += String.fromCharCode(65 + Math.floor(Math.random() * 26))
		}
		if (i < 3) room += '-'
	}
	return room
}
/**
 * randomly create some nodes and edges as a binary tree, mainly used for testing
 * @param {number} nNodes
 */
function getRandomData(nNodes) {
	let SFNdata = getScaleFreeNetwork(nNodes)
	nodes.add(SFNdata.nodes)
	edges.add(SFNdata.edges)
	reApplySampleToNodes(['group0'])
	reApplySampleToLinks(['edge0'])
	recalculateStats()
}
/**
 * Once any existing map has been loaded, fit it to the pane and reveal it
 * @param {string} msg message for console
 */
function displayNetPane(msg) {
	console.log(msg)
	if (!netLoaded) {
		elem('loading').style.display = 'none'
		fit()
		setMapTitle(yNetMap.get('mapTitle'))
		netPane.style.visibility = 'visible'
		clearTimeout(loadingDelayTimer)
		yUndoManager.clear()
		undoRedoButtonStatus()
		network.unselectAll()
		setUpTutorial()
		netLoaded = true
		drawMinimap()
		savedState = saveState()
		setAnalysisButtonsFromRemote()
		toggleDeleteButton()
		setLegend(yNetMap.get('legend'), false)
		console.log(exactTime(), `Doc size: ${humanSize(Y.encodeStateAsUpdate(doc).length)}, Load time: ${((Date.now() - setupStartTime) / 1000).toFixed(1)}s`)
		yNetMap.set('lastLoaded', Date.now())
		yNetMap.set('version', version)
	}
}
// to handle iPad viewport sizing problem when tab bar appears and to keep panels on screen
setvh()

window.onresize = function () {
	setvh()
	keepPaneInWindow(panel)
	resizeCanvas()
}
/**
 * Hack to get window size when orientation changes.  Should use screen.orientation, but this is not
 * implemented by Safari
 */
let portrait = window.matchMedia('(orientation: portrait)')
portrait.addEventListener('change', () => {
	setvh()
})
/**
 * in View Only mode, hide all the Nav Bar buttons except the search button
 * and make the map title not editable
 */
function hideNavButtons() {
	elem('buttons').style.visibility = 'hidden'
	elem('search').parentElement.style.visibility = 'visible'
	elem('search').parentElement.style.borderLeft = 'none'
	if (showCopyMapButton) {
		elem('copy-map-button').style.display = 'block'
		elem('copy-map-button').style.visibility = 'visible'
	}
	elem('maptitle').contentEditable = 'false'
	if (!container.panelHidden) {
		panel.classList.add('hide')
		container.panelHidden = true
	}
}
/** restore all the Nav Bar buttons when leaving view only mode (e.g. when
 * going back online)
 */
function showNavButtons() {
	elem('buttons').style.visibility = 'visible'
	elem('search').parentElement.style.visibility = 'visible'
	elem('search').parentElement.style.borderLeft = '1px solid rgb(255, 255, 255)'
	elem('copy-map-button').style.display = 'none'
	elem('maptitle').contentEditable = 'true'
}
/**
 * cancel View Only mode (only available via the console)
 */
function cancelViewOnly() {
	viewOnly = false
	yNetMap.set('viewOnly', false)
	showNavButtons()
	data.nodes.get().forEach((obj) => (obj.fixed = false))
	network.setOptions({ interaction: { dragNodes: true, hover: true } })
}
window.cancelViewOnly = cancelViewOnly
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
 * retrieve or generate user's name
 */
function setUpUserName() {
	try {
		myNameRec = JSON.parse(localStorage.getItem('myName'))
	} catch {
		myNameRec = null
	}
	saveUserName(myNameRec?.name ? myNameRec.name : '')
	console.log(`My name: ${myNameRec.name}`)
}
/**
 * Save a new user name into local storage
 * @param {String} name
 */
function saveUserName(name) {
	if (name.length > 0) {
		myNameRec.name = name
		myNameRec.anon = false
	} else {
		myNameRec = generateName()
	}
	myNameRec.id = clientID
	localStorage.setItem('myName', JSON.stringify(myNameRec))
	yAwareness.setLocalState({ user: myNameRec })
	showAvatars()
}

/**
 * if this is the user's first time, show them how the user interface works
 */
function setUpTutorial() {
	if (localStorage.getItem('doneIntro') !== 'done' && viewOnly === false) {
		tutorial.onexit(function () {
			localStorage.setItem('doneIntro', 'done')
		})
		tutorial.onstep(0, () => {
			let splashNameBox = elem('splashNameBox')
			let anonName = myNameRec.name || generateName().name
			splashNameBox.placeholder = anonName
			splashNameBox.focus()
			splashNameBox.addEventListener('blur', () => {
				saveUserName(splashNameBox.value || anonName)
			})
			splashNameBox.addEventListener('keyup', (e) => {
				if (e.key === 'Enter') splashNameBox.blur()
			})
		})
		tutorial.start()
	}
}

/**
 * draw the network, after setting the vis-network options
 */
function draw() {
	// for testing, you can append ?t=XXX to the URL of the page, where XXX is the number
	// of factors to include in a random network
	let url = new URL(document.location.href.toLowerCase())
	let nNodes = parseInt(url.searchParams.get('t'))
	if (nNodes) getRandomData(nNodes)
	// create a network
	var options = {
		nodes: {
			chosen: {
				node: function (values, id, selected) {
					values.shadow = selected
				},
			},
		},
		edges: {
			chosen: {
				edge: function (values, id, selected) {
					values.shadow = selected
				},
			},
			smooth: {
				type: 'cubicBezier',
			},
		},
		physics: {
			enabled: false,
			stabilization: false,
		},
		interaction: {
			multiselect: true,
			selectConnectedEdges: false,
			hover: false,
			hoverConnectedEdges: false,
			zoomView: false,
			tooltipDelay: 0,
		},
		manipulation: {
			enabled: false,
			addNode: function (item, callback) {
				item.label = ''
				item = deepMerge(item, styles.nodes[lastNodeSample])
				item.grp = lastNodeSample
				item.created = timestamp()
				addLabel(item, cancelAdd, callback)
				showPressed('addNode', 'remove')
			},
			editNode: function (item, callback) {
				// for some weird reason, vis-network copies the group properties into the
				// node properties before calling this fn, which we don't want.  So we
				// revert to using the original node properties before continuing.
				item = data.nodes.get(item.id)
				item.modified = timestamp()
				let point = network.canvasToDOM({ x: item.x, y: item.y })
				editNode(item, point, cancelEdit, callback)
			},
			addEdge: function (item, callback) {
				inAddMode = false
				network.setOptions({
					interaction: { dragView: true, selectable: true },
				})
				showPressed('addLink', 'remove')
				if (item.from === item.to) {
					callback(null)
					stopEdit()
					return
				}
				if (duplEdge(item.from, item.to).length > 0) {
					alertMsg('There is already a link from this Factor to the other.', 'error')
					callback(null)
					stopEdit()
					return
				}
				if (data.nodes.get(item.from).isCluster || data.nodes.get(item.to).isCluster) {
					alertMsg('Links cannot be made to or from a cluster', 'error')
					callback(null)
					stopEdit()
					return
				}
				item = deepMerge(item, styles.edges[lastLinkSample])
				item.grp = lastLinkSample
				item.created = timestamp()
				clearStatusBar()
				callback(item)
				logHistory(`added link from '${data.nodes.get(item.from).label}' to '${data.nodes.get(item.to).label}'`)
			},
			editEdge: {
				editWithoutDrag: function (item, callback) {
					item = data.edges.get(item.id)
					item.modified = timestamp()
					// find midpoint of edge
					let point = network.canvasToDOM({
						x: (network.getPosition(item.from).x + network.getPosition(item.to).x) / 2,
						y: (network.getPosition(item.from).y + network.getPosition(item.to).y) / 2,
					})
					editEdge(item, point, cancelEdit, callback)
				},
			},
			deleteNode: function (item, callback) {
				let locked = false
				item.nodes.forEach((nId) => {
					let n = data.nodes.get(nId)
					if (n.locked) {
						locked = true
						alertMsg(`Factor '${shorten(n.oldLabel)}' can't be deleted because it is locked`, 'warn')
						callback(null)
						return
					}
				})
				if (locked) return
				clearStatusBar()
				hideNotes()
				// delete also all the edges that link to the nodes being deleted
				item.nodes.forEach((nId) => {
					network.getConnectedEdges(nId).forEach((eId) => {
						if (item.edges.indexOf(eId) === -1) item.edges.push(eId)
					})
				})
				item.edges.forEach((edgeId) => {
					logHistory(
						`deleted link from '${data.nodes.get(data.edges.get(edgeId).from).label}' to '${data.nodes.get(data.edges.get(edgeId).to).label
						}'`,
					)
				})
				network.unselectAll()
				item.nodes.forEach((nodeId) => {
					logHistory(`deleted factor: '${data.nodes.get(nodeId).label}'`)
				})
				callback(item)
			},
			deleteEdge: function (item, callback) {
				item.edges.forEach((edgeId) => {
					logHistory(
						`deleted link from '${data.nodes.get(data.edges.get(edgeId).from).label}' to '${data.nodes.get(data.edges.get(edgeId).to).label
						}'`,
					)
				})
				callback(item)
			},
			controlNodeStyle: {
				shape: 'dot',
				color: 'red',
				size: 5,
				group: undefined,
			},
		},
	}
	if (viewOnly)
		options.interaction = {
			dragNodes: false,
			hover: false,
		}
	network = new Network(netPane, data, options)
	window.network = network
	elem('zoom').value = network.getScale()

	// start with factor tab open, but hidden
	elem('nodesButton').click()

	// listen for click events on the network pane
	let doubleClickTimer = null
	network.on('click', (params) => {
		if (/gui/.test(debug)) console.log('**click**', params)
		// if user is doing an analysis, and has clicked on a node, show the node notes
		if (getRadioVal('radius') !== 'All' || getRadioVal('stream') !== 'All' || getRadioVal('paths') !== 'All') {
			if (!showNotesToggle) return
			hideNotes()
			let clickedNodeId = network.getNodeAt(params.pointer.DOM)
			if (clickedNodeId) showNodeData(clickedNodeId)
			else {
				let clickedEdgeId = network.getEdgeAt(params.pointer.DOM)
				if (clickedEdgeId) showEdgeData(clickedEdgeId)
			}
			return
		}
		// if user has clicked on a portal node, open the map in another tab and go to it
		if (params.nodes.length === 1) {
			let node = data.nodes.get(params.nodes[0])
			// tricky stuff to distinguish a single click (move to map) from a double click (edit node)
			if (node.portal && doubleClickTimer === null) {
				doubleClickTimer = setTimeout(() => {
					window.open(`${window.location.pathname}?room=${node.portal}`, node.portal)
					doubleClickTimer = null
				}, 500)
			}
		}
		let keys = params.event.pointers[0]
		if (!keys) return
		if (keys.metaKey) {
			// if the Command key (on a Mac) is down, and the click is on a node/edge, log it to the console
			if (params.nodes.length === 1) {
				let node = data.nodes.get(params.nodes[0])
				console.log('node = ', node)
				window.node = node
			}
			if (params.edges.length === 1) {
				let edge = data.edges.get(params.edges[0])
				console.log('edge = ', edge)
				window.edge = edge
			}
			return
		}
		if (keys.altKey) {
			// if the Option/ALT key is down, add a node if on the background
			if (params.nodes.length === 0 && params.edges.length === 0) {
				let pos = params.pointer.canvas
				let item = { id: uuidv4(), label: '', x: pos.x, y: pos.y }
				item = deepMerge(item, styles.nodes[lastNodeSample])
				item.grp = lastNodeSample
				addLabel(item, clearPopUp, function (newItem) {
					if (newItem !== null) data.nodes.add(newItem)
				})
			}
			return
		}
		if (keys.shiftKey) {
			if (!inEditMode) showMagnifier(keys)
			return
		}
		// Might be a click on a thumb up/down
		if (showVotingToggle) {
			for (const node of data.nodes.get()) {
				let bBox = network.getBoundingBox(node.id)
				let clickPos = params.pointer.canvas
				if (
					clickPos.x > bBox.left &&
					clickPos.x < bBox.right &&
					clickPos.y > bBox.bottom &&
					clickPos.y < bBox.bottom + 20
				) {
					if (clickPos.x < bBox.left + (bBox.right - bBox.left) / 2) {
						// if user has not already voted for this, add their vote, i.e. add their clientID
						// or if they have voted, remove it
						if (node.thumbUp?.includes(clientID)) node.thumbUp = node.thumbUp.filter((c) => c !== clientID)
						else if (node.thumbUp) node.thumbUp.push(clientID)
						else node.thumbUp = [clientID]
					} else {
						if (node.thumbDown?.includes(clientID))
							node.thumbDown = node.thumbDown.filter((c) => c !== clientID)
						else if (node.thumbDown) node.thumbDown.push(clientID)
						else node.thumbDown = [clientID]
					}
					data.nodes.update(node)
					return
				}
			}
		}
	})

	// despatch to edit a node or an edge or to fit the network on the pane
	network.on('doubleClick', function (params) {
		if (/gui/.test(debug)) console.log('**doubleClick**')
		clearTimeout(doubleClickTimer)
		doubleClickTimer = null
		if (params.nodes.length === 1) {
			if (!(viewOnly || inEditMode)) network.editNode()
		} else if (params.edges.length === 1) {
			if (!(viewOnly || inEditMode)) network.editEdgeMode()
		} else {
			fit()
		}
	})
	network.on('selectNode', function (params) {
		if (/gui/.test(debug)) console.log('selectNode', params)
		// if user is doing an analysis, do nothing
		if (getRadioVal('radius') !== 'All' || getRadioVal('stream') !== 'All' || getRadioVal('paths') !== 'All') {
			return
		}
		// if a 'hidden' node is clicked, it is selected, but we don't want this
		// reset the selected nodes to all except the hidden one
		network.setSelection({
			nodes: params.nodes.filter((id) => !data.nodes.get(id).nodeHidden),
			edges: params.edges.filter((id) => !data.edges.get(id).edgeHidden),
		})
		showSelected()
		showNodeOrEdgeData()
		toggleDeleteButton()
		if (getRadioVal('radius') !== 'All') analyse()
		if (getRadioVal('stream') !== 'All') analyse()
		if (getRadioVal('paths') !== 'All') analyse()
	})
	network.on('deselectNode', function (params) {
		if (/gui/.test(debug)) console.log('deselectNode', params)
		// if user is doing an analysis, do nothing, but first reselect the unselected nodes
		if (getRadioVal('radius') !== 'All' || getRadioVal('stream') !== 'All' || getRadioVal('paths') !== 'All') {
			network.setSelection({
				nodes: params.previousSelection.nodes.map((node) => node.id),
				edges: params.previousSelection.edges.map((edge) => edge.id),
			})
			return
		}
		// if some other node(s) are already selected, and the user has
		// clicked on one of the selected nodes, do nothing,
		// i.e reselect all the nodes previously selected
		// similarly, if the user has clicked on a 'hidden' node,
		// reselect the previous nodes and do nothing
		if (params.nodes) {
			// clicked on a node
			let prevSelIds = params.previousSelection.nodes.map((node) => node.id)
			let hiddenEdge
			if (params.edges.length) hiddenEdge = data.edges.get(params.edges[0]).edgeHidden
			if (prevSelIds.includes(params.nodes[0]) || data.nodes.get(params.nodes[0]).nodeHidden || hiddenEdge) {
				// reselect the previously selected nodes
				network.selectNodes(
					params.previousSelection.nodes.map((node) => node.id),
					false,
				)
				return
			}
		}
		showSelected()
		showNodeOrEdgeData()
		toggleDeleteButton()
	})
	network.on('hoverNode', function () {
		changeCursor('grab')
	})
	network.on('blurNode', function () {
		changeCursor('default')
	})
	network.on('selectEdge', function (params) {
		if (/gui/.test(debug)) console.log('selectEdge')
		// if user is doing an analysis, do nothing
		if (getRadioVal('radius') !== 'All' || getRadioVal('stream') !== 'All' || getRadioVal('paths') !== 'All') {
			return
		}
		network.setSelection({
			nodes: params.nodes.filter((id) => !data.nodes.get(id).nodeHidden),
			edges: params.edges.filter((id) => !data.edges.get(id).edgeHidden),
		})
		showSelected()
		showNodeOrEdgeData()
		toggleDeleteButton()
	})
	network.on('deselectEdge', function (params) {
		if (/gui/.test(debug)) console.log('deselectEdge')
		// if user is doing an analysis, do nothing, but first reselect the unselected nodes
		if (getRadioVal('radius') !== 'All' || getRadioVal('stream') !== 'All' || getRadioVal('paths') !== 'All') {
			network.setSelection({
				nodes: params.previousSelection.nodes.map((node) => node.id),
				edges: params.previousSelection.edges.map((edge) => edge.id),
			})
			return
		}
		if (params.edges) {
			// clicked on an edge(see selectNode for comments)
			let prevSelIds = params.previousSelection.edges.map((edge) => edge.id)
			if (prevSelIds.includes(params.edges[0]) || data.edges.get(params.edges[0]).edgeHidden) {
				// reselect the previously selected edges
				network.selectEdges(
					params.previousSelection.edges.map((edge) => edge.id),
					false,
				)
				return
			}
		}
		hideNotes()
		showSelected()
		toggleDeleteButton()
	})
	network.on('oncontext', function (e) {
		let nodeId = network.getNodeAt(e.pointer.DOM)
		if (nodeId) openCluster(nodeId)
	})

	let viewPosition
	let selectionCanvasStart = {}
	let selectionStart = {}
	let selectionArea = document.createElement('div')
	selectionArea.className = 'selectionBox'
	selectionArea.style.display = 'none'
	elem('main').appendChild(selectionArea)

	network.on('dragStart', function (params) {
		if (/gui/.test(debug)) console.log('dragStart')
		viewPosition = network.getViewPosition()
		let e = params.event.pointers[0]
		// start drawing a selection rectangle if the CTRL key is down and click is on the background
		if (e.ctrlKey && params.nodes.length === 0 && params.edges.length === 0) {
			network.setOptions({ interaction: { dragView: false } })
			listen('net-pane', 'mousemove', showAreaSelection)
			selectionStart = { x: e.offsetX, y: e.offsetY }
			selectionCanvasStart = params.pointer.canvas
			selectionArea.style.left = `${e.offsetX}px`
			selectionArea.style.top = `${e.offsetY}px`
			selectionArea.style.width = '0px'
			selectionArea.style.height = '0px'
			selectionArea.style.display = 'block'
			return
		}
		if (e.altKey) {
			if (!inAddMode) {
				removeFactorCursor()
				changeCursor('crosshair')
				inAddMode = 'addLink'
				showPressed('addLink', 'add')
				statusMsg('Now drag to the middle of the Destination factor')
				network.setOptions({
					interaction: { dragView: false, selectable: false },
				})
				network.addEdgeMode()
				return
			}
		}
		changeCursor('grabbing')
	})
	/**
	 * update the selection rectangle as the mouse moves
	 * @param {Event} event
	 */
	function showAreaSelection(event) {
		selectionArea.style.left = `${Math.min(selectionStart.x, event.offsetX)}px`
		selectionArea.style.top = `${Math.min(selectionStart.y, event.offsetY)}px`
		selectionArea.style.width = `${Math.abs(event.offsetX - selectionStart.x)}px`
		selectionArea.style.height = `${Math.abs(event.offsetY - selectionStart.y)}px`
	}
	network.on('dragging', function () {
		if (/gui/.test(debug)) console.log('dragging')
		let endViewPosition = network.getViewPosition()
		panCanvas(viewPosition.x - endViewPosition.x, viewPosition.y - endViewPosition.y)
		viewPosition = endViewPosition
	})
	network.on('dragEnd', function (params) {
		if (/gui/.test(debug)) console.log('dragEnd')
		let endViewPosition = network.getViewPosition()
		panCanvas(viewPosition.x - endViewPosition.x, viewPosition.y - endViewPosition.y)
		if (selectionArea.style.display === 'block') {
			selectionArea.style.display = 'none'
			network.setOptions({ interaction: { dragView: true } })
			elem('net-pane').removeEventListener('mousemove', showAreaSelection)
		}
		let e = params.event.pointers[0]
		if (e.ctrlKey && params.nodes.length === 0 && params.edges.length === 0) {
			network.storePositions()
			let selectionCanvasEnd = params.pointer.canvas
			if (selectionCanvasStart.x > selectionCanvasEnd.x) {
				;[selectionCanvasStart.x, selectionCanvasEnd.x] = [selectionCanvasEnd.x, selectionCanvasStart.x]
			}
			if (selectionCanvasStart.y > selectionCanvasEnd.y) {
				;[selectionCanvasStart.y, selectionCanvasEnd.y] = [selectionCanvasEnd.y, selectionCanvasStart.y]
			}
			let selectedNodes = data.nodes.get({
				filter: function (node) {
					return (
						!node.nodeHidden &&
						node.x >= selectionCanvasStart.x &&
						node.x <= selectionCanvasEnd.x &&
						node.y >= selectionCanvasStart.y &&
						node.y <= selectionCanvasEnd.y
					)
				},
			})
			network.setSelection({
				nodes: selectedNodes.map((n) => n.id).concat(network.getSelectedNodes()),
			})
			showSelected()
			showNodeOrEdgeData()
			return
		}
		let newPositions = network.getPositions(params.nodes)
		data.nodes.update(
			data.nodes.get(params.nodes).map((n) => {
				n.x = newPositions[n.id].x
				n.y = newPositions[n.id].y
				if (snapToGridToggle) snapToGrid(n)
				return n
			}),
		)
		changeCursor('default')
	})
	network.on('controlNodeDragging', function () {
		if (/gui/.test(debug)) console.log('controlNodeDragging')
		changeCursor('crosshair')
	})
	network.on('controlNodeDragEnd', function (event) {
		if (/gui/.test(debug)) console.log('controlNodeDragEnd')
		if (event.controlEdge.from !== event.controlEdge.to) changeCursor('default')
	})
	network.on('beforeDrawing', (ctx) => redraw(ctx))
	network.on('afterDrawing', (ctx) => drawBadges(ctx))

	// listen for changes to the network structure
	// and recalculate the network statistics when there is one
	data.nodes.on('add', recalculateStats)
	data.nodes.on('remove', recalculateStats)
	data.edges.on('add', recalculateStats)
	data.edges.on('remove', recalculateStats)

	/* --------------------------------------------set up the magnifier --------------------------------------------*/
	const magSize = 300 // diameter of loupe
	const halfMagSize = magSize / 2.0
	const netPaneCanvas = netPane.firstElementChild.firstElementChild
	let magnifier = document.createElement('canvas')
	magnifier.width = magSize
	magnifier.height = magSize
	magnifier.className = 'magnifier'
	let magnifierCtx = magnifier.getContext('2d')
	magnifierCtx.fillStyle = 'white'
	netPane.appendChild(magnifier)
	let bigNetPane = null
	let bigNetwork = null
	let bigNetCanvas = null
	let netPaneRect = null
	let magnifying = false

	netPane.addEventListener('keydown', (e) => {
		if (!inEditMode && e.shiftKey && !magnifying) createMagnifier(e)
	})
	netPane.addEventListener('mousemove', (e) => {
		if (magnifying && !inEditMode && e.shiftKey) showMagnifier(e)
	})
	netPane.addEventListener('keyup', (e) => {
		if (e.key === 'Shift') closeMagnifier()
	})
	// ensure magnifier shows even if mouse is over the panel (e.g. when doing analysis)
	panel.addEventListener('keydown', (e) => {
		if (!inEditMode && e.shiftKey && !magnifying) createMagnifier(e)
	})
	panel.addEventListener('mousemove', (e) => {
		if (magnifying && !inEditMode && e.shiftKey) showMagnifier(e)
	})
	panel.addEventListener('keyup', (e) => {
		if (e.key === 'Shift') closeMagnifier()
	})

	/**
	 * create a copy of the network, but magnified and off screen
	 */
	function createMagnifier(e) {
		if (bigNetPane) {
			bigNetwork.destroy()
			bigNetPane.remove()
		}
		if (drawingSwitch) return
		magnifying = true
		netPaneRect = netPane.getBoundingClientRect()
		network.storePositions()
		bigNetPane = document.createElement('div')
		bigNetPane.id = 'big-net-pane'
		bigNetPane.style.position = 'absolute'
		bigNetPane.style.top = '-9999px'
		bigNetPane.style.left = '-9999px'
		bigNetPane.style.width = `${netPane.offsetWidth * magnification}px`
		bigNetPane.style.height = `${netPane.offsetHeight * magnification}px`
		netPane.appendChild(bigNetPane)
		let bigNetData = {
			nodes: new DataSet(),
			edges: new DataSet(),
		}
		bigNetData.nodes.add(data.nodes.get())
		bigNetData.edges.add(data.edges.get())
		bigNetwork = new Network(bigNetPane, bigNetData, {
			physics: { enabled: false },
		})
		/* // unhide any hidden nodes and edges
		let changedNodes = []
		bigNetData.nodes.forEach((n) => {
			if (n.nodeHidden) {
				changedNodes.push(setNodeHidden(n, false))
			}
		})
		let changedEdges = []
		bigNetData.edges.forEach((e) => {
			if (e.edgeHidden) {
				changedEdges.push(setEdgeHidden(e, false))
			}
		})
		bigNetData.nodes.update(changedNodes)
		bigNetData.edges.update(changedEdges) */
		bigNetCanvas = bigNetPane.firstElementChild.firstElementChild
		bigNetwork.on('afterDrawing', () => {
			setCanvasBackground(bigNetCanvas)
		})
		bigNetwork.moveTo({
			position: network.getViewPosition(),
			scale: magnification * network.getScale(),
		})
		netPane.style.cursor = 'none'
		magnifier.style.display = 'none'
		showMagnifier(e)
	}
	/**
	 * display the loupe, centred on the mouse pointer, and fill it with
	 * an image copied from the magnified network
	 */
	function showMagnifier(e) {
		e.preventDefault()
		if (drawingSwitch) return
		if (bigNetCanvas == null) createMagnifier()
		magnifierCtx.fillRect(0, 0, magSize, magSize)
		magnifierCtx.drawImage(
			bigNetCanvas,
			((e.clientX - netPaneRect.x) * bigNetCanvas.width) / netPaneCanvas.clientWidth - halfMagSize,
			((e.clientY - netPaneRect.y) * bigNetCanvas.height) / netPaneCanvas.clientHeight - halfMagSize,
			magSize,
			magSize,
			0,
			0,
			magSize,
			magSize,
		)
		magnifier.style.top = `${e.clientY - netPaneRect.y - halfMagSize}px`
		magnifier.style.left = `${e.clientX - netPaneRect.x - halfMagSize}px`
		magnifier.style.display = 'block'
	}
	/**
	 * destroy the magnified network copy
	 */
	function closeMagnifier() {
		if (bigNetPane) {
			bigNetwork.destroy()
			bigNetPane.remove()
		}
		netPane.style.cursor = 'default'
		magnifier.style.display = 'none'
		magnifying = false
	}
} // end draw()

/**
 * draw the background on the given canvas (which will be a magnified version of the net pane)
 * @param {HTMLElement} canvas
 * @returns canvas
 */
export function setCanvasBackground(canvas) {
	let context = canvas.getContext('2d')
	context.setTransform()
	context.globalCompositeOperation = 'destination-over'
	// apply the background objects
	let backgroundCanvas = document.getElementById('underlay').firstElementChild.firstElementChild
	context.drawImage(backgroundCanvas, 0, 0, canvas.width, canvas.height)
	// apply the background colour, if any, or white
	context.fillStyle = elem('underlay').style.backgroundColor || 'rgb(255, 255, 255)'
	context.fillRect(0, 0, canvas.width, canvas.height)
	return canvas
}

/* --------------------------------------------draw and update the minimap --------------------------------------------*/
/**
 * Draw the minimap, which is a scaled down version of the network
 * with a 'radar' overlay showing the current view
 *
 * @param {number} [ratio=5] - the ratio of the size of the minimap to the network
 */
export function drawMinimap(ratio = 5) {
	let fullNetPane, fullNetwork, initialScale, initialPosition, minimapWidth, minimapHeight
	const minimapWrapper = document.getElementById('minimapWrapper') // a div to contain the minimap
	const minimapImage = document.getElementById('minimapImage') // an img, child of minimapWrapper
	const minimapRadar = document.getElementById('minimapRadar') // a div, child of minimapWrapper
	// size the minimap
	minimapSetup()
	// set up dragging of the radar overlay
	let dragging = false // if true, ignore clicks when user is dragging radar overlay
	dragRadar()
	/**
	 * Set the size of the minimap and its components
	 */
	function minimapSetup() {
		const { clientWidth, clientHeight } = network.body.container
		minimapWidth = clientWidth / ratio
		minimapHeight = clientHeight / ratio
		minimapWrapper.style.width = `${minimapWidth}px`
		minimapWrapper.style.height = `${minimapHeight}px`
		minimapRadar.style.width = `${minimapWidth}px`
		minimapRadar.style.height = `${minimapHeight}px`
		drawMinimapImage()
		drawRadar()
	}
	/**
	 * Draw a copy of the full network offscreen, then create an image of it
	 * The visible network can't be used, because it may be scaled and panned, but the minimap image needs to
	 * show the full network
	 */
	function drawMinimapImage() {
		if (!elem('fullnetPane')) {
			// if the full network does not exist, create it
			fullNetPane = document.createElement('div')
			fullNetPane.style.position = 'absolute'
			fullNetPane.style.top = '-9999px'
			fullNetPane.style.left = '-9999px'
			fullNetPane.style.width = `${netPane.offsetWidth}px`
			fullNetPane.style.height = `${netPane.offsetHeight}px`
			fullNetPane.id = 'fullNetPane'
			netPane.appendChild(fullNetPane)
			fullNetwork = new Network(fullNetPane, data, {
				physics: { enabled: false },
			})
		}
		fullNetwork.setOptions({ edges: { smooth: elem('curveSelect').value === 'cubicBezier' } })
		fullNetwork.fit()
		initialScale = fullNetwork.getScale()
		initialPosition = fullNetwork.getViewPosition()

		const fullNetworklCanvas = fullNetPane.firstElementChild.firstElementChild
		fullNetwork.on('afterDrawing', () => {
			// make the image as a reduced version of the fullNetwork
			const tempCanvas = document.createElement('canvas')
			const tempContext = tempCanvas.getContext('2d')
			tempCanvas.width = minimapWidth
			tempCanvas.height = minimapHeight
			tempContext.drawImage(fullNetworklCanvas, 0, 0, minimapWidth, minimapHeight)
			minimapImage.src = tempCanvas.toDataURL()
			minimapImage.width = minimapWidth
			minimapImage.height = minimapHeight
		})
	}
	/**
	 * Move a radar overlay on the minimap to show the current view of the network
	 */
	function drawRadar() {
		const scale = initialScale / network.getScale()
		// fade out the whole minimap if the network is all visible in the viewport
		// (there is no value in having a minimap in this case)
		if (scale >= 1 && networkInPane()) {
			minimapWrapper.style.display = 'none'
			return
		} else minimapWrapper.style.display = 'block'
		const currentDOMPosition = network.canvasToDOM(network.getViewPosition())
		const initialDOMPosition = network.canvasToDOM(initialPosition)

		minimapRadar.style.left = `${Math.round(
			((currentDOMPosition.x - initialDOMPosition.x) * scale) / ratio + (minimapWidth * (1 - scale)) / 2,
		)}px`
		minimapRadar.style.top = `${Math.round(
			((currentDOMPosition.y - initialDOMPosition.y) * scale) / ratio + (minimapHeight * (1 - scale)) / 2,
		)}px`
		minimapRadar.style.width = `${minimapWidth * scale}px`
		minimapRadar.style.height = `${minimapHeight * scale}px`
	}
	/**
	 *
	 * @returns {boolean} - true if the network is entirely within the viewport
	 */
	function networkInPane() {
		const netPaneTopLeft = network.DOMtoCanvas({ x: 0, y: 0 })
		const netPaneBottomRight = network.DOMtoCanvas({ x: netPane.clientWidth, y: netPane.clientHeight })
		for (const nodeId of data.nodes.getIds()) {
			const boundingBox = network.getBoundingBox(nodeId)
			if (boundingBox.left < netPaneTopLeft.x) return false
			if (boundingBox.right > netPaneBottomRight.x) return false
			if (boundingBox.top < netPaneTopLeft.y) return false
			if (boundingBox.bottom > netPaneBottomRight.y) return false
		}
		return true
	}
	/**
	 * Whenever the network is resized, the minimap needs to be resized and the radar overlay moved
	 */
	network.on('resize', () => {
		minimapSetup()
	})
	/**
	 * Whenever the network is changed, panned or zoomed, the radar overlay needs to be moved
	 */
	network.on('afterDrawing', () => {
		drawRadar()
	})
	/**
	 * Set up dragging of the radar overlay
	 */
	function dragRadar() {
		let x, y, radarStart
		minimapRadar.addEventListener('pointerdown', dragMouseDown)
		minimapWrapper.addEventListener(
			'wheel',
			(e) => {
				e.preventDefault()
				// reject all but vertical touch movements
				if (Math.abs(e.deltaX) <= 1) zoomscroll(e)
			},
			{ passive: false },
		)
		/**
		 * note that the mouse is down on the radar overlay and start dragging
		 * @param {event} e
		 */
		function dragMouseDown(e) {
			e.preventDefault()
			x = e.clientX
			y = e.clientY
			radarStart = { x: minimapRadar.offsetLeft, y: minimapRadar.offsetTop }
			minimapRadar.addEventListener('pointermove', drag)
			minimapRadar.addEventListener('pointerup', dragMouseUp)
		}
		/**
		 * move the radar overlay as the mouse moves
		 * @param {event} e
		 */
		function drag(e) {
			e.preventDefault()
			dragging = true
			let dx = e.clientX - x
			let dy = e.clientY - y
			let left = radarStart.x + dx
			let top = radarStart.y + dy
			if (left < 0) left = 0
			if (left + minimapRadar.offsetWidth >= minimapWidth) left = minimapWidth - minimapRadar.offsetWidth
			if (top < 0) top = 0
			if (top + minimapRadar.offsetHeight >= minimapHeight) top = minimapHeight - minimapRadar.offsetHeight
			minimapRadar.style.left = `${Math.round(left)}px`
			minimapRadar.style.top = `${Math.round(top)}px`
			let initialDOMPosition = network.canvasToDOM(initialPosition)
			const scale = initialScale / network.getScale()
			const radarRect = minimapRadar.getBoundingClientRect()
			const wrapperRect = minimapWrapper.getBoundingClientRect()
			network.moveTo({
				position: network.DOMtoCanvas({
					x:
						((radarRect.left - wrapperRect.left + (radarRect.width - wrapperRect.width) / 2) * ratio) /
						scale +
						initialDOMPosition.x,
					y:
						((radarRect.top - wrapperRect.top + (radarRect.height - wrapperRect.height) / 2) * ratio) /
						scale +
						initialDOMPosition.y,
				}),
			})
		}
		/**
		 * note that the mouse is up and stop dragging
		 * @param {event} e
		 */
		function dragMouseUp(e) {
			e.preventDefault()
			if (dragging) {
				minimapRadar.removeEventListener('pointermove', drag)
				minimapRadar.removeEventListener('pointerup', dragMouseUp)
			}
		}
	}
}
/* -------------------------------------------- network map utilities --------------------------------------------*/
/**
 * clear the map by destroying all nodes and edges and background objects
 */
export function clearMap() {
	doc.transact(() => {
		unSelect()
		ensureNotDrawing()
		network.destroy()
		checkMapSaved = true
		data.nodes.clear()
		data.edges.clear()
		yDrawingMap.clear()
		canvas.clear()
		draw()
	})
}

/**
 * note that the map has been saved to file and so user does not need to be warned
 * about quitting without saving
 */
export function markMapSaved() {
	checkMapSaved = false
	dirty = false
}
/**
 * un fade the delete button to show that it can be used when something is selected
 */
export function toggleDeleteButton() {
	if (network.getSelectedNodes().length > 0 || network.getSelectedEdges().length > 0)
		elem('deleteNode').classList.remove('disabled')
	else elem('deleteNode').classList.add('disabled')
}

function contextMenu(event) {
	event.preventDefault()
}
/****************************************************** update history for history log **************************/
/**
 * return an object with the current time as an integer date and the current user's name
 */
export function timestamp() {
	return { time: Date.now(), user: myNameRec.name }
}
window.timestamp = timestamp
/**
 * Generate a key for a time slot in the history log
 *
 * @param {integer} time
 * @returns {string} key
 */
function timekey(time) {
	return room + time
}
/**
 * push a record that action has been taken on to the end of the history log
 *  also record current state of the map for possible roll back
 *  and note changes have been made to the map
 * @param {String} action
 * @param {String} actor - the user who took the action
 * @param {boolean} dontSaveState - if defined, don't save the current state of the map
 */
export async function logHistory(action, actor, dontSaveState = null) {
	let now = Date.now()
	yHistory.push([
		{
			action: action,
			time: now,
			user: actor ? actor : myNameRec.name,
		},
	])
	// store the current state of the map for possible rollback
	if (!dontSaveState) {
		await localForage.setItem(timekey(now), savedState).then(() => {
			savedState = saveState()

			// delete all but the last ROLLBACKS saved states
			for (let i = 0; i < yHistory.length - ROLLBACKS; i++) {
				let obj = yHistory.get(i)
				if (obj.time) localForage.removeItem(timekey(obj.time))
			}
		})
	}
	if (elem('history-window').style.display === 'block') showHistory()
	dirty = true
}
/**
 * Generate a compressed dump of the current state of the map, sufficient to reproduce it
 * @returns binary string
 */
export function saveState(options) {
	return compressToUTF16(
		JSON.stringify({
			nodes: data.nodes.get(),
			edges: data.edges.get(),
			net: yNetMap.toJSON(),
			samples: ySamplesMap.toJSON(),
			paint: yPointsArray.toArray(),
			drawing: yDrawingMap.toJSON(),
			options: options,
		}),
	)
}

/******************************************************** map notes side drawer *********************************************************/
/**
 * set up the side drawer for notes
 */
function setUpSideDrawer() {
	sideDrawEditor = new Quill(elem('drawer-editor'), {
		modules: {
			//we need to have this in HTML, to add the AI sparkle icon to the tools
			toolbar: viewOnly ? null : '#sideNotesToolbar'
		},
		placeholder: 'Notes about the map',
		theme: 'snow',
		readOnly: viewOnly,
	})

	sideDrawEditor.on('text-change', (delta, oldDelta, source) => {
		if (source === 'user') {
			yNetMap.set('mapDescription', { text: isQuillEmpty(sideDrawEditor) ? '' : sideDrawEditor.getContents() })
		}
	})
}
export function setSideDrawer(contents) {
	sideDrawEditor.setContents(contents.text)
}
export function disableSideDrawerEditing() {
	sideDrawEditor.disable()
	elem('drawer').firstElementChild.style.display = 'none'
}
async function genAISideNote() {
	alertMsg('Processing...', 'info', true)
	const sparklesElem = elem('sparklesSideNote')
	sparklesElem.classList.add('rotating')
	let causes = data.edges.get().map(e => data.nodes.get(e.from).label.replaceAll('\n', ' ') + ' causes ' + data.nodes.get(e.to).label.replaceAll('\n', ' ')).join('; ')
	let aiResponse = await getAIresponse(`A system map includes the following causal relationships. Write a description of the system map that will help a non-expert understand it. Use no more than 300 words. >>>${causes}<<<`)
	sideDrawEditor.setContents(aiResponse)
	yNetMap.set('mapDescription', { text: sideDrawEditor.getContents() })
	sparklesElem.classList.remove('rotating')
	cancelAlertMsg()
}

/************************************************************* badges around the factors ******************************************/
var noteImage = new Image()
noteImage.src =
	'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktY2FyZC10ZXh0IiB2aWV3Qm94PSIwIDAgMTYgMTYiPgogIDxwYXRoIGQ9Ik0xNC41IDNhLjUuNSAwIDAgMSAuNS41djlhLjUuNSAwIDAgMS0uNS41aC0xM2EuNS41IDAgMCAxLS41LS41di05YS41LjUgMCAwIDEgLjUtLjVoMTN6bS0xMy0xQTEuNSAxLjUgMCAwIDAgMCAzLjV2OUExLjUgMS41IDAgMCAwIDEuNSAxNGgxM2ExLjUgMS41IDAgMCAwIDEuNS0xLjV2LTlBMS41IDEuNSAwIDAgMCAxNC41IDJoLTEzeiIvPgogIDxwYXRoIGQ9Ik0zIDUuNWEuNS41IDAgMCAxIC41LS41aDlhLjUuNSAwIDAgMSAwIDFoLTlhLjUuNSAwIDAgMS0uNS0uNXpNMyA4YS41LjUgMCAwIDEgLjUtLjVoOWEuNS41IDAgMCAxIDAgMWgtOUEuNS41IDAgMCAxIDMgOHptMCAyLjVhLjUuNSAwIDAgMSAuNS0uNWg2YS41LjUgMCAwIDEgMCAxaC02YS41LjUgMCAwIDEtLjUtLjV6Ii8+Cjwvc3ZnPg=='
var lockImage = new Image()
lockImage.src =
	'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktbG9jay1maWxsIiB2aWV3Qm94PSIwIDAgMTYgMTYiPgogIDxwYXRoIGQ9Ik04IDFhMiAyIDAgMCAxIDIgMnY0SDZWM2EyIDIgMCAwIDEgMi0yem0zIDZWM2EzIDMgMCAwIDAtNiAwdjRhMiAyIDAgMCAwLTIgMnY1YTIgMiAwIDAgMCAyIDJoNmEyIDIgMCAwIDAgMi0yVjlhMiAyIDAgMCAwLTItMnoiLz4KPC9zdmc+'
var thumbUpImage = new Image()
thumbUpImage.src =
	'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktaGFuZC10aHVtYnMtdXAiIHZpZXdCb3g9IjAgMCAxNiAxNiI+CiAgPHBhdGggZD0iTTguODY0LjA0NkM3LjkwOC0uMTkzIDcuMDIuNTMgNi45NTYgMS40NjZjLS4wNzIgMS4wNTEtLjIzIDIuMDE2LS40MjggMi41OS0uMTI1LjM2LS40NzkgMS4wMTMtMS4wNCAxLjYzOS0uNTU3LjYyMy0xLjI4MiAxLjE3OC0yLjEzMSAxLjQxQzIuNjg1IDcuMjg4IDIgNy44NyAyIDguNzJ2NC4wMDFjMCAuODQ1LjY4MiAxLjQ2NCAxLjQ0OCAxLjU0NSAxLjA3LjExNCAxLjU2NC40MTUgMi4wNjguNzIzbC4wNDguMDNjLjI3Mi4xNjUuNTc4LjM0OC45Ny40ODQuMzk3LjEzNi44NjEuMjE3IDEuNDY2LjIxN2gzLjVjLjkzNyAwIDEuNTk5LS40NzcgMS45MzQtMS4wNjRhMS44NiAxLjg2IDAgMCAwIC4yNTQtLjkxMmMwLS4xNTItLjAyMy0uMzEyLS4wNzctLjQ2NC4yMDEtLjI2My4zOC0uNTc4LjQ4OC0uOTAxLjExLS4zMy4xNzItLjc2Mi4wMDQtMS4xNDkuMDY5LS4xMy4xMi0uMjY5LjE1OS0uNDAzLjA3Ny0uMjcuMTEzLS41NjguMTEzLS44NTcgMC0uMjg4LS4wMzYtLjU4NS0uMTEzLS44NTZhMi4xNDQgMi4xNDQgMCAwIDAtLjEzOC0uMzYyIDEuOSAxLjkgMCAwIDAgLjIzNC0xLjczNGMtLjIwNi0uNTkyLS42ODItMS4xLTEuMi0xLjI3Mi0uODQ3LS4yODItMS44MDMtLjI3Ni0yLjUxNi0uMjExYTkuODQgOS44NCAwIDAgMC0uNDQzLjA1IDkuMzY1IDkuMzY1IDAgMCAwLS4wNjItNC41MDlBMS4zOCAxLjM4IDAgMCAwIDkuMTI1LjExMUw4Ljg2NC4wNDZ6TTExLjUgMTQuNzIxSDhjLS41MSAwLS44NjMtLjA2OS0xLjE0LS4xNjQtLjI4MS0uMDk3LS41MDYtLjIyOC0uNzc2LS4zOTNsLS4wNC0uMDI0Yy0uNTU1LS4zMzktMS4xOTgtLjczMS0yLjQ5LS44NjgtLjMzMy0uMDM2LS41NTQtLjI5LS41NTQtLjU1VjguNzJjMC0uMjU0LjIyNi0uNTQzLjYyLS42NSAxLjA5NS0uMyAxLjk3Ny0uOTk2IDIuNjE0LTEuNzA4LjYzNS0uNzEgMS4wNjQtMS40NzUgMS4yMzgtMS45NzguMjQzLS43LjQwNy0xLjc2OC40ODItMi44NS4wMjUtLjM2Mi4zNi0uNTk0LjY2Ny0uNTE4bC4yNjIuMDY2Yy4xNi4wNC4yNTguMTQzLjI4OC4yNTVhOC4zNCA4LjM0IDAgMCAxLS4xNDUgNC43MjUuNS41IDAgMCAwIC41OTUuNjQ0bC4wMDMtLjAwMS4wMTQtLjAwMy4wNTgtLjAxNGE4LjkwOCA4LjkwOCAwIDAgMSAxLjAzNi0uMTU3Yy42NjMtLjA2IDEuNDU3LS4wNTQgMi4xMS4xNjQuMTc1LjA1OC40NS4zLjU3LjY1LjEwNy4zMDguMDg3LjY3LS4yNjYgMS4wMjJsLS4zNTMuMzUzLjM1My4zNTRjLjA0My4wNDMuMTA1LjE0MS4xNTQuMzE1LjA0OC4xNjcuMDc1LjM3LjA3NS41ODEgMCAuMjEyLS4wMjcuNDE0LS4wNzUuNTgyLS4wNS4xNzQtLjExMS4yNzItLjE1NC4zMTVsLS4zNTMuMzUzLjM1My4zNTRjLjA0Ny4wNDcuMTA5LjE3Ny4wMDUuNDg4YTIuMjI0IDIuMjI0IDAgMCAxLS41MDUuODA1bC0uMzUzLjM1My4zNTMuMzU0Yy4wMDYuMDA1LjA0MS4wNS4wNDEuMTdhLjg2Ni44NjYgMCAwIDEtLjEyMS40MTZjLS4xNjUuMjg4LS41MDMuNTYtMS4wNjYuNTZ6Ii8+Cjwvc3ZnPg=='
var thumbUpFilledImage = new Image()
thumbUpFilledImage.src =
	'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktaGFuZC10aHVtYnMtdXAtZmlsbCIgdmlld0JveD0iMCAwIDE2IDE2Ij4KICA8cGF0aCBkPSJNNi45NTYgMS43NDVDNy4wMjEuODEgNy45MDguMDg3IDguODY0LjMyNWwuMjYxLjA2NmMuNDYzLjExNi44NzQuNDU2IDEuMDEyLjk2NS4yMi44MTYuNTMzIDIuNTExLjA2MiA0LjUxYTkuODQgOS44NCAwIDAgMSAuNDQzLS4wNTFjLjcxMy0uMDY1IDEuNjY5LS4wNzIgMi41MTYuMjEuNTE4LjE3My45OTQuNjgxIDEuMiAxLjI3My4xODQuNTMyLjE2IDEuMTYyLS4yMzQgMS43MzMuMDU4LjExOS4xMDMuMjQyLjEzOC4zNjMuMDc3LjI3LjExMy41NjcuMTEzLjg1NiAwIC4yODktLjAzNi41ODYtLjExMy44NTYtLjAzOS4xMzUtLjA5LjI3My0uMTYuNDA0LjE2OS4zODcuMTA3LjgxOS0uMDAzIDEuMTQ4YTMuMTYzIDMuMTYzIDAgMCAxLS40ODguOTAxYy4wNTQuMTUyLjA3Ni4zMTIuMDc2LjQ2NSAwIC4zMDUtLjA4OS42MjUtLjI1My45MTJDMTMuMSAxNS41MjIgMTIuNDM3IDE2IDExLjUgMTZIOGMtLjYwNSAwLTEuMDctLjA4MS0xLjQ2Ni0uMjE4YTQuODIgNC44MiAwIDAgMS0uOTctLjQ4NGwtLjA0OC0uMDNjLS41MDQtLjMwNy0uOTk5LS42MDktMi4wNjgtLjcyMkMyLjY4MiAxNC40NjQgMiAxMy44NDYgMiAxM1Y5YzAtLjg1LjY4NS0xLjQzMiAxLjM1Ny0xLjYxNS44NDktLjIzMiAxLjU3NC0uNzg3IDIuMTMyLTEuNDEuNTYtLjYyNy45MTQtMS4yOCAxLjAzOS0xLjYzOS4xOTktLjU3NS4zNTYtMS41MzkuNDI4LTIuNTl6Ii8+Cjwvc3ZnPg=='
var thumbDownImage = new Image()
thumbDownImage.src =
	'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktaGFuZC10aHVtYnMtZG93biIgdmlld0JveD0iMCAwIDE2IDE2Ij4KICA8cGF0aCBkPSJNOC44NjQgMTUuNjc0Yy0uOTU2LjI0LTEuODQzLS40ODQtMS45MDgtMS40Mi0uMDcyLTEuMDUtLjIzLTIuMDE1LS40MjgtMi41OS0uMTI1LS4zNi0uNDc5LTEuMDEyLTEuMDQtMS42MzgtLjU1Ny0uNjI0LTEuMjgyLTEuMTc5LTIuMTMxLTEuNDFDMi42ODUgOC40MzIgMiA3Ljg1IDIgN1YzYzAtLjg0NS42ODItMS40NjQgMS40NDgtMS41NDYgMS4wNy0uMTEzIDEuNTY0LS40MTUgMi4wNjgtLjcyM2wuMDQ4LS4wMjljLjI3Mi0uMTY2LjU3OC0uMzQ5Ljk3LS40ODRDNi45MzEuMDggNy4zOTUgMCA4IDBoMy41Yy45MzcgMCAxLjU5OS40NzggMS45MzQgMS4wNjQuMTY0LjI4Ny4yNTQuNjA3LjI1NC45MTMgMCAuMTUyLS4wMjMuMzEyLS4wNzcuNDY0LjIwMS4yNjIuMzguNTc3LjQ4OC45LjExLjMzLjE3Mi43NjIuMDA0IDEuMTUuMDY5LjEzLjEyLjI2OC4xNTkuNDAzLjA3Ny4yNy4xMTMuNTY3LjExMy44NTYgMCAuMjg5LS4wMzYuNTg2LS4xMTMuODU2LS4wMzUuMTItLjA4LjI0NC0uMTM4LjM2My4zOTQuNTcxLjQxOCAxLjIuMjM0IDEuNzMzLS4yMDYuNTkyLS42ODIgMS4xLTEuMiAxLjI3Mi0uODQ3LjI4My0xLjgwMy4yNzYtMi41MTYuMjExYTkuODc3IDkuODc3IDAgMCAxLS40NDMtLjA1IDkuMzY0IDkuMzY0IDAgMCAxLS4wNjIgNC41MWMtLjEzOC41MDgtLjU1Ljg0OC0xLjAxMi45NjRsLS4yNjEuMDY1ek0xMS41IDFIOGMtLjUxIDAtLjg2My4wNjgtMS4xNC4xNjMtLjI4MS4wOTctLjUwNi4yMjktLjc3Ni4zOTNsLS4wNC4wMjVjLS41NTUuMzM4LTEuMTk4LjczLTIuNDkuODY4LS4zMzMuMDM1LS41NTQuMjktLjU1NC41NVY3YzAgLjI1NS4yMjYuNTQzLjYyLjY1IDEuMDk1LjMgMS45NzcuOTk3IDIuNjE0IDEuNzA5LjYzNS43MSAxLjA2NCAxLjQ3NSAxLjIzOCAxLjk3Ny4yNDMuNy40MDcgMS43NjguNDgyIDIuODUuMDI1LjM2Mi4zNi41OTUuNjY3LjUxOGwuMjYyLS4wNjVjLjE2LS4wNC4yNTgtLjE0NC4yODgtLjI1NWE4LjM0IDguMzQgMCAwIDAtLjE0NS00LjcyNi41LjUgMCAwIDEgLjU5NS0uNjQzaC4wMDNsLjAxNC4wMDQuMDU4LjAxM2E4LjkxMiA4LjkxMiAwIDAgMCAxLjAzNi4xNTdjLjY2My4wNiAxLjQ1Ny4wNTQgMi4xMS0uMTYzLjE3NS0uMDU5LjQ1LS4zMDEuNTctLjY1MS4xMDctLjMwOC4wODctLjY3LS4yNjYtMS4wMjFMMTIuNzkzIDdsLjM1My0uMzU0Yy4wNDMtLjA0Mi4xMDUtLjE0LjE1NC0uMzE1LjA0OC0uMTY3LjA3NS0uMzcuMDc1LS41ODEgMC0uMjExLS4wMjctLjQxNC0uMDc1LS41ODEtLjA1LS4xNzQtLjExMS0uMjczLS4xNTQtLjMxNWwtLjM1My0uMzU0LjM1My0uMzU0Yy4wNDctLjA0Ny4xMDktLjE3Ni4wMDUtLjQ4OGEyLjIyNCAyLjIyNCAwIDAgMC0uNTA1LS44MDRsLS4zNTMtLjM1NC4zNTMtLjM1NGMuMDA2LS4wMDUuMDQxLS4wNS4wNDEtLjE3YS44NjYuODY2IDAgMCAwLS4xMjEtLjQxNUMxMi40IDEuMjcyIDEyLjA2MyAxIDExLjUgMXoiLz4KPC9zdmc+'
var thumbDownFilledImage = new Image()
thumbDownFilledImage.src =
	'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktaGFuZC10aHVtYnMtZG93bi1maWxsIiB2aWV3Qm94PSIwIDAgMTYgMTYiPgogIDxwYXRoIGQ9Ik02Ljk1NiAxNC41MzRjLjA2NS45MzYuOTUyIDEuNjU5IDEuOTA4IDEuNDJsLjI2MS0uMDY1YTEuMzc4IDEuMzc4IDAgMCAwIDEuMDEyLS45NjVjLjIyLS44MTYuNTMzLTIuNTEyLjA2Mi00LjUxLjEzNi4wMi4yODUuMDM3LjQ0My4wNTEuNzEzLjA2NSAxLjY2OS4wNzEgMi41MTYtLjIxMS41MTgtLjE3My45OTQtLjY4IDEuMi0xLjI3MmExLjg5NiAxLjg5NiAwIDAgMC0uMjM0LTEuNzM0Yy4wNTgtLjExOC4xMDMtLjI0Mi4xMzgtLjM2Mi4wNzctLjI3LjExMy0uNTY4LjExMy0uODU2IDAtLjI5LS4wMzYtLjU4Ni0uMTEzLS44NTdhMi4wOTQgMi4wOTQgMCAwIDAtLjE2LS40MDNjLjE2OS0uMzg3LjEwNy0uODItLjAwMy0xLjE0OWEzLjE2MiAzLjE2MiAwIDAgMC0uNDg4LS45Yy4wNTQtLjE1My4wNzYtLjMxMy4wNzYtLjQ2NWExLjg2IDEuODYgMCAwIDAtLjI1My0uOTEyQzEzLjEuNzU3IDEyLjQzNy4yOCAxMS41LjI4SDhjLS42MDUgMC0xLjA3LjA4LTEuNDY2LjIxN2E0LjgyMyA0LjgyMyAwIDAgMC0uOTcuNDg1bC0uMDQ4LjAyOWMtLjUwNC4zMDgtLjk5OS42MS0yLjA2OC43MjNDMi42ODIgMS44MTUgMiAyLjQzNCAyIDMuMjc5djRjMCAuODUxLjY4NSAxLjQzMyAxLjM1NyAxLjYxNi44NDkuMjMyIDEuNTc0Ljc4NyAyLjEzMiAxLjQxLjU2LjYyNi45MTQgMS4yOCAxLjAzOSAxLjYzOC4xOTkuNTc1LjM1NiAxLjU0LjQyOCAyLjU5MXoiLz4KPC9zdmc+'
/**
 * draw badges (icons) around Factors and Links
 * @param {CanvasRenderingContext2D} ctx NetPane canvas context
 */
function drawBadges(ctx) {
	// padlock for locked factors
	if (!viewOnly) {
		// for a view only map, factors are always locked, so don't bother with padlock
		data.nodes
			.get()
			.filter((node) => !node.nodeHidden && node.fixed && !node.clusteredIn)
			.forEach((node) => {
				let box = network.getBoundingBox(node.id)
				drawTheBadge(lockImage, ctx, box.left - 10, box.top)
			})
	}
	if (showNotesToggle) {
		// note card for Factors and Links with Notes
		data.nodes
			.get()
			.filter(
				(node) => !node.hidden && !node.nodeHidden && node.note && node.note !== 'Notes' && !node.clusteredIn,
			)
			.forEach((node) => {
				let box = network.getBoundingBox(node.id)
				drawTheBadge(noteImage, ctx, box.right, box.top)
			})
		// an edge note badge is placed where a middle arrow would be
		let changedEdges = []
		data.edges.get().forEach((edge) => {
			if (
				!edge.edgeHidden &&
				edge.note &&
				edge.note !== 'Notes' &&
				edge.arrows &&
				edge.arrows.middle &&
				!edge.arrows.middle.enabled
			) {
				// there is a note, but the badge is not shown, so show it
				changedEdges.push(edge)
				edge.arrows.middle.enabled = true
				edge.arrows.middle.type = 'image'
				edge.arrows.middle.src = noteImage.src
			} else if (
				(!edge.note || (edge.note && edge.note === 'Notes') || edge.edgeHidden) &&
				edge.arrows &&
				edge.arrows.middle &&
				edge.arrows.middle.enabled
			) {
				// there is not a note, but the badge is shown, so remove it
				changedEdges.push(edge)
				edge.arrows.middle.enabled = false
			}
		})
		data.edges.update(changedEdges)
	}
	// draw the voting thumbs up/down (but not for nodes inside a cluster, or for cluster nodes)
	if (showVotingToggle) {
		data.nodes
			.get()
			.filter((node) => !node.hidden && !node.nodeHidden && !node.clusteredIn && !node.isCluster)
			.forEach((node) => {
				let box = network.getBoundingBox(node.id)
				drawTheBadge(
					node.thumbUp?.includes(clientID) ? thumbUpFilledImage : thumbUpImage,
					ctx,
					box.left + 20,
					box.bottom,
				)
				drawThumbCount(ctx, node.thumbUp, box.left + 36, box.bottom + 10)
				drawTheBadge(
					node.thumbDown?.includes(clientID) ? thumbDownFilledImage : thumbDownImage,
					ctx,
					box.right - 36,
					box.bottom,
				)
				drawThumbCount(ctx, node.thumbDown, box.right - 20, box.bottom + 10)
			})
	}

	/**
	 *
	 * @param {image} badgeImage
	 * @param {context} ctx
	 * @param {number} x
	 * @param {number} y
	 */
	function drawTheBadge(badgeImage, ctx, x, y) {
		ctx.beginPath()
		ctx.drawImage(badgeImage, Math.floor(x), Math.floor(y))
	}
	/**
	 * draw the length of the voters array, i.e. the count of those who have voted
	 * @param {context} ctx
	 * @param {array} voters
	 * @param {number} x
	 * @param {number} y
	 */
	function drawThumbCount(ctx, voters, x, y) {
		if (voters) {
			ctx.beginPath()
			ctx.fillStyle = 'black'
			ctx.fillText(voters.length.toString(), x, y)
		}
	}
}

/**
 * Move the node to the nearest spot that it on the grid
 * @param {object} node
 */
function snapToGrid(node) {
	node.x = GRIDSPACING * Math.round(node.x / GRIDSPACING)
	node.y = GRIDSPACING * Math.round(node.y / GRIDSPACING)
}

/*************************************************************** clipboard ************************************** */
/**
 * Copy the selected nodes and links to the clipboard
 * NB this doesn't yet work in Firefox, as they haven't implemented the Clipboard API and Permissions yet.
 * @param {Event} event
 */
function copyToClipboard(event) {
	if (document.getSelection().toString()) return // only copy factors if there is no text selected (e.g. in Notes)
	event.preventDefault()
	if (drawingSwitch) {
		copyBackgroundToClipboard(event)
		return
	}
	let nIds = network.getSelectedNodes()
	let eIds = network.getSelectedEdges()
	if (nIds.length + eIds.length === 0) {
		alertMsg('Nothing selected to copy', 'warn')
		return
	}
	let nodes = []
	let edges = []
	nIds.forEach((nId) => {
		nodes.push(data.nodes.get(nId))
		let edgesFromNode = network.getConnectedEdges(nId)
		edgesFromNode.forEach((eId) => {
			let edge = data.edges.get(eId)
			if (nIds.includes(edge.to) && nIds.includes(edge.from) && !edges.find((e) => e.id === eId)) edges.push(edge)
		})
	})
	eIds.forEach((eId) => {
		let edge = data.edges.get(eId)
		if (!nodes.find((n) => n.id === edge.from)) nodes.push(data.nodes.get(edge.from))
		if (!nodes.find((n) => n.id === edge.to)) nodes.push(data.nodes.get(edge.to))
		if (!edges.find((e) => e.id === eId)) edges.push(data.edges.get(eId))
	})
	copyText(JSON.stringify({ nodes: nodes, edges: edges }))
}
/**
 * copy the contents of the history log to the clipboard
 * @param {object} event
 */
function copyHistoryToClipboard(event) {
	event.preventDefault()
	let history = yHistory
		.toArray()
		.map((rec) => `${timeAndDate(rec.time, true)}\t${rec.user}\t${rec.action.replace(/\s+/g, ' ').trim()}\n`)
		.join('')
	copyText(history)
}
async function copyText(text) {
	try {
		if (typeof navigator.clipboard.writeText !== 'function')
			throw new Error('navigator.clipboard.writeText not a function')
	} catch {
		alertMsg('Copying not implemented in this browser', 'error')
		return false
	}
	try {
		await navigator.clipboard.writeText(text)
		alertMsg('Copied to clipboard', 'info')
		return true
	} catch (err) {
		console.error('Failed to copy: ', err)
		alertMsg('Copy failed', 'error')
		return false
	}
}

async function pasteFromClipboard() {
	if (drawingSwitch) {
		pasteBackgroundFromClipboard()
		return
	}
	let clip = await getClipboardContents()
	let nodes
	let edges
	try {
		; ({ nodes, edges } = JSON.parse(clip))
	} catch {
		// silently return (i.e. use system paste) if there is nothing relevant on the clipboard
		return
	}
	unSelect()
	nodes.forEach((node) => {
		let oldId = node.id
		node.id = uuidv4()
		node.x += 40
		node.y += 40
		edges.forEach((edge) => {
			if (edge.from === oldId) edge.from = node.id
			if (edge.to === oldId) edge.to = node.id
		})
	})
	edges.forEach((edge) => {
		edge.id = uuidv4()
	})
	data.nodes.add(nodes)
	data.edges.add(edges)
	network.setSelection({
		nodes: nodes.map((n) => n.id),
		edges: edges.map((e) => e.id),
	})
	showSelected()
	alertMsg('Pasted', 'info')
	logHistory('pasted factors and/or links from clipboard')
}

async function getClipboardContents() {
	try {
		if (typeof navigator.clipboard.readText !== 'function')
			throw new Error('navigator.clipboard.readText not a function')
	} catch {
		alertMsg('Pasting not implemented in this browser', 'error')
		return null
	}
	try {
		return await navigator.clipboard.readText()
	} catch (err) {
		console.error('Failed to read clipboard contents: ', err)
		alertMsg('Failed to paste', 'error')
		return null
	}
}

/* ----------------- dialogs for creating and editing nodes and links ----------------*/

/**
 * Initialise the dialog for creating nodes/edges
 * @param {string} popUpTitle
 * @param {number} height
 * @param {object} item
 * @param {function} cancelAction
 * @param {function} saveAction
 * @param {function} callback
 */
function initPopUp(popUpTitle, height, item, cancelAction, saveAction, callback) {
	inAddMode = false
	inEditMode = true
	changeCursor('default')
	elem('popup').style.height = `${height}px`
	elem('popup').style.borderColor = item.color.background
	elem('popup-operation').innerHTML = popUpTitle
	elem('popup-saveButton').onclick = saveAction.bind(this, item, callback)
	elem('popup-cancelButton').onclick = cancelAction.bind(this, item, callback)
	let popupLabel = elem('popup-label')
	popupLabel.style.fontSize = '14px'
	popupLabel.innerText = item.label === undefined ? '' : item.label //.replace(/\n/g, ' ')
	popupLabel.focus()
	// Set the cursor to the end
	setEndOfContenteditable(popupLabel)
	listen('popup', 'keydown', captureReturn)
	function captureReturn(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			elem('popup').removeEventListener('keydown', captureReturn)
			saveAction(item, callback)
		} else if (e.key === 'Escape') {
			elem('popup').removeEventListener('keydown', captureReturn)
			cancelAction(item, callback)
		}
	}
}
/**
 * Position the editing dialog box so that it is to the left of the item being edited,
 * but not outside the window
 * @param {Object} point
 */
function positionPopUp(point) {
	let popUp = elem('popup')
	popUp.style.display = 'block'
	// popup appears to the left of the given point
	popUp.style.top = `${point.y - popUp.offsetHeight / 2}px`
	let left = point.x - popUp.offsetWidth / 2 - 3
	popUp.style.left = `${left < 0 ? 0 : left}px`
	dragElement(popUp, elem('popup-top'))
}
/**
 * Hide the editing dialog box
 */
function clearPopUp() {
	elem('popup-saveButton').onclick = null
	elem('popup-cancelButton').onclick = null
	elem('popup-label').onkeyup = null
	elem('popup').style.display = 'none'
	if (elem('popup-node-editor')) elem('popup-node-editor').remove()
	if (elem('popup-link-editor')) elem('popup-link-editor').remove()
	if (elem('popup').timer) {
		clearTimeout(elem('popup').timer)
		elem('popup').timer = undefined
	}
	yAwareness.setLocalStateField('addingFactor', { state: 'done' })
	inEditMode = false
}
/**
 * User has pressed 'cancel' - abandon adding a node and hide the dialog
 * @param {Function} callback
 */
function cancelAdd(item, callback) {
	clearPopUp()
	callback(null)
	stopEdit()
}
/**
 * User has pressed 'cancel' - abandon the edit and hide the dialog
 * @param {object} item
 * @param {function} [callback]
 */
function cancelEdit(item, callback) {
	clearPopUp()
	item.label = item.oldLabel
	item.font.color = item.oldFontColor
	if (item.shape === 'portal') item.shape = 'image'
	if (item.from) {
		unlockEdge(item)
	} else {
		unlockNode(item)
	}
	if (callback) callback(null)
	stopEdit()
}
/**
 * A factor is being created:  get its label from the user
 * @param {Object} item - the node
 * @param {Function} cancelAction
 * @param {Function} callback
 */
function addLabel(item, cancelAction, callback) {
	if (elem('popup').style.display === 'block') return // can't add factor when factor is already being added
	initPopUp('Add Factor', 60, item, cancelAction, saveLabel, callback)
	let pos = network.canvasToDOM({ x: item.x, y: item.y })
	positionPopUp(pos)
	removeFactorCursor()
	ghostFactor(pos)
	elem('popup-label').focus()
}
/**
 * broadcast to other users that a new factor is being added here
 * @param {Object} pos offset coordinates of Add Factor dialog
 */
function ghostFactor(pos) {
	yAwareness.setLocalStateField('addingFactor', {
		state: 'adding',
		pos: network.DOMtoCanvas(pos),
		name: myNameRec.name,
	})
	elem('popup').timer = setTimeout(() => {
		// close it after a time if the user has gone away
		yAwareness.setLocalStateField('addingFactor', { state: 'done' })
	}, TIMETOEDIT)
}
/**
 * called when a node has been added.  Save the label provided
 * @param {Object} node the item that has been added
 * @param {Function} callback
 */
function saveLabel(node, callback) {
	node.label = splitText(elem('popup-label').innerText, NODEWIDTH)
	clearPopUp()
	if (node.label === '') {
		alertMsg('No label: cancelled', 'error')
		callback(null)
		return
	}
	network.manipulation.inMode = 'addNode' // ensure still in Add mode, in case others have done something meanwhile
	callback(node)
	logHistory(`added factor '${node.label}'`)
}
/**
 * Draw a dialog box for user to edit a node
 * @param {Object} item the node
 * @param {Object} point the centre of the node
 * @param {Function} cancelAction what to do if the edit is cancelled
 * @param {Function} callback what to do if the edit is saved
 */
function editNode(item, point, cancelAction, callback) {
	if (item.locked) return
	initPopUp('Edit Factor', 180, item, cancelAction, saveNode, callback)
	elem('popup').insertAdjacentHTML(
		'beforeend',
		`
		<div class="popup-node-editor" id="popup-node-editor">	
			<div>fill</div>
			<div>border</div>
			<div>font</div>
			<div class="input-color-container">
				<div class="color-well" id="node-backgroundColor"></div>
			</div>
			<div class="input-color-container">
				<div class="color-well" id="node-borderColor"></div>
			</div>
			<div class="input-color-container">
				<div class="color-well" id="node-fontColor"></div>
			</div>
			<div>
				<select name="nodeEditShape" id="nodeEditShape">
					<option value="box">Shape...</option>
					<option value="ellipse">Ellipse</option>
					<option value="circle">Circle</option>
					<option value="dot">Dot</option>
					<option value="box">Rect</option>
					<option value="diamond">Diamond</option>
					<option value="star">Star</option>
					<option value="triangle">Triangle</option>
					<option value="hexagon">Hexagon</option>
					<option value="text">Text</option>
					<option value="portal">Portal</option>
				</select>
			</div>
			<div>
				<select name="nodeEditBorder" id="node-borderType">
					<option value="solid" selected>Solid</option>
					<option value="dashed">Dashed</option>
					<option value="dots">Dotted</option>
					<option value="none">No border</option>
				</select>
			</div>
			<div>
				<select name="nodeEditFontSize" id="nodeEditFontSize">
					<option value="14">Size...</option>
					<option value="24">Large</option>
					<option value="14">Normal</option>
					<option value="10">Small</option>
				</select>
			</div>
			<div id="popup-sizer">
				<label
					>&nbsp;Size:
					<input type="range" class="xrange" id="nodeEditSizer" />
				</label>
			</div>
		</div>
		`,
	)
	cp.createColorPicker('node-backgroundColor')
	elem('node-backgroundColor').style.backgroundColor = standardize_color(item.color.background)
	if (item.shape === 'image' && !item.isCluster) {
		item.shape = 'portal'
		if (elem('popup-portal-room')) elem('popup-portal-room').value = item.portal
		else {
			makePortalInput(item.portal)
		}
	}
	elem('nodeEditShape').value = item.shape
	cp.createColorPicker('node-borderColor')
	elem('node-borderColor').style.backgroundColor = standardize_color(item.color.border)
	cp.createColorPicker('node-fontColor')
	elem('node-fontColor').style.backgroundColor = standardize_color(item.font.color)
	elem('node-borderType').value = getDashes(item.shapeProperties.borderDashes, item.borderWidth)
	elem('nodeEditFontSize').value = item.font.size

	elem('nodeEditSizer').value = factorSizeToPercent(item.size)
	progressBar(elem('nodeEditSizer'))
	listen('nodeEditSizer', 'input', (event) => progressBar(event.target))
	listen('nodeEditShape', 'change', (event) => {
		if (event.target.value === 'portal') {
			makePortalInput(item.portal)
		} else {
			elem('popup-portal-link')?.remove()
			item.portal = undefined
		}
	})
	positionPopUp(point)
	elem('popup-label').focus()
	elem('popup').timer = setTimeout(() => {
		//ensure that the node cannot be locked out for ever
		cancelEdit(item, callback)
		alertMsg('Edit timed out', 'warn')
	}, TIMETOEDIT)
	lockNode(item)
	/**
	 * Generate HTML for the textarea to obtain the room name of the portal
	 * @param {string} portal room name to go to
	 */
	function makePortalInput(portal) {
		{
			portal = portal || ''
			// expand the dialog to accommodate the textarea
			elem('popup').style.height = `${230}px`
			elem('popup-node-editor').insertAdjacentHTML(
				'beforeend',
				`<div id="popup-portal-link">
      				<label for="popup-portal-room">Map:</label>
      				<textarea id="popup-portal-room" rows="1" placeholder="ABC-DEF-GHI-JKL">${portal}</textarea>
    			</div>`,
			)
		}
	}
}
// fancy portal image icon
const portalSvg = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path fill="#ff0000" d="M298.736 21.016c-99.298 0-195.928 104.647-215.83 233.736-7.074 45.887-3.493 88.68 8.512 124.787-4.082-6.407-7.92-13.09-11.467-20.034-16.516-32.335-24.627-65.378-25-96.272-11.74 36.254-8.083 82.47 14.482 126.643 27.7 54.227 81.563 91.94 139.87 97.502 5.658.725 11.447 1.108 17.364 1.108 99.298 0 195.93-104.647 215.83-233.736 9.28-60.196.23-115.072-22.133-156.506 21.625 21.867 36.56 45.786 44.617 69.496.623-30.408-14.064-65.766-44.21-95.806-33.718-33.598-77.227-50.91-114.995-50.723-2.328-.118-4.67-.197-7.04-.197zm-5.6 36.357c40.223 0 73.65 20.342 95.702 53.533 15.915 42.888 12.51 108.315.98 147.858-16.02 54.944-40.598 96.035-79.77 126.107-41.79 32.084-98.447 24.39-115.874-5.798-1.365-2.363-2.487-4.832-3.38-7.385 11.724 14.06 38.188 14.944 61.817 1.3 25.48-14.71 38.003-40.727 27.968-58.108-10.036-17.384-38.826-19.548-64.307-4.837-9.83 5.676-17.72 13.037-23.14 20.934.507-1.295 1.043-2.59 1.626-3.88-18.687 24.49-24.562 52.126-12.848 72.417 38.702 45.923 98.07 25.503 140.746-6.426 37.95-28.392 72.32-73.55 89.356-131.988 1.265-4.34 2.416-8.677 3.467-13.008-.286 2.218-.59 4.442-.934 6.678-16.807 109.02-98.412 197.396-182.272 197.396-35.644 0-65.954-15.975-87.74-42.71-26.492-48.396-15.988-142.083 4.675-185.15 26.745-55.742 66.133-122.77 134.324-116.804 46.03 4.027 63.098 58.637 39.128 116.22-8.61 20.685-21.192 39.314-36.21 54.313 24.91-16.6 46.72-42.13 59.572-73 23.97-57.583 6.94-113.422-39.13-116.805-85.737-6.296-137.638 58.55-177.542 128.485-9.21 19.9-16.182 40.35-20.977 60.707.494-7.435 1.312-14.99 2.493-22.652C127.67 145.75 209.275 57.373 293.135 57.373z"></path></g></svg>`
/**
 * save the node format details that have been edited
 * @param {Object} item the node that has been edited
 * @param {Function} callback
 */
function saveNode(item, callback) {
	unlockNode(item)
	item.label = splitText(elem('popup-label').innerText, NODEWIDTH)
	if (item.label === '') {
		// if there is no label, cancel (nodes must have a label)
		alertMsg('No label: cancelled', 'error')
		callback(null)
	}
	let color = elem('node-backgroundColor').style.backgroundColor
	item.color.background = color
	item.color.highlight.background = color
	item.color.hover.background = color
	color = elem('node-borderColor').style.backgroundColor
	item.color.border = color
	item.color.highlight.border = color
	item.color.hover.border = color
	item.font.color = elem('node-fontColor').style.backgroundColor
	let borderType = elem('node-borderType').value
	item.borderWidth = borderType === 'none' ? 0 : borderType === 'solid' ? 1 : 4
	item.shapeProperties.borderDashes = convertDashes(borderType)
	item.shape = elem('nodeEditShape').value
	if (item.shape === 'portal') {
		item.portal = elem('popup-portal-room')?.value
		if (!item.portal) {
			alertMsg('No map room provided', 'error')
			callback(null)
			return
		}
		item.portal = item.portal.match(/[a-zA-Z]{3}-[a-zA-Z]{3}-[a-zA-Z]{3}-[a-zA-Z]{3}/)
		if (!item.portal) {
			alertMsg('Ill-formed map room provided', 'error')
			callback(null)
			return
		}
		item.portal = item.portal[0]
		item.shape = 'image'
		item.image = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(portalSvg)
	}
	if (item.isCluster) {
		item.shape = 'image'
	}
	item.font.size = parseInt(elem('nodeEditFontSize').value)
	setFactorSizeFromPercent(item, elem('nodeEditSizer').value)
	network.manipulation.inMode = 'editNode' // ensure still in Add mode, in case others have done something meanwhile
	if (item.label.replace(/\s+|\n/g, '') === item.oldLabel.replace(/\s+|\n/g, ''))
		logHistory(`edited factor: '${item.label}'`)
	else logHistory(`edited factor, changing label from '${item.oldLabel}' to '${item.label}'`)
	clearPopUp()
	callback(item)
}
/**
 * User is about to edit the node.  Make sure that no one else can edit it simultaneously
 * @param {Node} item
 */
function lockNode(item) {
	item.locked = true
	item.opacity = 0.3
	item.oldLabel = item.label
	item.oldFontColor = item.font.color
	item.label = `${item.label}\n\n[Being edited by ${myNameRec.name}]`
	item.wasFixed = Boolean(item.fixed)
	item.fixed = true
	dontUndo = 'locked'
	data.nodes.update(item)
}
/**
 * User has finished editing the node.  Unlock it.
 * @param {Node} item
 */
function unlockNode(item) {
	item.locked = false
	item.opacity = 1
	item.fixed = item.wasFixed
	item.label = item.oldLabel
	dontUndo = 'unlocked'
	data.nodes.update(item)
	showNodeOrEdgeData()
}
/**
 * ensure that all factors and links are unlocked (called only when user leaves the page, to clear up for others)
 */
function unlockAll() {
	data.nodes.forEach((node) => {
		if (node.locked) cancelEdit(deepCopy(node))
	})
	data.edges.forEach((edge) => {
		if (edge.locked) cancelEdit(deepCopy(edge))
	})
}
/**
 * Draw a dialog box for user to edit an edge
 * @param {Object} item the edge
 * @param {Object} point the centre of the edge
 * @param {Function} cancelAction what to do if the edit is cancelled
 * @param {Function} callback what to do if the edit is saved
 */
function editEdge(item, point, cancelAction, callback) {
	if (item.locked) return
	initPopUp('Edit Link', 170, item, cancelAction, saveEdge, callback)
	elem('popup').insertAdjacentHTML(
		'beforeend',
		`<div class="popup-link-editor" id="popup-link-editor">
		<div>colour</div>
		<div></div>
		<div></div>
		<div class="input-color-container">
			<div class="color-well" id="linkEditLineColor"></div>
		</div>
		<div>
			<select name="linkEditWidth" id="linkEditWidth">
				<option value="1">Width: 1</option>
				<option value="4">Width: 4</option>
				<option value="8">Width: 8</option>
			</select>
		</div>
		<div>
			<select name="linkEditArrows" id="linkEditArrows">
				<option value="vee">Arrows...</option>
				<option value="vee">Sharp</option>
				<option value="arrow">Triangle</option>
				<option value="bar">Bar</option>
				<option value="circle">Circle</option>
				<option value="box">Box</option>
				<option value="diamond">Diamond</option>
				<option value="none">None</option>
			</select>
		</div>
		<div>
			<select name="linkEditDashes" id="linkEditDashes">
				<option value="solid" selected>Solid</option>
				<option value="dashedLinks">Dashed</option>
				<option value="dots">Dotted</option>
			</select>
		</div>
		<div>
			<i>Font size:</i>	
		</div>
		<div>
			<select id="linkEditFontSize">
				<option value="24">Large</option>
				<option value="14">Normal</option>
				<option value="10">Small</option>
			</select>
		</div>
	</div>
`,
	)
	elem('popup').style.borderColor = item.color.color
	elem('linkEditWidth').value = parseInt(item.width)
	cp.createColorPicker('linkEditLineColor')
	elem('linkEditLineColor').style.backgroundColor = standardize_color(item.color.color)
	elem('linkEditDashes').value = getDashes(item.dashes, null)
	elem('linkEditArrows').value = item.arrows.to.enabled ? item.arrows.to.type : 'none'
	elem('linkEditFontSize').value = parseInt(item.font.size)
	positionPopUp(point)
	elem('popup-label').focus()
	elem('popup').timer = setTimeout(() => {
		//ensure that the edge cannot be locked out for ever
		cancelEdit(item, callback)
		alertMsg('Edit timed out', 'warn')
	}, TIMETOEDIT)
	lockEdge(item)
}
/**
 * save the edge format details that have been edited
 * @param {Object} item the edge that has been edited
 * @param {Function} callback
 */
function saveEdge(item, callback) {
	unlockEdge(item)
	item.label = splitText(elem('popup-label').innerText, NODEWIDTH)
	if (item.label === '') item.label = ' '
	let color = elem('linkEditLineColor').style.backgroundColor
	item.color.color = color
	item.color.hover = color
	item.color.highlight = color
	item.width = parseInt(elem('linkEditWidth').value)
	if (!item.width) item.width = 1
	item.dashes = convertDashes(elem('linkEditDashes').value)
	item.arrows.to = {
		enabled: elem('linkEditArrows').value !== 'none',
		type: elem('linkEditArrows').value,
	}
	item.font.size = parseInt(elem('linkEditFontSize').value)
	network.manipulation.inMode = 'editEdge' // ensure still in edit mode, in case others have done something meanwhile
	// vis-network silently deselects all edges in the callback (why?).  So we have to mark this edge as unselected in preparation
	clearStatusBar()
	logHistory(`edited link from '${data.nodes.get(item.from).label}' to '${data.nodes.get(item.to).label}'`)
	clearPopUp()
	callback(item)
}
function lockEdge(item) {
	item.locked = true
	item.font.color = 'rgba(0,0,0,0.5)'
	item.opacity = 0.1
	item.oldLabel = item.label || ' '
	item.label = `Being edited by ${myNameRec.name}`
	dontUndo = 'locked'
	data.edges.update(item)
}
/**
 * User has finished editing the edge.  Unlock it.
 * @param {object} item
 */
function unlockEdge(item) {
	item.locked = false
	item.font.color = 'rgba(0,0,0,1)'
	item.opacity = 1
	item.label = item.oldLabel
	item.oldLabel = undefined
	dontUndo = 'unlocked'
	data.edges.update(item)
	showNodeOrEdgeData()
}
/* ----------------- end of node and edge creation and editing dialog -----------------*/

/**
 * if there is already a link from the 'from' node to the 'to' node, return it
 * @param {Object} from A node
 * @param {Object} to Another node
 */
function duplEdge(from, to) {
	return data.edges.get({
		filter: function (item) {
			return item.from === from && item.to === to
		},
	})
}

/**
 * Change the cursor style for the net pane and nav bar
 * @param {object} newCursorStyle
 */
function changeCursor(newCursorStyle) {
	if (inAddMode) return
	netPane.style.cursor = newCursorStyle
	elem('navbar').style.cursor = newCursorStyle
}
/**
 * User has set or changed the map title: update the UI and broadcast the new title
 * @param {event} e
 */
function mapTitle(e) {
	let title = e.target.innerText.trim()
	title = setMapTitle(title)
	yNetMap.set('mapTitle', title)
}
function pasteMapTitle(e) {
	e.preventDefault()
	let paste = (e.clipboardData || window.clipboardData).getData('text/plain')
	if (paste instanceof HTMLElement) paste = paste.textContent
	const selection = window.getSelection()
	if (!selection.rangeCount) return false
	selection.deleteFromDocument()
	selection.getRangeAt(0).insertNode(document.createTextNode(paste))
	setMapTitle(elem('maptitle').innerText)
}
/**
 * Format the map title
 * @param {string} title
 */
export function setMapTitle(title) {
	let div = elem('maptitle')
	clearStatusBar()
	if (!title) {
		title = 'Untitled map'
	}
	if (title === 'Untitled map') {
		div.classList.add('unsetmaptitle')
		document.title = appName
	} else {
		if (title.length > 50) {
			title = title.slice(0, 50)
			alertMsg('Map title is too long: truncated', 'warn')
		}
		div.classList.remove('unsetmaptitle')
		document.title = `${title}: ${shortAppName} map`
	}
	if (title !== div.innerText.trim()) div.innerText = title
	if (title.length >= 50) setEndOfContenteditable(div)
	setFileName()
	titleDropDown(title)
	return title
}
/**
 * Add this title to the local record of maps used
 * The list is stored as an object so that it is easy to add [room, title] pairs
 * and easy to modify the title of an existing room
 * @param {String} title
 */

const TITLELISTLEN = 500
function titleDropDown(title) {
	let recentMaps = localStorage.getItem('recents')
	if (recentMaps) recentMaps = JSON.parse(recentMaps)
	else recentMaps = {}
	//TODO this should be Map, not an object, to guarantee preservation of the insertion order
	if (title !== 'Untitled map') {
		recentMaps[room] = title
		// save only the most recent entries
		recentMaps = Object.fromEntries(Object.entries(recentMaps).slice(-TITLELISTLEN))
		localStorage.setItem('recents', JSON.stringify(recentMaps))
	}
	// if there is more than 1, append a down arrow after the map title as a cue to there being a list
	if (Object.keys(recentMaps).length > 1) elem('recent-rooms-caret').classList.remove('hidden')
}
/**
 * Create a drop down list of previous maps used for user selection
 */
function createTitleDropDown() {
	removeTitleDropDown()
	let selectList = document.createElement('ul')
	selectList.id = 'recent-rooms-select'
	selectList.classList.add('room-titles')
	elem('recent-rooms').appendChild(selectList)
	let recentMaps = JSON.parse(localStorage.getItem('recents'))
	// list is with New Map and then the most recent at the top
	if (recentMaps) {
		makeTitleDropDownEntry('*New map*', '*new*', false)
		let props = Object.keys(recentMaps).reverse()
		props.forEach((prop) => {
			makeTitleDropDownEntry(recentMaps[prop], prop)
		})
	}
	/**
	 * create a previous map menu item
	 * @param {string} name Title of map
	 * @param {string} room
	 */
	function makeTitleDropDownEntry(name, room) {
		let li = document.createElement('li')
		li.classList.add('room-title')
		li.textContent = name
		li.dataset.room = room
		li.addEventListener('click', (event) => changeRoom(event))
		selectList.appendChild(li)
	}
}
/**
 * User has clicked one of the previous map titles - confirm and change to the web page for that room
 * @param {Event} event
 */
function changeRoom(event) {
	if (data.nodes.length > 0) if (!confirm('Are you sure you want to move to a different map?')) return
	let newRoom = event.target.dataset.room
	removeTitleDropDown()
	let url = new URL(document.location)
	url.search = newRoom !== '*new*' ? `?room=${newRoom}` : ''
	window.location.replace(url)
}
/**
 * Remove the drop down list of previous maps if user clicks on the net-pane or on a map title.
 */
function removeTitleDropDown() {
	let oldSelect = elem('recent-rooms-select')
	if (oldSelect) oldSelect.remove()
}
/**
 * unselect all nodes and edges
 */
export function unSelect() {
	hideNotes()
	network.unselectAll()
	clearStatusBar()
}
/* 
  ----------- Calculate statistics in the background -------------
*/
// set  up a web worker to calculate network statistics in parallel with whatever
// the user is doing
var worker = new Worker(new URL('./betweenness.js', import.meta.url), { type: 'module' })
/**
 * Ask the web worker to recalculate network statistics
 */
function recalculateStats() {
	// wait 200 mSecs for things to settle down before recalculating
	setTimeout(() => {
		worker.postMessage([nodes.get(), edges.get()])
	}, 200)
}
worker.onmessage = function (e) {
	if (typeof e.data === 'string') alertMsg(e.data, 'error')
	else {
		let nodesToUpdate = []
		data.nodes.get().forEach((n) => {
			if (n.bc !== e.data[n.id]) {
				n.bc = e.data[n.id]
				nodesToUpdate.push(n)
			}
		})
		if (nodesToUpdate) {
			data.nodes.update(nodesToUpdate)
		}
	}
}
/* 
  ----------- Status messages ---------------------------------------
*/
/**
 * return a string listing the labels of the given nodes, with nice connecting words
 * @param {Array} factors List of node Ids
 * @param {Boolean} suppressType If true, don't start string with 'Factors'
 */
function listFactors(factors, suppressType) {
	if (factors.length > 5) return `${factors.length} factors`
	let str = ''
	if (!suppressType) {
		str = 'Factor'
		if (factors.length > 1) str = `${str}s`
		str = `${str}: `
	}
	return str + lf(factors)

	function lf(factors) {
		// recursive fn to return a string of the node labels, separated by commas and 'and'
		let n = factors.length
		let label = `'${shorten(data.nodes.get(factors[0]).label)}'`
		if (n === 1) return label
		factors.shift()
		if (n === 2) return label.concat(` and ${lf(factors)}`)
		return label.concat(`, ${lf(factors)}`)
	}
}

/**
 * return a string listing the number of Links, or if just one, the starting and ending factors
 * @param {Array} links
 */
function listLinks(links) {
	if (links.length > 1) return `${links.length} links`
	let link = data.edges.get(links[0])
	return `Link from "${shorten(data.nodes.get(link.from).label)}" to "${shorten(data.nodes.get(link.to).label)}"`
}
/**
 * returns string of currently selected labels of links and factors, nicely formatted
 * @returns {String} string of labels of links and factors, nicely formatted
 */
function selectedLabels() {
	let selectedNodes = network.getSelectedNodes()
	let selectedEdges = network.getSelectedEdges()
	let msg = ''
	if (selectedNodes.length > 0) msg = listFactors(selectedNodes)
	if (selectedNodes.length > 0 && selectedEdges.length > 0) msg += ' and '
	if (selectedEdges.length > 0) msg += listLinks(selectedEdges)
	return msg
}
/**
 * show the nodes and links selected in the status bar
 */
function showSelected() {
	let msg = selectedLabels()
	if (msg.length > 0) statusMsg(`${msg} selected`)
	else clearStatusBar()
	toggleDeleteButton()
}
/* ----------------------------------------zoom slider -------------------------------------------- */
Network.prototype.zoom = function (scale) {
	let newScale = scale === undefined ? 1 : scale < 0.001 ? 0.001 : scale
	const animationOptions = {
		scale: newScale,
		animation: {
			duration: 0,
		},
	}
	this.view.moveTo(animationOptions)
	zoomCanvas(newScale)
}

/**
 * rescale and redraw the network so that it fits the pane
 */
export function fit() {
	let prevPos = network.getViewPosition()
	network.fit({
		position: { x: 0, y: 0 }, // fit to centre of canvas
	})
	let newPos = network.getViewPosition()
	let newScale = network.getScale()
	zoomCanvas(1.0)
	panCanvas(prevPos.x - newPos.x, prevPos.y - newPos.y, 1.0)
	zoomCanvas(newScale)
	elem('zoom').value = newScale
	network.storePositions()
}
/**
 * expand/reduce the network view using the value in the zoom slider
 */
function zoomnet() {
	network.zoom(Number(elem('zoom').value))
}
/**
 * zoom by the given amount (+ve or -ve);
 * used by the + and - buttons at the ends of the zoom slider
 * and by trackpad zoom/pinch.
 * If the new zoom level becomes below zero, do nothing
 * @param {Number} incr
 */
function zoomincr(incr) {
	let newScale = network.getScale() * (1 + incr)
	if (newScale <= 0) newScale = 0.015
	if (newScale <= 4 && newScale >= 0) {
		elem('zoom').value = newScale
	}
	network.zoom(newScale)
}
/**
 * Set up pinch-to-zoom using native touch events
 */
function setUpPinchZoom() {
	let initialDistance = null
	let initialScale = 1

	function getTouchDistance(touch1, touch2) {
		const dx = touch1.clientX - touch2.clientX
		const dy = touch1.clientY - touch2.clientY
		return Math.sqrt(dx * dx + dy * dy)
	}

	netPane.addEventListener('touchstart', (e) => {
		if (e.touches.length === 2) {
			e.preventDefault()
			initialDistance = getTouchDistance(e.touches[0], e.touches[1])
			initialScale = Number(elem('zoom').value)
		}
	}, { passive: false })

	netPane.addEventListener('touchmove', (e) => {
		if (e.touches.length === 2 && initialDistance) {
			e.preventDefault()
			const currentDistance = getTouchDistance(e.touches[0], e.touches[1])
			const scale = currentDistance / initialDistance
			let newZoom = initialScale * scale
			if (newZoom > 4) newZoom = 4
			if (newZoom <= 0.015) newZoom = 0.015
			elem('zoom').value = newZoom
			network.zoom(newZoom)
		}
	}, { passive: false })

	netPane.addEventListener('touchend', (e) => {
		if (e.touches.length < 2) {
			initialDistance = null
		}
	})

	netPane.addEventListener('touchcancel', () => {
		initialDistance = null
	})
}

var clicks = 0 // accumulate 'mousewheel' clicks sent while display is updating
var ticking = false // if true, we are waiting for an AnimationFrame */
// see https://www.html5rocks.com/en/tutorials/speed/animations/

// listen for zoom/pinch (confusingly, referred to as mousewheel events)
listen(
	'net-pane',
	'wheel',
	(e) => {
		e.preventDefault()
		// reject all but vertical touch movements
		if (Math.abs(e.deltaX) <= 1) zoomscroll(e)
	},
	// must be passive, else pinch/zoom is intercepted by the browser itself
	{ passive: false },
)
/**
 * Zoom using a trackpad (with a mousewheel or two fingers)
 * @param {Event} event
 */
function zoomscroll(event) {
	clicks += event.deltaY
	requestZoom()
}
function requestZoom() {
	if (!ticking) requestAnimationFrame(zoomUpdate)
	ticking = true
}
const MOUSEWHEELZOOMRATE = 0.01 // how many 'clicks' of the mouse wheel/finger track correspond to 1 zoom increment
function zoomUpdate() {
	zoomincr(-clicks * MOUSEWHEELZOOMRATE)
	ticking = false
	clicks = 0
}

/* -----------Operations related to the top button bar (not the side panel)------------- */

/**
 * react to the user pressing the Add node button
 * handles cases when the button is disabled; has previously been pressed; and the Add link
 * button is active, as well as the normal case
 *
 */
function plusNode() {
	switch (inAddMode) {
		case 'disabled':
			return
		case 'addNode': {
			removeFactorCursor()
			showPressed('addNode', 'remove')
			stopEdit()
			break
		}
		case 'addLink': {
			showPressed('addLink', 'remove')
			stopEdit()
		} // falls through
		default:
			// false
			// don't allow user to add a factor while editing another one
			if (elem('popup').style.display === 'block') break
			network.unselectAll()
			changeCursor('cell')
			ghostCursor()
			inAddMode = 'addNode'
			showPressed('addNode', 'add')
			unSelect()
			statusMsg('Click on the map to add a factor')
			network.addNodeMode()
	}
}
/**
 * show a box attached to the cursor to guide where the Factor will be placed when the user clicks.
 */
function ghostCursor() {
	// no ghost cursor if the hardware only supports touch
	if (!window.matchMedia('(any-hover: hover)').matches) return
	const box = document.createElement('div')
	box.classList.add('ghost-factor', 'factor-cursor')
	box.innerText = 'Click on the map to add a factor'
	box.id = 'factor-cursor'
	document.body.appendChild(box)
	const netPaneRect = netPane.getBoundingClientRect()
	keepInWindow(box, netPaneRect)
	document.addEventListener('pointermove', () => {
		keepInWindow(box, netPaneRect)
	})
	function keepInWindow(box, netPaneRect) {
		const boxHalfWidth = box.offsetWidth / 2
		const boxHalfHeight = box.offsetHeight / 2
		let left = window.event.pageX - boxHalfWidth
		box.style.left = `${left <= netPaneRect.left
			? netPaneRect.left
			: left >= netPaneRect.right - box.offsetWidth
				? netPaneRect.right - box.offsetWidth
				: left
			}px`
		let top = window.event.pageY - boxHalfHeight
		box.style.top = `${top <= netPaneRect.top
			? netPaneRect.top
			: top >= netPaneRect.bottom - box.offsetHeight
				? netPaneRect.bottom - box.offsetHeight
				: top
			}px`
	}
}
/**
 * remove the factor cursor if it exists
 */
function removeFactorCursor() {
	let factorCursor = elem('factor-cursor')
	if (factorCursor) {
		factorCursor.remove()
	}
	clearStatusBar()
}
/**
 * react to the user pressing the Add Link button
 * handles cases when the button is disabled; has previously been pressed; and the Add Node
 * button is active, as well as the normal case
 */
function plusLink() {
	switch (inAddMode) {
		case 'disabled':
			return
		case 'addLink': {
			showPressed('addLink', 'remove')
			stopEdit()
			break
		}
		case 'addNode': {
			showPressed('addNode', 'remove')
			stopEdit() // falls through
		} // falls through
		default:
			// false
			// don't allow user to add a factor while editing another one
			if (elem('popup').style.display === 'block') break
			removeFactorCursor()
			if (data.nodes.length < 2) {
				alertMsg('Two Factors needed to link', 'error')
				break
			}
			changeCursor('crosshair')
			inAddMode = 'addLink'
			showPressed('addLink', 'add')
			unSelect()
			statusMsg('Now drag from the middle of the Source factor to the middle of the Destination factor')
			network.setOptions({
				interaction: { dragView: false, selectable: false },
			})
			network.addEdgeMode()
	}
}
/**
 * cancel adding node and links
 */
function stopEdit() {
	inAddMode = false
	network.disableEditMode()
	network.setOptions({
		interaction: { dragView: true, selectable: true },
	})
	clearStatusBar()
	changeCursor('default')
}
/**
 * Add or remove the CSS style showing that the button has been pressed
 * @param {string} el the Id of the button
 * @param {*} action whether to add or remove the style
 *
 */
function showPressed(el, action) {
	elem(el).children.item(0).classList[action]('pressed')
}

function undo() {
	if (buttonIsDisabled('undo')) return
	unSelect()
	yUndoManager.undo()
	logHistory('undid last action')
	undoRedoButtonStatus()
}

function redo() {
	if (buttonIsDisabled('redo')) return
	unSelect()
	yUndoManager.redo()
	logHistory('redid last action')
	undoRedoButtonStatus()
}

export function undoRedoButtonStatus() {
	setButtonDisabledStatus('undo', yUndoManager.undoStack.length === 0)
	setButtonDisabledStatus('redo', yUndoManager.redoStack.length === 0)
}
/**
 * Returns true if the button is not disabled
 * @param {String} id
 * @returns Boolean
 */
function buttonIsDisabled(id) {
	return elem(id).classList.contains('disabled')
}
/**
 * Change the visible state of a button
 * @param {String} id
 * @param {Boolean} state - true to make the button disabled
 */
function setButtonDisabledStatus(id, state) {
	if (state) elem(id).classList.add('disabled')
	else elem(id).classList.remove('disabled')
}
/**
 * Delete the selected node, plus all the edges that connect to it (so no edge is left dangling)
 */
function deleteNode() {
	network.deleteSelected()
	clearStatusBar()
	toggleDeleteButton()
}

/**
 * set up the modal dialog that opens when the user clicks the Share icon in the nav bar
 */
function setUpShareDialog() {
	let modal = elem('shareModal')
	let inputElem = elem('text-to-copy')
	let copiedText = elem('copied-text')

	// When the user clicks the button, open the modal
	listen('share', 'click', () => {
		let path = `${window.location.pathname}?room=${room}`
		let linkToShare = window.location.origin + path
		copiedText.style.display = 'none'
		modal.style.display = 'block'
		inputElem.cols = linkToShare.length.toString()
		inputElem.value = linkToShare
		inputElem.style.height = `${inputElem.scrollHeight - 3}px`
		inputElem.select()
		network.storePositions()
	})
	listen('clone-button', 'click', () => openWindow('clone'))
	listen('view-button', 'click', () => openWindow('view'))
	listen('table-button', 'click', () => openWindow('table'))
	// When the user clicks on <span> (x), close the modal
	listen('modal-close', 'click', (event) => closeShareDialog(event))
	// When the user clicks anywhere on the background, close it
	listen('shareModal', 'click', (event) => closeShareDialog(event))

	listen('copy-text', 'click', (e) => {
		e.preventDefault()
		// Select the text
		inputElem.select()
		if (copyText(inputElem.value))
			// Display the copied text message
			copiedText.style.display = 'inline-block'
	})

	function openWindow(type) {
		let path = ''
		switch (type) {
			case 'clone': {
				doClone(false)
				break
			}
			case 'view': {
				doClone(true)
				break
			}
			case 'table': {
				path = `${window.location.pathname.replace('prsm.html', 'table.html')}?room=${room}`
				window.open(path, '_blank')
				break
			}
			default:
				console.log('Bad case in openWindow()')
				break
		}
		modal.style.display = 'none'
	}

	function closeShareDialog(event) {
		if (event.target === modal || event.target === elem('modal-close')) {
			modal.style.display = 'none'
		}
	}
}
function doClone(onlyView) {
	// undo any ongoing analysis and unselect all nodes and edges
	setRadioVal('radius', 'All')
	setRadioVal('stream', 'All')
	setRadioVal('paths', 'All')
	analyse()
	unSelect()

	let options = {
		created: {
			action: `cloned this map from room: ${room + (onlyView ? ' (Read Only)' : '')}`,
			actor: myNameRec.name,
		},
		viewOnly: onlyView,
	}
	// save state as a UTF16 string
	let state = saveState(options)
	// save it in local storage
	localForage
		.setItem('clone', state)
		.then(() => {
			// make a room id
			let clonedRoom = generateRoom()
			// open a new map
			let path = `${window.location.pathname}?room=${clonedRoom}`
			let debugType = new URL(window.location.href).searchParams.get("debug")
			if (onlyView && elem('addCopyButton').checked) path += '&copyButton'
			if (debugType) path += `&debug=${debugType}`
			window.open(path, '_blank')
			logHistory(`made a ${onlyView ? 'read-only copy' : 'clone'} of the map into room: ${clonedRoom}`)
		})
		.catch(function (err) {
			console.log('Error saving clone to local storage:', err)
		})
}
function mergeMap() {
	elem('mergedRoom').value = ''
	elem('mergeDialog').showModal()
}
function doMerge() {
	let path = elem('mergedRoom').value
	if (!path) {
		alertMsg('No map given to merge', 'error')
		return
	}
	try {
		let url = new URL(path)
		let roomToMerge = url.searchParams.get('room')
		console.log('merging ', roomToMerge)
		mergeRoom(roomToMerge)
		logHistory(`merged map from room: ${roomToMerge}`)
	} catch {
		alertMsg('Invalid map URL', 'error')
		return
	}
	elem('mergeDialog').close()
}
/* ----------------------------------------------------------- Search ------------------------------------------------------*/
/**
 * Open an input for user to type label of node to search for and generate suggestions when user starts typing
 */
function search() {
	let searchBar = elem('search-bar')
	if (searchBar.style.display === 'block') hideSearchBar()
	else {
		searchBar.style.display = 'block'
		elem('search-icon').style.display = 'block'
		searchBar.focus()
		listen('search-bar', 'keyup', searchTargets)
	}
}
/**
 * generate and display a set of suggestions - nodes with labels that include the substring that the user has typed
 */
function searchTargets() {
	let str = elem('search-bar').value
	if (!str || str === ' ') {
		if (elem('targets')) elem('targets').remove()
		return
	}
	let targets = elem('targets')
	if (targets) targets.remove()
	targets = document.createElement('ul')
	targets.id = 'targets'
	targets.classList.add('search-ul')
	str = str.toLowerCase()
	let suggestions = data.nodes.get().filter((n) => n.label.toLowerCase().includes(str))
	suggestions.forEach((n) => {
		let li = document.createElement('li')
		li.classList.add('search-suggestion')
		let div = document.createElement('div')
		div.classList.add('search-suggestion-text')
		div.innerText = n.label.replace(/\n/g, ' ')
		div.dataset.id = n.id
		div.addEventListener('click', (event) => doSearch(event))
		li.appendChild(div)
		targets.appendChild(li)
	})
	elem('suggestion-list').appendChild(targets)
}
/**
 * do the search using the string in the search bar and, when found, focus on that node
 */
function doSearch(event) {
	let nodeId = event.target.dataset.id
	if (nodeId) {
		let prevPos = network.getViewPosition()
		network.focus(nodeId, { scale: 1.5 })
		let newPos = network.getViewPosition()
		let newScale = network.getScale()
		zoomCanvas(1.0)
		panCanvas(prevPos.x - newPos.x, prevPos.y - newPos.y, 1.0)
		zoomCanvas(newScale)
		elem('zoom').value = newScale
		network.storePositions()
		hideSearchBar()
	}
}
function hideSearchBar() {
	let searchBar = elem('search-bar')
	if (elem('targets')) elem('targets').remove()
	searchBar.value = ''
	searchBar.style.display = 'none'
	elem('search-icon').style.display = 'none'
}

/**
 * show or hide the side panel
 */
function togglePanel() {
	if (container.panelHidden) {
		panel.classList.remove('hide')
		positionNotes()
	} else {
		panel.classList.add('hide')
	}
	container.panelHidden = !container.panelHidden
}
dragElement(elem('panel'), elem('panelHeader'))

/* ------------------------------------------------operations related to the side panel -------------------------------------*/

/**
 * when the window is resized, make sure that the pane is still visible
 * @param {HTMLelement} pane
 */
function keepPaneInWindow(pane) {
	if (pane.offsetLeft + pane.offsetWidth > container.offsetLeft + container.offsetWidth) {
		pane.style.left = `${container.offsetLeft + container.offsetWidth - pane.offsetWidth}px`
	}
	if (pane.offsetTop + pane.offsetHeight > container.offsetTop + container.offsetHeight) {
		pane.style.top = `${container.offsetTop +
			container.offsetHeight -
			pane.offsetHeight -
			document.querySelector('footer').offsetHeight
			}px`
	}
}

function openTab(tabId) {
	let i
	let tabcontent
	let tablinks
	// Get all elements with class="tabcontent" and hide them by moving them off screen
	tabcontent = document.getElementsByClassName('tabcontent')
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].classList.add('hide')
	}
	// Get all elements with class="tablinks" and remove the class "active"
	tablinks = document.getElementsByClassName('tablinks')
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(' active', '')
	}
	// Show the current tab, and add an "active" class to the button that opened the tab
	elem(tabId).classList.remove('hide')
	event.currentTarget.className += ' active'
	clearStatusBar()
	// if a Notes panel is in the way, move it
	positionNotes()
}

// Factors and Links Tabs
function applySampleToNode(event) {
	if (event.detail !== 1) return // only process single clicks here
	let selectedNodeIds = network.getSelectedNodes()
	if (selectedNodeIds.length === 0) return
	let nodesToUpdate = []
	let sample = event.currentTarget.groupNode
	for (let node of data.nodes.get(selectedNodeIds)) {
		if (node.isCluster) break
		if (sample !== node.grp) {
			node = deepMerge(node, styles.nodes[sample])
			node.grp = sample
			node.modified = timestamp()
			nodesToUpdate.push(node)
		}
	}
	data.nodes.update(nodesToUpdate)
	let nNodes = nodesToUpdate.length
	if (nNodes)
		logHistory(
			`applied ${styles.nodes[sample].groupLabel} style to ${nNodes === 1 ? nodesToUpdate[0].label : nNodes + ' factors'
			}`,
		)
	lastNodeSample = sample
}
/**
 * Apply the sample's format to the selected links
 * @param {event} event
 */
function applySampleToLink(event) {
	if (event.detail !== 1) return // only process single clicks here
	let sample = event.currentTarget.groupLink
	let selectedEdges = network.getSelectedEdges()
	if (selectedEdges.length === 0) return
	let edgesToUpdate = []
	for (let edge of data.edges.get(selectedEdges)) {
		if (edge.isClusterEdge) break
		if (sample !== edge.grp) {
			edge = deepMerge(edge, styles.edges[sample])
			edge.grp = sample
			edge.modified = timestamp()
			edgesToUpdate.push(edge)
		}
	}
	data.edges.update(edgesToUpdate)
	let nEdges = edgesToUpdate.length
	if (nEdges)
		logHistory(`applied ${styles.edges[sample].groupLabel} style to ${nEdges} link${nEdges === 1 ? '' : 's'} `)
	lastLinkSample = sample
}
/**
 * Remember the last style sample that the user clicked and use this for future factors/links
 * Mark the sample with a light blue border
 * @param {number} nodeId
 * @param {number} linkId
 */
export function updateLastSamples(nodeId, linkId) {
	if (nodeId) {
		lastNodeSample = nodeId
		let sampleNodes = Array.from(document.getElementsByClassName('sampleNode'))
		let node = sampleNodes.filter((e) => e.groupNode === nodeId)[0]
		sampleNodes.forEach((n) => n.classList.remove('sampleSelected'))
		node.classList.add('sampleSelected')
	}
	if (linkId) {
		lastLinkSample = linkId
		let sampleLinks = Array.from(document.getElementsByClassName('sampleLink'))
		let link = sampleLinks.filter((e) => e.groupLink === linkId)[0]
		sampleLinks.forEach((n) => n.classList.remove('sampleSelected'))
		link.classList.add('sampleSelected')
	}
}

/**
 * Hide or reveal all the Factors or Links with the given style
 * @param {Object} obj {sample: state}
 */
function updateFactorsOrLinksHiddenByStyle(obj) {
	for (const sampleElementId in obj) {
		let sampleElement = elem(sampleElementId)
		let state = obj[sampleElementId]
		sampleElement.dataset.hide = state ? 'hidden' : 'visible'
		sampleElement.style.opacity = state ? 0.6 : 1.0
	}
}

/********************************************************Notes********************************************** */
/**
 * Globally either display or don't display notes when a factor or link is selected
 * @param {Event} e
 */
function showNotesSwitch(e) {
	showNotesToggle = e.target.checked
	doShowNotes(showNotesToggle)
	yNetMap.set('showNotes', showNotesToggle)
}
function doShowNotes(toggle) {
	elem('showNotesSwitch').checked = toggle
	showNotesToggle = toggle
	network.redraw()
	showNodeOrEdgeData()
}
/**
 * User has clicked the padlock.  Toggle padlock state and fix the location of the node
 */
function setFixed() {
	if (viewOnly) return
	let locked = elem('fixed').style.display === 'none'
	let node = data.nodes.get(editor.id)
	node.fixed = locked
	elem('fixed').style.display = node.fixed ? 'inline' : 'none'
	elem('unfixed').style.display = node.fixed ? 'none' : 'inline'
	data.nodes.update(node)
}
/**
 * Display a panel to show info about the selected edge or node
 */
function showNodeOrEdgeData() {
	hideNotes()
	if (!showNotesToggle) return
	if (network.getSelectedNodes().length === 1) showNodeData()
	else if (network.getSelectedEdges().length === 1) showEdgeData()
}
/**
 * open another window (popupWindow) in which Notes can be edited
 */
function openNotesWindow() {
	popupWindow = window.open('./dist/NoteWindow.html', 'popupWindowName', 'toolbar=no,width=600,height=600')
}
/**
 * Hide the Node or Edge Data panel
 */
function hideNotes() {
	if (editor == null) return
	let notesPanel = document.getElementById('nodeNotePanel')
	if (notesPanel.classList.contains('hide')) notesPanel = document.getElementById('edgeNotePanel')
	if (notesPanel.classList.contains('hide')) return
	notesPanel.classList.add('hide')
	document.getSelection().removeAllRanges()
	notesPanel.querySelector('.ql-toolbar').remove()
	editor = null
	if (popupWindow) popupWindow.close()
}
/**
 * Show the notes box and the fixed node check box
 * @param {integer} nodeId
 */
function showNodeData(nodeId) {
	let panel = elem('nodeNotePanel')
	nodeId = nodeId || network.getSelectedNodes()[0]
	let node = data.nodes.get(nodeId)
	elem('fixed').style.display = node.fixed && !viewOnly ? 'inline' : 'none'
	elem('unfixed').style.display = node.fixed || viewOnly ? 'none' : 'inline'
	elem('nodeLabel').innerHTML = node.label ? shorten(node.label) : ''
	if (node.created) {
		elem('nodeCreated').innerHTML = `${timeAndDate(node.created.time)} by ${node.created.user}`
		elem('nodeCreation').style.display = 'flex'
	} else elem('nodeCreation').style.display = 'none'
	if (node.modified) {
		elem('nodeModified').innerHTML = `${timeAndDate(node.modified.time)} by ${node.modified.user}`
		elem('nodeModification').style.display = 'flex'
	} else elem('nodeModification').style.display = 'none'
	editor = new Quill('#node-notes', {
		modules: {
			toolbar: viewOnly
				? null
				: [
					'bold',
					'italic',
					'underline',
					'link',
					{ list: 'ordered' },
					{ list: 'bullet' },
					{ indent: '-1' },
					{ indent: '+1' },
				],
		},
		placeholder: 'Notes',
		theme: 'snow',
		readOnly: viewOnly,
	})
	window.editor = editor // used by popupEditor to access this editor
	editor.id = node.id
	if (node.note) {
		if (node.note instanceof Object) editor.setContents(node.note)
		else editor.setText(node.note)
	} else editor.setText('')
	editor.on('text-change', (delta, oldDelta, source) => {
		if (source === 'user') {
			data.nodes.update({
				id: nodeId,
				note: isQuillEmpty(editor) ? '' : editor.getContents(),
				modified: timestamp(),
			})
			if (popupWindow) {
				popupEditor = popupWindow.popupEditor
				if (popupEditor) popupEditor.setContents(editor.getContents())
			}
		}
	})
	panel.classList.remove('hide')
	positionNotes()
}
/**
 * user has clicked on the sparkles icon in a Factor window
 * return the output from an LLM asked to explain the factor
 */
async function genAINode() {
	alertMsg('Processing...', 'info', true)
	const sparklesElem = elem('sparklesNode')
	sparklesElem.classList.add('rotating')
	let nodeId = network.getSelectedNodes()[0]
	let node = data.nodes.get(nodeId)
	let context = data.nodes.get().map(n => n.label.replaceAll('\n', ' ')).join(', ')
	let aiResponse = await getAIresponse(`Explain ${node.label}. Answer concisely in no more than 200 words.`, context)
	editor.setContents(aiResponse)
	let modified = timestamp()
	data.nodes.update({
		id: nodeId,
		note: isQuillEmpty(editor) ? '' : editor.getContents(),
		modified: modified,
	})
	elem('nodeModified').innerHTML = `${timeAndDate(modified.time)} by ${modified.user}`
	positionNotes()
	sparklesElem.classList.remove('rotating')
	cancelAlertMsg()
}
/**
 * Make the notes panel resizeable by dragging its corner handle
 * @param {HTMLElement} notePanel 
 */
function makeNotesPanelResizeable(notePanel) {
	const notePanelCornerHandle = notePanel.querySelector('.corner-handle')

	let isResizingCorner = false
	let startX = 0
	let startY = 0
	let startWidth = 0
	let startHeight = 0

	notePanelCornerHandle.addEventListener('pointerdown', (e) => {
		isResizingCorner = true
		startX = e.clientX
		startY = e.clientY

		const styles = window.getComputedStyle(notePanel)
		startWidth = parseInt(styles.width, 10)
		startHeight = parseInt(styles.height, 10)

		document.body.style.userSelect = 'none'
		// Prevent default touch behaviors like scrolling
		notePanelCornerHandle.style.touchAction = 'none'
	})

	document.addEventListener('pointermove', (e) => {
		if (!isResizingCorner) return

		const dx = e.clientX - startX
		const dy = e.clientY - startY

		const newWidth = startWidth + dx
		const newHeight = startHeight + dy

		if (newWidth > 150) notePanel.style.width = newWidth + 'px'
		if (newHeight > 200) notePanel.style.height = newHeight + 'px'
	})

	document.addEventListener('pointerup', () => {
		isResizingCorner = false
		document.body.style.userSelect = 'auto'
		positionNotes()
	})
}
/**
 * Show the notes box for an edge
 * @param {integer} edgeId 
 */
function showEdgeData(edgeId) {
	let panel = elem('edgeNotePanel')
	edgeId = edgeId || network.getSelectedEdges()[0]
	let edge = data.edges.get(edgeId)
	elem('edgeLabel').innerHTML = edge.label?.trim().length
		? edge.label
		: `Link from "${shorten(data.nodes.get(edge.from).label)}" to "${shorten(data.nodes.get(edge.to).label)}"`
	if (edge.created) {
		elem('edgeCreated').innerHTML = `${timeAndDate(edge.created.time)} by ${edge.created.user}`
		elem('edgeCreation').style.display = 'flex'
	} else elem('edgeCreation').style.display = 'none'
	if (edge.modified) {
		elem('edgeModified').innerHTML = `${timeAndDate(edge.modified.time)} by ${edge.modified.user}`
		elem('edgeModification').style.display = 'flex'
	} else elem('edgeModification').style.display = 'none'
	editor = new Quill('#edge-notes', {
		modules: {
			toolbar: viewOnly
				? null
				: [
					'bold',
					'italic',
					'underline',
					'link',
					{ list: 'ordered' },
					{ list: 'bullet' },
					{ indent: '-1' },
					{ indent: '+1' },
				],
		},
		placeholder: 'Notes',
		theme: 'snow',
		readOnly: viewOnly,
	})
	editor.id = edge.id
	window.editor = editor // used by popupEditor to access this editor
	if (edge.note) {
		if (edge.note instanceof Object) editor.setContents(edge.note)
		else editor.setText(edge.note)
	} else editor.setText('')
	editor.on('text-change', (delta, oldDelta, source) => {
		if (source === 'user') {
			data.edges.update({
				id: edgeId,
				note: isQuillEmpty(editor) ? '' : editor.getContents(),
				modified: timestamp(),
			})
			if (popupWindow) {
				popupEditor = popupWindow.popupEditor
				if (popupEditor) popupEditor.setContents(editor.getContents())
			}
		}
	})
	panel.classList.remove('hide')
	positionNotes()
}
/**
 * user has clicked on the sparkles icon in a Link node window
 * return the output from an LLM asked to elaborate on the causal
 * relationship between the two linked factors
 */
async function genAIEdge() {
	alertMsg('Processing...', 'info', true)
	const sparklesElem = elem('sparklesEdge')
	sparklesElem.classList.add('rotating')
	let edgeId = network.getSelectedEdges()[0]
	let edge = data.edges.get(edgeId)
	let context = data.nodes.get().map(n => n.label.replaceAll('\n', ' ')).join(', ')
	let aiResponse = await getAIresponse(`Explain the causal link from ${data.nodes.get(edge.from).label} to 
	${data.nodes.get(edge.to).label}. Answer concisely in no more than 200 words.`, context)
	editor.setContents(aiResponse)
	let modified = timestamp()
	data.edges.update({
		id: edgeId,
		note: isQuillEmpty(editor) ? '' : editor.getContents(),
		modified: modified,
	})
	elem('edgeModified').innerHTML = `${timeAndDate(modified.time)} by ${modified.user}`
	positionNotes()
	sparklesElem.classList.remove('rotating')
	cancelAlertMsg()
}
/**
 * ensure that the panel is not outside the net pane, nor obscuring the Settings panel
 * @param {HTMLElement} notesPanel
 */
function positionNotes() {
	let notesPanel = document.getElementById('nodeNotePanel')
	if (notesPanel.classList.contains('hide')) notesPanel = document.getElementById('edgeNotePanel')
	if (notesPanel.classList.contains('hide')) return
	let netPane = document.getElementById('net-pane')
	let settings = document.getElementById('panel')

	let notesPanelRect = notesPanel.getBoundingClientRect()
	let settingsRect = settings.getBoundingClientRect()
	let netPaneRect = netPane.getBoundingClientRect()
	// if the notes would cover up the settings panel, move the notes to the left of the settings panel
	if (
		notesPanelRect.right > settingsRect.left &&
		notesPanelRect.top < settingsRect.bottom
	) {
		notesPanel.style.left = `${settingsRect.left - notesPanelRect.width - 10}px`
		notesPanelRect = notesPanel.getBoundingClientRect()
	}
	// if the notes panel is taller than the net pane, increase its width and reduce its height
	if (notesPanelRect.height > netPaneRect.height - 20) {
		notesPanel.style.width = `$({
						(notesPanelRect.width * notesPanelRect.height) / (netPaneRect.height - 20)
					}px`
		notesPanel.style.height = `${netPaneRect.height - 20}px`
		notesPanel.style.left = `${notesPanelRect.right - notesPanelRect.width}px`
		notesPanel.style.top = 10
		notesPanelRect = notesPanel.getBoundingClientRect()
	}
	// if the notes panel is wider than the net pane, reduce its width
	if (notesPanelRect.width > netPaneRect.width) {
		notesPanel.style.width = `${netPaneRect.width - 20}px`
		notesPanel.style.left = 10
		notesPanelRect = notesPanel.getBoundingClientRect()
	}
	// if the notes panel is outside the boundary of the net pane, shift it into the pane
	if (notesPanelRect.left < netPaneRect.left + 10)
		notesPanel.style.left = `${netPaneRect.left + 10}px`
	if (notesPanelRect.right > netPaneRect.right - 10)
		notesPanel.style.left = `${netPaneRect.right - notesPanelRect.width - 10}px`
	let visibleBottom = Math.min(notesPanelRect.bottom, notesPanelRect.top + notesPanel.offsetHeight)
	if (visibleBottom > netPaneRect.bottom - 10)
		notesPanel.style.top = `${netPaneRect.bottom - notesPanel.offsetHeight - 10}px`
	if (notesPanelRect.top < netPaneRect.top + 10)
		notesPanel.style.top = `${netPaneRect.top + 10}px`
}
// Network tab

/**
 * Choose and apply a layout algorithm
 */
function autoLayout(e) {
	let option = e.target.value
	let selectElement = elem('layoutSelect')
	selectElement.value = option
	let label = selectElement.options[selectElement.selectedIndex].innerText
	network.storePositions() // record current positions so it can be undone
	if (network.physics.options.enabled) {
		// another layout already in progress - cancel it first
		network.off('stabilized')
		network.stopSimulation()
		network.setOptions({ physics: { enabled: false } })
		network.storePositions()
		alertMsg(`Previous layout cancelled`, 'warn')
	}
	doc.transact(() => {
		switch (option) {
			case 'off': {
				network.setOptions({ physics: { enabled: false } })
				break
			}
			case 'trophic': {
				try {
					trophic(data)
					trophicDistribute()
					data.nodes.update(data.nodes.get())
					elem('layoutSelect').value = 'off'
					statusMsg('Trophic layout applied')
				} catch (e) {
					alertMsg(`Trophic layout: ${e.message}`, 'error')
				}
				break
			}
			case 'fan': {
				{
					let nodes = data.nodes.get().filter((n) => !n.nodeHidden)
					nodes.forEach((n) => (n.level = undefined))
					let selectedNodes = getSelectedAndFixedNodes().map((nId) => data.nodes.get(nId))
					if (selectedNodes.length === 0) {
						alertMsg('At least one Factor needs to be selected', 'error')
						elem('layoutSelect').value = 'off'
						return
					}
					// if Up or Down stream are selected, use those for the direction
					let direction = 'from'
					if (getRadioVal('stream') === 'downstream') direction = 'to'
					else if (getRadioVal('stream') === 'upstream') direction = 'from'
					else {
						// if neither,
						//  and more links from the selected nodes are going upstream then downstream,
						//  put the selected nodes on the right, else on the left
						let nUp = 0
						let nDown = 0
						selectedNodes.forEach((sl) => {
							nUp += network
								.getConnectedNodes(sl.id, 'to')
								.filter((nId) => !data.nodes.get(nId).nodeHidden).length
							nDown += network
								.getConnectedNodes(sl.id, 'from')
								.filter((nId) => !data.nodes.get(nId).nodeHidden).length
						})
						direction = nUp > nDown ? 'to' : 'from'
					}
					let minX = Math.min(...nodes.map((n) => n.x))
					let maxX = Math.max(...nodes.map((n) => n.x))
					selectedNodes.forEach((n) => {
						setZLevel(n, direction)
					})
					nodes.forEach((n) => {
						if (n.level === undefined) n.level = 0
					})
					let maxLevel = Math.max(...nodes.map((n) => n.level))
					let gap = (maxX - minX) / maxLevel
					for (let l = 0; l <= maxLevel; l++) {
						let x = l * gap + minX
						if (direction === 'from') x = maxX - l * gap
						let nodesOnLevel = nodes.filter((n) => n.level === l)
						nodesOnLevel.forEach((n) => (n.x = x))
						let ySpaceNeeded = nodesOnLevel
							.map((n) => {
								let box = network.getBoundingBox(n.id)
								return box.bottom - box.top + 10
							})
							.reduce((a, b) => a + b, 0)
						let yGap = ySpaceNeeded / nodesOnLevel.length
						let newY = -ySpaceNeeded / 2
						nodesOnLevel
							.sort((a, b) => a.y - b.y)
							.forEach((n) => {
								n.y = newY
								newY += yGap
							})
					}
					data.nodes.update(nodes)
					elem('layoutSelect').value = 'off'
					statusMsg('Fan layout applied')
				}
				break
			}
			case 'barnesHut':
			case 'repulsion':
				{
					statusMsg('Working...')
					let options = { physics: { solver: option, stabilization: true } }
					options.physics[option] = {}
					options.physics[option].springLength = avEdgeLength()
					network.setOptions(options)
					// cancel the iterative algorithms as soon as they have stabilized
					network.on('stabilized', () => cancelLayout())
				}
				break
			case 'forceAtlas2Based': {
				statusMsg('Working...')
				let options = {
					physics: {
						solver: 'forceAtlas2Based',
						forceAtlas2Based: {
							theta: 2, // Boundary between consolidated long range forces and individual short range forces
							gravitationalConstant: -500, // Repulsion force (-ve values push nodes apart)
							centralGravity: 0.01, // Pulls nodes toward the center
							springConstant: 0.3, // Controls edge length
							springLength: 0, // Edge attraction force
							damping: 0.8, // Reduces oscillation
							avoidOverlap: 1, // Prevents node overlap
						},
					},
				}
				network.setOptions(options)
				// cancel the iterative algorithms as soon as they have stabilized
				network.on('stabilized', () => cancelLayout())
				network.on('stabilizationProgress', (obj) => {
					statusMsg(`Working... ${obj.iterations} iterations of ${obj.total}`)
				})
				break
			}
			default: {
				console.log('Unknown layout option')
				break
			}
		}
	})
	// if the layout doesn't stabilize, cancel it after 30 seconds
	setTimeout(() => {
		cancelLayout()
	}, 30000)
	logHistory(`applied ${label} layout`)

	/**
	 * cancel the iterative layout algorithms
	 */
	function cancelLayout() {
		network.setOptions({ physics: { enabled: false } })
		network.storePositions()
		elem('layoutSelect').value = 'off'
		statusMsg(`${label} layout applied`)
		data.nodes.update(data.nodes.get())
	}

	/**
	 * set the levels for fan, using a breadth first search
	 * @param {object} node root node
	 * @param {string} direction either 'from' or 'to', depending on whether the links to use are point from or to the node
	 */
	function setZLevel(node, direction) {
		let q = [node]
		let level = 0
		node.level = 0
		while (q.length > 0) {
			let currentNode = q.shift()
			let connectedNodes = data.nodes
				.get(network.getConnectedNodes(currentNode.id, direction))
				.filter((n) => !n.nodeHidden && n.level === undefined)
			if (connectedNodes.length > 0) {
				level = currentNode.level + 1
				connectedNodes.forEach((n) => {
					n.level = level
				})
				q = q.concat(connectedNodes)
			}
		}
	}
	/**
	 * find the average length of all edges, as a guide to the layout spring length
	 * so that map is roughly as spaced out as before layout
	 * @returns average length (in canvas units)
	 */
	function avEdgeLength() {
		let edgeSum = 0
		data.edges.forEach((e) => {
			let from = data.nodes.get(e.from)
			let to = data.nodes.get(e.to)
			edgeSum += Math.sqrt((from.x - to.x) ** 2 + (from.y - to.y) ** 2)
		})
		return edgeSum / data.edges.length
	}
	/**
	 * At each level for a trophic layout, distribute the Factors equally along the vertical axis,
	 * avoiding overlaps
	 */
	function trophicDistribute() {
		for (let level = 0; level <= NLEVELS; level++) {
			let nodesOnLevel = data.nodes.get().filter((n) => n.level === level)
			let ySpaceNeeded = nodesOnLevel
				.map((n) => {
					let box = network.getBoundingBox(n.id)
					return box.bottom - box.top + 10
				})
				.reduce((a, b) => a + b, 0)
			let gap = ySpaceNeeded / nodesOnLevel.length
			let newY = -ySpaceNeeded / 2
			nodesOnLevel
				.sort((a, b) => a.y - b.y)
				.forEach((n) => {
					n.y = newY
					newY += gap
				})
		}
	}
}

function snapToGridSwitch(e) {
	snapToGridToggle = e.target.checked
	doSnapToGrid(snapToGridToggle)
	yNetMap.set('snapToGrid', snapToGridToggle)
}

export function doSnapToGrid(toggle) {
	elem('snaptogridswitch').checked = toggle
	if (toggle) {
		data.nodes.update(
			data.nodes.get().map((n) => {
				snapToGrid(n)
				return n
			}),
		)
	}
}

function selectCurve(e) {
	let option = e.target.value
	setCurve(option)
	yNetMap.set('curve', option)
}

export function setCurve(option) {
	elem('curveSelect').value = option
	network.setOptions({
		edges: {
			smooth: option === 'Curved' ? { type: 'cubicBezier' } : false,
		},
	})
}

function updateNetBack(color) {
	let ul = elem('underlay')
	ul.style.backgroundColor = color
	// if in drawing mode, make the underlay translucent so that network shows through
	if (elem('toolbox').style.display === 'block') makeTranslucent(ul)
	yNetMap.set('background', color)
}

var backgroundOpacity = 0.6

function makeTranslucent(el) {
	el.style.backgroundColor = getComputedStyle(el)
		.backgroundColor.replace(')', `, ${backgroundOpacity})`)
		.replace('rgb', 'rgba')
}

function makeSolid(el) {
	el.style.backgroundColor = getComputedStyle(el)
		.backgroundColor.replace(`, ${backgroundOpacity})`, ')')
		.replace('rgba', 'rgb')
}
export function setBackground(color) {
	elem('underlay').style.backgroundColor = color
	if (elem('toolbox').style.display === 'block') makeTranslucent(elem('underlay'))
	elem('netBackColorWell').style.backgroundColor = color
}

function toggleDrawingLayer() {
	drawingSwitch = elem('toolbox').style.display === 'block'
	let ul = elem('underlay')
	if (drawingSwitch) {
		// close drawing layer
		deselectTool()
		elem('toolbox').style.display = 'none'
		elem('underlay').style.zIndex = 0
		makeSolid(ul)
		document.querySelector('.upper-canvas').style.zIndex = 0
		inAddMode = false
		elem('buttons').style.visibility = 'visible'
		setButtonDisabledStatus('addNode', false)
		setButtonDisabledStatus('addLink', false)
		undoRedoButtonStatus()
		if (elem('showLegendSwitch').checked) legend()
		if (nChanges) logHistory('drew on the background layer')
		changeCursor('default')
	} else {
		// expose drawing layer
		elem('toolbox').style.display = 'block'
		ul.style.zIndex = 1000
		ul.style.cursor = 'default'
		document.querySelector('.upper-canvas').style.zIndex = 1001
		// make the underlay (which is now overlay) translucent
		makeTranslucent(ul)
		clearLegend()
		inAddMode = 'disabled'
		elem('buttons').style.visibility = 'hidden'
		elem('help-button').style.visibility = 'visible'
		setButtonDisabledStatus('addNode', true)
		setButtonDisabledStatus('addLink', true)
		setButtonDisabledStatus('undo', true)
		setButtonDisabledStatus('redo', true)
	}
	drawingSwitch = !drawingSwitch
	network.redraw()
}
function ensureNotDrawing() {
	if (!drawingSwitch) return
	toggleDrawingLayer()
	elem('drawing').checked = false
}

function selectAllFactors() {
	selectFactors(data.nodes.getIds({ filter: (n) => !n.nodeHidden }))
	showSelected()
}

export function selectFactors(nodeIds) {
	network.selectNodes(nodeIds, false)
	showSelected()
}

function selectAllLinks() {
	selectLinks(data.edges.getIds({ filter: (e) => !e.edgeHidden }))
	showSelected()
}

export function selectLinks(edgeIds) {
	network.selectEdges(edgeIds)
	showSelected()
}

/**
 * Selects all the nodes and edges that have been created or modified by a user
 */
function selectUsersItems(event) {
	event.preventDefault()
	let userName = event.target.dataset.userName
	let usersNodes = data.nodes
		.get()
		.filter((n) => n.created?.user === userName || n.modified?.user === userName)
		.map((n) => n.id)
	let userEdges = data.edges
		.get()
		.filter((e) => e.created?.user === userName || e.modified?.user === userName)
		.map((e) => e.id)
	network.setSelection({ nodes: usersNodes, edges: userEdges })
	showSelected()
}

function legendSwitch(e) {
	let on = e.target.checked
	setLegend(on, true)
	yNetMap.set('legend', on)
}
export function setLegend(on, warn) {
	elem('showLegendSwitch').checked = on
	if (on) legend(warn)
	else clearLegend()
}
function votingSwitch(e) {
	let on = e.target.checked
	setVoting(on)
	yNetMap.set('voting', on)
}
function setVoting(on) {
	elem('showVotingSwitch').checked = on
	showVotingToggle = on
	network.redraw()
}
/************************************************************** Analysis tab ************************************************* */

/**
 *
 * @param {String} name of Radio button group
 * @returns value of the button that is checked
 */
function getRadioVal(name) {
	// get list of radio buttons with specified name
	let radios = document.getElementsByName(name)
	// loop through list of radio buttons
	for (let i = 0, len = radios.length; i < len; i++) {
		if (radios[i].checked) return radios[i].value
	}
}
/**
 *
 * @param {String} name of the radio button group
 * @param {*} value check the button with this value
 */
function setRadioVal(name, value) {
	// get list of radio buttons with specified name
	let radios = document.getElementsByName(name)
	// loop through list of radio buttons and set the check on the one with the value
	for (let i = 0, len = radios.length; i < len; i++) {
		radios[i].checked = radios[i].value === value
	}
}
/**
 * Return an array of the node Ids of Factors that are selected or are locked
 * @returns Array
 */
function getSelectedAndFixedNodes() {
	return [
		...new Set(
			network.getSelectedNodes().concat(
				data.nodes
					.get()
					.filter((n) => n.fixed)
					.map((n) => n.id),
			),
		),
	]
}

/**
 * Sets the Analysis radio buttons and Factor selection according to values in global hiddenNodes
 *  (which is set when yNetMap is loaded, or when a file is read in)
 */
function setAnalysisButtonsFromRemote() {
	if (netLoaded) {
		let selectedNodes = [].concat(hiddenNodes.selected) // ensure that hiddenNodes.selected is an array
		if (hiddenNodes.radiusSetting !== 'All' || hiddenNodes.streamSetting !== 'All' || hiddenNodes.pathsSetting !== 'All') {
			network.selectNodes(selectedNodes, false) // in viewing  only mode, this does nothing
			if (selectedNodes.length > 0) {
				if (!viewOnly) statusMsg(`${listFactors(getSelectedAndFixedNodes())} selected`)
			} else clearStatusBar()
		}
		showNodeOrEdgeData()
		if (hiddenNodes.radiusSetting) setRadioVal('radius', hiddenNodes.radiusSetting)
		if (hiddenNodes.streamSetting) setRadioVal('stream', hiddenNodes.streamSetting)
		if (hiddenNodes.pathsSetting) setRadioVal('paths', hiddenNodes.pathsSetting)
	}
}

function setYMapAnalysisButtons() {
	let selectedNodes = getSelectedAndFixedNodes()
	yNetMap.set('radius', {
		radiusSetting: getRadioVal('radius'),
		selected: selectedNodes,
	})
	yNetMap.set('stream', {
		streamSetting: getRadioVal('stream'),
		selected: selectedNodes,
	})
	yNetMap.set('paths', {
		pathsSetting: getRadioVal('paths'),
		selected: selectedNodes,
	})
}
/**
 * Hide factors and links to show only those closest to the selected factors and/or
 * those up/downstream and/or those on paths between the selected factors
 */
function analyse() {
	let selectedNodes = getSelectedAndFixedNodes()
	setYMapAnalysisButtons()
	// get all nodes and edges and unhide them before hiding those not wanted to be visible
	let nodes = data.nodes
		.get()
		.filter((n) => !n.isCluster)
		.map((n) => {
			setNodeHidden(n, false)
			return n
		})
	let edges = data.edges
		.get()
		.filter((e) => !e.isClusterEdge)
		.map((e) => {
			setEdgeHidden(e, false)
			return e
		})
	cancelHiddenStyles()
	// if showing everything, we are done
	if (getRadioVal('radius') === 'All' && getRadioVal('stream') === 'All' && getRadioVal('paths') === 'All') {
		resetAll()
		showSelected()
		showNodeOrEdgeData()
		return
	}
	// check that at least one factor is selected
	if (selectedNodes.length === 0 && getRadioVal('paths') === 'All') {
		alertMsg('A Factor needs to be selected', 'error')
		resetAll()
		return
	}
	// but paths between factors needs at least two
	if (getRadioVal('paths') !== 'All' && selectedNodes.length < 2) {
		alertMsg('Select at least 2 factors to show paths between them', 'warn')
		resetAll()
		return
	}
	hideNotes()
	// these operations are not commutative (at least for networks with loops), so do them all in order
	if (getRadioVal('radius') !== 'All') hideNodesByRadius(selectedNodes, parseInt(getRadioVal('radius')))
	if (getRadioVal('stream') !== 'All') hideNodesByStream(selectedNodes, getRadioVal('stream'))
	if (getRadioVal('paths') !== 'All') hideNodesByPaths(selectedNodes, getRadioVal('paths'))

	// finally display the map with its hidden factors and edges
	data.nodes.update(nodes)
	data.edges.update(edges)

	// announce what has been done
	let streamMsg = ''
	if (getRadioVal('stream') === 'upstream') streamMsg = 'upstream'
	if (getRadioVal('stream') === 'downstream') streamMsg = 'downstream'
	let radiusMsg = ''
	if (getRadioVal('radius') === '1') radiusMsg = 'within one link'
	if (getRadioVal('radius') === '2') radiusMsg = 'within two links'
	if (getRadioVal('radius') === '3') radiusMsg = 'within three links'
	let pathsMsg = ''
	if (getRadioVal('paths') === 'allPaths') pathsMsg = ': showing all paths'
	if (getRadioVal('paths') === 'shortestPath') pathsMsg = ': showing shortest paths'
	if (getRadioVal('stream') === 'All' && getRadioVal('radius') === 'All')
		statusMsg(
			`Showing  ${getRadioVal('paths') === 'allPaths' ? 'all paths' : 'shortest paths'} between ${listFactors(
				getSelectedAndFixedNodes(),
				true,
			)}`,
		)
	else
		statusMsg(
			`Factors ${streamMsg} ${streamMsg && radiusMsg ? ' and ' : ''} ${radiusMsg} of ${listFactors(
				getSelectedAndFixedNodes(),
				true,
			)}${pathsMsg}`,
		)
	/**
	 * return all to neutral analysis state
	 */
	function resetAll() {
		setRadioVal('radius', 'All')
		setRadioVal('stream', 'All')
		setRadioVal('paths', 'All')
		setYMapAnalysisButtons()
		data.nodes.update(nodes)
		data.edges.update(edges)
	}
	/**
	 * Hide factors that are more than radius links distant from those selected
	 * @param {string[]} selectedNodes
	 * @param {Integer} radius
	 */
	function hideNodesByRadius(selectedNodes, radius) {
		let nodeIdsInRadiusSet = new Set()
		let linkIdsInRadiusSet = new Set()

		// put those factors and links within radius links into these sets
		if (getRadioVal('stream') === 'upstream' || getRadioVal('stream') === 'All') inSet(selectedNodes, radius, 'to')
		if (getRadioVal('stream') === 'downstream' || getRadioVal('stream') === 'All')
			inSet(selectedNodes, radius, 'from')

		// hide all nodes and edges not in radius
		nodes.forEach((n) => {
			if (!nodeIdsInRadiusSet.has(n.id)) setNodeHidden(n, true)
		})
		edges.forEach((e) => {
			if (!linkIdsInRadiusSet.has(e.id)) setEdgeHidden(e, true)
		})
		// add links between factors that are in radius set, to give an ego network
		nodeIdsInRadiusSet.forEach((f) => {
			network.getConnectedEdges(f).forEach((e) => {
				let edge = data.edges.get(e)
				if (nodeIdsInRadiusSet.has(edge.from) && nodeIdsInRadiusSet.has(edge.to)) setEdgeHidden(edge, false)
			})
		})

		/**
		 * recursive function to collect Factors and Links within radius links from any of the nodes listed in nodeIds
		 * Factor ids are collected in nodeIdsInRadiusSet and links in linkIdsInRadiusSet
		 * Links are followed in a consistent direction, i.e. if 'to', only links directed away from the the nodes are followed
		 * @param {string[]} nodeIds
		 * @param {number} radius
		 * @param {string} direction - either 'from' or 'to'
		 */
		function inSet(nodeIds, radius, direction) {
			if (radius < 0) return
			nodeIds.forEach((nId) => {
				let linked = []
				nodeIdsInRadiusSet.add(nId)
				let links = network.getConnectedEdges(nId).filter((e) => data.edges.get(e)[direction] === nId)
				if (links && radius > 0)
					links.forEach((lId) => {
						linkIdsInRadiusSet.add(lId)
						linked.push(data.edges.get(lId)[direction === 'to' ? 'from' : 'to'])
					})
				if (linked) inSet(linked, radius - 1, direction)
			})
		}
	}
	/**
	 * Hide factors that are not up or downstream from the selected factors.
	 * Does not include links or factors that are already hidden
	 * @param {string[]} selectedNodes
	 * @param {string} direction - 'upstream' or 'downstream'
	 */
	function hideNodesByStream(selectedNodes, upOrDown) {
		let nodeIdsInStreamSet = new Set()
		let linkIdsInStreamSet = new Set()

		let radiusVal = getRadioVal('radius')
		let radius = Infinity
		if (radiusVal !== 'All') {
			radius = parseInt(radiusVal)
		}
		let direction = 'to'
		if (upOrDown === 'upstream') direction = 'from'

		// breadth first search for all Factors that are downstream and less than or equal to radius links away
		data.nodes.map((n) => (n.level = undefined))
		selectedNodes.forEach((nodeId) => {
			nodeIdsInStreamSet.add(nodeId)
			let node = data.nodes.get(nodeId)
			let q = [node]
			let level = 0
			node.level = 0
			while (q.length > 0 && level <= radius) {
				let currentNode = q.shift()
				let connectedNodes = data.nodes
					.get(network.getConnectedNodes(currentNode.id, direction))
					.filter((n) => !(n.nodeHidden || nodeIdsInStreamSet.has(n.id)))
				if (connectedNodes.length > 0) {
					level = currentNode.level + 1
					connectedNodes.forEach((n) => {
						nodeIdsInStreamSet.add(n.id)
						n.level = level
					})
					q = q.concat(connectedNodes)
				}
			}
		})

		// hide all nodes and edges not up or down stream
		nodes.forEach((n) => {
			if (!nodeIdsInStreamSet.has(n.id)) setNodeHidden(n, true)
		})
		edges.forEach((e) => {
			if (!linkIdsInStreamSet.has(e.id)) setEdgeHidden(e, true)
		})

		// add links between factors that are in radius set, to give an ego network
		nodeIdsInStreamSet.forEach((f) => {
			network.getConnectedEdges(f).forEach((e) => {
				let edge = data.edges.get(e)
				if (nodeIdsInStreamSet.has(edge.from) && nodeIdsInStreamSet.has(edge.to)) setEdgeHidden(edge, false)
			})
		})
	}

	/**
	 * Hide all factors and links that are not on the shortest path (or all paths) between the selected factors
	 * Avoids factors or links that are hidden
	 * @param {string[]} selectedNodes
	 * @param {string} pathType - either 'allPaths' or 'shortestPath'
	 */
	function hideNodesByPaths(selectedNodes, pathType) {
		// paths is an array of objects with from and to node ids, or an empty array if there is no path
		let paths = shortestPaths(selectedNodes, pathType === 'allPaths')
		if (paths.length === 0) {
			alertMsg('No path between the selected Factors', 'info')
			setRadioVal('paths', 'All')
			setYMapAnalysisButtons()
			return
		}
		// hide nodes and links that are not included in paths
		let nodeIdsInPathsSet = new Set()
		let linkIdsInPathsSet = new Set()

		paths.forEach((links) => {
			links.forEach((link) => {
				let edge = data.edges.get({
					filter: (e) => e.to === link.to && e.from === link.from,
				})[0]
				linkIdsInPathsSet.add(edge.id)
				nodeIdsInPathsSet.add(edge.from)
				nodeIdsInPathsSet.add(edge.to)
			})
		})
		// hide all factors and links that are not in the set of paths
		nodes.forEach((n) => {
			if (!nodeIdsInPathsSet.has(n.id)) setNodeHidden(n, true)
		})
		edges.forEach((e) => {
			if (!linkIdsInPathsSet.has(e.id)) setEdgeHidden(e, true)
		})

		/**
		 * Given two or more selected factors, return a list of all the links that are either on any path between them, or just the ones on the shortest paths between them
		 * @param {Boolean} all when true, find all the links that connect to the selected factors; when false, find the shortest paths between the selected factors
		 * @returns	Arrays of objects with from: and to: properties for all the links (an empty array if there is no path between any of the selected factors)
		 */
		function shortestPaths(selectedNodes, all) {
			let visited = new Map()
			let allPaths = []
			// list of all pairs of the selected factors
			let combos = selectedNodes.flatMap((v, i) => selectedNodes.slice(i + 1).map((w) => [v, w]))
			// for each pair, find the sequences of links in both directions and combine them
			combos.forEach((combo) => {
				let source = combo[0]
				let dest = combo[1]
				let links = pathList(source, dest, all)
				if (links.length > 0) allPaths.push(links)
				links = pathList(dest, source, all)
				if (links.length > 0) allPaths.push(links)
			})
			return allPaths

			/**
			 * find the paths (as a list of links) that connect the source and destination
			 * @param {String} source
			 * @param {String} dest
			 * @param {Boolean} all true of all paths between Source and Destination are wanted; false if just the shortest path
			 * @returns an array of lists of links that connect the paths
			 */
			function pathList(source, dest, all) {
				visited.clear()
				let links = []
				let paths = getPaths(source, dest)
				// if no path found, getPaths return an array of length greater than the total number of factors in the map, or a string
				// in this case, return an empty list
				if (!Array.isArray(paths) || paths.length === data.nodes.length + 1) paths = []
				if (!all) {
					for (let i = 0; i < paths.length - 1; i++) {
						links.push({ from: paths[i], to: paths[i + 1] })
					}
				}
				return links
				/**
				 * recursively explore the map starting from source until destination is reached.
				 * stop if a factor has already been visited, or at a dead end (zero out-degree)
				 * @param {String} source
				 * @param {String} dest
				 * @returns an array of factors, the path so far followed
				 */
				function getPaths(source, dest) {
					if (source === dest) return [dest]
					visited.set(source, true)
					let path = [source]
					// only consider nodes and edges that are not hidden
					let connectedNodes = network
						.getConnectedEdges(source)
						.filter((e) => {
							let edge = data.edges.get(e)
							return !edge.edgeHidden && edge.from === source
						})
						.map((e) => data.edges.get(e).to)
					if (connectedNodes.length === 0) return 'deadend'
					if (all) {
						// all paths between the source and destination
						connectedNodes.forEach((next) => {
							let vis = visited.get(next)
							if (vis === 'onpath') {
								links.push({ from: source, to: next })
								path = path.concat([next])
							} else if (!vis) {
								let p = getPaths(next, dest)
								if (Array.isArray(p) && p.length > 0) {
									links.push({ from: source, to: next })
									visited.set(next, 'onpath')
									path = path.concat(p)
								}
							}
						})
					} else {
						// shortest path between the source and destination
						let bestPath = []
						let bestPathLength = data.nodes.length
						connectedNodes.forEach((next) => {
							let p = visited.get(next)
							if (!p) {
								p = getPaths(next, dest)
								visited.set(next, p)
							}
							if (Array.isArray(p) && p.length > 0) {
								if (p.length < bestPathLength) {
									bestPath = p
									bestPathLength = p.length
								}
							}
						})
						path = path.concat(bestPath)
					}
					// if no progress has been made (the path is just the initial source factor), return an empty path
					if (path.length === 1) path = []
					return path
				}
			}
		}
	}
}
/**
 * Unset the indicators on the Settings Factor and Link tabs that show that Factors/Links with
 * these styles are hidden
 * Assumes that the factors and links have already been unhidden - this just  removes the UI indicators
 */
function cancelHiddenStyles() {
	Array.from(document.getElementsByClassName('sampleNode'))
		.filter((n) => n.dataset.hide === 'hidden')
		.forEach((n) => {
			n.dataset.hide = 'visible'
			n.style.opacity = 1.0
		})
	Array.from(document.getElementsByClassName('sampleLink'))
		.filter((e) => e.dataset.hide === 'hidden')
		.forEach((e) => {
			e.dataset.hide = 'visible'
			e.style.opacity = 1.0
		})
}

function sizingSwitch(e) {
	let metric = e.target.value
	sizing(metric)
	yNetMap.set('sizing', metric)
}

/**
 * set the size of the nodes proportional to the selected metric
 * @param {String} metric none, all the same size, in degree, out degree or betweenness centrality
 */
// constants for sizes of nodes
const MIN_WIDTH = 50
const EQUAL_WIDTH = 100
const MAX_WIDTH = 200

export function sizing(metric) {
	let nodesToUpdate = []
	let min = Number.MAX_VALUE
	let max = 0
	data.nodes.forEach((node) => {
		let oldValue = node.val
		switch (metric) {
			case 'Off':
			case 'Equal': {
				node.val = 0
				break
			}
			case 'Inputs': {
				node.val = network.getConnectedNodes(node.id, 'from').length
				break
			}
			case 'Outputs': {
				node.val = network.getConnectedNodes(node.id, 'to').length
				break
			}
			case 'Leverage': {
				let inDegree = network.getConnectedNodes(node.id, 'from').length
				let outDegree = network.getConnectedNodes(node.id, 'to').length
				node.val = inDegree === 0 ? 0 : outDegree / inDegree
				break
			}
			case 'Centrality': {
				node.val = node.bc
				break
			}
		}
		if (node.val < min) min = node.val
		if (node.val > max) max = node.val
		if (metric === 'Off' || metric === 'Equal' || node.val !== oldValue) nodesToUpdate.push(node)
	})
	data.nodes.forEach((node) => {
		switch (metric) {
			case 'Off': {
				node.widthConstraint = node.heightConstraint = false
				node.size = 25
				break
			}
			case 'Equal': {
				node.widthConstraint = node.heightConstraint = node.size = EQUAL_WIDTH
				break
			}
			default:
				node.widthConstraint =
					node.heightConstraint =
					node.size =
					MIN_WIDTH + MAX_WIDTH * scale(min, max, node.val)
		}
	})
	data.nodes.update(nodesToUpdate)
	elem('sizing').value = metric

	function scale(min, max, value) {
		if (max === min) {
			return 0.5
		} else {
			return Math.max(0, (value - min) * (1 / (max - min)))
		}
	}
}

// Note: most of the clustering functionality is in cluster.js
/**
 * User has chosen a clustering option
 * @param {Event} e
 */
function selectClustering(e) {
	let option = e.target.value
	// it doesn't make much sense to cluster while the factors are hidden, so undo that
	setRadioVal('radius', 'All')
	setRadioVal('stream', 'All')
	setRadioVal('paths', 'All')
	setYMapAnalysisButtons()
	doc.transact(() => {
		data.nodes.update(
			data.nodes.get().map((n) => {
				setNodeHidden(n, false)
				return n
			}),
		)
		data.edges.update(
			data.edges.get().map((e) => {
				setEdgeHidden(e, false)
				return e
			}),
		)
	})
	cluster(option)
	fit()
	yNetMap.set('cluster', option)
}
export function setCluster(option) {
	elem('clustering').value = option
}
/**
 * recreate the Clustering drop down menu to include user attributes as clustering options
 * @param {object} obj {menu value, menu text}
 */
export function recreateClusteringMenu(obj) {
	// remove any old select items, other than the standard ones (which are the first 4: None, Style, Color, Community)
	let select = elem('clustering')
	for (let i = 4, len = select.options.length; i < len; i++) {
		select.remove()
	}
	// append the ones provided
	for (const property in obj) {
		if (obj[property] !== '*deleted*') {
			let opt = document.createElement('option')
			opt.value = property
			opt.text = shorten(obj[property], 12)
			select.add(opt, null)
		}
	}
}

/* ---------------------------------------history window --------------------------------*/
/**
 * display the history log in a window
 */
function showHistory() {
	elem('history-window').style.display = 'block'
	let log = elem('history-log')
	log.innerHTML = yHistory
		.toArray()
		.map(
			(rec) => `<div class="history-time">${timeAndDate(rec.time)}: </div>
		<div class="history-action">${rec.user} ${rec.action}</div>
		<div class="history-rollback" data-time="${rec.time}"></div>`,
		)
		.join(' ')
	document.querySelectorAll('div.history-rollback').forEach((e) => addRollbackIcon(e))
	if (log.children.length > 0) {
		// without the timeout, the window does not scroll fully to the bottom
		setTimeout(() => log.lastChild.scrollIntoView(false), 20)
	}
}
/**
 * add a button for rolling back if there is state data corresponding to this log record
 * @param {HTMLElement} e - history record
 * */
async function addRollbackIcon(e) {
	await localForage.getItem(timekey(parseInt(e.dataset.time))).then((state) => {
		if (state) {
			e.id = `hist${e.dataset.time}`
			e.innerHTML = `<div class="tooltip">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-bootstrap-reboot" viewBox="0 0 16 16">
				<path d="M1.161 8a6.84 6.84 0 1 0 6.842-6.84.58.58 0 1 1 0-1.16 8 8 0 1 1-6.556 3.412l-.663-.577a.58.58 0 0 1 .227-.997l2.52-.69a.58.58 0 0 1 .728.633l-.332 2.592a.58.58 0 0 1-.956.364l-.643-.56A6.812 6.812 0 0 0 1.16 8z"/>
				<path d="M6.641 11.671V8.843h1.57l1.498 2.828h1.314L9.377 8.665c.897-.3 1.427-1.106 1.427-2.1 0-1.37-.943-2.246-2.456-2.246H5.5v7.352h1.141zm0-3.75V5.277h1.57c.881 0 1.416.499 1.416 1.32 0 .84-.504 1.324-1.386 1.324h-1.6z"/>
				</svg>
				<span class="tooltiptext rollbacktip">Rollback to before this action</span>
			</div>
		</div>`
			if (elem(e.id)) listen(e.id, 'click', rollback)
		}
	})
}
/**
 * Restores the state of the map to a previous one
 * @param {Event} event
 * @returns null if no rollback possible or cancelled
 */
function rollback(event) {
	let rbTime = parseInt(event.currentTarget.dataset.time)
	localForage.getItem(timekey(rbTime)).then((rb) => {
		if (!rb) return
		if (!confirm(`Roll back the map to what it was before ${timeAndDate(rbTime)}?`)) return
		let state = JSON.parse(decompressFromUTF16(rb))
		data.nodes.clear()
		data.edges.clear()
		data.nodes.update(state.nodes)
		data.edges.update(state.edges)
		doc.transact(() => {
			for (const k in state.net) {
				yNetMap.set(k, state.net[k])
			}
			setMapTitle(state.net.mapTitle)
			for (const k in state.samples) {
				ySamplesMap.set(k, state.samples[k])
			}
			if (state.paint) {
				yPointsArray.delete(0, yPointsArray.length)
				yPointsArray.insert(0, state.paint)
			}
			if (state.drawing) {
				yDrawingMap.clear()
				for (const k in state.drawing) {
					yDrawingMap.set(k, state.drawing[k])
				}
				updateFromDrawingMap()
			}
		})
		localForage.removeItem(timekey(rbTime))
		logHistory(`rolled back the map to what it was before ${timeAndDate(rbTime, true)}`, null, 'rollback')
	})
}

function showHistorySwitch() {
	if (elem('showHistorySwitch').checked) showHistory()
	else elem('history-window').style.display = 'none'
}
listen('history-close', 'click', historyClose)
function historyClose() {
	elem('history-window').style.display = 'none'
	elem('showHistorySwitch').checked = false
}

dragElement(elem('history-window'), elem('history-header'))

/* --------------------------------------- avatars and shared cursors--------------------------------*/

var oldViewOnly = viewOnly // save the viewOnly state
/* tell user if they are offline and disconnect websocket server */
window.addEventListener('offline', () => {
	alertMsg('No network connection - working offline (view only)', 'info')
	wsProvider.shouldConnect = false
	network.setOptions({ interaction: { dragNodes: false, hover: false } })
	hideNavButtons()
	sideDrawEditor.enable(false)
	oldViewOnly = viewOnly
	viewOnly = true
})
window.addEventListener('online', () => {
	wsProvider.connect()
	alertMsg('Network connection re-established', 'info')
	viewOnly = oldViewOnly
	if (!viewOnly) showNavButtons()
	sideDrawEditor.enable(true)
	network.setOptions({ interaction: { dragNodes: true, hover: true } })
	showAvatars()
})
/**
 *  set up user monitoring (awareness)
 */
function setUpAwareness() {
	showAvatars()
	yAwareness.on('change', (event) => receiveEvent(event))

	// regularly broadcast our own state, every 20 seconds
	setInterval(() => {
		yAwareness.setLocalStateField('pkt', { time: Date.now() })
	}, 20000)

	// if debug = fake, generate fake mouse events every 200 ms for testing
	if (/fake/.test(debug)) {
		setInterval(() => {
			yAwareness.setLocalStateField('cursor', {
				x: Math.random() * 1000 - 500,
				y: Math.random() * 1000 - 500,
			})
		}, 200)
	}

	// fade out avatar when there has been no movement of the mouse for 15 minutes
	asleep(false)
	var sleepTimer = setTimeout(() => asleep(true), TIMETOSLEEP)

	// throttle mousemove broadcast to avoid overloading server
	var throttled = false
	var THROTTLETIME = 200
	window.addEventListener('mousemove', (e) => {
		// broadcast my mouse movements
		if (throttled) return
		throttled = true
		setTimeout(() => (throttled = false), THROTTLETIME)
		clearTimeout(sleepTimer)
		asleep(false)
		sleepTimer = setTimeout(() => asleep(true), TIMETOSLEEP)
		// broadcast current position of mouse in canvas coordinates
		let box = netPane.getBoundingClientRect()
		yAwareness.setLocalStateField(
			'cursor',
			network.DOMtoCanvas({
				x: Math.round(e.clientX - box.left),
				y: Math.round(e.clientY - box.top),
			}),
		)
	})
}

/**
 * Set the awareness local state to show whether this client is sleeping (no mouse movement for 15 minutes)
 * @param {Boolean} isSleeping
 */
function asleep(isSleeping) {
	if (myNameRec.asleep === isSleeping) return
	myNameRec.asleep = isSleeping
	yAwareness.setLocalState({ user: myNameRec })
	showAvatars()
	//disconnect from websocket server to save resources when sleeping
	if (isSleeping) wsProvider.disconnect()
	else wsProvider.connect()
}
/**
 * display the awareness events
 * @param {object} event
 */
function traceUsers(event) {
	let msg = ''
	event.added.forEach((id) => {
		msg += `Added ${user(id)} (${id}) `
	})
	event.updated.forEach((id) => {
		msg += `Updated ${user(id)} (${id}) `
	})
	event.removed.forEach((id) => {
		msg += `Removed (${id}) `
	})
	console.log('yAwareness', exactTime(), msg)

	function user(id) {
		let userRec = yAwareness.getStates().get(id)
		return isEmpty(userRec.user) ? id : userRec.user.name
	}
}
var lastMicePositions = new Map()
var lastAvatarStatus = new Map()
var refreshAvatars = true
/**
 * Despatch to deal with event
 * @param {object} event - from yAwareness.on('change')
 */
function receiveEvent(event) {
	if (/aware/.test(debug)) traceUsers(event)
	if (elem('showUsersSwitch').checked) {
		let box = netPane.getBoundingClientRect()
		let changed = event.added.concat(event.updated)
		changed.forEach((userId) => {
			let rec = yAwareness.getStates().get(userId)
			if (userId !== clientID && rec.cursor && !object_equals(rec.cursor, lastMicePositions.get(userId))) {
				showOtherMouse(userId, rec.cursor, box)
				lastMicePositions.set(userId, rec.cursor)
			}
			if (rec.user) {
				// if anything has changed, redisplay the avatars
				if (refreshAvatars || !object_equals(rec.user, lastAvatarStatus.get(userId))) showAvatars()
				lastAvatarStatus.set(userId, rec.user)
				// set a timer for this avatar to self-destruct if no update has been received for a minute
				let ava = elem(`ava${userId}`)
				if (ava) {
					clearTimeout(ava.timer)
					ava.timer = setTimeout(removeAvatar, 60000, ava)
				}
			}
			if (userId !== clientID && rec.addingFactor) showGhostFactor(userId, rec.addingFactor)
		})
	}
	if (followme) followUser()
}
/**
 * Display another user's mouse pointers (if they are inside the canvas)
 */
function showOtherMouse(userId, cursor, box) {
	let cursorDiv = elem(userId.toString())
	if (cursorDiv) {
		let p = network.canvasToDOM(cursor)
		p.x += box.left
		p.y += box.top
		cursorDiv.style.top = `${p.y}px`
		cursorDiv.style.left = `${p.x}px`
		cursorDiv.style.display =
			p.x < box.left || p.x > box.right || p.y > box.bottom || p.y < box.top ? 'none' : 'block'
	}
}
/**
 * Place a circle at the top left of the net pane to represent each user who is online
 * Also create a cursor (a div) for each of the users
 */

function showAvatars() {
	refreshAvatars = false
	let recs = Array.from(yAwareness.getStates())
	// remove and save myself (using clientID as the id, not name)
	let me = recs.splice(
		recs.findIndex((a) => a[0] === clientID),
		1,
	)
	let nameRecs = recs
		// eslint-disable-next-line no-unused-vars
		.map(([key, value]) => {
			if (value.user) return value.user
		})
		.filter((e) => e) // remove any recs without a user record
		.filter((v, i, a) => a.findIndex((t) => t.name === v.name) === i) // remove duplicates, by name
		.sort((a, b) => (a.name.charAt(0).toUpperCase() > b.name.charAt(0).toUpperCase() ? 1 : -1)) // sort names

	if (me.length === 0) return // app is unloading
	nameRecs.unshift(me[0][1].user) // push myself on to the front

	let avatars = elem('avatars')
	let currentCursors = []

	// check that an avatar exists for each name; if not create one.  If it does, check that it is still looking right
	nameRecs.forEach((nameRec) => {
		let ava = elem(`ava${nameRec.id}`)
		let shortName = initials(nameRec.name)
		if (ava === null) {
			makeAvatar(nameRec)
			refreshAvatars = true
		} else {
			// to avoid flashes, don't touch anything that is already correct
			if (ava.dataset.tooltip !== nameRec.name) ava.dataset.tooltip = nameRec.name
			let circle = ava.firstChild
			if (circle.style.backgroundColor !== nameRec.color) circle.style.backgroundColor = nameRec.color
			let circleBorderColor = nameRec.anon ? 'white' : 'black'
			if (circle.style.borderColor !== circleBorderColor) circle.style.borderColor = circleBorderColor
			if (circle.innerText !== shortName) circle.innerText = shortName
			let circleFontColor = circle.style.color
			if (circleFontColor !== (nameRec.isLight ? 'black' : 'white'))
				circle.style.color = nameRec.isLight ? 'black' : 'white'
			let opacity = nameRec.asleep ? 0.2 : 1.0
			if (circle.style.opacity !== opacity) circle.style.opacity = opacity
		}

		if (nameRec.id !== clientID) {
			// don't create a cursor for myself
			let cursorDiv = elem(nameRec.id)
			if (cursorDiv === null) {
				cursorDiv = makeCursor(nameRec)
			} else {
				if (nameRec.asleep) cursorDiv.style.display = 'none'
				if (cursorDiv.innerText !== shortName) cursorDiv.innerText = shortName
				if (cursorDiv.style.backgroundColor !== nameRec.color) cursorDiv.style.backgroundColor = nameRec.color
			}
			currentCursors.push(cursorDiv)
		}
	})

	// re-order the avatars into alpha order, without gaps, with me at the start

	let df = document.createDocumentFragment()
	nameRecs.forEach((nameRec) => {
		df.appendChild(elem(`ava${nameRec.id}`))
	})
	avatars.replaceChildren(df)

	// delete any cursors that remain from before
	let cursorsToDelete = Array.from(document.querySelectorAll('.shared-cursor')).filter(
		(a) => !currentCursors.includes(a),
	)
	cursorsToDelete.forEach((e) => e.remove())

	/**
	 * create an avatar as a div with initials inside
	 * @param {object} nameRec
	 */
	function makeAvatar(nameRec) {
		let ava = document.createElement('div')
		ava.classList.add('hoverme')
		if (followme === nameRec.id) ava.classList.add('followme')
		ava.id = `ava${nameRec.id}`
		ava.dataset.tooltip = nameRec.name
		// the broadcast awareness sometimes loses a client (i.e. broadcasts that it has been removed)
		// when it actually hasn't (e.g. if there is a comms glitch).  So instead, we set a timer
		// and delete the avatar only if nothing is heard from that user for a minute
		ava.timer = setTimeout(removeAvatar, 60000, ava)
		let circle = document.createElement('div')
		circle.classList.add('round')
		circle.style.backgroundColor = nameRec.color
		if (nameRec.anon) circle.style.borderColor = 'white'
		circle.innerText = initials(nameRec.name)
		circle.style.color = nameRec.isLight ? 'black' : 'white'
		circle.style.opacity = nameRec.asleep ? 0.2 : 1.0
		circle.dataset.client = nameRec.id
		circle.dataset.userName = nameRec.name
		ava.appendChild(circle)
		avatars.appendChild(ava)
		circle.addEventListener('click', nameRec.id === clientID ? renameUser : follow)
		circle.addEventListener('contextmenu', selectUsersItems)
		circle.addEventListener('mouseover', () =>
			statusMsg(
				nameRec.id === clientID
					? 'Click to change your name. Right click to select all your edits'
					: `Click to follow this person. Right click to select all this person's edits`,
			),
		)
		circle.addEventListener('mouseout', () => clearStatusBar())
	}
	/**
	 * make a pseudo cursor (a div)
	 * @param {object} nameRec
	 * @returns a div
	 */
	function makeCursor(nameRec) {
		let cursorDiv = document.createElement('div')
		cursorDiv.className = 'shared-cursor'
		cursorDiv.id = nameRec.id
		cursorDiv.style.backgroundColor = nameRec.color
		cursorDiv.innerText = initials(nameRec.name)
		cursorDiv.style.color = nameRec.isLight ? 'black' : 'white'
		cursorDiv.style.display = 'none' // hide it until we get coordinates at next mousemove
		container.appendChild(cursorDiv)
		return cursorDiv
	}
}
/**
 * destroy the avatar - the user is no longer on line
 * @param {HTMLelement} ava
 */
function removeAvatar(ava) {
	refreshAvatars = true
	ava.remove()
}
function showUsersSwitch() {
	let on = elem('showUsersSwitch').checked
	document.querySelectorAll('div.shared-cursor').forEach((node) => {
		node.style.display = on ? 'block' : 'none'
	})
	elem('avatars').style.display = on ? 'flex' : 'none'
}
/**
 * User has clicked on an avatar.  Start following this avatar
 * @param {event} event
 */
function follow(event) {
	if (followme) unFollow()
	let user = parseInt(event.target.dataset.client, 10)
	if (user === clientID) return
	followme = user
	elem(`ava${followme}`).classList.add('followme')
	let userName = elem(`ava${user}`).dataset.tooltip
	alertMsg(`Following ${userName}`, 'info')
}
/**
 * User was following another user, but has now clicked off the avatar, so stop following
 */
function unFollow() {
	if (!followme) return
	elem(`ava${followme}`).classList.remove('followme')
	followme = undefined
	elem('errMsg').classList.remove('fadeInAndOut')
	clearStatusBar()
}
/**
 * move the map so that the followed cursor is always in the centre of the pane
 */
function followUser() {
	let userRec = yAwareness.getStates().get(followme)
	if (!userRec) return
	if (userRec.user.asleep) unFollow()
	let userPosition = userRec.cursor
	if (userPosition) network.moveTo({ position: userPosition })
}
/**
 * User has clicked on their own avatar.  Prompt them to change their own name.
 */
function renameUser() {
	let newName = prompt('Enter your new name', myNameRec.name)
	if (newName) {
		myNameRec.name = newName
		myNameRec.anon = false
		yAwareness.setLocalState({ user: myNameRec })
		showAvatars()
	}
	clearStatusBar()
}
/**
 * show a ghost box where another user is adding a factor
 * addingFactor is an object with properties:
 * state: adding', or 'done' to indicate that the ghost box should be removed
 * pos: a position (of the Add Factor dialog); 'done'
 * name: the name of the other user
 * @param {Integer} userId other user's client Id
 * @param {object} addingFactor
 */
function showGhostFactor(userId, addingFactor) {
	let id = `ghost-factor${userId}`
	switch (addingFactor.state) {
		case 'done': {
			{
				let ghostDiv = elem(id)
				if (ghostDiv) ghostDiv.remove()
			}
			break
		}
		case 'adding': {
			{
				if (!elem(id)) {
					let ghostDiv = document.createElement('div')
					ghostDiv.className = 'ghost-factor'
					ghostDiv.id = `ghost-factor${userId}`
					ghostDiv.innerText = `[New factor\nbeing added by\n${addingFactor.name}]`
					let p = network.canvasToDOM(addingFactor.pos)
					let box = container.getBoundingClientRect()
					p.x += box.left
					p.y += box.top
					ghostDiv.style.top = `${p.y - 50}px`
					ghostDiv.style.left = `${p.x - 187}px`
					ghostDiv.style.display =
						p.x < box.left || p.x > box.right || p.y > box.bottom || p.y < box.top ? 'none' : 'block'
					netPane.appendChild(ghostDiv)
				}
			}
			break
		}
		default:
			console.log(`Bad adding factor: ${addingFactor}`)
	}
}
