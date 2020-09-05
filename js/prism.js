/* 
The main entry point for PRSM.  
 */
import * as Y from 'yjs';
import {WebsocketProvider} from 'y-websocket';
// import {IndexeddbPersistence} from 'y-indexeddb';
import {Network, parseGephiNetwork} from 'vis-network/peer';
import {DataSet} from 'vis-data/peer';
import {
	getScaleFreeNetwork,
	deepMerge,
	clean,
	strip,
	splitText,
	cleanArray,
	dragElement,
	standardize_color,
	object_equals,
} from './utils.js';
import * as parser from 'fast-xml-parser';
// see https://github.com/joeattardi/emoji-button
import EmojiButton from '@joeattardi/emoji-button';
import {
	samples,
	setUpSamples,
	reApplySampleToNodes,
	reApplySampleToLinks,
	legend,
	clearLegend,
} from './samples.js';
import {setUpPaint, setUpToolbox, deselectTool, redraw} from './paint.js';

const version = '1.29';
const GRIDSPACING = 50; // for snap to grid
const NODEWIDTH = 10; // chars for label splitting
const SHORTLABELLEN = 30; // when listing node labels, use ellipsis after this number of chars
export var network;
var room;
var viewOnly; // when true, user can only view, not modify, the network
var nodes;
var edges;
var data;
var clientID;
var yNodesMap;
var yEdgesMap;
var ySamplesMap;
var yNetMap;
export var yPointsArray; // stores the background drawing commands
var yUndoManager;
var yChatArray;
var container; //the DOM body elemnt
var netPane;
var panel; // the DOM right side panel element
var buttonStatus; // the status of the buttons in the panel
var initialButtonStatus;
var myName; // the user's name
var lastNodeSample = 'group0';
var lastLinkSample = 'edge0';
var inAddMode = false; // true when adding a new Factor to the network; used to choose cursor pointer
var snapToGridToggle = false;
export var drawingSwitch = false;

window.addEventListener('load', () => {
	addEventListeners();
	setUpPage();
	startY();
	setUpChat();
	setUpPaint();
	setUpToolbox();
	draw();
});

/**
 * attach an event listener
 *
 * @param {string} elem - id of the element on which to hand the event listener
 * @param {string} event
 * @param {function} callback
 */
function listen(elem, event, callback) {
	document.getElementById(elem).addEventListener(event, callback);
}

/**
 * Set up all the permanent event listeners
 */
function addEventListeners() {
	listen('addNode', 'click', plusNode);
	listen('addLink', 'click', plusLink);
	listen('deleteNode', 'click', deleteNode);
	listen('undo', 'click', undo);
	listen('redo', 'click', redo);
	listen('fileInput', 'change', readSingleFile);
	listen('openFile', 'click', openFile);
	listen('saveFile', 'click', saveJSONfile);
	listen('exportCVS', 'click', exportCVS);
	listen('exportGML', 'click', exportGML);
	listen('help', 'click', displayHelp);
	listen('panelToggle', 'click', togglePanel);
	listen('zoom', 'change', zoomnet);
	listen('zoomminus', 'click', () => {
		zoomincr(-0.1);
	});
	listen('zoomplus', 'click', () => {
		zoomincr(0.1);
	});
	listen('nodesButton', 'click', () => {
		openTab('nodesTab');
	});
	listen('linksButton', 'click', () => {
		openTab('linksTab');
	});
	listen('networkButton', 'click', () => {
		openTab('networkTab');
	});
	listen('autolayoutswitch', 'click', autoLayoutSwitch);
	listen('antiGravity', 'change', setGravity);
	listen('snaptogridswitch', 'click', snapToGridSwitch);
	listen('netBackColorWell', 'input', updateNetBack);
	listen('drawing', 'click', toggleDrawingLayer);
	listen('allFactors', 'click', selectAllFactors);
	listen('allEdges', 'click', selectAllEdges);
	listen('showLabelSwitch', 'click', labelSwitch);
	listen('showLegendSwitch', 'click', legendSwitch);
	listen('curveSelect', 'change', selectCurve);
	listen('fixed', 'click', setFixed);
	Array.from(document.getElementsByName('hide')).forEach((elem) => {
		elem.addEventListener('change', hideDistantOrStreamNodes);
	});
	Array.from(document.getElementsByName('stream')).forEach((elem) => {
		elem.addEventListener('change', hideDistantOrStreamNodes);
	});
	listen('sizing', 'change', sizing);
	Array.from(document.getElementsByClassName('sampleNode')).forEach((elem) =>
		elem.addEventListener('click', (event) => {
			applySampleToNode(event);
		})
	);
	Array.from(document.getElementsByClassName('sampleLink')).forEach((elem) =>
		elem.addEventListener('click', (event) => {
			applySampleToLink(event);
		})
	);
}

function setUpPage() {
	viewOnly = new URL(document.location).searchParams.get('viewing');
	if (viewOnly) document.getElementById('buttons').style.display = 'none';
	container = document.getElementById('container');
	panel = document.getElementById('panel');
	panel.classList.add('hide');
	container.panelHidden = true;
	setUpSamples();
	hideNotes();
	document.getElementById('version').innerHTML = version;
	storeButtonStatus();
	initialButtonStatus = {
		autoLayout: false,
		gravity: '50000',
		snapToGrid: false,
		curve: 'Curved',
		linkRadius: 'All',
		stream: 'All',
		showLabels: true,
		legend: true,
		sizing: 'Off',
	};
}

/**
 * create a new shared document and start the WebSocket provider
 */
