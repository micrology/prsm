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
import {trophic} from './trophic.js';
import * as parser from 'fast-xml-parser';
// see https://github.com/joeattardi/emoji-button
import { EmojiButton } from '@joeattardi/emoji-button';
import {
	setUpSamples,
	reApplySampleToNodes,
	reApplySampleToLinks,
	legend,
	clearLegend,
} from './styles.js';
import {setUpPaint, setUpToolbox, deselectTool, redraw} from './paint.js';

const version = '1.5.0';
const appName = 'Participatory System Mapper';
const shortAppName = 'PRSM';
const GRIDSPACING = 50; // for snap to grid
const NODEWIDTH = 10; // chars for label splitting
const NOTEWIDTH = 30; // chars for title (node/edge tooltip) splitting
const SHORTLABELLEN = 25; // when listing node labels, use ellipsis after this number of chars
const TIMETOSLEEP = 15 * 60 * 1000; // if no mouse movement for this time, user is assumed to have left or is sleeping
const TIMETOEDIT = 5 * 60 * 1000; // if node/edge edit dialog is not saved after this time, the edit is cancelled
export var network;
var room;
var debug = []; // if includes 'yjs', all yjs sharing interactions are logged to the console; if 'gui' mouse events are reported
var viewOnly; // when true, user can only view, not modify, the network
var nodes; // a dataset of nodes
var edges; // a dataset of edges
var data; // an object with the nodes and edges datasets as properties
const doc = new Y.Doc();
var websocket = 'wss://cress.soc.surrey.ac.uk/wss'; // web socket server URL
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
var inEditMode = false; //true when node or edge is being edited (dialog is open)
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
 * Clean up before user departs
 */
window.addEventListener('beforeunload', unlockAll);

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
	listen('exportPRSM', 'click', saveJSONfile);
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
	listen('trophicButton', 'click', autoLayoutSwitch);
	listen('snaptogridswitch', 'click', snapToGridSwitch);
	listen('netBackColorWell', 'input', updateNetBack);
	listen('drawing', 'click', toggleDrawingLayer);
	listen('allFactors', 'click', selectAllFactors);
	listen('allEdges', 'click', selectAllEdges);
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
	// check options set on URL: ?debug='yjs'|'gui'&viewing&start
	let searchParams = new URL(document.location).searchParams;
	if (searchParams.has('debug')) debug = [searchParams.get('debug')];
	// don't allow user to change anything if URL includes ?viewing
	viewOnly = searchParams.has('viewing');
	if (viewOnly) elem('buttons').style.display = 'none';
	// treat user as first time user if URL includes ?start=true
	if (searchParams.has('start')) localStorage.setItem('doneIntro', 'false');
	container = elem('container');
	panel = elem('panel');
	panel.classList.add('hide');
	container.panelHidden = true;
	setUpSamples();
	divWithPlaceHolder('#node-notes');
	divWithPlaceHolder('#edge-notes');
	hideNotes();
	elem('version').innerHTML = version;
	storeButtonStatus();
	initialButtonStatus = {
		autoLayout: false,
		gravity: '50000',
		snapToGrid: false,
		curve: 'Curved',
		linkRadius: 'All',
		stream: 'All',
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
	const wsProvider = new WebsocketProvider(websocket, 'prsm' + room, doc);
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
	window.debug = debug;
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
		if (window.debug.includes('yjs'))
			console.log(
				new Date().toLocaleTimeString() +
					': nodes.on: ' +
					event +
					JSON.stringify(properties.items) +
					' origin: ' +
					origin
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
						if (window.debug.includes('yjs'))
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
		if (window.debug.includes('yjs')) console.log(event);
		let nodesToUpdate = [];
		for (let key of event.keysChanged) {
			if (yNodesMap.has(key)) {
				let obj = yNodesMap.get(key);
				let origin = event.transaction.origin;
				if (obj.clientID != clientID || origin != null) {
					nodesToUpdate.push(obj);
				}
			} else {
				if (data.nodes.get(key))
					network
						.getConnectedEdges(key)
						.forEach((edge) => edges.remove(edge));
				nodes.remove(key);
			}
		}
		if (nodesToUpdate) nodes.update(nodesToUpdate, origin);
	});
	/* 
	See comments above about nodes
	 */
	edges.on('*', (event, properties, origin) => {
		if (window.debug.includes('yjs'))
			console.log(
				new Date().toLocaleTimeString() +
					': edges.on: ' +
					event +
					JSON.stringify(properties.items) +
					' origin: ' +
					origin
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
		if (window.debug.includes('yjs')) console.log(event);
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
		if (window.debug.includes('yjs')) console.log(event);
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
			reApplySampleToNodes(nodesToUpdate, false);
		}
		if (edgesToUpdate) {
			refreshSampleLinks();
			reApplySampleToLinks(edgesToUpdate, false);
		}
	});
	yNetMap.observe((event) => {
		if (window.debug.includes('yjs')) console.log(event);
		if (event.transaction.origin) {
			for (let key of event.keysChanged) {
				let obj = yNetMap.get(key);
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
		}
	});
	yPointsArray.observe((event, trans) => {
		if (window.debug.includes('yjs'))
			console.log(trans.local, yPointsArray.get(yPointsArray.length - 1));
		if (!trans.local) network.redraw();
	});
	yUndoManager.on('stack-item-added', (event) => {
		if (window.debug.includes('yjs')) console.log(event);
		saveButtonStatus(event);
		undoButtonstatus();
		redoButtonStatus();
	});
	yUndoManager.on('stack-item-popped', (event) => {
		if (window.debug.includes('yjs')) console.log(event);
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
	setMapTitle(yNetMap.get('maptitle'));
	console.log(msg);
	let netPane = elem('net-pane');
	if (
		netPane.style.visibility == 'hidden' ||
		netPane.style.visibility == ''
	) {
		netPane.style.visibility = 'visible';
		setUpTutorial();
	}
}
// to handle iPad viewport sizing problem when tab bar appears
document.body.height = window.innerHeight;
window.onresize = function () {
	document.body.height = window.innerHeight;
	keepPaneInWindow(panel);
	keepPaneInWindow(elem('chatbox-holder'));
};
window.onorientationchange = function () {
	document.body.height = window.innerHeight;
};

const chatbox = elem('chatbox');
const chatboxTab = elem('chatbox-tab');
const chatNameBox = elem('chat-name');
const chatInput = elem('chat-input');
const chatSend = elem('send-button');
const chatMessages = elem('chat-messages');
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
		if (e.key == 'Enter') saveUserName(chatNameBox.value);
	});
	chatNameBox.addEventListener('blur', () => {
		saveUserName(chatNameBox.value);
	});
	chatNameBox.addEventListener('click', () => {
		if (myNameRec.anon) chatNameBox.value = '';
		chatNameBox.focus();
		chatNameBox.select();
	});
	chatSend.addEventListener('click', sendMsg);
	emojiPicker.on('emoji', (selection) => {
		document.querySelector('#chat-input').value += selection.emoji;
	});
	emojiButton.addEventListener('click', () => {
		emojiPicker.togglePicker(emojiButton);
	});
}
function saveUserName(name) {
	if (name.length > 0) {
		myNameRec.name = name;
		myNameRec.anon = false;
	} else myNameRec = generateName();
	chatNameBox.value = myNameRec.name;
	localStorage.setItem('myName', JSON.stringify(myNameRec));
	yAwareness.setLocalState({name: myNameRec});
}
/**
 * if this is the user's first time, show them how the user interface works
 */
