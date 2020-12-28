/* 
The main entry point for PRSM.  
 */
import * as Y from 'yjs';
import {WebsocketProvider} from 'y-websocket';
import {IndexeddbPersistence} from 'y-indexeddb';
import {Network, parseGephiNetwork} from 'vis-network/peer';
import {DataSet} from 'vis-data/peer';
import {
	listen,
	elem,
	getScaleFreeNetwork,
	uuidv4,
	deepMerge,
	clean,
	strip,
	splitText,
	cleanArray,
	dragElement,
	standardize_color,
	object_equals,
	generateName,
	divWithPlaceHolder,
} from './utils.js';
import Tutorial from './tutorial.js';
import {styles} from './samples.js';
import * as parser from 'fast-xml-parser';
// see https://github.com/joeattardi/emoji-button
import EmojiButton from '@joeattardi/emoji-button';
import {
	setUpSamples,
	reApplySampleToNodes,
	reApplySampleToLinks,
	legend,
	clearLegend,
} from './styles.js';
import {setUpPaint, setUpToolbox, deselectTool, redraw} from './paint.js';

const version = '1.4.2';
const GRIDSPACING = 50; // for snap to grid
const NODEWIDTH = 10; // chars for label splitting
const NOTEWIDTH = 30; // chars for title (node/edge tooltip) splitting
const SHORTLABELLEN = 25; // when listing node labels, use ellipsis after this number of chars
const timeToSleep = 1 * 60 * 1000; // if no mouse movement for this time, user is assumed to have left or is sleeping

export var network;
var room;
var viewOnly; // when true, user can only view, not modify, the network
var nodes; // a dataset of nodes
var edges; // a dataset of edges
var data; // an object with the nodes and edges datasets as properties
var clientID; // unitue ID for this browser
var yNodesMap; // shared map of nodes
var yEdgesMap; // shared map of edges
var ySamplesMap; // shared map of styles
var yNetMap; // shared map of global network settings
export var yPointsArray; // shared array of the background drawing commands
var yUndoManager; // shared list of commands for undo
var yChatArray; // shared array of messages in the chat window
var yAwareness; // awareness channel
var container; //the DOM body elemnet
var netPane; // the DOM pane showing the network
var panel; // the DOM right side panel element
var buttonStatus; // the status of the buttons in the panel
var initialButtonStatus; // the network panel's sttings at initialisation
var myNameRec; // the user's name record {actual name, type, etc.}
var lastNodeSample = 'group0'; // the last used node style
var lastLinkSample = 'edge0'; // the last used edge style
var inAddMode = false; // true when adding a new Factor to the network; used to choose cursor pointer
var snapToGridToggle = false; // true when snapping nodes to the (unseen) grid
export var drawingSwitch = false; // true when the drawing layer is uppermost
var tutorial = new Tutorial(); // object driving the tutorial

/**
 * top level function to initialise everything
 */
window.addEventListener('load', () => {
	addEventListeners();
	setUpPage();
	startY();
	setUpChat();
	setUpAwareness();
	setUpPaint();
	setUpToolbox();
	setUpShareDialog();
	draw();
});

/**
 * Set up all the permanent event listeners
 */