function startY() {
	// get the room number from the URL, or if none, generate a new one
	let url = new URL(document.location);
	room = url.searchParams.get('room');
	if (room == null || room == '') room = generateRoom();
	else room = room.toUpperCase();
	const doc = new Y.Doc();
	// wait for an update from another peer; only then will
	// drawing etc. be finished and so we can then fit the  network to the window.
	doc.on('afterTransaction', initialFit);
	function initialFit(trans, doc) {
		if (window.debug) console.log(trans, performance.now());
		if (!trans.local && trans.changed.size > 0) {
			fit(0);
			legend(false);
			doc.off('afterTransaction', initialFit);
		}
	}
	const wsProvider = new WebsocketProvider(
		'wss://cress.soc.surrey.ac.uk/wss',
		'prism' + room,
		doc
	);
	/* 	const wsProvider = new WebsocketProvider(
		'ws://cress.soc.surrey.ac.uk:1233',
		'prism' + room,
		doc
	);  */
	/*
	const indexeddbProvider = new IndexeddbPersistence('prism' + room, doc);
	indexeddbProvider.whenSynced.then(() => {
		console.log(
			new Date().toLocaleTimeString() + ': ' + 'indexed db set up'
		);
	});
 */
	document.title = document.title + ' ' + room;
	wsProvider.on('status', (event) => {
		console.log(
			new Date().toLocaleTimeString() +
				': ' +
				event.status +
				(event.status == 'connected' ? ' to' : ' from') +
				' room ' +
				room
		); // logs "connected" or "disconnected"
	});
	/* 
	create a yMap for the nodes and one for the edges (we need two because there is no 
	guarantee that the the ids of nodes will differ from the ids of edges) 
	 */
	yNodesMap = doc.getMap('nodes');
	yEdgesMap = doc.getMap('edges');
	ySamplesMap = doc.getMap('samples');
	yNetMap = doc.getMap('network');
	yChatArray = doc.getArray('chat');
	yPointsArray = doc.getArray('points');

	// get an existing or generate a new clientID, used to identify nodes and edges created by this client
	if (localStorage.getItem('clientID'))
		clientID = localStorage.getItem('clientID');
	else {
		clientID = doc.clientID;
		localStorage.setItem('clientID', clientID);
	}
	console.log('My client ID: ' + clientID);
	/* set up the undo managers */
	yUndoManager = new Y.UndoManager([yNodesMap, yEdgesMap, yNetMap]);
	nodes = new DataSet();
	edges = new DataSet();
	data = {
		nodes: nodes,
		edges: edges,
	};
	/* 
	for convenience when debugging
	 */
	window.debug = false;
	window.data = data;
	window.clientID = clientID;
	window.yNodesMap = yNodesMap;
	window.yEdgesMap = yEdgesMap;
	window.ySamplesMap = ySamplesMap;
	window.yNetMap = yNetMap;
	window.yUndoManager = yUndoManager;
	window.yChatArray = yChatArray;
	window.yPointsArray = yPointsArray;
	window.samples = samples;

	/* 
	nodes.on listens for when local nodes or edges are changed (added, updated or removed).
	If a local node is removed, the yMap is updated to broadcast to other clients that the node 
	has been deleted. If a local node is added or updated, that is also broadcast, with a 
	copy of the node, augmented with this client's ID, so that the originator can be identified.
	Nodes that are not originated locally are not broadcast (if they were, there would be a 
	feedback loop, with each client re-broadcasting everything it received)
	 */
	nodes.on('*', (event, properties, origin) => {
		if (window.debug)
			console.log(
				new Date().toLocaleTimeString() +
					': nodes.on: ' +
					event +
					JSON.stringify(properties.items) +
					' origin: ' +
					(origin != null ? origin.constructor.name : origin)
			);
		properties.items.forEach((id) => {
			if (origin == null) {
				if (event == 'remove') {
					yNodesMap.delete(id.toString());
				} else {
					let obj = nodes.get(id);
					if (obj.clientID == undefined) obj.clientID = clientID;
					// only broadcast my changes and only if the node has actually changed
					if (
						obj.clientID === clientID &&
						!object_equals(obj, yNodesMap.get(obj.id))
					) {
						yNodesMap.set(id.toString(), obj);
						if (window.debug)
							console.log(
								new Date().toLocaleTimeString() +
									': added to YMapNodes: ' +
									JSON.stringify(obj)
							);
					}
				}
			}
		});
	});
	/* 
	yNodesMap.observe listens for changes in the yMap, receiving a set of the keys that have
	had changed values.  If the change was to delete an entry, the corresponding node is
	removed from the local nodes dataSet. Otherwise, the local node dataSet is updated (which 
	includes adding a new node if it does not already exist locally).
	 */
	yNodesMap.observe((event) => {
		if (window.debug) console.log(event);
		let nodesToUpdate = [];
		for (let key of event.keysChanged) {
			if (yNodesMap.has(key)) {
				let obj = yNodesMap.get(key);
				let origin = event.transaction.origin;
				if (obj.clientID != clientID || origin != null) {
					nodesToUpdate.push(obj);
				}
			} else nodes.remove(key);
		}
		if (nodesToUpdate) nodes.update(nodesToUpdate, origin);
	});
	/* 
	See comments above about nodes
	 */
	edges.on('*', (event, properties, origin) => {
		if (window.debug)
			console.log(
				new Date().toLocaleTimeString() +
					': edges.on: ' +
					event +
					JSON.stringify(properties.items) +
					' origin: ' +
					(origin != null ? origin.constructor.name : origin)
			);
		properties.items.forEach((id) => {
			if (origin == null) {
				if (event == 'remove') yEdgesMap.delete(id.toString());
				else {
					let obj = edges.get(id);
					if (obj.clientID == undefined) obj.clientID = clientID;
					if (
						obj.clientID === clientID &&
						!object_equals(obj, yEdgesMap.get(obj.id))
					)
						yEdgesMap.set(id.toString(), obj);
				}
			}
		});
	});
	yEdgesMap.observe((event) => {
		if (window.debug) console.log(event);
		let edgesToUpdate = [];
		for (let key of event.keysChanged) {
			if (yEdgesMap.has(key)) {
				let obj = yEdgesMap.get(key);
				let origin = event.transaction.origin;
				if (obj.clientID != clientID || origin != null) {
					edgesToUpdate.push(obj);
				}
			} else edges.remove(key);
		}
		edges.update(edgesToUpdate, origin);
	});

	ySamplesMap.observe((event) => {
		if (window.debug) console.log(event);
		let origin = event.transaction.origin;
		let nodesToUpdate = [];
		let edgesToUpdate = [];
		for (let key of event.keysChanged) {
			let sample = ySamplesMap.get(key);
			if (sample.clientID != clientID || origin != null) {
				if (sample.node != undefined) {
					samples.nodes[key] = sample.node;
					nodesToUpdate.push(key);
				} else {
					samples.edges[key] = sample.edge;
					edgesToUpdate.push(key);
				}
			}
		}
		if (nodesToUpdate) {
			refreshSampleNodes();
			reApplySampleToNodes(nodesToUpdate);
		}
		if (edgesToUpdate) {
			refreshSampleLinks();
			reApplySampleToLinks(edgesToUpdate);
		}
	});
	yNetMap.observe((event) => {
		if (window.debug) console.log(event);
		for (let key of event.keysChanged) {
			let obj = yNetMap.get(key);
			let origin = event.transaction.origin;
			if (obj.clientID != clientID || origin != null)
				switch (key) {
					case 'edges':
						setCurve(
							clean(obj, {
								clientID: null,
							})
						);
						break;
					case 'hideAndStream':
						setHideAndStream(obj);
						break;
					case 'background':
						setBackground(obj);
						break;
					default:
						console.log('Bad key in yMapNet.observe: ', key);
				}
		}
	});
	yPointsArray.observe((event, trans) => {
		if (window.debug)
			console.log(trans.local, yPointsArray.get(yPointsArray.length - 1));
		if (!trans.local) network.redraw();
	});
	yUndoManager.on('stack-item-added', (event) => {
		if (window.debug) console.log(event);
		saveButtonStatus(event);
		undoButtonstatus();
		redoButtonStatus();
	});
	yUndoManager.on('stack-item-popped', (event) => {
		if (window.debug) console.log(event);
		undoRedoButtons(event);
		undoButtonstatus();
		redoButtonStatus();
	});
}

/**
 * create a random string of the form AAA-BBB-CCC-DDD
 */
function generateRoom() {
	let room = '';
	for (let i = 0; i < 4; i++) {
		for (let j = 0; j < 3; j++) {
			room += String.fromCharCode(65 + Math.floor(Math.random() * 26));
		}
		if (i < 3) room += '-';
	}
	return room;
}

/**
 * randomly create some nodes and edges as a binary tree, mainly used for testing
 * @param {Integer} nNodes
 */
function getRandomData(nNodes) {
	let SFNdata = getScaleFreeNetwork(nNodes);
	nodes.add(SFNdata.nodes);
	edges.add(SFNdata.edges);
	recalculateStats();
}
// to handle iPad viewport sizing problem when tab bar appears
document.body.height = window.innerHeight;
window.onresize = function () {
	document.body.height = window.innerHeight;
	keepPanelInWindow();
};
window.onorientationchange = function () {
	document.body.height = window.innerHeight;
};

const chatbox = document.getElementById('chatbox');
const chatboxTab = document.getElementById('chatbox-tab');
const chatNameBox = document.getElementById('chat-name');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('send-button');
const chatMessages = document.getElementById('chat-messages');
const emojiButton = document.querySelector('#emoji-button');
const emojiPicker = new EmojiButton({
	rootElement: chatbox,
	zIndex: 1000,
});

function setUpChat() {
	if (localStorage.getItem('myName')) myName = localStorage.getItem('myName');
	else myName = 'User' + clientID;
	console.log('My name: ' + myName);
	yChatArray.observe(() => {
		displayLastMsg();
		blinkChatboxTab();
	});
	chatboxTab.addEventListener('click', maximize);
	listen('minimize', 'click', minimize);
	chatNameBox.addEventListener('keyup', (e) => {
		if (e.key == 'Enter') {
			myName = chatNameBox.value;
			localStorage.setItem('myName', myName);
			chatInput.focus();
		}
	});
	chatNameBox.addEventListener('blur', () => {
		myName = chatNameBox.value;
		localStorage.setItem('myName', myName);
	});
	chatNameBox.addEventListener('click', () => {
		chatNameBox.focus();
		chatNameBox.select();
	});
	chatSend.addEventListener('click', sendMsg);
	emojiPicker.on('emoji', (emoji) => {
		document.querySelector('#chat-input').value += emoji;
	});
	emojiButton.addEventListener('click', () => {
		emojiPicker.togglePicker(emojiButton);
	});
}

/**
 * draw the network, after settingthe vis-network options
 */