function setUpTutorial() {
	if (localStorage.getItem('doneIntro') !== 'true' && viewOnly === false) {
		tutorial.onexit(function () {
			localStorage.setItem('doneIntro', 'true');
		});
		tutorial.onstep(0, () => {
			let splashNameBox = elem('splashNameBox');
			splashNameBox.focus();
			splashNameBox.addEventListener('blur', () => {
				saveUserName(splashNameBox.value);
				displayUserName();
			});
			splashNameBox.addEventListener('keyup', (e) => {
				if (e.key == 'Enter') splashNameBox.blur();
			});
		});
		tutorial.start();
	}
}
/**
 *  set up user monitoring (awareness)
 */
function setUpAwareness() {
	yAwareness.on('change', (event) => {
		if (window.debug.includes('yjs')) console.log(event);
		showOtherUsers();
	});
	// fade out avatar when there has been no movement of the mouse for 15 minutes
	asleep(false);
	var sleepTimer = setTimeout(() => asleep(true), TIMETOSLEEP);
	window.addEventListener('mousemove', () => {
		clearTimeout(sleepTimer);
		asleep(false);
		sleepTimer = setTimeout(() => asleep(true), TIMETOSLEEP);
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
 * draw the network, after setting the vis-network options
 */
function draw() {
	// for testing, you can append ?t=XXX to the URL of the page, where XXX is the number
	// of factors to include in a random network
	let url = new URL(document.location);
	let nNodes = url.searchParams.get('t');
	if (nNodes) getRandomData(nNodes);
	// create a network
	netPane = elem('net-pane');
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
			hover: false,
			hoverConnectedEdges: false,
			zoomView: false,
			tooltipDelay: 0,
		},
		manipulation: {
			enabled: false,
			addNode: function (item, callback) {
				item.label = '';
				item = deepMerge(item, styles.nodes[lastNodeSample]);
				item.grp = lastNodeSample;
				addLabel(item, cancelAdd, callback);
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
				let locked = false;
				item.nodes.forEach((nId) => {
					let n = data.nodes.get(nId);
					if (n.locked) {
						locked = true;
						statusMsg(
							`Factor '${shorten(
								n.oldLabel
							)}' can't be deleted because it is locked`,
							'warn'
						);
						callback(null);
						return;
					}
				});
				if (locked) return;
				let r = confirm(deleteMsg(item));
				if (r != true) {
					callback(null);
					return;
				}
				clearStatusBar();
				hideNotes();
				// delete also all the edges that link to the nodes being deleted
				// there edges are added to 'item' by deleteMsg()
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
	elem('zoom').value = network.getScale();

	// start with factor tab open, but hidden
	elem('nodesButton').click();

	// listen for click events on the network pane

	// despatch to edit a node or an edge or to fit the network on the pane
	network.on('doubleClick', function (params) {
		if (window.debug.includes('gui')) console.log('doubleClick');
		if (params.nodes.length === 1) {
			if (!inEditMode && !data.nodes.get(params.nodes[0]).locked)
				network.editNode();
		} else if (params.edges.length === 1) {
			if (!inEditMode) network.editEdgeMode();
		} else {
			fit();
		}
	});
	network.on('selectNode', function (params) {
		if (window.debug.includes('gui')) console.log('selectNode');
		let selectedNodes = network.getSelectedNodes();
		selectedNodes.forEach((nodeId) => {
			let node = data.nodes.get(nodeId);
			if (!node.locked) {
				node.shadow = true;
				data.nodes.update(node);
			}
		});
		// if shiftkey is down, start linking to another node
		if (params.event.pointers[0].shiftKey) {
			// start linking from this node, but only if only one node is selected, else source node is not clear
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
		if (window.debug.includes('gui')) console.log('deselectNode');
		let nodesToUpdate = [];
		data.nodes.get().forEach((node) => {
			if (node.shadow) {
				node.shadow = false;
				nodesToUpdate.push(node);
			}
		});
		data.nodes.update(nodesToUpdate);
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
		if (window.debug.includes('gui')) console.log('selectEdge');
		let selectedEdges = network.getSelectedEdges();
		selectedEdges.forEach((edgeId) => {
			let edge = data.edges.get(edgeId);
			edge.shadow = true;
			data.edges.update(edge);
		});
		statusMsg(listLinks(selectedEdges) + ' selected');
		showNodeOrEdgeData();
	});
	network.on('deselectEdge', function () {
		if (window.debug.includes('gui')) console.log('deselectEdge');
		let edgesToUpdate = [];
		data.edges.get().forEach((edge) => {
			if (edge.shadow) {
				edge.shadow = false;
				edgesToUpdate.push(edge);
			}
		});
		data.edges.update(edgesToUpdate);
		hideNotes();
		clearStatusBar();
	});
	network.on('dragStart', function () {
		if (window.debug.includes('gui')) console.log('dragStart');
		//		hideNotes();
		changeCursor('grabbing');
	});
	network.on('dragEnd', function (event) {
		if (window.debug.includes('gui')) console.log('dragEnd');
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
	elem('zoom').value = newScale;
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
	elem('popup-label').focus();
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
	elem('popup').insertAdjacentHTML(
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
					<option value="none">None</option>
				</select>
			</td>
		</tr>
	</table>`
	);
	elem('node-backgroundColor').value = standardize_color(
		item.color.background
	);
	elem('node-borderColor').value = standardize_color(item.color.border);
	elem('node-fontColor').value = standardize_color(item.font.color);
	elem('node-borderType').value = getDashes(
		item.shapeProperties.borderDashes
	);
	positionPopUp();
	elem('popup-label').focus();
	elem('popup').timer = setTimeout(() => {
		//ensure that the node cannot be locked out for ever
		cancelEdit(item, callback);
		statusMsg('Edit timed out', 'warn');
	}, TIMETOEDIT);
	lockNode(item);
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
	elem('popup').insertAdjacentHTML(
		'beforeend',
		` 
		<table id="popup-table">
		<tr>
			<td>
				Line
			</td>
			<td>
				Font
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
			<td>
				<select id="edge-type">
					<option value="false">Type...</option>
					<option value="false">Solid</option>
					<option value="true">Dashed</option>
					<option value="dots">Dotted</option>
				</select>
			</td>
			<td>
				<select id="edge-font-size">
					<option value="14">Size</option>
					<option value="18">Large</option>
					<option value="14">Normal</option>
					<option value="10">Small</option>
				</select>
			</td>
		</tr>
	</table>`
	);
	elem('edge-width').value = parseInt(item.width);
	elem('edge-color').value = standardize_color(item.color.color);
	elem('edge-type').value = getDashes(item.dashes);
	elem('edge-font-size').value = parseInt(item.font.size);
	positionPopUp();
	elem('popup-label').focus();
	elem('popup').timer = setTimeout(() => {
		//ensure that the edge cannot be locked out for ever
		cancelEdit(item, callback);
		statusMsg('Edit timed out', 'warn');
	}, TIMETOEDIT);
	lockEdge(item);
}
/**
 * Initialise the dialog for creating nodes/edges
 * @param {String} popUpTitle
 * @param {Integer} height
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
	inEditMode = true;
	changeCursor('auto');
	elem('popup').style.height = height + 'px';
	elem('popup-operation').innerHTML = popUpTitle;
	elem('popup-saveButton').onclick = saveAction.bind(this, item, callback);
	elem('popup-cancelButton').onclick = cancelAction.bind(
		this,
		item,
		callback
	);
	let popupLabel = elem('popup-label');
	popupLabel.style.fontSize = '12px';
	popupLabel.innerText =
		item.label === undefined ? '' : item.label.replace(/\n/g, ' ');
	let table = elem('popup-table');
	if (table) table.remove();
}

/**
 * Position the editng dialog box so that it is to the left of the item being edited,
 * but not outside the window
 */
function positionPopUp() {
	let popUp = elem('popup');
	popUp.style.display = 'block';
	// popup appears to the left of the mouse pointer
	popUp.style.top = `${
		event.clientY - popUp.offsetHeight / 2 - popUp.offsetParent.offsetTop
	}px`;
	let left = event.clientX - popUp.offsetWidth - 3;
	popUp.style.left = `${left < 0 ? 0 : left}px`;
	dragElement(popUp, elem('popup-top'));
}

/**
 * Hide the editing dialog box
 */
function clearPopUp() {
	elem('popup-saveButton').onclick = null;
	elem('popup-cancelButton').onclick = null;
	elem('popup-label').onkeyup = null;
	elem('popup').style.display = 'none';
	if (elem('popup').timer) {
		clearTimeout(elem('popup').timer);
		elem('popup').timer = undefined;
	}
	inEditMode = false;
}
/**
 * User has pressed 'cancel' - abandon the edit and hide the dialog
 * @param {Function} callback
 */
function cancelAdd(item, callback) {
	clearPopUp();
	callback(null);
	stopEdit();
}
/**
 * User has pressed 'cancel' - abandon the edit and hide the dialog
 * @param {Function} callback
 */
function cancelEdit(item, callback) {
	clearPopUp();
	item.label = item.oldLabel;
	item.font.color = item.oldFontColor;
	if (item.from) unlockEdge(item);
	else unlockNode(item);
	callback(null);
	stopEdit();
}
/**
 * called when a node or edge has been added.  Save the label provided
 * @param {Object} item the item that has been added
 * @param {Function} callback
 */
function saveLabel(item, callback) {
	item.label = splitText(elem('popup-label').innerText, NODEWIDTH);
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
	item.label = splitText(elem('popup-label').innerText, NODEWIDTH);
	clearPopUp();
	if (item.label === '') {
		// if there is no label, cancel (nodes must have a label)
		statusMsg('No label: cancelled', 'warn');
		callback(null);
	}
	let color = elem('node-backgroundColor').value;
	item.color.background = color;
	item.color.highlight.background = color;
	item.color.hover.background = color;
	color = elem('node-borderColor').value;
	item.color.border = color;
	item.color.highlight.border = color;
	item.color.hover.border = color;
	item.font.color = elem('node-fontColor').value;
	let borderType = elem('node-borderType').value;
	item.borderWidth = borderType == 'none' ? 0 : 1;
	item.shapeProperties.borderDashes = convertDashes(borderType);
	claim(item);
	network.manipulation.inMode = 'editNode'; // ensure still in Add mode, in case others have done something meanwhile
	unlockNode(item);
	callback(item);
}
/**
 * User is about to edit the node.  Make sure that no one else can edit it simultaneously
 * @param {Node} item
 */
function lockNode(item) {
	item.locked = true;
	item.oldFontColor = item.font.color;
	item.font.color = item.font.color + '80';
	item.opacity = 0.3;
	item.oldLabel = item.label;
	item.label =
		item.label + '\n\n' + '[Being edited by ' + myNameRec.name + ']';
	item.wasFixed = Boolean(item.fixed);
	item.fixed = true;
	item.chosen = false;
	claim(item);
	data.nodes.update(item);
}
/**
 * User has finished editing the node.  Unlock it.
 * @param {Node} item
 */
function unlockNode(item) {
	item.locked = false;
	item.opacity = 1;
	item.fixed = item.wasFixed;
	item.oldLabel = undefined;
	item.chosen = true;
	data.nodes.update(item);
}
/**
 * ensure that all factors and links are unlocked (called only when user leaves the page, to clear up for others)
 */
function unlockAll() {
	data.nodes.forEach((node) => {
		if (node.locked) cancelEdit(node);
	});
	data.edges.forEach((edge) => {
		if (edge.locked) cancelEdit(edge);
	});
}
/**
 * save the edge format details that have been edited
 * @param {Object} item the edge that has been edited
 * @param {Function} callback
 */
function saveEdge(item, callback) {
	item.label = splitText(elem('popup-label').innerText, NODEWIDTH);
	clearPopUp();
	if (item.label === '') item.label = ' ';
	let color = elem('edge-color').value;
	item.color.color = color;
	item.color.hover = color;
	item.color.highlight = color;
	item.width = parseInt(elem('edge-width').value);
	if (!item.width) item.width = 1;
	item.dashes = convertDashes(elem('edge-type').value);
	item.font.size = parseInt(elem('edge-font-size').value);
	claim(item);
	network.manipulation.inMode = 'editEdge'; // ensure still in edit mode, in case others have done something meanwhile
	unlockEdge(item);
	// vis-network silently deselects all edges in the callback (why?).  So we have to mark this edge as unselected in preparation
	item.shadow = false;
	clearStatusBar();
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
function lockEdge(item) {
	item.locked = true;
	item.font.color = 'rgba(0,0,0,0.3)';
	item.opacity = 0.1;
	item.oldLabel = item.label || ' ';
	item.label = 'Being edited by ' + myNameRec.name;
	item.chosen = false;
	claim(item);
	data.edges.update(item);
}
/**
 * User has finished editing the node.  Unlock it.
 * @param {Node} item
 */
function unlockEdge(item) {
	item.locked = false;
	item.font.color = 'rgba(0,0,0,1)';
	item.opacity = 1;
	item.oldLabel = undefined;
	item.chosen = true;
	data.edges.update(item);
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
	elem('navbar').style.cursor = newCursorStyle;
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
	let div = elem('maptitle');
	if (!title) {
		title = 'Untitled map';
	}
	if (title == 'Untitled map') {
		div.classList.add('unsetmaptitle');
		document.title = `${appName} ${room}`;
	}
	else {
		div.classList.remove('unsetmaptitle');
		document.title = `${title}: ${shortAppName} map`;
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
	let nodes = data.nodes.get(network.getSelectedNodes());
	nodes.forEach((node) => {
		node.shadow = false;
	});
	data.nodes.update(nodes);
	network.unselectAll();
	clearStatusBar();
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
	let el = elem('statusBar');
	switch (status) {
		case 'warn':
			el.style.backgroundColor = 'yellow';
			break;
		case 'error':
			el.style.backgroundColor = 'red';
			el.style.color = 'white';
			break;
		default:
			el.style.backgroundColor = 'white';
			break;
	}
	el.innerHTML = htmlEntities(msg);
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
	network.zoom(Number(elem('zoom').value));
}
/**
 * zoom by the given amount (+ve or -ve)
 * @param {Number} incr
 */
function zoomincr(incr) {
	let newScale = Number(elem('zoom').value) + incr;
	if (newScale > 4) newScale = 4;
	if (newScale <= 0) newScale = 0.1;
	elem('zoom').value = newScale;
	network.zoom(newScale);
}
/* 
  -----------Operations related to the top button bar (not the side panel)-------------
 */
/**
 * react to the user pressing the Add node button
 * handles cases when the button is disabled; has previously been pressed; and the Add link
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
			network.unselectAll();
			changeCursor('cell');
			inAddMode = 'addNode';
			showPressed('addNode', 'add');
			unSelect();
			network.addNodeMode();
	}
}
/**
 * react to the user pressing the Add Link button
 * handles cases when the button is disabled; has previously been pressed; and the Add Node
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
			unSelect();
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
function showPressed(el, action) {
	elem(el).children.item(0).classList[action]('pressed');
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
	if (state) elem(id).classList.add('disabled');
	else elem(id).classList.remove('disabled');
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
	elem('fileInput').click();
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
	// ensure that all nodes have a grp property (converting 'group' property for old format files)
	data.nodes.update(
		data.nodes.map(
			(n) => {
				n.grp = n.group ? 'group' + (n.group % 9) : 'group0';
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
	if (json.mapTitle) yNetMap.set('maptitle', setMapTitle(json.mapTitle));
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
			mapTitle: elem('maptitle').innerText,
			lastNodeSample: lastNodeSample,
			lastLinkSample: lastLinkSample,
			buttons: buttonStatus,
			styles: styles,
			nodes: data.nodes.map((n) =>
				strip(n, [
					'id',
					'label',
					'title',
					'grp',
					'x',
					'y',
					'color',
					'font',
					'borderWidth',
					'shapeProperties',
				])
			),
			edges: data.edges.map((e) =>
				strip(e, [
					'id',
					'label',
					'title',
					'grp',
					'from',
					'to',
					'color',
					'width',
					'dashes',
				])
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
	statusMsg(`'${lastFileName}' saved`);
}
/**
 * Save the map as CSV files, one for nodes and one for edges
 * Only node and edge labels and style ids are saved
 */
function exportCVS() {
	let str = 'Id,Label,Style\n';
	for (let node of data.nodes.get()) {
		str += node.id;
		if (node.label) str += ',"' + node.label + '"';
		str += ',' + node.grp;
		str += '\n';
	}
	saveStr(str, 'nodes.csv');
	str = 'Source,Target,Type,Id,Label,Style\n';
	for (let edge of data.edges.get()) {
		str += edge.from + ',';
		str += edge.to + ',';
		str += 'directed,';
		str += edge.id + ',';
		if (edge.label) str += edge.label + '"';
		str += ',' + edge.grp;
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
	let modal = elem('shareModal');
	let inputElem = elem('text-to-copy');
	let copiedText = elem('copied-text');

	// When the user clicks the button, open the modal
	listen('share', 'click', () => {
		setLink('share');
	});
	listen('clone-check', 'click', () =>
		setLink(elem('clone-check').checked ? 'clone' : 'share')
	);
	listen('view-check', 'click', () =>
		setLink(elem('view-check').checked ? 'view' : 'share')
	);
	function setLink(type) {
		let newRoom;
		switch (type) {
			case 'share':
				newRoom = room;
				break;
			case 'clone':
				newRoom = clone();
				elem('view-check').checked = false;
				break;
			case 'view':
				newRoom = room + '&viewing';
				elem('clone-check').checked = false;
				break;
			default:
				console.log('Bad case in setLink()');
				break;
		}
		let linkToShare =
			window.location.origin +
			window.location.pathname +
			'?room=' +
			newRoom;
		modal.style.display = 'block';
		inputElem.cols = linkToShare.length.toString();
		inputElem.value = linkToShare;
		inputElem.style.height = inputElem.scrollHeight - 3 + 'px';
		inputElem.select();
		network.storePositions();
	}
	// When the user clicks on <span> (x), close the modal
	listen('modal-close', 'click', closeShareDialog);
	// When the user clicks anywhere on the background, close it
	listen('shareModal', 'click', closeShareDialog);

	function closeShareDialog() {
		let modal = elem('shareModal');
		if (event.target == modal || event.target == elem('modal-close')) {
			modal.style.display = 'none';
			elem('clone-check').checked = false;
			elem('view-check').checked = false;
			copiedText.style.display = 'none';
		}
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
 * clone the map, i.e copy everything into a new room
 * @return {string} name of new room
 */
function clone() {
	let clonedRoom = generateRoom();
	let clonedDoc = new Y.Doc();
	let ws = new WebsocketProvider(websocket, 'prsm' + clonedRoom, clonedDoc);
	ws.awareness.destroy();
	ws.on('sync', () => {
		let state = Y.encodeStateAsUpdate(doc);
		Y.applyUpdate(clonedDoc, state);
	});
	return clonedRoom;
}
/**
 * display help page in a separate window
 */
function displayHelp() {
	window.open('./help.html#contents', 'helpWindow');
}
/**
 * show or hide the side panel
 */
function togglePanel() {
	if (container.panelHidden) {
		panel.classList.remove('hide');
	} else {
		panel.classList.add('hide');
	}
	container.panelHidden = !container.panelHidden;
}
dragElement(elem('panel'), elem('tab'));

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
	elem(tabId).classList.remove('hide');
	event.currentTarget.className += ' active';
	tabOpen = tabId;
	if (tabOpen == 'nodesTab' || tabOpen == 'linksTab') showNodeOrEdgeData();
	else hideNotes();
}

function storeButtonStatus() {
	buttonStatus = {
		snapToGrid: elem('snaptogridswitch').checked,
		curve: elem('curveSelect').value,
		linkRadius: getRadioVal('hide'),
		stream: getRadioVal('stream'),
		legend: elem('showLegendSwitch').checked,
		sizing: elem('sizing').value,
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
	elem('snaptogridswitch').checked = settings.snapToGrid;
	if (settings.snapToGrid) doSnapToGrid();
	elem('curveSelect').value = settings.curve;
	selectCurve();
	elem('showLegendSwitch').checked = settings.legend;
	legendSwitch(false);
	setRadioVal('hide', settings.linkRadius);
	setRadioVal('stream', settings.stream);
	elem('sizing').value = settings.sizing;
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
/**
 * User has clicked the padlock.  Toggle padlock state and fix the location of the node
 */
function setFixed() {
	let unlocked = elem('fixed').firstChild.className.includes('open');
	let node = data.nodes.get(network.getSelectedNodes()[0]);
	if (unlocked) {
		elem('fixed').firstChild.className = 'fas fa-lock';
	} else {
		elem('fixed').firstChild.className = 'fas fa-lock-open';
	}
	node.fixed = unlocked;
	data.nodes.update(node);
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
	let panel = elem('nodeDataPanel');
	let nodeId = network.getSelectedNodes()[0];
	let node = data.nodes.get(nodeId);
	elem('fixed').firstChild.className = node.fixed
		? 'fas fa-lock'
		: 'fas fa-lock-open';
	elem('nodeLabel').innerHTML = node.label ? shorten(node.label) : '';
	let notes = elem('node-notes');
	notes.innerHTML = node.title ? node.title.replace(/<br>/g, ' ') : '';
	notes.addEventListener('keyup', (e) => updateNodeNotes(e));
	let placeholder = `<span class="placeholder">${notes.dataset.placeholder}</span>`;
	if (notes.innerText.length == 0) notes.innerHTML = placeholder;
	panel.classList.remove('hide');
	displayStatistics(nodeId);
}
/**
 * update the title property of the node with the text of the note.
 * returns (\n) inserted by the user are replaced by <p> and
 * \n inserted by the split text fn are replaced by <br>.
 *
 * When the Note is redisplayed in the Note box, <br> is stripped out and
 * <p> replaced by \n to preserve user formatting.
 * @param {event} e
 */
function updateNodeNotes(e) {
	let text = e.target.innerText.replace(/\n/g, '<p>');
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
	let panel = elem('edgeDataPanel');
	let edgeId = network.getSelectedEdges()[0];
	let edge = data.edges.get(edgeId);
	elem('edgeLabel').innerHTML = edge.label ? shorten(edge.label) : '';
	let notes = elem('edge-notes');
	notes.innerHTML = edge.title ? edge.title.replace(/<br>/g, ' ') : '';
	notes.addEventListener('keyup', (e) => updateEdgeNotes(e));
	let placeholder = `<span class="placeholder">${notes.dataset.placeholder}</span>`;
	if (notes.innerText.length == 0) notes.innerHTML = placeholder;
	panel.classList.remove('hide');
}

function updateEdgeNotes(e) {
	let text = e.target.innerText.replace(/\n/g, '<p>');
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
	elem('nodeDataPanel').classList.add('hide');
	elem('edgeDataPanel').classList.add('hide');
}
// Statistics specific to a node
function displayStatistics(nodeId) {
	// leverage (outDegree / inDegree)
	let inDegree = network.getConnectedNodes(nodeId, 'from').length;
	let outDegree = network.getConnectedNodes(nodeId, 'to').length;
	let leverage = inDegree == 0 ? '--' : (outDegree / inDegree).toPrecision(3);
	elem('leverage').textContent = leverage;
	elem('bc').textContent = bc[nodeId] >= 0 ? bc[nodeId].toPrecision(3) : '--';
}
// Network tab

function autoLayoutSwitch() {
	network.storePositions(); // record current positions so it can be undone
	try {
		data.nodes.update(trophic(data));
	} catch (e) {
		statusMsg(`Trophic layout: ${e.message}`, 'error');
	}
	broadcast();
}

function snapToGridSwitch(e) {
	snapToGridToggle = e.target.checked;
	if (snapToGridToggle) {
		doSnapToGrid();
	}
}

function doSnapToGrid() {
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

function selectCurve() {
	let options = {
		edges: {
			smooth: elem('curveSelect').value === 'Curved',
		},
	};
	network.setOptions(options);
	options.clientID = clientID;
	yNetMap.set('edges', options);
}

function setCurve(options) {
	elem('curveSelect').value = options.edges.smooth ? 'Curved' : 'Straight';
	network.setOptions(options);
}

function updateNetBack(event) {
	let ul = elem('underlay');
	ul.style.backgroundColor = event.target.value;
	// if in drawing mode, make the underlay translucent so that network shows through
	if (elem('toolbox').style.display == 'block') makeTranslucent(ul);
	yNetMap.set('background', event.target.value);
}

function makeTranslucent(el) {
	el.style.backgroundColor = getComputedStyle(el)
		.backgroundColor.replace(')', ', 0.2)')
		.replace('rgb', 'rgba');
}

function makeSolid(el) {
	el.style.backgroundColor = getComputedStyle(el)
		.backgroundColor.replace(', 0.2)', ')')
		.replace('rgba', 'rgb');
}
function setBackground(color) {
	elem('underlay').style.backgroundColor = color;
	if (elem('toolbox').style.display == 'block')
		makeTranslucent(elem('underlay'));
	elem('netBackColorWell').value = color;
}
function toggleDrawingLayer() {
	drawingSwitch = elem('toolbox').style.display == 'block';
	let ul = elem('underlay');
	if (drawingSwitch) {
		// close drawing layer
		deselectTool();
		elem('toolbox').style.display = 'none';
		elem('underlay').style.zIndex = 0;
		makeSolid(ul);
		elem('temp-canvas').style.zIndex = 0;
		elem('chatbox-tab').classList.remove('chatbox-hide');
		inAddMode = false;
		setButtonDisabledStatus('addNode', false);
		setButtonDisabledStatus('addLink', false);
		changeCursor('auto');
	} else {
		// expose drawing layer
		elem('toolbox').style.display = 'block';
		ul.style.zIndex = 1000;
		ul.style.cursor = 'default';
		elem('temp-canvas').style.zIndex = 1000;
		// make the underlay (which is now overlay) translucent
		makeTranslucent(ul);
		minimize();
		elem('chatbox-tab').classList.add('chatbox-hide');
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
	elem('drawing').checked = false;
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

function legendSwitch(warn) {
	if (elem('showLegendSwitch').checked) legend(warn);
	else clearLegend();
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
		elem('hideAll').checked = true;
		elem('streamAll').checked = true;
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
		let nodes = data.nodes.get({
			filter: function (node) {
				let h = node.hidden;
				if (h) node.hidden = false;
				return h;
			},
		});
		data.nodes.update(nodes);
		let edges = data.edges.get({
			filter: function (edge) {
				let h = edge.hidden;
				if (h) edge.hidden = false;
				return h;
			},
		});
		data.edges.update(edges);
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
	let selectedNodes = [].concat(obj.selected); // ensure that obj.selected is an array
	if (selectedNodes.length > 0) {
		network.selectNodes(selectedNodes); // in viewing  only mode, this does nothing
		if (!viewOnly)
			statusMsg(listFactors(network.getSelectedNodes()) + ' selected');
	}
	setRadioVal('hide', obj.hideSetting);
	setRadioVal('stream', obj.streamSetting);
}

function sizing() {
	// set the size of the nodes proportional to the selected metric
	//  none, in degree out degree or betweenness centrality
	let metric = elem('sizing').value;
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
	elem('zoom').value = network.getScale();
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
	yChatArray.push([
		{
			client: clientID,
			author: myNameRec.name,
			time: Date.now(),
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
	let clock = '';
	if (Number.isInteger(msg.time)) {
		let time = new Date();
		time.setTime(msg.time);
		if (time.toDateString() == new Date().toDateString()) {
			clock = 'Today, ' + time.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' });
		}
		else clock = time.toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		});
	}
	if (msg.client == clientID) {
		/* my own message */
		chatMessages.innerHTML += `<div class="message-box-holder">
			<div class="message-header">
				<span class="message-time">${clock}</span>
			</div>
			<div class="message-box">
				${msg.msg}
			</div>
		</div>`;
	} else {
		chatMessages.innerHTML += `<div class="message-box-holder">
			<div class="message-header">
				<span class="message-author">${msg.author}</span><span class="message-time">${clock}</span> 
			</div>
			<div class="message-box message-received">
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

	let avatars = elem('avatars');
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
			if (nameRec.anon) circle.style.borderColor = 'white';
			circle.innerText = nameRec.name
				.match(/(^\S\S?|\b\S)?/g)
				.join('')
				.match(/(^\S|\S$)?/g)
				.join('')
				.toUpperCase();
			circle.style.opacity = nameRec.asleep ? 0.2 : 1.0;
			ava.appendChild(circle);
			avatars.appendChild(ava);
		}
	});
}

dragElement(elem('chatbox-holder'), elem('chatbox-top'));


/* --------------------------------- Merge maps ----------------------------- */
/* to get the data in, open inspect windows for both maps.  in one window, eval data.nodes.get() and copy the result (not including any initial and trailing quote marks).
In the other window. evaluate n = <pasted list>.  Repeat for data.edges.get() and e = <pasted list>.  Then evaluate mergeMaps(n, e) in the other window.
*/

function mergeMaps(nodeList, edgeList) {
	nodeList.forEach((newNode) => {
		let oldNode = data.nodes.get(newNode.id)
		if (oldNode) {
			if (oldNode.label != newNode.label) console.log(`Existing factor label: \n${oldNode.label} \ndoes not match new label: \n${newNode.label}`);
			else if (oldNode.grp != newNode.grp) console.log(`Existing factor style: ${oldNode.grp} does not match new style ${newNode.grp} for ${oldNode.label}`);
		}
		else {
			data.nodes.add(newNode);
			console.log(`Added ${newNode.label}`)
		}
	})
	edgeList.forEach((newEdge) => {
		let oldEdge = data.edges.get(newEdge.id)
		if (oldEdge) {
			if (oldEdge.label != newEdge.label) console.log(`Existing label: \n${oldEdge.label} \ndoes not match new label: \n${newEdge.label}`);
			else if (oldEdge.grp != newEdge.grp) console.log(`Existing style: ${oldEdge.grp} does not match new style ${newEdge.grp} for edge ${oldEdge.id}`);
		}
		else {
			data.edges.add(newEdge);
			console.log(`Added ${newEdge.id}`)
		}
	})
}
window.mergeMaps = mergeMaps;