function addEventListeners() {
	listen('maptitle', 'keydown', (e) => {
		//disallow Enter key
		if (e.key === 'Enter') {
			e.preventDefault();
		}
	});
	listen('maptitle', 'keyup', mapTitle);
	listen('maptitle', 'click', (e) => {
		if (e.target.innerText == 'Untitled map')
			window.getSelection().selectAllChildren(e.target);
	});
	listen('addNode', 'click', plusNode);
	listen('net-pane', 'contextmenu', ctlClickAddNode);
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

/**
 * create all the DOM elemts on the web page
 */
function setUpPage() {
	// don't allow user to change anything if URL includes ?viewing
	viewOnly = new URL(document.location).searchParams.get('viewing');
	if (viewOnly) document.getElementById('buttons').style.display = 'none';
	// treat user as first time user if URL includes ?start=true
	let newUser = new URL(document.location).searchParams.get('start');
	if (newUser) localStorage.setItem('doneIntro', 'false');
	container = document.getElementById('container');
	panel = document.getElementById('panel');
	panel.classList.add('hide');
	container.panelHidden = true;
	setUpSamples();
	divWithPlaceHolder('#node-notes');
	divWithPlaceHolder('#edge-notes');
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
	const wsProvider = new WebsocketProvider(
		'wss://cress.soc.surrey.ac.uk/wss',
		'prsm' + room,
		doc
	);
	/* 	const wsProvider = new WebsocketProvider(
		'ws://localhost:1234',
		'prsm' + room,
		doc
	); */
	const persistence = new IndexeddbPersistence(room, doc);
	persistence.once('synced', () => {
		displayNetPane('local content loaded');
	});
	// wait for an update from another peer; only then will
	// drawing etc. be finished and so we can then fit the  network to the window.
	wsProvider.on('sync', () => {
		displayNetPane('remote content loaded');
	});
	document.title = document.title + ' ' + room;
	wsProvider.on('status', (event) => {
		console.log(
			new Date().toLocaleTimeString() +
				': ' +
				event.status +
				(event.status == 'connected' ? ' to' : ' from') +
				' room ' +
				room
		); // logs when websocket is "connected" or "disconnected"
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
	yAwareness = wsProvider.awareness;

	clientID = doc.clientID;
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
	window.debug = false; // if true, all yjs sharing interactions are logged to the console
	window.data = data;
	window.clientID = clientID;
	window.yNodesMap = yNodesMap;
	window.yEdgesMap = yEdgesMap;
	window.ySamplesMap = ySamplesMap;
	window.yNetMap = yNetMap;
	window.yUndoManager = yUndoManager;
	window.yChatArray = yChatArray;
	window.yPointsArray = yPointsArray;
	window.styles = styles;
	window.yAwareness = yAwareness;
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
					styles.nodes[key] = sample.node;
					nodesToUpdate.push(key);
				} else {
					styles.edges[key] = sample.edge;
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
			if (!event.transaction.local)
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
						hideDistantOrStreamNodes(false);
						break;
					case 'background':
						setBackground(obj);
						break;
					case 'maptitle':
						setMapTitle(obj);
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
} // end startY()

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
/**
 * Once any existing map has been loaded, fit it to the pane and reveal it
 * @param {string} msg message for console
 */
function displayNetPane(msg) {
	fit(0);
	legend(false);
	console.log(msg);
	let netPane = elem('net-pane');
	if (netPane.style.visibility == 'hidden' || netPane.style.visibility == '') {
		netPane.style.visibility = 'visible';
		setUpTutorial();
	}
}
// to handle iPad viewport sizing problem when tab bar appears
document.body.height = window.innerHeight;
window.onresize = function () {
	document.body.height = window.innerHeight;
	keepPaneInWindow(panel);
	keepPaneInWindow(document.getElementById('chatbox-holder'));
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

/**
 * create DOM elements for the chat box
 */
function setUpChat() {
	try {
		myNameRec = JSON.parse(localStorage.getItem('myName'));
	} catch (err) {
		myNameRec = null;
	}
	// sanity check
	if (!(myNameRec != null && myNameRec.name)) {
		myNameRec = generateName();
		localStorage.setItem('myName', JSON.stringify(myNameRec));
	}

	console.log('My name: ' + myNameRec.name);
	displayUserName();
	yAwareness.setLocalState({name: myNameRec});
	yChatArray.observe(() => {
		displayLastMsg();
		blinkChatboxTab();
	});
	chatboxTab.addEventListener('click', maximize);
	listen('minimize', 'click', minimize);
	chatNameBox.addEventListener('keyup', (e) => {
		if (myNameRec.anon) chatNameBox.style.fontStyle = 'normal';
		if (e.key == 'Enter') chatboxSaveName();
	});
	function chatboxSaveName() {
		if (chatNameBox.value.length == 0) {
			myNameRec = generateName();
			chatNameBox.value = myNameRec.name;
		} else {
			myNameRec.name = chatNameBox.value;
			myNameRec.anon = false;
		}
		localStorage.setItem('myName', JSON.stringify(myNameRec));
		yAwareness.setLocalState({name: myNameRec});
	}
	chatNameBox.addEventListener('blur', () => {
		chatboxSaveName();
	});
	chatNameBox.addEventListener('click', () => {
		if (myNameRec.anon) chatNameBox.value = '';
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
 * if this is the user's first time, show them how the user interface works
 */
function setUpTutorial() {
	if (localStorage.getItem('doneIntro') != 'true') {
		tutorial.onexit(function () {
			localStorage.setItem('doneIntro', 'true');
		});
		tutorial.start();
	}
}
/**
 *  set up user monitoring (awareness)
 */
function setUpAwareness() {
	yAwareness.on('change', (event) => {
		if (window.debug) console.log(event);
		showOtherUsers();
	});
	// fade out avatar when there has been no movement of the mouse for 15 minutes
	var sleepTimer = setTimeout(() => asleep(true), timeToSleep);
	window.addEventListener('mousemove', () => {
		clearTimeout(sleepTimer);
		asleep(false);
		sleepTimer = setTimeout(asleep, timeToSleep);
	});
}
/**
 * Set the awareness local state to show whether this client is sleeping (no mouse movement for 15 minutes)
 * @param {Boolean} isSleeping
 */
function asleep(isSleeping) {
	myNameRec.asleep = isSleeping;
	yAwareness.setLocalState({name: myNameRec});
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
				item = deepMerge(item, styles.nodes[lastNodeSample]);
				item.grp = lastNodeSample;
				addLabel(item, cancelEdit, callback);
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
				item = deepMerge(item, styles.edges[lastLinkSample]);
				item.grp = lastLinkSample;
				showPressed('addLink', 'remove');
				clearStatusBar();
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
	network.on('selectNode', function (params) {
		let selectedNodes = network.getSelectedNodes();
		selectedNodes.forEach((nodeId) => {
			let node = data.nodes.get(nodeId);
			node.shadow = true;
			data.nodes.update(node);
		});
		if (selectedNodes.length > 1) hideDistantOrStreamNodes();
		// if shiftkey is down, start linking to another node
		if (params.event.pointers[0].shiftKey) {
			// start linking from this node, but only if  one node is selected, else source node is not clear
			if (selectedNodes.length == 1) {
				statusMsg('Linking from ' + listFactors(selectedNodes));
				plusLink();
			}
		} else {
			statusMsg(listFactors(selectedNodes) + ' selected');
			showNodeOrEdgeData();
		}
	});
	network.on('deselectNode', function () {
		let nodes = data.nodes.get();
		nodes.forEach((node) => {
			node.shadow = false;
		});
		data.nodes.update(nodes);
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
		showNodeOrEdgeData();
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
 * @param {Integer} duration speed of zoom to fit
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
 * broadcast current node positions to all clients
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
/* ----------------- dialogs for creating and editing nodes and links ----------------*/

/**
 * A factor is being created:  get its label from the user
 * @param {Object} item - the node
 * @param {Function} cancelAction
 * @param {Function} callback
 */
function addLabel(item, cancelAction, callback) {
	initPopUp('Add Factor', 60, item, cancelAction, saveLabel, callback);
	positionPopUp();
	document.getElementById('popup-label').focus();
}
/**
 * if user Control-clicks the canvas, use this as a shortcut equivalent to pressing the Add Node button
 * @param {mouseEvent} event
 */
function ctlClickAddNode(event) {
	// cancel default context menu
	event.preventDefault();
	let domPos = {x: event.offsetX, y: event.offsetY};
	// if clicking on a node or edge, report it to console for debugging
	let target = network.getNodeAt(domPos);
	if (target !== undefined) {
		console.log(data.nodes.get(target));
		return;
	}
	target = network.getEdgeAt(domPos);
	if (target !== undefined) {
		console.log(data.edges.get(target));
		return;
	}
	let pos = network.DOMtoCanvas(domPos);
	let item = {id: uuidv4(), label: '', x: pos.x, y: pos.y};
	item = deepMerge(item, styles.nodes[lastNodeSample]);
	item.grp = lastNodeSample;
	addLabel(item, clearPopUp, function (newItem) {
		if (newItem !== null) data.nodes.add(newItem);
	});
}
/**
 * Draw a dialog box for user to edit a node
 * @param {Object} item the node
 * @param {Function} cancelAction what to do if the edit is cancelled
 * @param {Function} callback what to do if the edit is saved
 */
function editNode(item, cancelAction, callback) {
	initPopUp('Edit Factor', 150, item, cancelAction, saveNode, callback);
	document.getElementById('popup').insertAdjacentHTML(
		'beforeend',
		`	
	<table id="popup-table">
		<tr>
			<td>
				Back
			</td>
			<td>
				Border
			</td>
			<td>
				Font
			</td>
		</tr>
		<tr>
		<td>
		<div class="input-color-container">
		<input type="color" class="input-color" id="node-backgroundColor" />
		</div>
		</td>
		<td>
			<div class="input-color-container">
			<input type="color" class="input-color" id="node-borderColor" />
			</div>
			</td>
			<td>
			<div class="input-color-container">
			<input type="color" class="input-color" id="node-fontColor" />
			</div>
			</td>
		</tr>
		<tr>
		<td>Border:</td>
			<td colspan="2">
				<select id="node-borderType">
					<option value="false">Type...</option>
					<option value="false">Solid</option>
					<option value="true">Dashed</option>
					<option value="dots">Dotted</option>
				</select>
			</td>
		</tr>
	</table>`
	);
	document.getElementById('node-backgroundColor').value = standardize_color(
		item.color.background
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
/**
 * Convert CSS description of line type to menu option format
 * true, false, [3 3] => "true", "false", "dots"
 * @param {Array|Boolean} val
 */
function getDashes(val) {
	return Array.isArray(val) ? 'dots' : val.toString();
}
/**
 * Draw a dialog box for user to edit an edge
 * @param {Object} item the edge
 * @param {Function} cancelAction what to do if the edit is cancelled
 * @param {Function} callback what to do if the edit is saved
 */
function editEdge(item, cancelAction, callback) {
	initPopUp('Edit Link', 140, item, cancelAction, saveEdge, callback);
	document.getElementById('popup').insertAdjacentHTML(
		'beforeend',
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
			<div class="input-color-container">
			<input type="color" class="input-color" id="edge-color" />
			</div>
			</td>
		</tr>
		<tr>
			<td colspan="2">
				<select id="edge-type">
					<option value="false">Type...</option>
					<option value="false">Solid</option>
					<option value="true">Dashed</option>
					<option value="dots">Dotted</option>
				</select>
			</td>
		</tr>
	</table>`
	);
	document.getElementById('edge-width').value = parseInt(item.width);
	document.getElementById('edge-color').value = standardize_color(
		item.color.color
	);
	document.getElementById('edge-type').value = getDashes(item.dashes);
	positionPopUp();
	document.getElementById('popup-label').focus();
}
/**
 * Initialise the dialog for creating nodes/edges
 * @param {String} popUpTitle
 * @param {Object} item
 * @param {Function} cancelAction
 * @param {Function} saveAction
 * @param {Function} callback
 */
function initPopUp(
	popUpTitle,
	height,
	item,
	cancelAction,
	saveAction,
	callback
) {
	inAddMode = false;
	changeCursor('auto');
	document.getElementById('popup').style.height = height + 'px';
	document.getElementById('popup-operation').innerHTML = popUpTitle;
	document.getElementById('popup-saveButton').onclick = saveAction.bind(
		this,
		item,
		callback
	);
	document.getElementById('popup-cancelButton').onclick = cancelAction.bind(
		this,
		callback
	);
	let popupLabel = document.getElementById('popup-label');
	popupLabel.addEventListener('keyup', squashInputOnKeyUp);
	popupLabel.style.fontSize = '20px';
	popupLabel.innerText =
		item.label === undefined ? '' : item.label.replace(/\n/g, ' ');
	let table = document.getElementById('popup-table');
	if (table) table.remove();
}
/**
 * when the height of the text threatens to exceed the height of the window, reduce the font size to make it fit
 * @param {event} e
 */
function squashInputOnKeyUp(e) {
	squashInput(e.target);
}
/**
 * Reduce font size of element to make text fit it
 * @param {HTMLElement} elem
 */
function squashInput(elem) {
	if (elem.scrollHeight > elem.clientHeight) {
		let shrink = elem.clientHeight / elem.scrollHeight;
		elem.style.fontSize =
			Math.floor(
				parseFloat(
					window.getComputedStyle(elem).getPropertyValue('font-size')
				) * shrink
			) + 'px';
	}
}
/**
 * Position the editng dialog box so that it is to the left of the item being edited,
 * but not outside the window
 */
function positionPopUp() {
	let popUp = document.getElementById('popup');
	popUp.style.display = 'block';
	// popup appears to the left of the mouse pointer
	popUp.style.top = `${
		event.clientY - popUp.offsetHeight / 2 - popUp.offsetParent.offsetTop
	}px`;
	let left = event.clientX - popUp.offsetWidth - 3;
	popUp.style.left = `${left < 0 ? 0 : left}px`;
	squashInput(document.getElementById('popup-label'));
}

/**
 * Hide the editing dialog box
 */
function clearPopUp() {
	document.getElementById('popup-saveButton').onclick = null;
	document.getElementById('popup-cancelButton').onclick = null;
	document.getElementById('popup-label').onkeyup = null;
	document.getElementById('popup').style.display = 'none';
}
/**
 * User has pressed 'cancel' - abandon the edit and hide the dialog
 * @param {Function} callback
 */
function cancelEdit(callback) {
	clearPopUp();
	callback(null);
	stopEdit();
}
/**
 * called when a node or edge has been added.  Save the label provided
 * @param {Object} item the item that has been added
 * @param {Function} callback
 */
function saveLabel(item, callback) {
	item.label = splitText(
		document.getElementById('popup-label').innerText,
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
/**
 * save the node format details that have been edited
 * @param {Object} item the node that has been edited
 * @param {Function} callback
 */
function saveNode(item, callback) {
	item.label = splitText(
		document.getElementById('popup-label').innerText,
		NODEWIDTH
	);
	clearPopUp();
	if (item.label === '') {
		// if there is no label, cancel (nodes must have a label)
		statusMsg('No label: cancelled', 'warn');
		callback(null);
	}
	let color = document.getElementById('node-backgroundColor').value;
	item.color.background = color;
	item.color.highlight.background = color;
	item.color.hover.background = color;
	color = document.getElementById('node-borderColor').value;
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
/**
 * save the edge format details that have been edited
 * @param {Object} item the edge that has been edited
 * @param {Function} callback
 */
function saveEdge(item, callback) {
	item.label = splitText(
		document.getElementById('popup-label').innerText,
		NODEWIDTH
	);
	clearPopUp();
	if (item.label === '') item.label = ' ';
	let color = document.getElementById('edge-color').value;
	item.color.color = color;
	item.color.hover = color;
	item.color.highlight = color;
	item.width = parseInt(document.getElementById('edge-width').value);
	if (!item.width) item.width = 1;
	item.dashes = convertDashes(document.getElementById('edge-type').value);
	claim(item);
	network.manipulation.inMode = 'editEdge'; // ensure still in edit mode, in case others have done something meanwhile
	callback(item);
}
/**
 * Convert from the menu selection to the CSS format of the edge
 * @param {String} val
 */
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

/* ----------------- end of node and edge creation and editing dialog -----------------*/

/**
 * if there is already a link from the 'from' node to the 'to' node, return it
 * @param {Object} from A node
 * @param {Object} to Another node
 */
function duplEdge(from, to) {
	return data.edges.get({
		filter: function (item) {
			return item.from == from && item.to == to;
		},
	});
}
/**
 * Constructs a nice string to tell the user what nodes and links are being deleted.
	 Includes links connected to deleted nodes in the count. 
 * @param {Array} item List of nodes to be deleted
 */
function deleteMsg(item) {
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
/**
 * Change the cursor style for the net pane and nav bar
 * @param {Cursor} newCursorStyle
 */
function changeCursor(newCursorStyle) {
	if (inAddMode) return;
	netPane.style.cursor = newCursorStyle;
	document.getElementById('navbar').style.cursor = newCursorStyle;
}
/**
 * User has set or changed the map title: update the UI and broadcast the new title
 * @param {event} e
 */
function mapTitle(e) {
	let title = e.target.innerText;
	title = setMapTitle(title);
	yNetMap.set('maptitle', title);
}
/**
 * Format the map title
 * @param {string} title
 */
function setMapTitle(title) {
	let div = document.getElementById('maptitle');
	if (title == '') {
		title = 'Untitled map';
	}
	if (title == 'Untitled map') div.classList.add('unsetmaptitle');
	else div.classList.remove('unsetmaptitle');
	if (title !== 'Untitled map') {
		lastFileName = title.replace(/\s+/g, '').toLowerCase();
	}
	if (title !== div.innerText) div.innerText = title;
	return title;
}
/**
 * unselect all nodes and edges
 */
function unSelect() {
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
/**
 * Ask the web worker to recalculate network statistics
 */
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
/**
 * show status messages at the bottom of the window
 * @param {string} msg
 * @param {string} status type of msg - warning, error or other
 */
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
/**
 * replace special characters with their HTML entity codes
 * @param {string} str
 */
function htmlEntities(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&quot;');
}
/**
 * remove any previous message from the status bar
 */
function clearStatusBar() {
	statusMsg(' ');
}
/**
 * return a string listing the labels of the given nodes, with nice connecting words
 * @param {Array} factors List of factcors
 */
function listFactors(factors) {
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
/**
 * shortern the label if necessary and add an ellipsis
 * @param {string} label
 */
function shorten(label) {
	return label.length > SHORTLABELLEN
		? label.substring(0, SHORTLABELLEN) + '...'
		: label;
}
/**
 * return a string listing the number of Links
 * @param {Array} links
 */
function listLinks(links) {
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
/**
 * expand/reduce the network view using the value in the zoom slider
 */
function zoomnet() {
	network.zoom(Number(document.getElementById('zoom').value));
}
/**
 * zoom by the given amount (+ve or -ve)
 * @param {Number} incr
 */
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
/**
 * react to the user pressing the Add node button
 * handles cases when the button is disbled; has previously been pressed; and the Add link
 * button is active, as well as the normal case
 *
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
/**
 * react to the user pressing the Add Link button
 * handles cases when the button is disbled; has previously been pressed; and the Add Node
 * button is active, as well as the normal case
 */
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
/**
 * cancel adding node and links
 */
function stopEdit() {
	inAddMode = false;
	network.disableEditMode();
	changeCursor('auto');
}
/**
 * Add or remove the CSS style showing that the button has been pressed
 * @param {string} elem the Id of the button
 * @param {*} action whether to add or remove the style
 *
 */
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
/**
 * Get the name of a map file to read and load it
 * @param {event} e
 */
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
/**
 * determine what kind fo file it is, parse it and reaplce any current map with the one read from the file
 * @param {string} contents
 */
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
	data.nodes.update(data.nodes.map((n) => deepMerge(styles.nodes[n.grp], n)));
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
	data.edges.update(data.edges.map((e) => deepMerge(styles.edges[e.grp], e)));
	if (!isJSONfile) adjustGravity(50000);
	network.fit(0);
}
/**
 * Parse and load a PRSM map file, or a JSON file exported from Gephi
 * @param {string} json
 */
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
	// before v1.4, the style array was called samples
	if (json.samples) json.styles = json.samples;
	if (json.styles) {
		styles.nodes = json.styles.nodes;
		styles.edges = json.styles.edges;
		refreshSampleNodes();
		refreshSampleLinks();
		for (let groupId in styles.nodes) {
			ySamplesMap.set(groupId, {
				node: styles.nodes[groupId],
				clientID: clientID,
			});
		}
		for (let edgeId in styles.edges) {
			ySamplesMap.set(edgeId, {
				edge: styles.edges[edgeId],
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
/**
 * parse and load a graphML file
 * @param {string} graphML
 */
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
/**
 * Parse and load a GML file
 * @param {string} gml
 */
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
/**
 * Read a comma separated values file consisting of 'From' label and 'to' label, on each row,
     with a header row (ignored) 
	optional, cols 3 and 4 can include the groups (styles) of the from and to nodes,
	column 5 can include the style of the edge.  All these must be integers between 1 and 9
 * @param {string} csv 
 */
function parseCSV(csv) {
	let lines = csv.split('\n');
	let labels = new Map();
	let links = [];
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].length <= 2) continue; // empty line
		let line = lines[i].split(',');
		let from = node(line[0], line[2]);
		let to = node(line[1], line[3]);
		let grp = line[4];
		if (grp) grp = 'edge' + (grp.trim() - 1);
		links.push({
			id: i.toString(),
			from: from,
			to: to,
			grp: grp,
		});
	}
	nodes.add(Array.from(labels.values()));
	edges.add(links);
	return {
		nodes: nodes,
		edges: edges,
	};

	function node(label, grp) {
		label = label.trim();
		if (grp) grp = 'group' + (grp.trim() - 1);
		if (labels.get(label) == undefined) {
			labels.set(label, {id: label.toString(), label: label, grp: grp});
		}
		return labels.get(label).id;
	}
}
/**
 * ensure that the styles displayed in the node styles panel display the styles defined in the styles array
 */
function refreshSampleNodes() {
	let sampleElements = Array.from(
		document.getElementsByClassName('sampleNode')
	);
	for (let i = 0; i < sampleElements.length; i++) {
		let sampleElement = sampleElements[i];
		let node = sampleElement.dataSet.get()[0];
		node = deepMerge(node, styles.nodes['group' + i], {
			value: styles.nodes['base'].scaling.max,
		});
		node.label = node.groupLabel;
		sampleElement.dataSet.remove(node.id);
		sampleElement.dataSet.update(node);
		sampleElement.net.fit();
	}
}
/**
 * ensure that the styles displayed in the link styles panel display the styles defined in the styles array
 */
function refreshSampleLinks() {
	let sampleElements = Array.from(
		document.getElementsByClassName('sampleLink')
	);
	for (let i = 0; i < sampleElements.length; i++) {
		let sampleElement = sampleElements[i];
		let edge = sampleElement.dataSet.get()[0];
		edge = deepMerge(edge, styles.edges['edge' + i]);
		edge.label = edge.groupLabel;
		sampleElement.dataSet.remove(edge.id);
		sampleElement.dataSet.update(edge);
		sampleElement.net.fit();
	}
}

/**
 * save the current map as a PRSM file
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
			styles: styles,
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
/**
 * Save the string to a local file
 * @param {string} str file contents
 * @param {strng} extn file extension
 *
 * Browser will only ask for name and location of the file to be saved if
 * it has a user setting to do so.  Otherwise, it is saved at a default
 * download location with a default name.
 */
function saveStr(str, extn) {
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
	}
}
/**
 * Save the map as CSV files, one for nodes and one for edges
 * Only node and edge labels are saved
 */
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
/**
 * Save the map as a GML file
 */
function exportGML() {
	let str =
		'Creator "prsm ' +
		version +
		' on ' +
		new Date(Date.now()).toLocaleString() +
		'"\ngraph\n[\n\tdirected 1\n';
	let nodeIds = data.nodes.map((n) => n.id); //use integers, not GUIDs for node ids
	for (let node of data.nodes.get()) {
		str += '\tnode\n\t[\n\t\tid ' + nodeIds.indexOf(node.id);
		if (node.label) str += '\n\t\tlabel "' + node.label + '"';
		let color =
			node.color.background || styles.nodes.group0.color.background;
		str += '\n\t\tcolor "' + color + '"';
		str += '\n\t]\n';
	}
	for (let edge of data.edges.get()) {
		str += '\tedge\n\t[\n\t\tsource ' + nodeIds.indexOf(edge.from);
		str += '\n\t\ttarget ' + nodeIds.indexOf(edge.to);
		if (edge.label) str += '\n\t\tlabel "' + edge.label + '"';
		let color = edge.color.color || styles.edges.edge0.color.color;
		str += '\n\t\tcolor "' + color + '"';
		str += '\n\t]\n';
	}
	str += '\n]';
	saveStr(str, 'gml');
}
/**
 * set up the modal dialog that opens when the user clicks the Share icon in the nav bar
 */
function setUpShareDialog() {
	let modal = document.getElementById('shareModal');
	let inputElem = document.getElementById('text-to-copy');
	let copiedText = document.getElementById('copied-text');

	// When the user clicks the button, open the modal
	listen('share', 'click', () => {
		let linkToShare =
			window.location.origin + window.location.pathname + '?room=' + room;
		copiedText.style.display = 'none';
		modal.style.display = 'block';
		inputElem.setAttribute('size', linkToShare.length);
		inputElem.value = linkToShare;
		inputElem.select();
		network.storePositions();
	});
	// When the user clicks on <span> (x), close the modal
	listen('modal-close', 'click', closeShareDialog);
	// When the user clicks anywhere on the background, close it
	listen('shareModal', 'click', closeShareDialog);

	function closeShareDialog() {
		let modal = elem('shareModal');
		if (event.target == modal) modal.style.display = 'none';
	}
	listen('copy-text', 'click', (e) => {
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
}
/**
 * dislay help page in a separate window
 */
function displayHelp() {
	window.open('./help.html', 'helpWindow');
}
/**
 * show or hide the side panel
 */
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

var tabOpen = null;
/**
 * when the window is resized, make sure that the pane is still visible
 * @param {HTMLelement} pane
 */
function keepPaneInWindow(pane) {
	if (
		pane.offsetLeft + pane.offsetWidth >
		container.offsetLeft + container.offsetWidth
	) {
		pane.style.left =
			container.offsetLeft +
			container.offsetWidth -
			pane.offsetWidth +
			'px';
	}
	if (
		pane.offsetTop + pane.offsetHeight >
		container.offsetTop + container.offsetHeight
	) {
		pane.style.top =
			container.offsetTop +
			container.offsetHeight -
			pane.offsetHeight -
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
	if (tabOpen == 'nodesTab' || tabOpen == 'linksTab') showNodeOrEdgeData();
	else hideNotes();
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
		node = deepMerge(node, styles.nodes[sample]);
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
		edge = deepMerge(edge, styles.edges[sample]);
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
function showNodeOrEdgeData() {
	hideNotes();
	if (tabOpen == 'nodesTab' || tabOpen == 'linksTab') {
		if (network.getSelectedNodes().length == 1) showNodeData();
		else if (network.getSelectedEdges().length == 1) showEdgeData();
	}
}
function showNodeData() {
	let panel = document.getElementById('nodeDataPanel');
	let nodeId = network.getSelectedNodes()[0];
	let node = data.nodes.get(nodeId);
	document.getElementById('fixed').checked = node.fixed ? true : false;
	document.getElementById('nodeLabel').innerHTML = node.label
		? shorten(node.label)
		: '';
	let notes = document.getElementById('node-notes');
	notes.innerHTML = node.title ? node.title : '';
	notes.addEventListener('keyup', (e) => updateNodeNotes(e));
	let placeholder = `<span class="placeholder">${notes.dataset.placeholder}</span>`;
	if (notes.innerText.length == 0) notes.innerHTML = placeholder;
	panel.classList.remove('hide');
	displayStatistics(nodeId);
}

function updateNodeNotes(e) {
	let text = e.target.innerText;
	data.nodes.update({
		id: network.getSelectedNodes()[0],
		title: splitText(
			text == e.target.dataset.placeholder ? '' : text,
			NOTEWIDTH
		).replace(/\n/g, '<br>'),
		clientID: undefined,
	});
}
function showEdgeData() {
	let panel = document.getElementById('edgeDataPanel');
	let edgeId = network.getSelectedEdges()[0];
	let edge = data.edges.get(edgeId);
	document.getElementById('edgeLabel').innerHTML = edge.label
		? shorten(edge.label)
		: '';
	let notes = document.getElementById('edge-notes');
	notes.innerHTML = edge.title ? edge.title : '';
	notes.addEventListener('keyup', (e) => updateEdgeNotes(e));
	let placeholder = `<span class="placeholder">${notes.dataset.placeholder}</span>`;
	if (notes.innerText.length == 0) notes.innerHTML = placeholder;
	panel.classList.remove('hide');
}

function updateEdgeNotes(e) {
	let text = e.target.innerText;
	data.edges.update({
		id: network.getSelectedEdges()[0],
		title: splitText(
			text == e.target.dataset.placeholder ? '' : text,
			NOTEWIDTH
		).replace(/\n/g, '<br>'),
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
	let selectedNodes = network.getSelectedNodes();
	selectedNodes.forEach((nodeId) => {
		let node = data.nodes.get(nodeId);
		node.shadow = true;
		data.nodes.update(node);
	});
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

function hideDistantOrStreamNodes(broadcast = true) {
	// get the intersection of the nodes (and links) in radius and up or downstream,
	// and then hide everything not in that intersection
	let radius = getRadioVal('hide');
	let stream = getRadioVal('stream');
	if (broadcast) broadcastHideAndStream(radius, stream);
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
		if (broadcast) broadcastHideAndStream('All', 'All');
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
	if (!obj) return;
	network.selectNodes([obj.selected]);
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
			author: myNameRec.name,
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
	chatNameBox.style.fontStyle = myNameRec.anon ? 'italic' : 'normal';
	chatNameBox.value = myNameRec.name;
}
/* --------------------------------------- avatars --------------------------------*/

/**
 * Place a circle at the top left of the net pane to represent each user who is online
 */

function showOtherUsers() {
	let names = Array.from(yAwareness.getStates())
		.map(([name, value]) => {
			name;
			return value.name;
		})
		.sort((a, b) => (a.name > b.name ? 1 : -1));

	let avatars = document.getElementById('avatars');
	while (avatars.firstChild) {
		avatars.removeChild(avatars.firstChild);
	}

	names.forEach((nameRec) => {
		if (nameRec != myNameRec) {
			// skip myself
			let ava = document.createElement('div');
			ava.classList.add('hoverme');
			ava.dataset.tooltip = nameRec.name;
			let circle = document.createElement('div');
			circle.classList.add('round');
			circle.style.backgroundColor = nameRec.color;
			if (nameRec.anon) {
				circle.style.color = 'white';
				circle.style.textShadow =
					'-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;';
				circle.style.fontWeight = 'normal';
			}
			circle.innerText = nameRec.name[0];
			circle.style.opacity = nameRec.asleep ? 0.2 : 1.0;
			ava.appendChild(circle);
			avatars.appendChild(ava);
		}
	});
}

dragElement(
	document.getElementById('chatbox-holder'),
	document.getElementById('chatbox-top')
);