function draw() {
	// for testing, you can append ?t=XXX to the URL of the page, where XXX is the number
	// of factors to include in a random network
	let url = new URL(document.location);
	let nNodes = url.searchParams.get('t');
	if (nNodes) getRandomData(nNodes);
	// create a network
	netPane = document.getElementById('net-pane');
	var options = {
		edges: {
			smooth: {
				type: 'straightCross',
			},
		},
		physics: {
			enabled: false,
			stabilization: false,
		},
		interaction: {
			multiselect: true,
			selectConnectedEdges: false,
			hover: true,
			zoomView: false,
			tooltipDelay: 0,
		},
		manipulation: {
			enabled: false,
			addNode: function (item, callback) {
				item.label = '';
				item = deepMerge(item, samples.nodes[lastNodeSample]);
				item.grp = lastNodeSample;
				addLabel(item, clearPopUp, callback);
				showPressed('addNode', 'remove');
			},
			editNode: function (item, callback) {
				// for some weird reason, vis-network copies the group properties into the
				// node properties before calling this fn, which we don't want.  So we
				// revert to using the original node properties before continuing.
				item = data.nodes.get(item.id);
				editNode(item, cancelEdit, callback);
			},
			addEdge: function (item, callback) {
				inAddMode = false;
				changeCursor('auto');
				if (item.from == item.to) {
					showPressed('addLink', 'remove');
					callback(null);
					return;
				}
				if (duplEdge(item.from, item.to).length > 0) {
					alert(
						'There is already a link from this Factor to the other.'
					);
					callback(null);
					return;
				}
				item = deepMerge(item, samples.edges[lastLinkSample]);
				item.grp = lastLinkSample;
				showPressed('addLink', 'remove');
				callback(item);
			},
			editEdge: {
				editWithoutDrag: function (item, callback) {
					item = data.edges.get(item.id);
					editEdge(item, cancelEdit, callback);
				},
			},
			deleteNode: function (item, callback) {
				let r = confirm(deleteMsg(item));
				if (r != true) {
					callback(null);
					return;
				}
				clearStatusBar();
				// delete also all the edges that link to the nodes being deleted
				// added by deleteMsg()
				callback(item);
			},
			deleteEdge: function (item, callback) {
				let r = confirm(deleteMsg(item));
				if (r != true) {
					callback(null);
					return;
				}
				callback(item);
			},
			controlNodeStyle: {
				shape: 'dot',
				color: 'red',
				size: 5,
				group: undefined,
			},
		},
	};
	if (viewOnly)
		options.interaction = {
			dragNodes: false,
			hover: false,
			selectable: false,
		};
	network = new Network(netPane, data, options);
	window.network = network;
	document.getElementById('zoom').value = network.getScale();
	// start with factor tab open, but hidden
	document.getElementById('nodesButton').click();
	// listen for click events on the network pane
	// despatch to edit a node or an edge or to fit the network on the pane
	network.on('doubleClick', function (params) {
		if (params.nodes.length === 1) {
			network.editNode();
		} else if (params.edges.length === 1) {
			network.editEdgeMode();
		} else {
			fit();
		}
	});
	network.on('selectNode', function () {
		if (network.getSelectedNodes().length > 1) hideDistantOrStreamNodes();
		statusMsg(listFactors(network.getSelectedNodes()) + ' selected');
		showNodeData();
	});
	network.on('deselectNode', function () {
		hideNotes();
		clearStatusBar();
	});
	network.on('hoverNode', function () {
		changeCursor('grab');
	});
	network.on('blurNode', function () {
		changeCursor('default');
	});
	network.on('selectEdge', function () {
		statusMsg(listLinks(network.getSelectedEdges()) + ' selected');
		showEdgeData();
	});
	network.on('deselectEdge', function () {
		hideNotes();
		clearStatusBar();
	});
	network.on('dragStart', function () {
		hideNotes();
		changeCursor('grabbing');
	});
	network.on('dragEnd', function (event) {
		let newPositions = network.getPositions(event.nodes);
		data.nodes.update(
			data.nodes.get(event.nodes).map((n) => {
				n.x = newPositions[n.id].x;
				n.y = newPositions[n.id].y;
				if (snapToGridToggle) snapToGrid(n);
				claim(n);
				return n;
			})
		);
		changeCursor('auto');
	});
	network.on('beforeDrawing', function (ctx) {
		redraw(ctx);
	});
	// listen for changes to the network structure
	// and recalculate the network statistics when there is one
	data.nodes.on('add', recalculateStats);
	data.nodes.on('remove', recalculateStats);
	data.edges.on('add', recalculateStats);
	data.edges.on('remove', recalculateStats);
} // end draw()

/**
 * rescale and redraw the network so that it fits the pane
 */
function fit(duration = 200) {
	network.fit({
		position: {x: 0, y: 0},
		animation: {duration: duration, easingFunction: 'linear'},
	});
	let newScale = network.getScale();
	document.getElementById('zoom').value = newScale;
	network.storePositions();
}

/**
 *  remove any existing clientID, to show that I now
	own this and can broadcast my changes to the item
 * @param {object} item 
 */
function claim(item) {
	item.clientID = undefined;
}

/**
 * boroadcast current node positions to all clients
 */
function broadcast() {
	/* there are situations where vis does not update node positions
(and therefore does not call nodes.on) such as auto layout, 
and therefore other clients don't get to see the changes.
This function forces a broadcast of all nodes.  We only deal with
nodes because the edges follow */
	network.storePositions();
	data.nodes.forEach((n) => yNodesMap.set(n.id, n));
}

/**
 * Move the node to the nearest spot that it on the grid
 * @param {object} node
 */
function snapToGrid(node) {
	node.x = GRIDSPACING * Math.round(node.x / GRIDSPACING);
	node.y = GRIDSPACING * Math.round(node.y / GRIDSPACING);
}

/**
 * the item is being created:  get its label from the user
 * @param {Object} item
 * @param {Function} cancelAction
 * @param {Function} callback
 */
function addLabel(item, cancelAction, callback) {
	initPopUp('Add Factor', item, cancelAction, saveLabel, callback);
	positionPopUp();
	document.getElementById('popup-label').focus();
}

function editNode(item, cancelAction, callback) {
	initPopUp('Edit Factor', item, cancelAction, saveNode, callback);
	document.getElementById('popup-label').insertAdjacentHTML(
		'afterend',
		`	
	<table id="popup-table">
		<tr>
			<td>
				Border
			</td>
			<td>
				Font
			</td>
		</tr>
		<tr>
			<td>
				<input type="color" id="node-borderColor" />
			</td>
			<td>
				<input type="color" id="node-fontColor" />
			</td>
		</tr>
		<tr>
			<td colspan="2">
				<select id="node-borderType">
					<option value="">Type...</option>
					<option value="false">Solid</option>
					<option value="true">Dashed</option>
					<option value="dots">Dotted</option>
				</select>
			</td>
		</tr>
	</table>`
	);
	document.getElementById('node-borderColor').value = standardize_color(
		item.color.border
	);
	document.getElementById('node-fontColor').value = standardize_color(
		item.font.color
	);
	document.getElementById('node-borderType').value = getDashes(
		item.shapeProperties.borderDashes
	);
	positionPopUp();
	document.getElementById('popup-label').focus();
}

function getDashes(val) {
	return Array.isArray(val) ? 'dots' : val.toString();
}

function editEdge(item, cancelAction, callback) {
	initPopUp('Edit Link', item, cancelAction, saveEdge, callback);
	document.getElementById('popup-label').insertAdjacentHTML(
		'afterend',
		` 
		<table id="popup-table">
		<tr>
			<td>
				Width
			</td>
			<td>
				Colour
			</td>
		</tr>
		<tr>
			<td>
				<select id="edge-width">
					<option value="">Width...</option>
					<option value="1">Width: 1</option>
					<option value="2">Width: 2</option>
					<option value="4">Width: 4</option>
				</select>
			</td>
			<td>
				<input type="color" id="edge-color" />
			</td>
		</tr>
		<tr>
			<td colspan="2">
				<select id="edge-type">
					<option value="">Type...</option>
					<option value="false">Solid</option>
					<option value="true">Dashed</option>
					<option value="dots">Dotted</option>
				</select>
			</td>
		</tr>
	</table>`
	);
	document.getElementById('edge-width').value = item.width;
	document.getElementById('edge-color').value = standardize_color(
		item.color.color
	);
	document.getElementById('edge-type').value = getDashes(item.dashes);
	positionPopUp();
	document.getElementById('popup-label').focus();
}

function initPopUp(popUpTitle, item, cancelAction, saveAction, callback) {
	inAddMode = false;
	changeCursor('auto');
	document.getElementById('popup-operation').innerHTML = popUpTitle;
	document.getElementById('popup-cancelButton').onclick = cancelAction.bind(
		this,
		callback
	);
	document.getElementById('popup-saveButton').onclick = saveAction.bind(
		this,
		item,
		callback
	);
	document.getElementById('popup-label').value =
		item.label === undefined ? '' : item.label;
	let table = document.getElementById('popup-table');
	if (table) table.remove();
}

function positionPopUp() {
	let popUp = document.getElementById('popup');
	popUp.style.display = 'block';
	// popup appears to the left of the mouse pointer
	popUp.style.top = `${
		event.clientY - popUp.offsetHeight / 2 - popUp.offsetParent.offsetTop
	}px`;
	let left = event.clientX - popUp.offsetWidth - 3;
	popUp.style.left = `${left < 0 ? 0 : left}px`;
}

// Callback passed as parameter is ignored
function clearPopUp() {
	document.getElementById('popup-saveButton').onclick = null;
	document.getElementById('popup-cancelButton').onclick = null;
	document.getElementById('popup').style.display = 'none';
}

function cancelEdit(callback) {
	clearPopUp();
	callback(null);
}

function saveLabel(item, callback) {
	item.label = splitText(
		document.getElementById('popup-label').value,
		NODEWIDTH
	);
	clearPopUp();
	if (item.label === '') {
		// if there is no label and it is an edge, blank the label, else cancel
		// (nodes must have a label)
		if ('from' in item) item.label = ' ';
		else {
			statusMsg('No label: cancelled', 'warn');
			callback(null);
			return;
		}
	}
	claim(item);
	network.manipulation.inMode = 'addNode'; // ensure still in Add mode, in case others have done something meanwhile
	callback(item);
}

