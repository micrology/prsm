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
	deepCopy,
	strip,
	splitText,
	dragElement,
	standardize_color,
	object_equals,
	generateName,
	statusMsg,
	clearStatusBar,
	initials,
	CP,
} from './utils.js';
import Tutorial from './tutorial.js';
import {styles} from './samples.js';
import {trophic} from './trophic.js';
import * as parser from 'fast-xml-parser';
// see https://github.com/joeattardi/emoji-button
import {EmojiButton} from '@joeattardi/emoji-button';
import Quill from 'quill';
import {setUpSamples, reApplySampleToNodes, reApplySampleToLinks, legend, clearLegend, updateLegend} from './styles.js';
import {setUpPaint, setUpToolbox, deselectTool, redraw} from './paint.js';

const version = '1.6.5';
const appName = 'Participatory System Mapper';
const shortAppName = 'PRSM';
const GRIDSPACING = 50; // for snap to grid
const NODEWIDTH = 10; // chars for label splitting
const SHORTLABELLEN = 25; // when listing node labels, use ellipsis after this number of chars
const TIMETOSLEEP = 15 * 60 * 1000; // if no mouse movement for this time, user is assumed to have left or is sleeping
const TIMETOEDIT = 5 * 60 * 1000; // if node/edge edit dialog is not saved after this time, the edit is cancelled
const magnification = 3; // magnification of the loupe (magnifier 'glass')