function saveNode(item, callback) {
	item.label = splitText(
		document.getElementById('popup-label').value,
		NODEWIDTH
	);
	clearPopUp();
	if (item.label === '') {
		// if there is no label, cancel (nodes must have a label)
		statusMsg('No label: cancelled', 'warn');
		callback(null);
	}
	let color = document.getElementById('node-borderColor').value;
	item.color.border = color;
	item.color.highlight.border = color;
	item.color.hover.border = color;
	item.font.color = document.getElementById('node-fontColor').value;
	item.shapeProperties.borderDashes = convertDashes(
		document.getElementById('node-borderType').value
	);
	claim(item);
	network.manipulation.inMode = 'editNode'; // ensure still in Add mode, in case others have done something meanwhile
	callback(item);
}

function saveEdge(item, callback) {
	item.label = splitText(
		document.getElementById('popup-label').value,
		NODEWIDTH
	);
	clearPopUp();
	if (item.label === '') item.label = ' ';
	let color = document.getElementById('edge-color').value;
	item.color.color = color;
	item.color.hover = color;
	item.color.highlight = color;
	item.width = document.getElementById('edge-width').value;
	item.dashes = convertDashes(document.getElementById('edge-type').value);
	claim(item);
	network.manipulation.inMode = 'editEdge'; // ensure still in edit mode, in case others have done something meanwhile
	callback(item);
}

function convertDashes(val) {
	switch (val) {
		case 'true':
			return true;
		case 'false':
			return false;
		case 'dashes':
			return [10, 10];
		case 'dots':
			return [3, 3];
		default:
			return val;
	}
}

function duplEdge(from, to) {
	// if there is already a link from the 'from' node to the 'to' node, return it
	return data.edges.get({
		filter: function (item) {
			return item.from == from && item.to == to;
		},
	});
}

function deleteMsg(item) {
	//constructs a nice string to tell the user what nodes and links are being deleted.
	// also delete edges connected to these nodes
	item.nodes.forEach((nId) => {
		network.getConnectedEdges(nId).forEach((eId) => {
			if (item.edges.indexOf(eId) === -1) item.edges.push(eId);
		});
	});
	let nNodes = item.nodes.length;
	let nEdges = item.edges.length;
	let msg = 'Delete ';
	if (nNodes > 0) msg = msg + nNodes + ' Factor' + (nNodes == 1 ? '' : 's');
	if (nNodes > 0 && nEdges > 0) msg = msg + ' and ';
	if (nEdges > 0) msg = msg + nEdges + ' Link' + (nEdges == 1 ? '' : 's');
	return msg + '?';
}

function changeCursor(newCursorStyle) {
	if (inAddMode) return;
	netPane.style.cursor = newCursorStyle;
	document.getElementById('navbar').style.cursor = newCursorStyle;
}

function unSelect() {
	/* unselect all nodes and edges */
	hideNotes();
	network.unselectAll();
}
/* 
  ----------- Calculate statistics in the background -------------
*/
// set  up a web worker to calculate network statistics in parallel with whatever
// the user is doing
var worker = new Worker('betweenness.js');
var bc; //caches the betweenness centralities
function recalculateStats() {
	// wait 200 mSecs for things to settle down before recalculating
	setTimeout(() => {
		worker.postMessage([nodes.get(), edges.get()]);
	}, 200);
}
worker.onmessage = function (e) {
	if (typeof e.data == 'string') statusMsg(e.data, 'error');
	else bc = e.data;
};
/* 
  ----------- Status messages ---------------------------------------
*/
/* show status messages at the bottom of the window */
export function statusMsg(msg, status) {
	let elem = document.getElementById('statusBar');
	switch (status) {
		case 'warn':
			elem.style.backgroundColor = 'yellow';
			break;
		case 'error':
			elem.style.backgroundColor = 'red';
			elem.style.color = 'white';
			break;
		default:
			elem.style.backgroundColor = 'white';
			break;
	}
	elem.innerHTML = htmlEntities(msg);
}

function htmlEntities(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&quot;');
}

function clearStatusBar() {
	statusMsg(' ');
}

function listFactors(factors) {
	// return a string listing the labels of the given nodes
	if (factors.length > 5) return factors.length + ' factors';
	let str = 'Factor';
	if (factors.length > 1) str = str + 's';
	return str + ': ' + lf(factors);

	function lf(factors) {
		// recursive fn to return a string of the node labels, separated by commas and 'and'
		let n = factors.length;
		let label = "'" + shorten(data.nodes.get(factors[0]).label) + "'";
		if (n == 1) return label;
		factors.shift();
		if (n == 2) return label.concat(' and ' + lf(factors));
		return label.concat(', ' + lf(factors));
	}
}

function shorten(label) {
	return label.length > SHORTLABELLEN
		? label.substring(0, SHORTLABELLEN) + '...'
		: label;
}

function listLinks(links) {
	// return a string listing the number of Links
	if (links.length > 1) return links.length + ' links';
	return '1 link';
}
/* zoom slider */
Network.prototype.zoom = function (scale) {
	let newScale = scale === undefined ? 1 : scale;
	const animationOptions = {
		scale: newScale,
		animation: {
			duration: 200,
		},
	};
	this.view.moveTo(animationOptions);
};

function zoomnet() {
	network.zoom(Number(document.getElementById('zoom').value));
}

function zoomincr(incr) {
	let newScale = Number(document.getElementById('zoom').value) + incr;
	if (newScale > 4) newScale = 4;
	if (newScale <= 0) newScale = 0.1;
	document.getElementById('zoom').value = newScale;
	network.zoom(newScale);
}
/* 
  -----------Operations related to the top button bar (not the side panel)-------------
 */
function plusNode() {
	switch (inAddMode) {
		case 'disabled':
			return;
		case 'addNode':
			showPressed('addNode', 'remove');
			stopEdit();
			break;
		case 'addLink':
			showPressed('addLink', 'remove');
			stopEdit(); // falls through
		default:
			// false
			changeCursor('cell');
			inAddMode = 'addNode';
			showPressed('addNode', 'add');
			network.addNodeMode();
	}
}

function plusLink() {
	switch (inAddMode) {
		case 'disabled':
			return;
		case 'addLink':
			showPressed('addLink', 'remove');
			stopEdit();
			break;
		case 'addNode':
			showPressed('addNode', 'remove');
			stopEdit(); // falls through
		default:
			// false
			changeCursor('crosshair');
			inAddMode = 'addLink';
			showPressed('addLink', 'add');
			network.addEdgeMode();
	}
}

function stopEdit() {
	inAddMode = false;
	network.disableEditMode();
	changeCursor('auto');
}

function showPressed(elem, action) {
	document.getElementById(elem).children.item(0).classList[action]('pressed');
}

function undo() {
	unSelect();
	yUndoManager.undo();
}

function redo() {
	unSelect();
	yUndoManager.redo();
}

function undoButtonstatus() {
	setButtonDisabledStatus('undo', yUndoManager.undoStack.length === 0);
}

function redoButtonStatus() {
	setButtonDisabledStatus('redo', yUndoManager.redoStack.length === 0);
}
/**
 * Change the visible state of a button
 * @param {String} id
 * @param {Boolean} state - true to make the button disabled
 */
function setButtonDisabledStatus(id, state) {
	if (state) document.getElementById(id).classList.add('disabled');
	else document.getElementById(id).classList.remove('disabled');
}

function deleteNode() {
	network.deleteSelected();
}
var lastFileName = 'network.json'; // the name of the file last read in
let msg = '';

function readSingleFile(e) {
	var file = e.target.files[0];
	if (!file) {
		return;
	}
	let fileName = file.name;
	lastFileName = fileName;
	document.body.style.cursor = 'wait';
	statusMsg("Reading '" + fileName + "'");
	msg = '';
	e.target.value = '';
	var reader = new FileReader();
	reader.onloadend = function (e) {
		try {
			loadFile(e.target.result);
			if (!msg) statusMsg("Read '" + fileName + "'");
		} catch (err) {
			statusMsg(
				"Error reading '" + fileName + "': " + err.message,
				'error'
			);
			return;
		}
		document.body.style.cursor = 'auto';
	};
	reader.readAsText(file);
}

function openFile() {
	document.getElementById('fileInput').click();
}

function loadFile(contents) {
	if (data.nodes.length > 0)
		if (
			!confirm(
				'Loading a file will delete the current network.  Are you sure you want to replace it?'
			)
		)
			return;
	unSelect();
	ensureNotDrawing();
	nodes.clear();
	edges.clear();
	network.destroy();
	draw();

	let isJSONfile = false;
	switch (lastFileName.split('.').pop().toLowerCase()) {
		case 'csv':
			data = parseCSV(contents);
			break;
		case 'graphml':
			data = parseGraphML(contents);
			break;
		case 'gml':
			data = parseGML(contents);
			break;
		case 'json':
		case 'prsm':
			data = loadJSONfile(contents);
			isJSONfile = true;
			break;
		default:
			throw {message: 'Unrecognised file name suffix'};
	}
	network.setOptions({
		interaction: {
			hideEdgesOnDrag: data.nodes.length > 100,
			hideEdgesOnZoom: data.nodes.length > 100,
		},
	});
	// ensure that all nodes have a grp property
	data.nodes.update(
		data.nodes.map(
			(n) => {
				n.grp = n.group || 'group0';
				return n;
			},
			{
				filter: function (n) {
					return n.grp == undefined;
				},
			}
		)
	);
	// reassign the sample properties to the nodes
	data.nodes.update(
		data.nodes.map((n) => deepMerge(samples.nodes[n.grp], n))
	);
	// same for edges
	data.edges.update(
		data.edges.map(
			(e) => {
				e.grp = 'edge0';
				return e;
			},
			{
				filter: function (e) {
					return e.grp == undefined;
				},
			}
		)
	);
	legend(false);
	data.edges.update(
		data.edges.map((e) => deepMerge(samples.edges[e.grp], e))
	);
	if (!isJSONfile) adjustGravity(50000);
	network.fit(0);
}

function loadJSONfile(json) {
	json = JSON.parse(json);
	if (
		json.version &&
		version.substring(0, 3) > json.version.substring(0, 3)
	) {
		statusMsg('Warning: file was created in an earlier version', 'warn');
		msg = 'old version';
	}
	if (json.lastNodeSample) lastNodeSample = json.lastNodeSample;
	if (json.lastLinkSample) lastLinkSample = json.lastLinkSample;
	if (json.buttons) setButtonStatus(json.buttons);
	if (json.edges.length > 0 && 'source' in json.edges[0]) {
		// the file is from Gephi and needs to be translated
		let parsed = parseGephiNetwork(json, {
			edges: {
				inheritColors: false,
			},
			nodes: {
				fixed: false,
				parseColor: true,
			},
		});
		nodes.add(parsed.nodes);
		edges.add(parsed.edges);
	} else {
		nodes.add(
			cleanArray(json.nodes, {
				clientID: null,
			})
		);
		edges.add(
			cleanArray(json.edges, {
				clientID: null,
			})
		);
	}
	if (json.samples) {
		samples.nodes = json.samples.nodes;
		samples.edges = json.samples.edges;
		refreshSampleNodes();
		refreshSampleLinks();
		for (let groupId in samples.nodes) {
			ySamplesMap.set(groupId, {
				node: samples.nodes[groupId],
				clientID: clientID,
			});
		}
		for (let edgeId in samples.edges) {
			ySamplesMap.set(edgeId, {
				edge: samples.edges[edgeId],
				clientID: clientID,
			});
		}
	}
	legend(false);
	yPointsArray.delete(0, yPointsArray.length);
	if (json.underlay) yPointsArray.insert(0, json.underlay);

	return {
		nodes: nodes,
		edges: edges,
	};
}

function parseGraphML(graphML) {
	let options = {
		attributeNamePrefix: '',
		attrNodeName: 'attr',
		textNodeName: 'txt',
		ignoreAttributes: false,
		ignoreNameSpace: true,
		allowBooleanAttributes: false,
		parseNodeValue: true,
		parseAttributeValue: true,
		trimValues: true,
		parseTrueNumberOnly: false,
		arrayMode: false, //"strict"
	};
	var result = parser.validate(graphML, options);
	if (result !== true) {
		throw {
			message: result.err.msg + '(line ' + result.err.line + ')',
		};
	}
	let jsonObj = parser.parse(graphML, options);
	nodes.add(
		jsonObj.graphml.graph.node.map((n) => {
			return {
				id: n.attr.id.toString(),
				label: getLabel(n.data),
			};
		})
	);
	edges.add(
		jsonObj.graphml.graph.edge.map((e) => {
			return {
				id: e.attr.id.toString(),
				from: e.attr.source.toString(),
				to: e.attr.target.toString(),
			};
		})
	);
	return {
		nodes: nodes,
		edges: edges,
	};

	function getLabel(arr) {
		for (let at of arr) {
			if (at.attr.key == 'label') return at.txt;
		}
	}
}