export var network;
var room;
var debug = []; // if includes 'yjs', all yjs sharing interactions are logged to the console; if 'gui' mouse events are reported
var viewOnly; // when true, user can only view, not modify, the network
var nodes; // a dataset of nodes
var edges; // a dataset of edges
var data; // an object with the nodes and edges datasets as properties
const doc = new Y.Doc();
var websocket = 'wss://cress.soc.surrey.ac.uk/wss'; // web socket server URL
var clientID; // unique ID for this browser
var yNodesMap; // shared map of nodes
var yEdgesMap; // shared map of edges
var ySamplesMap; // shared map of styles
var yNetMap; // shared map of global network settings
export var yPointsArray; // shared array of the background drawing commands
var yUndoManager; // shared list of commands for undo
var yChatArray; // shared array of messages in the chat window
var yAwareness; // awareness channel
var yHistory; // log of actions
var container; //the DOM body elemnet
var netPane; // the DOM pane showing the network
var panel; // the DOM right side panel element
var myNameRec; // the user's name record {actual name, type, etc.}
var lastNodeSample = 'group0'; // the last used node style
var lastLinkSample = 'edge0'; // the last used edge style
var inAddMode = false; // true when adding a new Factor to the network; used to choose cursor pointer
var inEditMode = false; //true when node or edge is being edited (dialog is open)
var snapToGridToggle = false; // true when snapping nodes to the (unseen) grid
export var drawingSwitch = false; // true when the drawing layer is uppermost
var tutorial = new Tutorial(); // object driving the tutorial
export var cp; // color picker

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
window.addEventListener('beforeunload', () => {
	unlockAll();
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
	listen('maptitle', 'paste', pasteMapTitle);
	listen('maptitle', 'click', (e) => {
		if (e.target.innerText == 'Untitled map') window.getSelection().selectAllChildren(e.target);
	});
	listen('addNode', 'click', plusNode);
	listen('net-pane', 'contextmenu', contextMenu);
	listen('addLink', 'click', plusLink);
	listen('deleteNode', 'click', deleteNode);
	listen('undo', 'click', undo);
	listen('redo', 'click', redo);
	listen('fileInput', 'change', readSingleFile);
	listen('openFile', 'click', openFile);
	listen('saveFile', 'click', saveJSONfile);
	listen('exportPRSM', 'click', saveJSONfile);
	listen('exportImage', 'click', exportPNGfile);
	listen('exportCVS', 'click', exportCVS);
	listen('exportGML', 'click', exportGML);
	listen('search', 'click', search);
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
	listen('drawing', 'click', toggleDrawingLayer);
	listen('allFactors', 'click', selectAllFactors);
	listen('allEdges', 'click', selectAllEdges);
	listen('showLegendSwitch', 'click', legendSwitch);
	listen('showCursorSwitch', 'click', showCursorSwitch);
	listen('showHistorySwitch', 'click', showHistorySwitch);
	listen('curveSelect', 'change', selectCurve);
	listen('fixed', 'click', setFixed);
	Array.from(document.getElementsByName('hide')).forEach((elem) => {
		elem.addEventListener('change', hideDistantOrStreamNodes);
	});
	Array.from(document.getElementsByName('stream')).forEach((elem) => {
		elem.addEventListener('change', hideDistantOrStreamNodes);
	});
	listen('sizing', 'change', sizingSwitch);
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
 * create all the DOM elements on the web page
 */
function setUpPage() {
	elem('version').innerHTML = version;
	// check options set on URL: ?debug='yjs'|'gui'&viewing&start
	let searchParams = new URL(document.location).searchParams;
	if (searchParams.has('debug')) debug = [searchParams.get('debug')];
	// don't allow user to change anything if URL includes ?viewing
	viewOnly = searchParams.has('viewing');
	if (viewOnly) elem('buttons').style.display = 'none';
	// treat user as first time user if URL includes ?start=true
	if (searchParams.has('start')) localStorage.setItem('doneIntro', 'false');
	container = elem('container');
	netPane = elem('net-pane');
	panel = elem('panel');
	panel.classList.add('hide');
	container.panelHidden = true;
	cp = new CP();
	cp.createColorPicker('netBackColorWell', updateNetBack);
	setUpSamples();
	dragElement(elem('nodeDataPanel'), elem('nodeDataHeader'));
	dragElement(elem('edgeDataPanel'), elem('edgeDataHeader'));
	hideNotes();
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
	document.title = document.title + ' ' + room;
	/* const persistence = new IndexeddbPersistence(room, doc);
	// once the map is loaded, it can be displayed
	persistence.once('synced', () => {
		displayNetPane(exactTime() + ' local content loaded');
	}); */
	const wsProvider = new WebsocketProvider(websocket, 'prsm' + room, doc);
	wsProvider.on('sync', () => {
		displayNetPane(exactTime());
		console.log(exactTime() + ' remote content loaded');
	});
	wsProvider.on('status', (event) => {
		console.log(exactTime() + event.status + (event.status == 'connected' ? ' to' : ' from') + ' room ' + room); // logs when websocket is "connected" or "disconnected"
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
	yHistory = doc.getArray('history');
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
	window.yHistory = yHistory;
	window.yPointsArray = yPointsArray;
	window.styles = styles;
	window.yAwareness = yAwareness;
	/* 
	nodes.on listens for when local nodes or edges are changed (added, updated or removed).
	If a local node is removed, the yMap is updated to broadcast to other clients that the node 
	has been deleted. If a local node is added or updated, that is also broadcast.
	 */
	nodes.on('*', (event, properties, origin) => {
		yjsTrace('nodes.on', `${event}  ${JSON.stringify(properties.items)} origin: ${origin}`);
		doc.transact(() => {
			properties.items.forEach((id) => {
				if (origin === null) {
					// this is a local change
					if (event == 'remove') {
						yNodesMap.delete(id.toString());
					} else {
						yNodesMap.set(id.toString(), deepCopy(nodes.get(id)));
					}
				}
			});
		});
	});
	/* 
	yNodesMap.observe listens for changes in the yMap, receiving a set of the keys that have
	had changed values.  If the change was to delete an entry, the corresponding node and all links to/from it are
	removed from the local nodes dataSet. Otherwise, if the received node differs from the local one, 
	the local node dataSet is updated (which includes adding a new node if it does not already exist locally).
	 */
	yNodesMap.observe((event) => {
		yjsTrace('yNodesMap.observe', event);
		let nodesToUpdate = [];
		for (let key of event.keysChanged) {
			if (yNodesMap.has(key)) {
				let obj = yNodesMap.get(key);
				if (!object_equals(obj, data.nodes.get(key))) {
					delete obj.shadow;
					nodesToUpdate.push(obj);
				}
			} else {
				hideNotes();
				if (data.nodes.get(key)) network.getConnectedEdges(key).forEach((edge) => edges.remove(edge, 'remote'));
				nodes.remove(key, 'remote');
			}
		}
		if (nodesToUpdate) nodes.update(nodesToUpdate, 'remote');
	});
	/* 
	See comments above about nodes
	 */
	edges.on('*', (event, properties, origin) => {
		yjsTrace('edges.on', `${event}  ${JSON.stringify(properties.items)} origin: ${origin}`);
		doc.transact(() => {
			properties.items.forEach((id) => {
				if (origin === null) {
					if (event == 'remove') yEdgesMap.delete(id.toString());
					else {
						yEdgesMap.set(id.toString(), deepCopy(edges.get(id)));
					}
				}
			});
		});
	});
	yEdgesMap.observe((event) => {
		yjsTrace('yEdgesMap.observe', event);
		let edgesToUpdate = [];
		for (let key of event.keysChanged) {
			if (yEdgesMap.has(key)) {
				let obj = yEdgesMap.get(key);
				if (!object_equals(obj, data.edges.get(key))) {
					delete obj.shadow;
					edgesToUpdate.push(obj);
				}
			} else {
				hideNotes();
				edges.remove(key, 'remote');
			}
		}
		edges.update(edgesToUpdate, 'remote');
	});

	ySamplesMap.observe((event) => {
		yjsTrace('ySamplesMap.observe', event);
		let nodesToUpdate = [];
		let edgesToUpdate = [];
		for (let key of event.keysChanged) {
			let sample = ySamplesMap.get(key);
			if (sample.node !== undefined) {
				if (!object_equals(styles.nodes[key], sample.node)) {
					styles.nodes[key] = sample.node;
					nodesToUpdate.push(key);
				}
			} else {
				if (!object_equals(styles.edges[key], sample.edge)) {
					styles.edges[key] = sample.edge;
					edgesToUpdate.push(key);
				}
			}
		}
		if (nodesToUpdate) {
			refreshSampleNodes();
			reApplySampleToNodes(nodesToUpdate, true);
		}
		if (edgesToUpdate) {
			refreshSampleLinks();
			reApplySampleToLinks(edgesToUpdate, true);
		}
	});
	/*
	Map controls (those on the Network tab) are of three kinds:
	1. Those that affect only the local map and are not promulgated to other users
	e.g zoom, show drawing layer, show history
	2. Those where the control status (e.g. whether a switch is on or off) is promulgated,
	but the effect of the switch is handled by yNodesMap and yEdgesMap (e.g. Show Factors
		x links away; Size Factors to)
	3. Those whose effects are promulgated and switches controlled here by yNetMap (e.g
		Background)
	For cases 2 and 3, the functions called here must not invoke yNetMap.set() to avoid looops
	*/
	yNetMap.observe((event) => {
		yjsTrace('YNetMap.observe', event);

		for (let key of event.keysChanged) {
			let obj = yNetMap.get(key);
			switch (key) {
				case 'mapTitle':
				case 'maptitle':
					setMapTitle(obj);
					break;
				case 'snapToGrid':
					doSnapToGrid(obj);
					break;
				case 'curve':
					setCurve(obj);
					break;
				case 'background':
					setBackground(obj);
					break;
				case 'legend':
					setLegend(obj, false);
					break;
				case 'stream':
					setHideAndStream(obj);
					hideDistantOrStreamNodes(false);
					break;
				case 'sizing':
					sizing(obj);
					break;
				default:
					console.log('Bad key in yMapNet.observe: ', key);
			}
		}
	});
	yPointsArray.observe((event) => {
		yjsTrace('yPointsArray.observe', yPointsArray.get(yPointsArray.length - 1));
		if (event.transaction.local === false) network.redraw();
	});
	yHistory.observe(() => {
		yjsTrace('yHistory.observe', yHistory.get(yHistory.length - 1));
		if (elem('showHistorySwitch').checked) showHistory();
	});
	yUndoManager.on('stack-item-added', (event) => {
		yjsTrace('yUndoManager.on stack-item-added', event);
		undoRedoButtonStatus();
	});
	yUndoManager.on('stack-item-popped', (event) => {
		yjsTrace('yUndoManager.on stack-item-popped', event);
		undoRedoButtonStatus();
	});
} // end startY()

function yjsTrace(where, what) {
	if (window.debug.includes('yjs')) {
		console.log(exactTime(), where, what);
	}
}
function exactTime() {
	let d = new Date();
	return `${d.toLocaleTimeString()}:${d.getMilliseconds()} `;
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
/**
 * Once any existing map has been loaded, fit it to the pane and reveal it
 * @param {string} msg message for console
 */
function displayNetPane(msg) {
	fit(0);
	setMapTitle(yNetMap.get('mapTitle'));
	console.log(msg);
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
	myNameRec.id = clientID;

	console.log('My name: ' + myNameRec.name);
	displayUserName();
	yAwareness.setLocalState({user: myNameRec});
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
}
function saveUserName(name) {
	if (name.length > 0) {
		myNameRec.name = name;
		myNameRec.anon = false;
	} else {
		myNameRec = generateName();
		chatNameBox.value = myNameRec.name;
	}
	myNameRec.id = clientID;
	localStorage.setItem('myName', JSON.stringify(myNameRec));
	yAwareness.setLocalState({user: myNameRec});
	showAvatars();
}
/**
 * if this is the user's first time, show them how the user interface works
 */
function setUpTutorial() {
	if (localStorage.getItem('doneIntro') !== 'done' && viewOnly === false) {
		tutorial.onexit(function () {
			localStorage.setItem('doneIntro', 'done');
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
	showAvatars();
	yAwareness.on('change', (event) => {
		yjsTrace('yAwareness.on', event);
		showAvatars();
		if (elem('showCursorSwitch').checked) showMice();
	});
	// fade out avatar when there has been no movement of the mouse for 15 minutes
	asleep(false);
	var sleepTimer = setTimeout(() => asleep(true), TIMETOSLEEP);
	window.addEventListener('mousemove', (e) => {
		clearTimeout(sleepTimer);
		asleep(false);
		sleepTimer = setTimeout(() => asleep(true), TIMETOSLEEP);
		// broadcast current position of mouse in canvas coordinates
		let box = netPane.getBoundingClientRect();
		yAwareness.setLocalStateField(
			'cursor',
			network.DOMtoCanvas({
				x: e.clientX - box.left,
				y: e.clientY - box.top,
			})
		);
	});
}
/**
 * Set the awareness local state to show whether this client is sleeping (no mouse movement for 15 minutes)
 * @param {Boolean} isSleeping
 */
function asleep(isSleeping) {
	if (myNameRec.asleep === isSleeping) return;
	myNameRec.asleep = isSleeping;
	yAwareness.setLocalState({user: myNameRec});
	showAvatars();
}
/**
 * Display the other users' mouse pointers (if they are inside the canvas)
 */
function showMice() {
	let recs = Array.from(yAwareness.getStates());
	let box = netPane.getBoundingClientRect();
	recs.forEach(([key, value]) => {
		if (key != clientID && value.cursor) {
			let cursorDiv = elem(key.toString());
			let p = network.canvasToDOM(value.cursor);
			p.x += box.left;
			p.y += box.top;
			cursorDiv.style.top = `${p.y}px`;
			cursorDiv.style.left = `${p.x}px`;
			cursorDiv.style.display =
				p.x < box.left || p.x > box.right || p.y > box.bottom || p.y < box.top ? 'none' : 'block';
		}
	});
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
				item.created = timestamp();
				addLabel(item, cancelAdd, callback);
				showPressed('addNode', 'remove');
			},
			editNode: function (item, callback) {
				// for some weird reason, vis-network copies the group properties into the
				// node properties before calling this fn, which we don't want.  So we
				// revert to using the original node properties before continuing.
				item = data.nodes.get(item.id);
				item.modified = timestamp();
				let point = {x: event.offsetX, y: event.offsetY};
				editNode(item, point, cancelEdit, callback);
			},
			addEdge: function (item, callback) {
				inAddMode = false;
				network.setOptions({
					interaction: {dragView: true, selectable: true},
				});
				showPressed('addLink', 'remove');
				if (item.from == item.to) {
					callback(null);
					return;
				}
				if (duplEdge(item.from, item.to).length > 0) {
					alert('There is already a link from this Factor to the other.');
					callback(null);
					return;
				}
				item = deepMerge(item, styles.edges[lastLinkSample]);
				item.grp = lastLinkSample;
				item.created = timestamp();
				clearStatusBar();
				callback(item);
				logHistory(`added link from ${data.nodes.get(item.from).label} to ${data.nodes.get(item.to).label}`);
			},
			editEdge: {
				editWithoutDrag: function (item, callback) {
					item = data.edges.get(item.id);
					item.modified = timestamp();
					let point = {x: event.offsetX, y: event.offsetY};
					editEdge(item, point, cancelEdit, callback);
				},
			},
			deleteNode: function (item, callback) {
				let locked = false;
				item.nodes.forEach((nId) => {
					let n = data.nodes.get(nId);
					if (n.locked) {
						locked = true;
						statusMsg(`Factor '${shorten(n.oldLabel)}' can't be deleted because it is locked`, 'warn');
						callback(null);
						return;
					}
				});
				if (locked) return;
				clearStatusBar();
				hideNotes();
				// delete also all the edges that link to the nodes being deleted
				item.nodes.forEach((nId) => {
					network.getConnectedEdges(nId).forEach((eId) => {
						if (item.edges.indexOf(eId) === -1) item.edges.push(eId);
					});
				});
				item.edges.forEach((edgeId) => {
					logHistory(
						`deleted link from ${data.nodes.get(data.edges.get(edgeId).from).label} to ${
							data.nodes.get(data.edges.get(edgeId).to).label
						}`
					);
				});
				item.nodes.forEach((nodeId) => {
					logHistory(`deleted factor: ${data.nodes.get(nodeId).label}`);
				});
				callback(item);
			},
			deleteEdge: function (item, callback) {
				item.edges.forEach((edgeId) => {
					logHistory(
						`deleted link from ${data.nodes.get(data.edges.get(edgeId).from).label} to ${
							data.nodes.get(data.edges.get(edgeId).to).label
						}`
					);
				});
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
	network.on('click', function (params) {
		if (window.debug.includes('gui')) console.log('click');
		let keys = params.event.pointers[0];
		if (keys.metaKey) {
			// if the Command key (on a Mac)   is down, and the click is on a node/edge, log it to the console
			if (params.nodes.length == 1) {
				let node = data.nodes.get(params.nodes[0]);
				console.log('node = ', node);
				window.node = node;
			}
			if (params.edges.length == 1) {
				let edge = data.edges.get(params.edges[0]);
				console.log('edge = ', edge);
				window.edge = edge;
			}
			return;
		}
		if (keys.altKey) {
			// if the Option/ALT key is down, add a node if on the background, or a link if on a node
			if (params.nodes.length == 0 && params.edges.length == 0) {
				let pos = params.pointer.canvas;
				let item = {id: uuidv4(), label: '', x: pos.x, y: pos.y};
				item = deepMerge(item, styles.nodes[lastNodeSample]);
				item.grp = lastNodeSample;
				addLabel(item, clearPopUp, function (newItem) {
					if (newItem !== null) data.nodes.add(newItem);
				});
			}
			if (params.nodes.length == 1) {
				elem('addLink').click();
			}
			return;
		}
		if (keys.shiftKey) {
			if (!inEditMode) showMagnifier(keys);
		}
	});
	// despatch to edit a node or an edge or to fit the network on the pane
	network.on('doubleClick', function (params) {
		if (window.debug.includes('gui')) console.log('doubleClick');
		if (params.nodes.length === 1) {
			if (!inEditMode && !data.nodes.get(params.nodes[0]).locked) network.editNode();
		} else if (params.edges.length === 1) {
			if (!inEditMode) network.editEdgeMode();
		} else {
			fit();
		}
	});
	network.on('selectNode', function () {
		if (window.debug.includes('gui')) console.log('selectNode');
		let selectedNodes = network.getSelectedNodes();
		selectedNodes.forEach((nodeId) => {
			let node = data.nodes.get(nodeId);
			if (!node.locked) {
				node.shadow = true;
				data.nodes.update(node, 'dontBroadcast');
			}
		});
		showSelected();
		showNodeOrEdgeData();
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
		data.nodes.update(nodesToUpdate, 'dontBroadcast');
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
			data.edges.update(edge, 'dontBroadcast');
		});
		showSelected();
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
		data.edges.update(edgesToUpdate, 'dontBroadcast');
		hideNotes();
		clearStatusBar();
	});

	let selectionCanvasStart = {};
	let selectionStart = {};
	let selectionArea = document.createElement('div');
	selectionArea.className = 'selectionBox';
	selectionArea.style.display = 'none';
	elem('main').appendChild(selectionArea);

	network.on('dragStart', function (params) {
		if (window.debug.includes('gui')) console.log('dragStart');
		let e = params.event.pointers[0];
		// start drawing a selection rectangle if the CTRL key is down and click is on the background
		if (e.ctrlKey && params.nodes.length == 0 && params.edges.length == 0) {
			network.setOptions({interaction: {dragView: false}});
			listen('net-pane', 'mousemove', showAreaSelection);
			selectionStart = {x: e.offsetX, y: e.offsetY};
			selectionCanvasStart = params.pointer.canvas;
			selectionArea.style.left = `${e.offsetX}px`;
			selectionArea.style.top = `${e.offsetY}px`;
			selectionArea.style.width = '0px';
			selectionArea.style.height = '0px';
			selectionArea.style.display = 'block';
			return;
		}
		changeCursor('grabbing');
	});
	/**
	 * update the selection rectangle as the mouse moves
	 * @param {Event} event
	 */
	function showAreaSelection(event) {
		selectionArea.style.left = `${Math.min(selectionStart.x, event.offsetX)}px`;
		selectionArea.style.top = `${Math.min(selectionStart.y, event.offsetY)}px`;
		selectionArea.style.width = `${
			Math.max(selectionStart.x, event.offsetX) - Math.min(selectionStart.x, event.offsetX)
		}px`;
		selectionArea.style.height = `${
			Math.max(selectionStart.y, event.offsetY) - Math.min(selectionStart.y, event.offsetY)
		}px`;
	}
	network.on('dragEnd', function (params) {
		if (window.debug.includes('gui')) console.log('dragEnd');
		if (selectionArea.style.display == 'block') {
			selectionArea.style.display = 'none';
			network.setOptions({interaction: {dragView: true}});
			elem('net-pane').removeEventListener('mousemove', showAreaSelection);
		}
		let e = params.event.pointers[0];
		if (e.ctrlKey && params.nodes.length == 0 && params.edges.length == 0) {
			network.storePositions();
			let selectionEnd = params.pointer.canvas;
			let selectedNodes = data.nodes.get({
				filter: function (node) {
					return (
						node.x >= selectionCanvasStart.x &&
						node.x <= selectionEnd.x &&
						node.y >= selectionCanvasStart.y &&
						node.y <= selectionEnd.y
					);
				},
			});
			network.setSelection({nodes: selectedNodes.map((n) => n.id).concat(network.getSelectedNodes())});
			showSelected();
			return;
		}

		let newPositions = network.getPositions(params.nodes);
		data.nodes.update(
			data.nodes.get(params.nodes).map((n) => {
				n.x = newPositions[n.id].x;
				n.y = newPositions[n.id].y;
				if (snapToGridToggle) snapToGrid(n);
				return n;
			})
		);
		changeCursor('default');
	});
	network.on('controlNodeDragging', function () {
		if (window.debug.includes('gui')) console.log('controlNodeDragging');
		changeCursor('crosshair');
	});
	network.on('controlNodeDragEnd', function (event) {
		if (window.debug.includes('gui')) console.log('controlNodeDragEnd');
		if (event.controlEdge.from != event.controlEdge.to) changeCursor('default');
	});
	network.on('beforeDrawing', function (ctx) {
		redraw(ctx);
	});
	network.on('afterDrawing', (ctx) => drawBadges(ctx));

	// listen for changes to the network structure
	// and recalculate the network statistics when there is one
	data.nodes.on('add', recalculateStats);
	data.nodes.on('remove', recalculateStats);
	data.edges.on('add', recalculateStats);
	data.edges.on('remove', recalculateStats);

	/* --------------------------------------------set up the magnifer --------------------------------------------*/
	const magSize = 300; // diameter of loupe
	const halfMagSize = magSize / 2.0;
	const netPaneCanvas = netPane.firstElementChild.firstElementChild;
	let magnifier = document.createElement('canvas');
	magnifier.width = magSize;
	magnifier.height = magSize;
	magnifier.className = 'magnifier';
	let magnifierCtx = magnifier.getContext('2d');
	magnifierCtx.fillStyle = 'white';
	netPane.appendChild(magnifier);
	let bigNetPane = null;
	let bigNetwork = null;
	let bigNetCanvas = null;
	let netPaneRect = null;

	window.addEventListener('keydown', (e) => {
		if (!inEditMode && e.shiftKey) createMagnifier();
	});
	window.addEventListener('mousemove', (e) => {
		if (e.shiftKey) showMagnifier(e);
	});
	window.addEventListener('keyup', (e) => {
		if (e.key == 'Shift') closeMagnifier();
	});

	/**
	 * create a copy of the network, but magnified and off screen
	 */
	function createMagnifier() {
		if (bigNetPane) {
			bigNetwork.destroy();
			bigNetPane.remove();
		}
		netPaneRect = netPane.getBoundingClientRect();
		network.storePositions();
		bigNetPane = document.createElement('div');
		bigNetPane.id = 'big-net-pane';
		bigNetPane.style.position = 'absolute';
		bigNetPane.style.top = '-9999px';
		bigNetPane.style.left = '-9999px';
		bigNetPane.style.width = `${netPane.offsetWidth * magnification}px`;
		bigNetPane.style.height = `${netPane.offsetHeight * magnification}px`;
		netPane.appendChild(bigNetPane);
		bigNetwork = new Network(bigNetPane, data, {
			physics: {enabled: false},
		});
		bigNetCanvas = bigNetPane.firstElementChild.firstElementChild;
		bigNetwork.moveTo({
			position: network.getViewPosition(),
			scale: magnification * network.getScale(),
		});
		netPane.style.cursor = 'none';
		magnifier.style.display = 'none';
	}
	/**
	 * display the loupe, centred on the mouse pointer, and fill it with
	 * an image copied from the magnified network
	 */
	function showMagnifier(e) {
		e.preventDefault();
		if (bigNetCanvas == null) createMagnifier(e);
		magnifierCtx.fillRect(0, 0, magSize, magSize);
		magnifierCtx.drawImage(
			bigNetCanvas,
			((e.clientX - netPaneRect.x) * bigNetCanvas.width) / netPaneCanvas.clientWidth - halfMagSize,
			((e.clientY - netPaneRect.y) * bigNetCanvas.height) / netPaneCanvas.clientHeight - halfMagSize,
			magSize,
			magSize,
			0,
			0,
			magSize,
			magSize
		);
		magnifier.style.top = e.clientY - netPaneRect.y - halfMagSize + 'px';
		magnifier.style.left = e.clientX - netPaneRect.x - halfMagSize + 'px';
		magnifier.style.display = 'block';
	}
	/**
	 * destroy the magnified network copy
	 */
	function closeMagnifier() {
		if (bigNetPane) {
			bigNetwork.destroy();
			bigNetPane.remove();
		}
		netPane.style.cursor = 'default';
		magnifier.style.display = 'none';
	}
} // end draw()

function contextMenu(event) {
	event.preventDefault();
}
/**
 * return an object with the current time as a date an integer and the current user's initials
 */
function timestamp() {
	return {time: Date.now(), user: initials(myNameRec.name)};
}
/**
 * push a record that action has been taken on to the end of the history log
 * @param {String} action
 */
function logHistory(action) {
	yHistory.push([{action: action, time: Date.now(), user: myNameRec.name}]);
}

function drawBadges(ctx) {
	data.nodes
		.get()
		.filter((node) => !node.hidden && node.note && node.note != 'Notes')
		.forEach((node) => {
			let box = network.getBoundingBox(node.id);
			drawBadge(ctx, box.right - 20, box.top);
		});
	let changedEdges = [];
	data.edges.get().forEach((edge) => {
		if (
			!edge.hidden &&
			edge.note &&
			edge.note != 'Notes' &&
			edge.arrows &&
			edge.arrows.middle &&
			!edge.arrows.middle.enabled
		) {
			// there is a note, but the badge is not shown
			changedEdges.push(edge);
			edge.arrows.middle.enabled = true;
			edge.arrows.middle.type = 'image';
			edge.arrows.middle.src = elem('badge').src;
		} else if (
			(!edge.note || (edge.note && edge.note == 'Notes')) &&
			edge.arrows &&
			edge.arrows.middle &&
			edge.arrows.middle.enabled
		) {
			// there is not a note, but the badge is shown
			changedEdges.push(edge);
			edge.arrows.middle.enabled = false;
		}
	});
	data.edges.update(changedEdges);
}
const badge = elem('badge');

function drawBadge(ctx, x, y) {
	ctx.beginPath();
	ctx.drawImage(badge, Math.floor(x), Math.floor(y));
}
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
 * @param {Object} point  where the mouse clicked
 * @param {Function} cancelAction
 * @param {Function} callback
 */
function addLabel(item, cancelAction, callback) {
	initPopUp('Add Factor', 60, item, cancelAction, saveLabel, callback);
	positionPopUp({x: event.offsetX, y: event.offsetY});
	elem('popup-label').focus();
}

/**
 * Draw a dialog box for user to edit a node
 * @param {Object} item the node
 * @param {Object} point the centre of the node
 * @param {Function} cancelAction what to do if the edit is cancelled
 * @param {Function} callback what to do if the edit is saved
 */
function editNode(item, point, cancelAction, callback) {
	initPopUp('Edit Factor', 150, item, cancelAction, saveNode, callback);
	elem('popup').insertAdjacentHTML(
		'beforeend',
		`	
	<table id="popup-table">
		<tr>
			<td>
				<i>Back</i>
			</td>
			<td>
			<i>Border</i>
			</td>
			<td>
			<i>Font</i>
			</td>
		</tr>
		<tr>
		<td>
		<div class="input-color-container">
		<div class="color-well" id="node-backgroundColor" </div>
		</div>
		</td>
		<td>
			<div class="input-color-container">
			<div class="color-well" id="node-borderColor" </div>
			</div>
			</td>
			<td>
			<div class="input-color-container">
			<div class="color-well" id="node-fontColor" </div>
			</div>
			</td>
		</tr>
		<tr>
		<td><i>Border:</i></td>
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
	cp.createColorPicker('node-backgroundColor');
	elem('node-backgroundColor').style.backgroundColor = standardize_color(item.color.background);
	cp.createColorPicker('node-borderColor');
	elem('node-borderColor').style.backgroundColor = standardize_color(item.color.border);
	cp.createColorPicker('node-fontColor');
	elem('node-fontColor').style.backgroundColor = standardize_color(item.font.color);
	elem('node-borderType').value = getDashes(item.shapeProperties.borderDashes);
	positionPopUp(point);
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
 * @param {Object} point the centre of the edge
 * @param {Function} cancelAction what to do if the edit is cancelled
 * @param {Function} callback what to do if the edit is saved
 */
function editEdge(item, point, cancelAction, callback) {
	initPopUp('Edit Link', 150, item, cancelAction, saveEdge, callback);
	elem('popup').insertAdjacentHTML(
		'beforeend',
		` 
		<table id="popup-table">
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
				<select id="edge-type">
					<option value="false">Line...</option>
					<option value="false">Solid</option>
					<option value="true">Dashed</option>
					<option value="dots">Dotted</option>
				</select>
			</td>
		</tr>
		<tr>
			<td>
				<select id="edge-arrow">
					<option value="vee">Arrows...</option>
					<option value="vee">Sharp</option>
					<option value="bar">Bar</option>
					<option value="circle">Circle</option>
					<option value="box">Box</option>
					<option value="diamond">Diamond</option>
					<option value="none">None</option>
				</select>
			</td>
			<td>
				<div class="input-color-container">
					<div class="color-well"  id="edge-color" </div>
				</div>
			</td>
		</tr>
		<tr>
			<td style="text-align: right; padding-top: 5px">
				<i>Font</i>	
			</td>
			<td style="padding-top: 5px">
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
	cp.createColorPicker('edge-color');
	elem('edge-color').style.backgroundColor = standardize_color(item.color.color);
	elem('edge-type').value = getDashes(item.dashes);
	elem('edge-arrow').value = item.arrows.to.enabled ? item.arrows.to.type : 'none';
	elem('edge-font-size').value = parseInt(item.font.size);
	positionPopUp(point);
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
function initPopUp(popUpTitle, height, item, cancelAction, saveAction, callback) {
	inAddMode = false;
	inEditMode = true;
	changeCursor('default');
	elem('popup').style.height = height + 'px';
	elem('popup-operation').innerHTML = popUpTitle;
	elem('popup-saveButton').onclick = saveAction.bind(this, item, callback);
	elem('popup-cancelButton').onclick = cancelAction.bind(this, item, callback);
	let popupLabel = elem('popup-label');
	popupLabel.style.fontSize = '14px';
	popupLabel.innerText = item.label === undefined ? '' : item.label.replace(/\n/g, ' ');
	let table = elem('popup-table');
	if (table) table.remove();
}

/**
 * Position the editing dialog box so that it is to the left of the item being edited,
 * but not outside the window
 * @param {Object} point
 */
function positionPopUp(point) {
	let popUp = elem('popup');
	popUp.style.display = 'block';
	// popup appears to the left of the given point
	popUp.style.top = `${point.y - popUp.offsetHeight / 2}px`;
	let left = point.x - popUp.offsetWidth - 3;
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
 * User has pressed 'cancel' - abandon adding a node and hide the dialog
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
	if (callback) callback(null);
	stopEdit();
}
/**
 * called when a node has been added.  Save the label provided
 * @param {Object} node the item that has been added
 * @param {Function} callback
 */
function saveLabel(node, callback) {
	node.label = splitText(elem('popup-label').innerText, NODEWIDTH);
	clearPopUp();
	if (node.label === '') {
		statusMsg('No label: cancelled', 'warn');
		callback(null);
		return;
	}
	network.manipulation.inMode = 'addNode'; // ensure still in Add mode, in case others have done something meanwhile
	callback(node);
	logHistory(`added factor ${node.label}`);
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
	let color = elem('node-backgroundColor').style.backgroundColor;
	item.color.background = color;
	item.color.highlight.background = color;
	item.color.hover.background = color;
	color = elem('node-borderColor').style.backgroundColor;
	item.color.border = color;
	item.color.highlight.border = color;
	item.color.hover.border = color;
	item.font.color = elem('node-fontColor').style.backgroundColor;
	let borderType = elem('node-borderType').value;
	item.borderWidth = borderType == 'none' ? 0 : 4;
	item.shapeProperties.borderDashes = convertDashes(borderType);
	network.manipulation.inMode = 'editNode'; // ensure still in Add mode, in case others have done something meanwhile
	if (item.label == item.oldLabel) logHistory(`edited factor : ${item.label}`);
	else logHistory(`edited factor, changing label from ${item.oldLabel} to ${item.label}`);
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
	item.label = item.label + '\n\n' + '[Being edited by ' + myNameRec.name + ']';
	item.wasFixed = Boolean(item.fixed);
	item.fixed = true;
	item.chosen = false;
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
	showNodeOrEdgeData();
}
/**
 * ensure that all factors and links are unlocked (called only when user leaves the page, to clear up for others)
 */
function unlockAll() {
	data.nodes.forEach((node) => {
		if (node.locked) cancelEdit(deepCopy(node));
	});
	data.edges.forEach((edge) => {
		if (edge.locked) cancelEdit(deepCopy(edge));
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
	let color = elem('edge-color').style.backgroundColor;
	item.color.color = color;
	item.color.hover = color;
	item.color.highlight = color;
	item.width = parseInt(elem('edge-width').value);
	if (!item.width) item.width = 1;
	item.dashes = convertDashes(elem('edge-type').value);
	item.arrows.to = {
		enabled: elem('edge-arrow').value !== 'none',
		type: elem('edge-arrow').value,
	};
	item.font.size = parseInt(elem('edge-font-size').value);
	network.manipulation.inMode = 'editEdge'; // ensure still in edit mode, in case others have done something meanwhile
	unlockEdge(item);
	// vis-network silently deselects all edges in the callback (why?).  So we have to mark this edge as unselected in preparation
	item.shadow = false;
	clearStatusBar();
	callback(item);
	logHistory(`edited link from ${data.nodes.get(item.from).label} to ${data.nodes.get(item.to).label}`);
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
			return [2, 8];
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
	data.edges.update(item);
}
/**
 * User has finished editing the edge.  Unlock it.
 * @param {edge} item
 */
function unlockEdge(item) {
	item.locked = false;
	item.font.color = 'rgba(0,0,0,1)';
	item.opacity = 1;
	item.oldLabel = undefined;
	item.chosen = true;
	data.edges.update(item);
	showNodeOrEdgeData();
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
/* function deleteMsg(item) {
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
} */
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
	yNetMap.set('mapTitle', title);
}
function pasteMapTitle(e) {
	e.preventDefault();
	let paste = (e.clipboardData || window.clipboardData).getData('text/plain');
	if (paste instanceof HTMLElement) paste = paste.textContent;
	const selection = window.getSelection();
	if (!selection.rangeCount) return false;
	selection.deleteFromDocument();
	selection.getRangeAt(0).insertNode(document.createTextNode(paste));
	setMapTitle(elem('maptitle').innerText);
}
/**
 * Format the map title
 * @param {string} title
 */
function setMapTitle(title) {
	let div = elem('maptitle');
	clearStatusBar();
	if (!title) {
		title = 'Untitled map';
	}
	if (title == 'Untitled map') {
		div.classList.add('unsetmaptitle');
		document.title = `${appName} ${room}`;
	} else {
		if (title.length > 50) {
			title = title.slice(0, 50);
			statusMsg('Map title is too long: truncated', 'warn');
		}
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
	data.nodes.update(nodes, 'dontBroadcast');
	let edges = data.nodes.get(network.getSelectedEdges());
	edges.forEach((edge) => {
		edge.shadow = false;
	});
	data.edges.update(edges, 'dontBroadcast');
	network.unselectAll();
	clearStatusBar();
}
/* 
  ----------- Calculate statistics in the background -------------
*/
// set  up a web worker to calculate network statistics in parallel with whatever
// the user is doing
var worker = new Worker(new URL('betweenness.js', import.meta.url));
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
 * shorten the label if necessary and add an ellipsis
 * @param {string} label
 */
function shorten(label) {
	return label.length > SHORTLABELLEN ? label.substring(0, SHORTLABELLEN) + '...' : label;
}
/**
 * return a string listing the number of Links
 * @param {Array} links
 */
function listLinks(links) {
	if (links.length > 1) return links.length + ' links';
	return '1 link';
}
/**
 * show the nodes and links selected in the status bar
 */
function showSelected() {
	let selectedNodes = network.getSelectedNodes();
	let selectedEdges = network.getSelectedEdges();
	let msg = '';
	if (selectedNodes.length > 0) msg = listFactors(selectedNodes);
	if (selectedNodes.length > 0 && selectedEdges.length > 0) msg += ' and ';
	if (selectedEdges.length > 0) msg += listLinks(selectedEdges);
	if (msg.length > 0) statusMsg(msg + ' selected');
}
/* zoom slider */
Network.prototype.zoom = function (scale) {
	let newScale = scale === undefined ? 1 : scale;
	const animationOptions = {
		scale: newScale,
		animation: {
			duration: 0,
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
			network.setOptions({
				interaction: {dragView: false, selectable: false},
			});
			network.addEdgeMode();
	}
}
/**
 * cancel adding node and links
 */
function stopEdit() {
	inAddMode = false;
	network.disableEditMode();
	changeCursor('default');
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

function undoRedoButtonStatus() {
	setButtonDisabledStatus('undo', yUndoManager.undoStack.length === 0);
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
	clearStatusBar();
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
			statusMsg("Error reading '" + fileName + "': " + err.message, 'error');
			return;
		}
		document.body.style.cursor = 'default';
	};
	reader.readAsText(file);
}

function openFile() {
	elem('fileInput').click();
}
/**
 * determine what kind of file it is, parse it and replace any current map with the one read from the file
 * @param {string} contents
 */
function loadFile(contents) {
	if (data.nodes.length > 0)
		if (!confirm('Loading a file will delete the current network.  Are you sure you want to replace it?')) return;
	unSelect();
	ensureNotDrawing();
	network.destroy();
	nodes.clear();
	edges.clear();
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
	let nodesToUpdate = [];
	data.nodes.get().forEach((n) => {
		// ensure that all nodes have a grp property (converting 'group' property for old format files)
		if (!n.grp) n.grp = n.group ? 'group' + (n.group % 9) : 'group0';
		// reassign the sample properties to the nodes
		n = deepMerge(styles.nodes[n.grp], n);
		// version 1.6 made changes to label scaling
		n.scaling = {
			label: {enabled: false, max: 40, min: 10},
			max: 100,
			min: 10,
		};
		nodesToUpdate.push(n);
	});
	data.nodes.update(nodesToUpdate);

	// same for edges
	let edgesToUpdate = [];
	data.edges.get().forEach((e) => {
		// ensure that all edges have a grp property (converting 'group' property for old format files)
		if (!e.grp) e.grp = e.group ? 'edge' + (e.group % 9) : 'edge0';
		// reassign the sample properties to the edges
		e = deepMerge(styles.edges[e.grp], e);
		edgesToUpdate.push(e);
	});
	data.edges.update(edgesToUpdate);

	network.fit(0);
	yUndoManager.clear();
	undoRedoButtonStatus();
	updateLegend();
	logHistory('loaded &lt;' + lastFileName + '&gt;');
}
/**
 * Parse and load a PRSM map file, or a JSON file exported from Gephi
 * @param {string} json
 */
function loadJSONfile(json) {
	json = JSON.parse(json);
	if (json.version && version.substring(0, 3) > json.version.substring(0, 3)) {
		statusMsg('Warning: file was created in an earlier version', 'warn');
		msg = 'old version';
	}
	if (json.lastNodeSample) lastNodeSample = json.lastNodeSample;
	if (json.lastLinkSample) lastLinkSample = json.lastLinkSample;
	if (json.buttons) setButtonStatus(json.buttons);
	if (json.mapTitle) yNetMap.set('mapTitle', setMapTitle(json.mapTitle));
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
		json.nodes.forEach((n) => {
			// at version 1.5, the title: property was renamed to note:
			if (!n.note && n.title) n.note = n.title.replace(/<br>|<p>/g, '\n');
			delete n.title;
		});
		nodes.add(json.nodes);
		json.edges.forEach((e) => {
			if (!e.note && e.title) e.note = e.title.replace(/<br>|<p>/g, '\n');
			delete e.title;
		});
		edges.add(json.edges);
	}
	// before v1.4, the style array was called samples
	if (json.samples) json.styles = json.samples;
	if (json.styles) {
		styles.nodes = json.styles.nodes;
		styles.edges = json.styles.edges;
		refreshSampleNodes();
		refreshSampleLinks();
		doc.transact(() => {
			for (let groupId in styles.nodes) {
				ySamplesMap.set(groupId, {
					node: styles.nodes[groupId],
				});
			}
			for (let edgeId in styles.edges) {
				ySamplesMap.set(edgeId, {
					edge: styles.edges[edgeId],
				});
			}
		});
	}
	yPointsArray.delete(0, yPointsArray.length);
	if (json.underlay) yPointsArray.insert(0, json.underlay);
	yHistory.delete(0, yHistory.length);
	if (json.history) yHistory.insert(0, json.history);
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
							node.label = splitText(tokens.shift().replace(/"/g, ''), NODEWIDTH);
							break;
						case 'color':
						case 'colour':
							node.color = {};
							node.color.background = tokens.shift().replace(/"/g, '');
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
	let sampleElements = Array.from(document.getElementsByClassName('sampleNode'));
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
	let sampleElements = Array.from(document.getElementsByClassName('sampleLink'));
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
			buttons: getButtonStatus(),
			styles: styles,
			nodes: data.nodes.map((n) =>
				strip(n, [
					'id',
					'label',
					'note',
					'grp',
					'x',
					'y',
					'arrows',
					'color',
					'font',
					'borderWidth',
					'shapeProperties',
				])
			),
			edges: data.edges.map((e) =>
				strip(e, ['id', 'label', 'note', 'grp', 'from', 'to', 'color', 'width', 'dashes'])
			),
			underlay: yPointsArray.toArray(),
			history: yHistory.toArray(),
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
	setFileName(extn);
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
 * save the map as a PNG image file
 */
function exportPNGfile() {
	setFileName('png');
	const a = document.createElement('a');
	document.body.appendChild(a);
	a.setAttribute('style', 'display: none');
	a.href = network.canvas.frame.firstChild.toDataURL('image/png');
	a.download = lastFileName;
	a.click();
	a.remove();
	statusMsg(`'${lastFileName}' saved`);
}
/**
 * resets lastFileName to have supplied extension
 * @param {string} extn filename extnsion to apply
 */
function setFileName(extn) {
	let pos = lastFileName.indexOf('.');
	lastFileName = lastFileName.substr(0, pos < 0 ? lastFileName.length : pos) + '.' + extn;
}
/**
 * Save the map as CSV files, one for nodes and one for edges
 * Only node and edge labels and style ids are saved
 */
function exportCVS() {
	let dummyDiv = document.createElement('div');
	dummyDiv.id = 'dummy-div';
	dummyDiv.style.display = 'none';
	container.appendChild(dummyDiv);
	let qed = new Quill('#dummy-div');
	let str = 'Id,Label,Style,Note\n';
	for (let node of data.nodes.get()) {
		str += node.id + ',';
		if (node.label) str += '"' + node.label.replaceAll('\n', ' ') + '"';
		str += ',' + node.grp + ',';
		if (node.note) {
			qed.setContents(node.note);
			str += '"' + qed.getText(0).replaceAll('\n', ' ') + '"';
		}
		str += '\n';
	}
	saveStr(str, 'nodes.csv');
	str = 'Source,Target,Type,Id,Label,Style,Note\n';
	for (let edge of data.edges.get()) {
		str += edge.from + ',';
		str += edge.to + ',';
		str += 'directed,';
		str += edge.id + ',';
		if (edge.label) str += edge.label.replaceAll('\n', ' ') + '"';
		str += ',' + edge.grp + ',';
		if (edge.note) {
			qed.setContents(edge.note);
			str += '"' + qed.getText(0).replaceAll('\n', ' ') + '"';
		}
		str += '\n';
	}
	saveStr(str, 'edges.csv');
	dummyDiv.remove();
}
/**
 * Save the map as a GML file
 */
function exportGML() {
	let str =
		'Creator "prsm ' + version + ' on ' + new Date(Date.now()).toLocaleString() + '"\ngraph\n[\n\tdirected 1\n';
	let nodeIds = data.nodes.map((n) => n.id); //use integers, not GUIDs for node ids
	for (let node of data.nodes.get()) {
		str += '\tnode\n\t[\n\t\tid ' + nodeIds.indexOf(node.id);
		if (node.label) str += '\n\t\tlabel "' + node.label + '"';
		let color = node.color.background || styles.nodes.group0.color.background;
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
	listen('clone-check', 'click', () => setLink(elem('clone-check').checked ? 'clone' : 'share'));
	listen('view-check', 'click', () => setLink(elem('view-check').checked ? 'view' : 'share'));
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
		let linkToShare = window.location.origin + window.location.pathname + '?room=' + newRoom;
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

/* ----------------------------------------------------------- Search ------------------------------------------------------*/
/**
 * Open an input for user to type label of node to search for and generate suggestions when user starts typing
 */
function search() {
	let searchBar = elem('search-bar');
	if (searchBar.style.display == 'block') hideSearchBar();
	else {
		searchBar.style.display = 'block';
		elem('search-icon').style.display = 'block';
		searchBar.focus();
		listen('search-bar', 'keyup', searchTargets);
	}
}
/**
 * generate and display a set of suggestions - nodes with labels that include the substring that the user has typed
 */
function searchTargets() {
	let str = elem('search-bar').value;
	if (!str || str == ' ') {
		if (elem('targets')) elem('targets').remove();
		return;
	}
	let targets = elem('targets');
	if (targets) targets.remove();
	targets = document.createElement('ul');
	targets.id = 'targets';
	targets.classList.add('search-ul');
	str = str.toLowerCase();
	let suggestions = window.data.nodes.get().filter((n) => n.label.toLowerCase().includes(str));
	suggestions.slice(0, 8).forEach((n) => {
		let li = document.createElement('li');
		li.classList.add('search-suggestion');
		let div = document.createElement('div');
		div.classList.add('search-suggestion-text');
		div.innerText = n.label.replace(/\n/g, ' ');
		div.dataset.id = n.id;
		div.addEventListener('click', (event) => doSearch(event));
		li.appendChild(div);
		targets.appendChild(li);
	});
	if (suggestions.length > 8) {
		let li = document.createElement('li');
		li.classList.add('search-suggestion');
		let div = document.createElement('div');
		div.className = 'search-suggestion-text and-more';
		div.innerText = 'and more ...';
		li.appendChild(div);
		targets.appendChild(li);
	}
	elem('suggestion-list').appendChild(targets);
}
/**
 * do the search using the string in the search bar and, when found, focus on that node
 */
function doSearch(event) {
	let nodeId = event.target.dataset.id;
	if (nodeId) {
		window.network.focus(nodeId, {scale: 2, animation: true});
		elem('zoom').value = 2;
		hideSearchBar();
	}
}
function hideSearchBar() {
	let searchBar = elem('search-bar');
	if (elem('targets')) elem('targets').remove();
	searchBar.value = '';
	searchBar.style.display = 'none';
	elem('search-icon').style.display = 'none';
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
dragElement(elem('panel'), elem('panelHeader'));

/* ------------------------------------------------operations related to the side panel -------------------------------------*/

/**
 * when the window is resized, make sure that the pane is still visible
 * @param {HTMLelement} pane
 */
function keepPaneInWindow(pane) {
	if (pane.offsetLeft + pane.offsetWidth > container.offsetLeft + container.offsetWidth) {
		pane.style.left = container.offsetLeft + container.offsetWidth - pane.offsetWidth + 'px';
	}
	if (pane.offsetTop + pane.offsetHeight > container.offsetTop + container.offsetHeight) {
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
}

/**
 * @return an object with the Network panel settings
 */
function getButtonStatus() {
	return {
		snapToGrid: elem('snaptogridswitch').checked,
		curve: elem('curveSelect').value,
		background: elem('netBackColorWell').value,
		legend: elem('showLegendSwitch').checked,
		sizing: elem('sizing').value,
	};
}
/**
 * Set the Network panel buttons to their values loaded from a file
 * @param {Object} settings
 */
function setButtonStatus(settings) {
	yNetMap.set('snapToGrid', settings.snapToGrid);
	yNetMap.set('curve', settings.curve);
	yNetMap.set('background', settings.background || '#ffffff');
	yNetMap.set('legend', settings.legend);
	yNetMap.set('stream', settings.stream);
	yNetMap.set('sizing', settings.sizing);
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
		edgesToUpdate.push(edge);
	}
	data.edges.update(edgesToUpdate);
	lastLinkSample = sample;
}
/**
 * Remember the last style sample that the user clicked and use this for future factors/links
 * @param {Integer} nodeId
 * @param {Integer} linkId
 */
export function updateLastSamples(nodeId, linkId) {
	if (nodeId) lastNodeSample = nodeId;
	if (linkId) lastLinkSample = linkId;
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
/**
 * Display a panel to show info about the selected edge or node
 */
function showNodeOrEdgeData() {
	hideNotes();
	if (network.getSelectedNodes().length == 1) showNodeData();
	else if (network.getSelectedEdges().length == 1) showEdgeData();
}
/**
 * Show the notes box, the fixed node check box and the node statistics
 */
function showNodeData() {
	let panel = elem('nodeDataPanel');
	let nodeId = network.getSelectedNodes()[0];
	let node = data.nodes.get(nodeId);
	elem('fixed').firstChild.className = node.fixed ? 'fas fa-lock' : 'fas fa-lock-open';
	elem('nodeLabel').innerHTML = node.label ? shorten(node.label) : '';
	if (node.created) {
		elem('nodeCreated').innerHTML = `${timeAndDate(node.created.time)} by ${node.created.user}`;
		elem('nodeCreation').style.display = 'flex';
	} else elem('nodeCreation').style.display = 'none';
	if (node.modified) {
		elem('nodeModified').innerHTML = `${timeAndDate(node.modified.time)} by ${node.modified.user}`;
		elem('nodeModification').style.display = 'flex';
	} else elem('nodeModification').style.display = 'none';
	elem('node-notes').className = 'notes';
	let editor = new Quill('#node-notes', {
		modules: {
			toolbar: [[{header: [1, 2, false]}], ['bold', 'italic', 'underline']],
		},
		placeholder: 'Notes',
		theme: 'bubble',
	});
	if (node.note) {
		if (node.note instanceof Object) editor.setContents(node.note);
		else editor.setText(node.note);
	} else editor.setText('');
	editor.on('text-change', () => {
		data.nodes.update({
			id: nodeId,
			note: isQuillEmpty(editor) ? '' : editor.getContents(),
			modified: timestamp(),
		});
	});
	panel.classList.remove('hide');
	displayStatistics(nodeId);
}
function isQuillEmpty(quill) {
	if ((quill.getContents()['ops'] || []).length !== 1) {
		return false;
	}
	return quill.getText().trim().length === 0;
}

function showEdgeData() {
	let panel = elem('edgeDataPanel');
	let edgeId = network.getSelectedEdges()[0];
	let edge = data.edges.get(edgeId);
	elem('edgeLabel').innerHTML = edge.label ? shorten(edge.label) : 'Link';
	if (edge.created) {
		elem('edgeCreated').innerHTML = `${timeAndDate(edge.created.time)} by ${edge.created.user}`;
		elem('edgeCreation').style.display = 'flex';
	} else elem('edgeCreation').style.display = 'none';
	if (edge.modified) {
		elem('edgeModified').innerHTML = `${timeAndDate(edge.modified.time)} by ${edge.modified.user}`;
		elem('edgeModification').style.display = 'flex';
	} else elem('edgeModification').style.display = 'none';
	let editor = new Quill('#edge-notes', {
		modules: {
			toolbar: [[{header: [1, 2, false]}], ['bold', 'italic', 'underline']],
		},
		placeholder: 'Notes',
		theme: 'bubble',
	});
	if (edge.note) {
		if (edge.note instanceof Object) editor.setContents(edge.note);
		else editor.setText(edge.note);
	} else editor.setText('');
	editor.on('text-change', () => {
		data.edges.update({
			id: edgeId,
			note: isQuillEmpty(editor) ? '' : editor.getContents(),
			modified: timestamp(),
		});
	});
	panel.classList.remove('hide');
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
	doSnapToGrid(snapToGridToggle);
	yNetMap.set('snapToGrid', snapToGridToggle);
}

function doSnapToGrid(toggle) {
	elem('snaptogridswitch').checked = toggle;
	if (toggle) {
		let positions = network.getPositions();
		data.nodes.update(
			data.nodes.get().map((n) => {
				n.x = positions[n.id].x;
				n.y = positions[n.id].y;
				snapToGrid(n);
				return n;
			})
		);
	}
}

function selectCurve(e) {
	let option = e.target.value;
	setCurve(option);
	yNetMap.set('curve', option);
}

function setCurve(option) {
	elem('curveSelect').value = option;
	network.setOptions({
		edges: {
			smooth: option === 'Curved',
		},
	});
}

function updateNetBack(color) {
	let ul = elem('underlay');
	ul.style.backgroundColor = color;
	// if in drawing mode, make the underlay translucent so that network shows through
	if (elem('toolbox').style.display == 'block') makeTranslucent(ul);
	yNetMap.set('background', color);
}

function makeTranslucent(el) {
	el.style.backgroundColor = getComputedStyle(el).backgroundColor.replace(')', ', 0.2)').replace('rgb', 'rgba');
}

function makeSolid(el) {
	el.style.backgroundColor = getComputedStyle(el).backgroundColor.replace(', 0.2)', ')').replace('rgba', 'rgb');
}
function setBackground(color) {
	elem('underlay').style.backgroundColor = color;
	if (elem('toolbox').style.display == 'block') makeTranslucent(elem('underlay'));
	elem('netBackColorWell').style.backgroundColor = color;
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
		changeCursor('default');
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
		data.nodes.update(node, 'dontBroadcast');
	});
}

function selectAllEdges() {
	network.selectEdges(network.body.edgeIndices);
	let selectedEdges = network.getSelectedEdges();
	selectedEdges.forEach((edgeId) => {
		let edge = data.edges.get(edgeId);
		edge.shadow = true;
		data.edges.update(edge, 'dontBroadcast');
	});
}

function legendSwitch(e) {
	let on = e.target.checked;
	setLegend(on, true);
	yNetMap.set('legend', on);
}
function setLegend(on, warn) {
	elem('showLegendSwitch').checked = on;
	if (on) legend(warn);
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
		if (!viewOnly) statusMsg(listFactors(network.getSelectedNodes()) + ' selected');
	}
	setRadioVal('hide', obj.hideSetting);
	setRadioVal('stream', obj.streamSetting);
}

function sizingSwitch(e) {
	let metric = e.target.value;
	sizing(metric);
	yNetMap.set('sizing', metric);
}
/**
 * set the size of the nodes proportional to the selected metric
	none, in degree out degree or betweenness centrality
 */
function sizing(metric) {
	let nodesToUpdate = [];
	data.nodes.forEach((node) => {
		node.scaling.label.enabled = true;
		switch (metric) {
			case 'Off':
				node.scaling.label.enabled = false;
				break;
			case 'Inputs':
				node.value = network.getConnectedNodes(node.id, 'from').length;
				break;
			case 'Outputs':
				node.value = network.getConnectedNodes(node.id, 'to').length;
				break;
			case 'Leverage': {
				let inDegree = network.getConnectedNodes(node.id, 'from').length;
				let outDegree = network.getConnectedNodes(node.id, 'to').length;
				node.value = inDegree == 0 ? 0 : outDegree / inDegree;
				break;
			}
			case 'Centrality':
				node.value = bc[node.id];
				break;
		}
		nodesToUpdate.push(node);
	});
	data.nodes.update(nodesToUpdate);
	elem('sizing').value = metric;
	network.fit();
	elem('zoom').value = network.getScale();
}
/* ---------------------------------------chat window --------------------------------*/

var emojiPicker = null;

function minimize() {
	if (emojiPicker) emojiPicker.destroyPicker();
	chatbox.classList.add('chatbox-hide');
	chatboxTab.classList.remove('chatbox-hide');
	chatboxTab.classList.remove('chatbox-blink');
}

function maximize() {
	chatboxTab.classList.add('chatbox-hide');
	chatboxTab.classList.remove('chatbox-blink');
	chatbox.classList.remove('chatbox-hide');
	const emojiButton = document.querySelector('#emoji-button');
	emojiPicker = new EmojiButton({
		rootElement: chatbox,
		zIndex: 1000,
	});
	emojiPicker.on('emoji', (selection) => {
		document.querySelector('#chat-input').value += selection.emoji;
	});
	emojiButton.addEventListener('click', () => {
		emojiPicker.togglePicker(emojiButton);
	});
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
			recipient: elem('chat-users').value,
			time: Date.now(),
			msg: inputMsg,
		},
	]);
	chatInput.value = '';
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
	let clock = Number.isInteger(msg.time) ? timeAndDate(msg.time) : '';
	if (msg.client == clientID) {
		// my own message
		chatMessages.innerHTML += `<div class="message-box-holder">
			<div class="message-header">
				<span class="message-time">${clock}</span>
			</div>
			<div class="message-box">
				${msg.msg}
			</div>
		</div>`;
	} else {
		// show only messages with no recipient (as from an old version), everyone or me
		if (msg.recipient == undefined || msg.recipient == '' || msg.recipient == myNameRec.name.replace(/\s+/g, '').toLowerCase()) {
			chatMessages.innerHTML += `<div class="message-box-holder">
			<div class="message-header">
				<span class="message-author">${msg.author}</span><span class="message-time">${clock}</span> 
			</div>
			<div class="message-box message-received">
				${msg.msg}
			</div>
		</div>`;
		}
	}
	chatMessages.scrollTop = chatMessages.scrollHeight;
}
/**
 * Returns a nicely formatted Date (or time if the date is today), given a Time value (from Date() )
 * @param {Integer} utc
 */
function timeAndDate(utc) {
	let time = new Date();
	time.setTime(utc);
	if (time.toDateString() == new Date().toDateString()) {
		return (
			'Today, ' +
			time.toLocaleString('en-GB', {
				hour: '2-digit',
				minute: '2-digit',
			})
		);
	} else {
		return time.toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		});
	}
}
function displayUserName() {
	chatNameBox.style.fontStyle = myNameRec.anon ? 'italic' : 'normal';
	chatNameBox.value = myNameRec.name;
}

/**
 * Create a set of options for the select menu of the currently online users
 * @param {Array} names - array of name records from yAwareness (see showAvatars)
 */
function populateChatUserMenu(names) {
	let options = '<option value="">Everyone</option>';
	names.forEach((nRec) => {
		options += `<option value=${nRec.name.replace(/\s+/g, '').toLowerCase()}>${nRec.name}</option>`
	});
	elem('chat-users').innerHTML=	options
}

dragElement(elem('chatbox-holder'), elem('chatbox-top'));


/* ---------------------------------------history window --------------------------------*/
/**
 * display the history log in a window
 */
function showHistory() {
	elem('history-window').style.display = 'block';
	let log = elem('history-log');
	log.innerHTML = yHistory
		.toArray()
		.map((rec) => formatLogRec(rec))
		.join(' ');
	log.scrollTop = log.scrollHeight;
}
/**
 * return a DOM element with the data in rec formatted
 * @param {Object} rec
 */
function formatLogRec(rec) {
	return `<div class="history-row">
				<div class="history-time">${timeAndDate(rec.time)}: </div>
				<div class="history-action">${rec.user} ${rec.action}</div>
			</div>`;
}
function showHistorySwitch() {
	if (elem('showHistorySwitch').checked) showHistory();
	else elem('history-window').style.display = 'none';
}
listen('history-close', 'click', historyClose);
function historyClose() {
	elem('history-window').style.display = 'none';
	elem('showHistorySwitch').checked = false;
}

dragElement(elem('history-window'), elem('history-header'));
window.showHistory = showHistory;
/* --------------------------------------- avatars and shared cursors--------------------------------*/

/**
 * Place a circle at the top left of the net pane to represent each user who is online
 * Also create a cursor (a div) for each of the users
 */

function showAvatars() {
	let recs = Array.from(yAwareness.getStates());
	let me = recs.splice(
		recs.findIndex((a) => a[0] === clientID),
		1
	); // remove myself
	let names = recs
		// eslint-disable-next-line no-unused-vars
		.map(([key, value]) => {
			if (value.user) return value.user;
		})
		.filter((e) => e) // remove any recs without a user record
		.filter((v, i, a) => a.findIndex((t) => t.name === v.name) === i) // remove duplicates
		.sort((a, b) => (a.name > b.name ? 1 : -1)); // sort names
	populateChatUserMenu(Array.from(names));
	names.unshift(me[0][1].user); // push myself on to the front

	let avatars = elem('avatars');
	let currentAvatars = [];
	let currentCursors = [];

	names.forEach((nameRec) => {
		let ava = elem('ava' + nameRec.id);
		let shortName = initials(nameRec.name);
		if (ava == null) {
			ava = document.createElement('div');
			ava.classList.add('hoverme');
			ava.id = 'ava' + nameRec.id;
			ava.dataset.tooltip = nameRec.name;
			let circle = document.createElement('div');
			circle.classList.add('round');
			circle.style.backgroundColor = nameRec.color;
			if (nameRec.anon) circle.style.borderColor = 'white';
			circle.innerText = shortName;
			circle.style.opacity = nameRec.asleep ? 0.2 : 1.0;
			ava.appendChild(circle);
			avatars.appendChild(ava);
		} else {
			ava.dataset.tooltip = nameRec.name;
			let circle = ava.firstChild;
			circle.style.backgroundColor = nameRec.color;
			if (nameRec.anon) circle.style.borderColor = 'white';
			circle.innerText = shortName;
			circle.style.opacity = nameRec.asleep ? 0.2 : 1.0;
		}
		currentAvatars.push(ava);

		if (nameRec.id != clientID) {
			// don't create a cursor for myself
			let cursorDiv = elem(nameRec.id);
			if (cursorDiv == null) {
				cursorDiv = document.createElement('div');
				cursorDiv.className = 'shared-cursor';
				cursorDiv.id = nameRec.id;
				cursorDiv.style.backgroundColor = nameRec.color;
				cursorDiv.innerText = shortName;
				cursorDiv.style.display = 'none';
				container.appendChild(cursorDiv);
			} else {
				if (nameRec.asleep) cursorDiv.style.display = 'none';
				if (cursorDiv.innerText != shortName) cursorDiv.innerText = shortName;
				if (cursorDiv.style.backgroundColor != nameRec.color) cursorDiv.style.backgroundColor = nameRec.color;
			}
			currentCursors.push(cursorDiv);
		}
	});
	// delete any avatars and cursors that remain from before
	let avatarsToDelete = Array.from(avatars.children).filter((a) => !currentAvatars.includes(a));
	avatarsToDelete.forEach((e) => e.remove());
	let cursorsToDelete = Array.from(document.querySelectorAll('.shared-cursor')).filter(
		(a) => !currentCursors.includes(a)
	);
	cursorsToDelete.forEach((e) => e.remove());
}

function showCursorSwitch() {
	let on = elem('showCursorSwitch').checked;
	document.querySelectorAll('div.shared-cursor').forEach((node) => {
		node.style.display = on ? 'block' : 'none';
	});
}
/* --------------------------------- Merge maps ----------------------------- */
/* to get the data in, open inspect windows for both maps.  in one window, eval data.nodes.get() and copy the result (not including any initial and trailing quote marks).
In the other window. evaluate n = <pasted list>.  Repeat for data.edges.get() and e = <pasted list>.  Then evaluate mergeMaps(n, e) in the other window.
*/

function openOtherDoc(room) {
	let bDoc = new Y.Doc();
	new WebsocketProvider(websocket, 'prsm' + room, bDoc);
	let bNodesMap = bDoc.getMap('nodes');
	let bEdgesMap = bDoc.getMap('edges');
	let bNodes = new DataSet();
	let bEdges = new DataSet();
	let data = {
		nodes: bNodes,
		edges: bEdges,
	};
	bNodesMap.observe((event) => {
		let nodesToUpdate = [];
		for (let key of event.keysChanged) {
			if (bNodesMap.has(key)) {
				let obj = bNodesMap.get(key);
				nodesToUpdate.push(obj);
			}
		}
		if (nodesToUpdate) bNodes.update(nodesToUpdate);
	});
	bEdgesMap.observe((event) => {
		let edgesToUpdate = [];
		for (let key of event.keysChanged) {
			if (bEdgesMap.has(key)) {
				let obj = bEdgesMap.get(key);
				edgesToUpdate.push(obj);
			}
		}
		bEdges.update(edgesToUpdate, origin);
	});
	return data;
}
window.openOtherDoc = openOtherDoc;

function mergeMaps(nodeList, edgeList) {
	// lists of edges from the map to be merged (B) into this one (A)
	let newNodes = new Map();
	nodeList.forEach((BNode) => {
		let ANode = data.nodes.get(BNode.id);
		if (ANode) {
			if (ANode.label != BNode.label) {
				console.log(`Existing factor label: \n${ANode.label} \ndoes not match new label: \n${BNode.label}`);
				// generate a new id for BNode.  change border to dashed.  add it to the map
				let newNode = deepCopy(BNode);
				newNode.id = uuidv4();
				newNode.shapeProperties.borderDashes = true;
				newNode.borderWidth = 4;
				newNode.borderWidthSelected = 4;
				newNode.color.border = '#ff0000';
				newNode.color.highlight.border = '#ff0000';
				newNode.x = ANode.x + 30;
				newNode.y = ANode.y + 30;
				data.nodes.add(newNode);
				newNodes.set(BNode.id, newNode.id);
			} else if (ANode.grp != BNode.grp)
				console.log(
					`Existing factor style: ${ANode.grp} does not match new style ${BNode.grp} for ${ANode.label}`
				);
		} else {
			data.nodes.add(BNode);
			console.log(`Added ${BNode.label}`);
		}
	});

	edgeList.forEach((BEdge) => {
		/* some edges on the B map may have been going to/from nodes that have been given a new id.  Edit these edges
	to give them the new from or to node ids and make them dashed. */
		let newEdge = null;
		if (newNodes.has(BEdge.from)) {
			newEdge = deepCopy(BEdge);
			newEdge.from = newNodes.get(BEdge.from);
			if (newNodes.has(newEdge.to)) newEdge.to = newNodes.get(newEdge.to);
		} else if (newNodes.has(BEdge.to)) {
			newEdge = deepCopy(BEdge);
			newEdge.to = newNodes.get(BEdge.to);
		}
		if (newEdge) {
			newEdge.dashes = true;
			data.edges.add(newEdge);
			console.log(
				`Added link for new factor(s): ${data.nodes.get(newEdge.from).label} to ${
					data.nodes.get(newEdge.to).label
				}`
			);
		}
		let AEdge = data.edges.get(BEdge.id);
		if (AEdge) {
			if (AEdge.label != BEdge.label)
				console.log(`Existing label: \n${AEdge.label} \ndoes not match new label: \n${BEdge.label}`);
			else if (AEdge.grp != BEdge.grp)
				console.log(`Existing style: ${AEdge.grp} does not match new style ${BEdge.grp} for edge ${AEdge.id}`);
		} else {
			data.edges.add(BEdge);
			console.log(`Added ${BEdge.id}`);
		}
	});
}
window.mergeMaps = mergeMaps;