function parseGML(gml) {
	if (gml.search('graph') < 0) throw {message: 'invalid GML format'};
	let tokens = gml.match(/"[^"]+"|[\w]+|\[|\]/g);
	let node;
	let edge;
	let edgeId = 0;
	let tok = tokens.shift();
	while (tok) {
		switch (tok) {
			case 'graph':
				break;
			case 'node':
				tokens.shift(); // [
				node = {};
				tok = tokens.shift();
				while (tok != ']') {
					switch (tok) {
						case 'id':
							node.id = tokens.shift().toString();
							break;
						case 'label':
							node.label = splitText(
								tokens.shift().replace(/"/g, ''),
								NODEWIDTH
							);
							break;
						case 'color':
						case 'colour':
							node.color = {};
							node.color.background = tokens
								.shift()
								.replace(/"/g, '');
							break;
						case '[': // skip embedded groups
							while (tok != ']') tok = tokens.shift();
							break;
						default:
							break;
					}
					tok = tokens.shift(); // ]
				}
				if (node.label == undefined) node.label = node.id;
				nodes.add(node);
				break;
			case 'edge':
				tokens.shift(); // [
				edge = {};
				tok = tokens.shift();
				while (tok != ']') {
					switch (tok) {
						case 'id':
							edge.id = tokens.shift().toString();
							break;
						case 'source':
							edge.from = tokens.shift().toString();
							break;
						case 'target':
							edge.to = tokens.shift().toString();
							break;
						case 'label':
							edge.label = tokens.shift().replace(/"/g, '');
							break;
						case 'color':
						case 'colour':
							edge.color = tokens.shift().replace(/"/g, '');
							break;
						case '[': // skip embedded groups
							while (tok != ']') tok = tokens.shift();
							break;
						default:
							break;
					}
					tok = tokens.shift(); // ]
				}
				if (edge.id == undefined) edge.id = (edgeId++).toString();
				edges.add(edge);
				break;
			default:
				break;
		}
		tok = tokens.shift();
	}
	return {
		nodes: nodes,
		edges: edges,
	};
}

function parseCSV(csv) {
	/* comma separated values file consisting of 'From' label and 'to' label, on each row,
  with a header row (ignored) 
  optional, cols 3 and 4 can include the groups of the from and to nodes */
	let lines = csv.split('\n'); console.log(lines);
	let labels = [];
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].length <= 2) continue; // empty line
		let line = lines[i].split(','); console.log(line);
		let from = node(line[0]);
		let to = node(line[1]);
		edges.add({
			id: i,
			from: from,
			to: to,
		});
		if (line[2])
			nodes.update({
				id: from,
				grp: line[2].trim(),
			});
		if (line[3])
			nodes.update({
				id: to,
				grp: line[3].trim(),
			});
	}
	return {
		nodes: nodes,
		edges: edges,
	};

	function node(label) {
		label = label.trim();
		if (labels.indexOf(label) == -1) {
			labels.push(label);
			nodes.add({
				id: labels.indexOf(label).toString(),
				label: label,
			});
		}
		return labels.indexOf(label).toString();
	}
}

function refreshSampleNodes() {
	let sampleElements = Array.from(
		document.getElementsByClassName('sampleNode')
	);
	for (let i = 0; i < sampleElements.length; i++) {
		let sampleElement = sampleElements[i];
		let node = sampleElement.dataSet.get()[0];
		node = deepMerge(node, samples.nodes['group' + i], {
			value: samples.nodes['base'].scaling.max,
		});
		node.label = node.groupLabel;
		sampleElement.dataSet.remove(node.id);
		sampleElement.dataSet.update(node);
		sampleElement.net.fit();
	}
}

function refreshSampleLinks() {
	let sampleElements = Array.from(
		document.getElementsByClassName('sampleLink')
	);
	for (let i = 0; i < sampleElements.length; i++) {
		let sampleElement = sampleElements[i];
		let edge = sampleElement.dataSet.get()[0];
		edge = deepMerge(edge, samples.edges['edge' + i]);
		edge.label = edge.groupLabel;
		sampleElement.dataSet.remove(edge.id);
		sampleElement.dataSet.update(edge);
		sampleElement.net.fit();
	}
}
/* 
Browser will only ask for name and location of the file to be saved if
it has a user setting to do so.  Otherwise, it is saved at a default
download location with a default name.
 */
function saveJSONfile() {
	network.storePositions();
	let json = JSON.stringify(
		{
			saved: new Date(Date.now()).toLocaleString(),
			version: version,
			room: room,
			lastNodeSample: lastNodeSample,
			lastLinkSample: lastLinkSample,
			buttons: buttonStatus,
			samples: samples,
			nodes: data.nodes.map((n) =>
				strip(n, ['id', 'label', 'title', 'grp', 'x', 'y'])
			),
			edges: data.edges.map((e) =>
				strip(e, ['id', 'label', 'title', 'grp', 'from', 'to'])
			),
			underlay: yPointsArray.toArray(),
		},
		null,
		'\t'
	);
	saveStr(json, 'prsm');
}

function saveStr(str, extn) {
	/* download str to a local file */
	let blob = new Blob([str], {
		type: 'text/plain',
	});
	let pos = lastFileName.indexOf('.');
	lastFileName =
		lastFileName.substr(0, pos < 0 ? lastFileName.length : pos) +
		'.' +
		extn;
	// detect whether the browser is IE/Edge or another browser
	if (window.navigator && window.navigator.msSaveOrOpenBlob) {
		// IE or Edge browser.
		window.navigator.msSaveOrOpenBlob(blob, lastFileName);
	} else {
		// Another browser, create a tag to download file.
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		document.body.appendChild(a);
		a.setAttribute('style', 'display: none');
		a.href = url;
		a.download = lastFileName;
		a.click();
		a.remove();
		//		window.URL.revokeObjectURL(url); generates Failed - Network error in Chrome
	}
}

function exportCVS() {
	let str = 'Id,Label\n';
	for (let node of data.nodes.get()) {
		str += node.id;
		if (node.label) str += ',"' + node.label + '"';
		str += '\n';
	}
	saveStr(str, 'nodes.csv');
	str = 'Source,Target,Type,Id,Label\n';
	for (let edge of data.edges.get()) {
		str += edge.from + ',';
		str += edge.to + ',';
		str += 'directed,';
		str += edge.id + ',';
		if (edge.label) str += edge.label + '"';
		str += '\n';
	}
	saveStr(str, 'edges.csv');
}

function exportGML() {
	let str =
		'Creator "PRISM ' +
		version +
		' on ' +
		new Date(Date.now()).toLocaleString() +
		'"\ngraph\n[\n\tdirected 1\n';
	let nodeIds = data.nodes.map((n) => n.id); //use integers, not GUIDs for node ids
	for (let node of data.nodes.get()) {
		str += '\tnode\n\t[\n\t\tid ' + nodeIds.indexOf(node.id);
		if (node.label) str += '\n\t\tlabel "' + node.label + '"';
		let color =
			node.color.background || samples.nodes.group0.color.background;
		str += '\n\t\tcolor "' + color + '"';
		str += '\n\t]\n';
	}
	for (let edge of data.edges.get()) {
		str += '\tedge\n\t[\n\t\tsource ' + nodeIds.indexOf(edge.from);
		str += '\n\t\ttarget ' + nodeIds.indexOf(edge.to);
		if (edge.label) str += '\n\t\tlabel "' + edge.label + '"';
		let color = edge.color.color || samples.edges.edge0.color.color;
		str += '\n\t\tcolor "' + color + '"';
		str += '\n\t]\n';
	}
	str += '\n]';
	saveStr(str, 'gml');
}

/* Share modal dialog */
var modal = document.getElementById('shareModal');
var btn = document.getElementById('share');
var span = document.getElementsByClassName('close')[0];
var inputElem = document.getElementById('text-to-copy');
var copiedText = document.getElementById('copied-text');

// When the user clicks the button, open the modal
btn.onclick = function () {
	let linkToShare =
		window.location.origin + window.location.pathname + '?room=' + room;
	copiedText.style.display = 'none';
	modal.style.display = 'block';
	inputElem.setAttribute('size', linkToShare.length);
	inputElem.value = linkToShare;
	inputElem.select();
	network.storePositions();
};
// When the user clicks on <span> (x), close the modal
span.onclick = function () {
	modal.style.display = 'none';
};
// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
	if (event.target == modal) {
		modal.style.display = 'none';
	}
};
document.getElementById('copy-text').addEventListener('click', function (e) {
	e.preventDefault();
	// Select the text
	inputElem.select();
	let copied;
	try {
		// Copy the text
		copied = document.execCommand('copy');
	} catch (ex) {
		copied = false;
	}
	if (copied) {
		// Display the copied text message
		copiedText.style.display = 'inline-block';
	}
});

function displayHelp() {
	window.open('./help.html', 'helpWindow');
}

function togglePanel() {
	// Hide/unhide the side panel
	if (container.panelHidden) {
		panel.classList.remove('hide');
	} else {
		panel.classList.add('hide');
	}
	container.panelHidden = !container.panelHidden;
}
dragElement(document.getElementById('panel'), document.getElementById('tab'));

/* ---------operations related to the side panel -------------------------------------*/
// Panel

var tabOpen = null;
/**
 * when the window is resized, make sure that the panel is still visible
 */
function keepPanelInWindow() {
	if (
		panel.offsetLeft + panel.offsetWidth >
		container.offsetLeft + container.offsetWidth
	) {
		panel.style.left =
			container.offsetLeft +
			container.offsetWidth -
			panel.offsetWidth +
			'px';
	}
	if (
		panel.offsetTop + panel.offsetHeight >
		container.offsetTop + container.offsetHeight
	) {
		panel.style.top =
			container.offsetTop +
			container.offsetHeight -
			panel.offsetHeight -
			document.querySelector('footer').offsetHeight +
			'px';
	}
}

function openTab(tabId) {
	let i, tabcontent, tablinks;
	// Get all elements with class="tabcontent" and hide them by moving them off screen
	tabcontent = document.getElementsByClassName('tabcontent');
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].classList.add('hide');
	}
	// Get all elements with class="tablinks" and remove the class "active"
	tablinks = document.getElementsByClassName('tablinks');
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(' active', '');
	}
	// Show the current tab, and add an "active" class to the button that opened the tab
	document.getElementById(tabId).classList.remove('hide');
	event.currentTarget.className += ' active';
	tabOpen = tabId;
	if (tabOpen == 'nodesTab') showNodeData();
	if (tabOpen == 'linksTab') showEdgeData();
}

function storeButtonStatus() {
	buttonStatus = {
		autoLayout: document.getElementById('autolayoutswitch').checked,
		gravity: document.getElementById('antiGravity').value,
		snapToGrid: document.getElementById('snaptogridswitch').checked,
		curve: document.getElementById('curveSelect').value,
		linkRadius: getRadioVal('hide'),
		stream: getRadioVal('stream'),
		showLabels: document.getElementById('showLabelSwitch').checked,
		legend: document.getElementById('showLegendSwitch').checked,
		sizing: document.getElementById('sizing').value,
	};
}

function saveButtonStatus(event) {
	event.stackItem.meta.set('buttons', buttonStatus);
	storeButtonStatus();
}

function undoRedoButtons(event) {
	let settings;
	if (event.type == 'undo')
		if (yUndoManager.undoStack.length == 0) {
			settings = initialButtonStatus;
		} else {
			settings = yUndoManager.undoStack[
				yUndoManager.undoStack.length - 1
			].meta.get('buttons');
		}
	// event.type == "redo"
	else settings = event.stackItem.meta.get('buttons');
	setButtonStatus(settings);
}

function setButtonStatus(settings) {
	if (
		document.getElementById('autolayoutswitch').checked !=
		settings.autoLayout
	) {
		autoLayoutSet(settings.autoLayout);
		document.getElementById('autolayoutswitch').checked =
			settings.autoLayout;
	}
	if (
		document.getElementById('antiGravity').value != settings.gravity &&
		settings.autoLayout
	) {
		adjustGravity(settings.gravity);
		document.getElementById('antiGravity').value = settings.gravity;
	}
	document.getElementById('snaptogridswitch').checked = settings.snapToGrid;
	if (settings.snapToGrid) doSnapToGrid();
	document.getElementById('curveSelect').value = settings.curve;
	selectCurve();
	document.getElementById('showLegendSwitch').checked = settings.legend;
	legendSwitch(false);
	setRadioVal('hide', settings.linkRadius);
	setRadioVal('stream', settings.stream);
	document.getElementById('showLabelSwitch').checked = settings.showLabels;
	document.getElementById('sizing').value = settings.sizing;
}
// Factors and Links Tabs
function applySampleToNode() {
	if (event.detail != 1) return; // only process single clicks here
	let selectedNodeIds = network.getSelectedNodes();
	if (selectedNodeIds.length == 0) return;
	let nodesToUpdate = [];
	let sample = event.currentTarget.groupNode;
	for (let node of data.nodes.get(selectedNodeIds)) {
		node = deepMerge(node, samples.nodes[sample]);
		node.grp = sample;
		claim(node);
		nodesToUpdate.push(node);
	}
	data.nodes.update(nodesToUpdate);
	lastNodeSample = sample;
}

function applySampleToLink(event) {
	if (event.detail != 1) return; // only process single clicks here
	let sample = event.currentTarget.groupLink;
	let selectedEdges = network.getSelectedEdges();
	if (selectedEdges.length == 0) return;
	let edgesToUpdate = [];
	for (let edge of data.edges.get(selectedEdges)) {
		edge = deepMerge(edge, samples.edges[sample]);
		edge.grp = sample;
		claim(edge);
		edgesToUpdate.push(edge);
	}
	data.edges.update(edgesToUpdate);
	lastLinkSample = sample;
}

function setFixed() {
	let checkbox = document.getElementById('fixed');
	let node = data.nodes.get(network.getSelectedNodes()[0]);
	if (checkbox.checked == true) {
		node.fixed = true;
		data.nodes.update(node);
	} else {
		node.fixed = false;
		data.nodes.update(node);
	}
}
// Notes
function showNodeData() {
	let panel = document.getElementById('nodeDataPanel');
	let selectedNodes = network.getSelectedNodes();
	if (tabOpen == 'nodesTab' && selectedNodes.length == 1) {
		let nodeId = selectedNodes[0];
		let node = data.nodes.get(nodeId);
		document.getElementById('fixed').checked = node.fixed ? true : false;
		document.getElementById('nodeLabel').innerHTML = node.label
			? shorten(node.label)
			: '';
		document.getElementById('nodeNotes').innerHTML =
			'<textarea class="notesTA" id="nodesTA"</textarea>';
		let textarea = document.getElementById('nodesTA');
		let title = node.title ? node.title : '';
		textarea.innerHTML = title.replace(/<\/br>/g, '\n');
		textarea.addEventListener('blur', updateNodeNotes);
		panel.classList.remove('hide');
		displayStatistics(nodeId);
	} else {
		panel.classList.add('hide');
	}
}

function updateNodeNotes() {
	data.nodes.update({
		id: network.getSelectedNodes()[0],
		title: document.getElementById('nodesTA').value.replace(/\n/g, '</br>'),
		clientID: undefined,
	});
}

function showEdgeData() {
	let panel = document.getElementById('edgeDataPanel');
	let selectedEdges = network.getSelectedEdges();
	if (tabOpen == 'linksTab' && selectedEdges.length == 1) {
		let edgeId = selectedEdges[0];
		let edge = data.edges.get(edgeId);
		document.getElementById('edgeLabel').innerHTML = edge.label
			? edge.label
			: '';
		document.getElementById('edgeNotes').innerHTML =
			'<textarea class="notesTA" id="edgesTA"</textarea>';
		let textarea = document.getElementById('edgesTA');
		let title = edge.title ? edge.title : '';
		textarea.innerHTML = title.replace(/<\/br>/g, '\n');
		textarea.addEventListener('blur', updateEdgeNotes);
		panel.classList.remove('hide');
	} else {
		panel.classList.add('hide');
	}
}

function updateEdgeNotes() {
	data.edges.update({
		id: network.getSelectedEdges()[0],
		title: document.getElementById('edgesTA').value.replace(/\n/g, '</br>'),
		clientID: undefined,
	});
}

function hideNotes() {
	document.getElementById('nodeDataPanel').classList.add('hide');
	document.getElementById('edgeDataPanel').classList.add('hide');
}
// Statistics specific to a node
function displayStatistics(nodeId) {
	// leverage (outDegree / inDegree)
	let inDegree = network.getConnectedNodes(nodeId, 'from').length;
	let outDegree = network.getConnectedNodes(nodeId, 'to').length;
	let leverage = inDegree == 0 ? '--' : (outDegree / inDegree).toPrecision(3);
	document.getElementById('leverage').textContent = leverage;
	document.getElementById('bc').textContent =
		bc[nodeId] >= 0 ? bc[nodeId].toPrecision(3) : '--';
}
// Network tab
function autoLayoutSwitch(e) {
	let switchOn = e.target.checked;
	if (switchOn && snapToGridToggle) snapToGridOff(); // no snapping with auto layout.
	document.getElementById('spacing').classList.toggle('hidden');
	autoLayoutSet(switchOn);
}

function autoLayoutSet(switchOn) {
	network.storePositions(); // record current positions so it can be undone
	network.setOptions({
		physics: {
			enabled: switchOn,
		},
	});
	network.once('stabilized', broadcast);
}

function setGravity() {
	// only when autolayout is on
	if (document.getElementById('autolayoutswitch').checked) {
		adjustGravity(document.getElementById('antiGravity').value);
	}
}

function adjustGravity(gravity) {
	network.storePositions(); // record current positions so it can be undone
	network.setOptions({
		physics: {
			barnesHut: {
				gravitationalConstant: -Number(gravity),
				centralGravity: 3.5,
			},
		},
	});
	network.once('stabilized', () => {
		network.setOptions({
			physics: {
				enabled: false,
				stabilization: false,
			},
		});
		broadcast();
	});
}

function snapToGridSwitch(e) {
	snapToGridToggle = e.target.checked;
	if (snapToGridToggle) {
		doSnapToGrid();
	}
}

function doSnapToGrid() {
	autoLayoutSet(false);
	let positions = network.getPositions();
	data.nodes.update(
		data.nodes.get().map((n) => {
			n.x = positions[n.id].x;
			n.y = positions[n.id].y;
			snapToGrid(n);
			claim(n);
			return n;
		})
	);
}

function snapToGridOff() {
	document.getElementById('snaptogridswitch').checked = false;
	snapToGridToggle = false;
}

function selectCurve() {
	let options = {
		edges: {
			smooth: document.getElementById('curveSelect').value === 'Curved',
		},
	};
	network.setOptions(options);
	options.clientID = clientID;
	yNetMap.set('edges', options);
}

function setCurve(options) {
	document.getElementById('curveSelect').value = options.edges.smooth
		? 'Curved'
		: 'Straight';
	network.setOptions(options);
}

function updateNetBack(event) {
	let ul = document.getElementById('underlay');
	ul.style.backgroundColor = event.target.value;
	// if in drawing mode, make the underlay translucent so that network shows through
	if (document.getElementById('toolbox').style.display == 'block')
		makeTranslucent(ul);
	yNetMap.set('background', event.target.value);
}

function makeTranslucent(elem) {
	elem.style.backgroundColor = getComputedStyle(elem)
		.backgroundColor.replace(')', ', 0.2)')
		.replace('rgb', 'rgba');
}

function makeSolid(elem) {
	elem.style.backgroundColor = getComputedStyle(elem)
		.backgroundColor.replace(', 0.2)', ')')
		.replace('rgba', 'rgb');
}
function setBackground(color) {
	document.getElementById('underlay').style.backgroundColor = color;
}
function toggleDrawingLayer() {
	drawingSwitch = document.getElementById('toolbox').style.display == 'block';
	let ul = document.getElementById('underlay');
	if (drawingSwitch) {
		// close drawing layer
		deselectTool();
		document.getElementById('toolbox').style.display = 'none';
		document.getElementById('underlay').style.zIndex = 0;
		makeSolid(ul);
		document.getElementById('temp-canvas').style.zIndex = 0;
		document.getElementById('chatbox-tab').classList.remove('chatbox-hide');
		inAddMode = false;
		setButtonDisabledStatus('addNode', false);
		setButtonDisabledStatus('addLink', false);
		changeCursor('auto');
	} else {
		// expose drawing layer
		document.getElementById('toolbox').style.display = 'block';
		ul.style.zIndex = 1000;
		ul.style.cursor = 'default';
		document.getElementById('temp-canvas').style.zIndex = 1000;
		// make the underlay (which is now overlay) translucent
		makeTranslucent(ul);
		minimize();
		document.getElementById('chatbox-tab').classList.add('chatbox-hide');
		inAddMode = 'disabled';
		setButtonDisabledStatus('addNode', true);
		setButtonDisabledStatus('addLink', true);
	}
	drawingSwitch = !drawingSwitch;
	network.redraw();
}
function ensureNotDrawing() {
	if (!drawingSwitch) return;
	toggleDrawingLayer();
	document.getElementById('drawing').checked = false;
}

function selectAllFactors() {
	network.selectNodes(network.body.nodeIndices);
}

function selectAllEdges() {
	network.selectEdges(network.body.edgeIndices);
}
var labelsShown = true;

function labelSwitch() {
	if (labelsShown) {
		labelsShown = false;
		hideLabels();
	} else {
		labelsShown = true;
		unHideLabels();
	}
}

function legendSwitch(warn) {
	if (document.getElementById('showLegendSwitch').checked) legend(warn);
	else clearLegend();
}

function hideLabels() {
	// move the label to the hiddenLabel property and set the label to an empty string
	let nodesToUpdate = [];
	data.nodes.forEach(function (n) {
		n.hiddenLabel = n.label;
		n.label = '';
		nodesToUpdate.push(n);
	});
	data.nodes.update(nodesToUpdate);
	let edgesToUpdate = [];
	data.edges.forEach(function (n) {
		n.hiddenLabel = n.label;
		n.label = '';
		edgesToUpdate.push(n);
	});
	data.edges.remove(edgesToUpdate);
	data.edges.add(edgesToUpdate);
}

function unHideLabels() {
	let nodesToUpdate = [];
	data.nodes.forEach(function (n) {
		if (n.hiddenLabel) n.label = n.hiddenLabel;
		n.hiddenLabel = undefined;
		nodesToUpdate.push(n);
	});
	data.nodes.update(nodesToUpdate);
	let edgesToUpdate = [];
	data.edges.forEach(function (n) {
		if (n.hiddenLabel) n.label = n.hiddenLabel;
		n.hiddenLabel = undefined;
		edgesToUpdate.push(n);
	});
	data.edges.remove(edgesToUpdate);
	data.edges.add(edgesToUpdate);
}

function getRadioVal(name) {
	// get list of radio buttons with specified name
	let radios = document.getElementsByName(name);
	// loop through list of radio buttons
	for (let i = 0, len = radios.length; i < len; i++) {
		if (radios[i].checked) return radios[i].value;
	}
}

function setRadioVal(name, value) {
	// get list of radio buttons with specified name
	let radios = document.getElementsByName(name);
	// loop through list of radio buttons and set the check on the one with the value
	for (let i = 0, len = radios.length; i < len; i++) {
		radios[i].checked = radios[i].value == value;
	}
}

function hideDistantOrStreamNodes() {
	// get the intersection of the nodes (and links) in radius and up or downstream,
	// and then hide everything not in that intersection
	let radius = getRadioVal('hide');
	let stream = getRadioVal('stream');
	broadcastHideAndStream(radius, stream);
	if (radius == 'All' && stream == 'All') {
		showAll();
		return;
	}
	let selectedNodes = network.getSelectedNodes();
	if (selectedNodes.length == 0) {
		statusMsg('Select a Factor first', 'error');
		// unhide everything
		document.getElementById('hideAll').checked = true;
		document.getElementById('streamAll').checked = true;
		broadcastHideAndStream('All', 'All');
		showAll();
		return;
	}

	let nodeIdsInRadiusSet = new Set();
	let linkIdsInRadiusSet = new Set();
	let nodeMap = new Map();
	let linkIdsInStreamSet = new Set();
	let nodesToShow, linksToShow;

	if (stream == 'All') {
		// filter by radius only
		inSet(selectedNodes, radius);
		nodesToShow = nodeIdsInRadiusSet;
		linksToShow = linkIdsInRadiusSet;
	} else {
		// get nodes up or down stream
		if (radius == 'All') radius = data.nodes.length;
		if (stream == 'upstream') upstream(selectedNodes, radius);
		else downstream(selectedNodes, radius);
		nodesToShow = nodeMap;
		linksToShow = linkIdsInStreamSet;
	}
	// update the network
	data.nodes.update(
		data.nodes.map((node) => {
			node.hidden = !nodesToShow.has(node.id);
			return node;
		})
	);
	data.edges.update(
		data.edges.map((edge) => {
			edge.hidden = !linksToShow.has(edge.id);
			return edge;
		})
	);

	function inSet(nodeIds, radius) {
		// recursive function to collect nodes within radius links from any
		// of the nodes listed in nodeIds
		if (radius < 0) return;
		nodeIds.forEach(function (nId) {
			nodeIdsInRadiusSet.add(nId);
			let links = network.getConnectedEdges(nId);
			if (links && radius >= 0)
				links.forEach(function (lId) {
					linkIdsInRadiusSet.add(lId);
				});
			let linked = network.getConnectedNodes(nId);
			if (linked) inSet(linked, radius - 1);
		});
	}

	function upstream(q, radius) {
		let distance = 0;
		q.forEach((nId) => nodeMap.set(nId, distance));
		while (q.length > 0) {
			let nId = q.shift();
			if (nodeMap.get(nId) < radius) {
				let links = data.edges.get({
					filter: function (item) {
						return item.to == nId;
					},
				});
				distance++;
				links.forEach((link) => {
					if (!nodeMap.has(link.from)) {
						nodeMap.set(link.from, distance);
						q.push(link.from);
					}
				});
			}
		}
		addAllLinks();
	}

	function addAllLinks() {
		data.edges
			.get({
				filter: function (edge) {
					return nodeMap.has(edge.from) && nodeMap.has(edge.to);
				},
			})
			.forEach((edge) => linkIdsInStreamSet.add(edge.id));
	}

	function downstream(q, radius) {
		let distance = 0;
		q.forEach((nId) => nodeMap.set(nId, distance));
		while (q.length > 0) {
			let nId = q.shift();
			if (nodeMap.get(nId) < radius) {
				let links = data.edges.get({
					filter: function (item) {
						return item.from == nId;
					},
				});
				distance++;
				links.forEach((link) => {
					if (!nodeMap.has(link.to)) {
						nodeMap.set(link.to, distance);
						q.push(link.to);
					}
				});
			}
		}
		addAllLinks();
	}

	function showAll() {
		data.nodes.update(
			data.nodes.map((node) => {
				node.hidden = false;
				return node;
			})
		);
		data.edges.update(
			data.edges.map((edge) => {
				edge.hidden = false;
				return edge;
			})
		);
	}
}

function broadcastHideAndStream(hideSetting, streamSetting) {
	yNetMap.set('hideAndStream', {
		hideSetting: hideSetting,
		streamSetting: streamSetting,
		selected: network.getSelectedNodes(),
	});
}

function setHideAndStream(obj) {
	network.selectNodes(obj.selected);
	statusMsg(listFactors(network.getSelectedNodes()) + ' selected');
	setRadioVal('hide', obj.hideSetting);
	setRadioVal('stream', obj.streamSetting);
}

function sizing() {
	// set the size of the nodes proportional to the selected metric
	//  none, in degree out degree or betweenness centrality
	let metric = document.getElementById('sizing').value;
	data.nodes.forEach((node) => {
		switch (metric) {
			case 'Off':
				node.value = 0;
				break;
			case 'Inputs':
				node.value = network.getConnectedNodes(node.id, 'from').length;
				break;
			case 'Outputs':
				node.value = network.getConnectedNodes(node.id, 'to').length;
				break;
			case 'Leverage': {
				let inDegree = network.getConnectedNodes(node.id, 'from')
					.length;
				let outDegree = network.getConnectedNodes(node.id, 'to').length;
				node.value = inDegree == 0 ? 0 : outDegree / inDegree;
				break;
			}
			case 'Centrality':
				node.value = bc[node.id];
				break;
		}
		data.nodes.update(node);
	});
	network.fit();
	document.getElementById('zoom').value = network.getScale();
}
/* ---------------------------------------chat window --------------------------------*/
function minimize() {
	chatbox.classList.add('chatbox-hide');
	chatboxTab.classList.remove('chatbox-hide');
	chatboxTab.classList.remove('chatbox-blink');
}

function maximize() {
	chatboxTab.classList.add('chatbox-hide');
	chatboxTab.classList.remove('chatbox-blink');
	chatbox.classList.remove('chatbox-hide');
	displayUserName();
	displayAllMsgs();
}

function blinkChatboxTab() {
	if (yChatArray.length > 0) chatboxTab.classList.add('chatbox-blink');
}

function sendMsg() {
	let inputMsg = chatInput.value.replace(/\n/g, '</br>');
	let clock = new Date().toLocaleTimeString();
	yChatArray.push([
		{
			client: clientID,
			author: myName,
			time: clock,
			msg: inputMsg,
		},
	]);
}

function displayLastMsg() {
	displayMsg(yChatArray.get(yChatArray.length - 1));
}

function displayAllMsgs() {
	chatMessages.innerHTML = '';
	for (let m = 0; m < yChatArray.length; m++) {
		displayMsg(yChatArray.get(m));
	}
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

function displayMsg(msg) {
	if (msg == undefined) return;
	if (msg.client == clientID) {
		/* my own message */
		chatMessages.innerHTML += `<div class="message-box-holder">
			<div class="message-box">
				${msg.msg}
			</div>
		</div>`;
	} else {
		chatMessages.innerHTML += `<div class="message-box-holder">
			<div class="message-sender">
				${msg.time} ${msg.author}
			</div>
			<div class="message-box message-partner">
				${msg.msg}
			</div>
		</div>`;
	}
	chatMessages.scrollTop = chatMessages.scrollHeight;
	chatInput.value = '';
}

function displayUserName() {
	chatNameBox.value = myName;
}

dragElement(
	document.getElementById('chatbox-holder'),
	document.getElementById('chatbox-top')
);
