/* 
The main entry point for PRISM.  
 */
import * as Y from 'yjs';
import {
	WebsocketProvider
}
from 'y-websocket';

import {
	Network,
	parseGephiNetwork
}
from "vis-network/peer/esm/vis-network";

import {
	DataSet
}
from "vis-data";

import {
	getScaleFreeNetwork, clean, cleanArray
}
from "./utils.js";

import * as parser from 'fast-xml-parser';

import {
	samples, setUpSamples, deepCopy, reApplySampleToLinks
}
from "./samples.js";

import 'vis-network/dist/vis-network.min.css';

/* for esLint: */
/* global Modernizr */
/*
Remember to start the WS provider first:
	npx y-websocket-server
*/

const version = "0.97";

const GRIDSPACING = 100;

var network;
var room;
var nodes;
var edges;
var data;
var clientID;
var yNodesMap;
var yEdgesMap;
var ySamplesMap;
var yUndoManager;
var panel;
var container;
var buttonStatus;

var lastNodeSample = null;
var lastLinkSample = null;
var inAddMode = false; // true when adding a new Factor to the network; used to choose cursor pointer
var snapToGridToggle = false;


window.addEventListener('load', () => {
	checkFeatures();
	addEventListeners();
	setUpPage();
	startY();
	draw();
	setTimeout(fit, 500);  // need to wait until the canvas draw has been completed
});

function checkFeatures() {
	if (!(Modernizr.borderradius &&
			Modernizr.boxsizing &&
			Modernizr.flexbox &&
			Modernizr.boxshadow &&
			Modernizr.opacity &&
			Modernizr.canvas &&
			Modernizr.fileinput &&
			Modernizr.eventlistener &&
			Modernizr.webworkers &&
			Modernizr.json &&
			Modernizr.canvastext)) {
		alert(
			"Your browser does not support all the features required.  Try an up-to-date copy of Edge, Chrome or Safari");
	}
}


function addEventListeners() {
	// Clicking anywhere on the network canvas clears the status bar 
	// (note trick: click is processed in the capturing phase)
/* 
	document.getElementById("net-pane").addEventListener("click", () => {
		clearStatusBar()
	}, true);
 */
	document.getElementById("addNode").addEventListener("click", plusNode);
	document.getElementById("addLink").addEventListener("click", plusLink);
	document.getElementById("deleteNode").addEventListener("click", deleteNode);
	document.getElementById('undo').addEventListener('click', undo);
	document.getElementById('redo').addEventListener('click', redo);
	document.getElementById('fileInput').addEventListener('change', readSingleFile);
	document.getElementById("openFile").addEventListener("click", openFile);
	document.getElementById("saveFile").addEventListener("click", saveJSONfile);
	document.getElementById("exportCVS").addEventListener("click", exportCVS);
	document.getElementById("exportGML").addEventListener("click", exportGML);
	document.getElementById("panelToggle").addEventListener("click", togglePanel);
	document.getElementById('zoom').addEventListener('change', zoomnet);
	document.getElementById('zoomminus').addEventListener('click', () => {
		zoomincr(-0.1)
	});
	document.getElementById('zoomplus').addEventListener('click', () => {
		zoomincr(0.1)
	});
	document.getElementById("nodesButton").addEventListener("click", () => {
		openTab("nodesTab")
	});
	document.getElementById("linksButton").addEventListener("click", () => {
		openTab("linksTab")
	});
	document.getElementById("networkButton").addEventListener("click", () => {
		openTab("networkTab")
	});
	document.getElementById('autolayoutswitch').addEventListener('click', autoLayoutSwitch);
	document.getElementById('antiGravity').addEventListener('change', setGravity);	
	document.getElementById('snaptogridswitch').addEventListener('click', snapToGridSwitch);
	document.getElementById('netBackColorWell').addEventListener('input', updateNetBack);
	document.getElementById('allFactors').addEventListener('click', selectAllFactors);
	document.getElementById('allEdges').addEventListener('click', selectAllEdges);
	document.getElementById('showLabelSwitch').addEventListener('click', labelSwitch);
	document.getElementById('layoutSelect').addEventListener('change', selectLayout);
	document.getElementById('curveSelect').addEventListener('change', selectCurve);
	document.getElementById('fixed').addEventListener('click', setFixed);
	Array.from(document.getElementsByName("hide")).forEach((elem) => {
		elem.addEventListener('change', hideDistantOrStreamNodes)
	});
	Array.from(document.getElementsByName("stream")).forEach((elem) => {
		elem.addEventListener('change', hideDistantOrStreamNodes)
	});
	document.getElementById('sizing').addEventListener('change', sizing);
	Array.from(document.getElementsByClassName("sampleNode")).forEach((elem) =>
		elem.addEventListener("click", () => {
			applySampleToNode()
		}, false));
	Array.from(document.getElementsByClassName("sampleLink")).forEach((elem) =>
		elem.addEventListener("click", () => {
			applySampleToLink()
		}, false));
}

function setUpPage() {
	container = document.getElementById("container");
	panel = document.getElementById("panel");
	panel.classList.add('hide');
	container.panelHidden = true;
	setUpSamples();
	hideNotes();
	document.getElementById('version').innerHTML = version;
	storeButtonStatus();
}

function startY() {

	// create a new shared document and start the WebSocket provider

	// get the room number from the URL, or if none, generate a new one
	let url = new URL(document.location);
	room = url.searchParams.get('room');
	if (room == null) room = generateRoom();

	const doc = new Y.Doc();
	const wsProvider = new WebsocketProvider('ws://35.177.28.97:1234',
		'prism' + room, doc);
	wsProvider.on('status', event => {
		console.log(new Date().toLocaleTimeString() + ': ' +
				event.status + (event.status == 'connected' ? ' to' : ' from') + ' room ' +
				room) // logs "connected" or "disconnected"
	});

	/* 
	create a yMap for the nodes and one for the edges (we need two because there is no 
	guarantee that the the ids of nodes will differ from the ids of edges) 
	 */
	yNodesMap = doc.getMap('nodes');
	yEdgesMap = doc.getMap('edges');
	ySamplesMap = doc.getMap('samples');

	// get an existing or generate a new clientID, used to identify nodes and edges created by this client
	if (localStorage.getItem('clientID'))
		clientID = localStorage.getItem('clientID')
	else {
		clientID = doc.clientID;
		localStorage.setItem('clientID', clientID);
	}
	console.log('My client ID: ' + clientID);

	/* set up the undomanagers */
	yUndoManager = new Y.UndoManager([yNodesMap, yEdgesMap]);

	nodes = new DataSet();
	edges = new DataSet();
	data = {
		nodes: nodes,
		edges: edges
	};

	/* 
	for convenience when debugging
	 */
	window.data = data;
	window.clientID = clientID;
	window.yNodesMap = yNodesMap;
	window.yEdgesMap = yEdgesMap;
	window.ySamplesMap = ySamplesMap;
	window.yUndoManager = yUndoManager;
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
/* 
		console.log(new Date().toLocaleTimeString() + ': nodes.on: ' +
			event + JSON.stringify(properties.items) + 'origin: ' + origin);
 */
		properties.items.forEach(id => {
			if (origin == null) {
				if (event == 'remove') {
					yNodesMap.delete(id.toString());
				} else {
					let obj = nodes.get(id);
					if (obj.clientID == undefined) obj.clientID = clientID;
					if (obj.clientID == clientID) {
						yNodesMap.set(id.toString(), obj);
/* 
						console.log(new Date().toLocaleTimeString() +
							': added to YMapNodes: ' + JSON.stringify(obj));
 */
					}
				}
			}
		});
	});

	/* 
	yNodesMap.observe listens for changes in the yMap, reciving a set of the keys that have
	had changed values.  If the change was to delete an entry, the corresponding node is
	removed from the local nodes dataSet. Otherwise, the local node dataSet is updated (which 
	includes adding a new node if it does not already exist locally).
	 */

	yNodesMap.observe((event) => {
		//		console.log(event);
		for (let key of event.keysChanged) {
			if (yNodesMap.has(key)) {
				let obj = yNodesMap.get(key);
				let origin = event.transaction.origin;
				if (obj.clientID != clientID || origin != null) {
					nodes.remove(obj, origin);
					nodes.add(obj, origin);
				}
			} else nodes.remove(key);
		}
	});

	/* 
	See comments above about nodes
	 */
	edges.on('*', (event, properties, origin) => {
		properties.items.forEach(id => {
			if (origin == null) {
				if (event == 'remove') yEdgesMap.delete(id.toString())
				else {
					let obj = edges.get(id);
					if (obj.clientID == undefined) obj.clientID = clientID;
					if (obj.clientID == clientID) yEdgesMap.set(id.toString(), obj);
				}
			}
		})
	});

	yEdgesMap.observe((event) => {
		for (let key of event.keysChanged) {
			if (yEdgesMap.has(key)) {
				let obj = yEdgesMap.get(key);
				let origin = event.transaction.origin;
				if (obj.clientID != clientID || origin != null) {
					edges.remove(obj, origin);
					edges.add(obj, origin);
				}
			} else edges.remove(key);
		}
	});
	
	ySamplesMap.observe((event) => {
//		console.log(event);
		for (let key of event.keysChanged) {
			let sample = ySamplesMap.get(key);
			let origin = event.transaction.origin;
			if (sample.clientID != clientID || origin != null) {
				if (sample.node != undefined) {
					samples.nodes[key] = sample.node;
					refreshSampleNodes();
					network.setOptions({groups: samples.nodes});
					}
				else {
					samples.edges[key] = sample.edge;
					refreshSampleLinks();
					reApplySampleToLinks(key);
					}
				}
			}
		});

	yUndoManager.on('stack-item-added', (event) => {
		saveButtonStatus(event);
		undoButtonstatus();
		redoButtonStatus();
	});

	yUndoManager.on('stack-item-popped', (event) => {
		setButtonStatus(event);
		undoButtonstatus();
		redoButtonStatus();
	});

}

function generateRoom() {
	let room = '';
	for (let i = 0; i < 4; i++) {
		for (let j = 0; j < 3; j++) {
 			room += String.fromCharCode(65+ Math.floor(Math.random() * 26));
			}
		if (i < 3) room += '-';
		}
	 return room;
}

function getRandomData(nNodes) {
	// randomly create some nodes and edges
	let SFNdata = getScaleFreeNetwork(nNodes);
	nodes.add(SFNdata.nodes);
	edges.add(SFNdata.edges);
	recalculateStats();
}

// to handle iPad viewport sizing problem
window.onresize = function () {
	document.body.height = window.innerHeight;
}
window.onresize(); // called to initially set the height.

function draw() {

		// for testing, you can append ?t=XXX to the URL of the page, where XXX is the number
		// of factors to include in a random network
		let url = new URL(document.location);
		let nNodes = url.searchParams.get('t');
		if (nNodes) getRandomData(nNodes);

		// create a network
		var netPane = document.getElementById('net-pane');
		var options = {
			physics: {
				enabled: false,
				stabilization: false
			},
			// default edge format is edge0
			edges: clean(samples.edges.edge0, {
				groupLabel: null
			}),
			groups: samples.nodes,
			// default node format is group0
			nodes: {
				group: 'group0'
			},
			interaction: {
				multiselect: true,
				selectConnectedEdges: false,
				hover: true,
				zoomView: false,
				tooltipDelay: 0
			},
			layout: {
				improvedLayout: (data.nodes.length < 150)
			},
			manipulation: {
				enabled: false,
				addNode: function (item, callback) {
					// filling in the popup DOM elements
					item.label = '';
					if (lastNodeSample) item.group = lastNodeSample;
					document.getElementById('node-operation').innerHTML = "Add Factor";
					editLabel(item, clearPopUp, callback);
					showPressed('addNode', 'remove');
				},
				editNode: function (item, callback) {
					// for some weird reason, vis-network copies the group properties into the 
					// node properties before calling this fn, which we don't want.  So we
					// revert to using the original node properties before continuing.
					item = data.nodes.get(item.id);
					// filling in the popup DOM elements
					document.getElementById('node-operation').innerHTML = "Edit Factor Label";
					editLabel(item, cancelEdit, callback);
				},
				addEdge: function (item, callback) {
					inAddMode = false;
					changeCursor("auto");
					if (item.from == item.to) {
						let r = confirm(
							"Do you want to connect the Factor to itself?"
						);
						if (r != true) {
							callback(null);
							return;
						}
					}
					if (duplEdge(item.from, item.to).length > 0) {
						alert("There is already a link from this Factor to the other.")
						callback(null);
						return;
					}
					if (lastLinkSample) item = Object.assign(item, samples.edges[lastLinkSample]);
					showPressed('addLink', 'remove');
					callback(item);
				},
				editEdge: {
					editWithoutDrag: function (item, callback) {
						// filling in the popup DOM elements
						document.getElementById('node-operation').innerHTML = "Edit Link Label";
						editLabel(item, cancelEdit, callback);
					}
				},
				deleteNode: function (item, callback) {
					let r = confirm(deleteMsg(item));
					if (r != true) {
						callback(null);
						return;
					}
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
					group: undefined
				}
			},
		};

		network = new Network(netPane, data, options);
		window.network = network;

		// start with factor tab open, but hidden
		document.getElementById("nodesButton").click();

		// listen for click events on the network pane
		network.on("doubleClick", function (params) {
			if (params.nodes.length === 1) {
				network.editNode();
			} else if (params.edges.length === 1) {
				network.editEdgeMode();
			} else {
				fit();
			}
		});
		network.on('selectNode', function () {
			statusMsg(listFactors(network.getSelectedNodes()) +
				' selected');
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
			statusMsg(listLinks(network.getSelectedEdges()) +
				' selected');
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
		network.on('dragging', function () {
			changeCursor('grabbing');
		});
		network.on('dragEnd', function (event) {
			let newPositions = network.getPositions(event.nodes);
			data.nodes.update(
				data.nodes.get(event.nodes).map(n => {
					n.x = newPositions[n.id].x;
					n.y = newPositions[n.id].y;
					if (snapToGridToggle) snapToGrid(n);
					claim(n);
					return n;
				})
			);
			changeCursor('grab');
		});

		// listen for changes to the network structure
		// and recalculate the network statistics when there is one
		data.nodes.on('add', recalculateStats);
		data.nodes.on('remove', recalculateStats);
		data.edges.on('add', recalculateStats);
		data.edges.on('remove', recalculateStats);

	} // end draw()

function fit() {
	network.fit();
	document.getElementById('zoom').value = network.getScale();
	network.storePositions();
}
				
function claim(item) {
	// remove any existing clientID, to show that I now
	// own this and can broadcast my changes to the item
	item.clientID = undefined;
}

function snapToGrid(node) {
	node.x = (GRIDSPACING) * Math.round(node.x / (GRIDSPACING));
	node.y = (GRIDSPACING) * Math.round(node.y / (GRIDSPACING));
}

function editLabel(item, cancelAction, callback) {
	inAddMode = false;
	changeCursor('auto');
	let popUp = document.getElementById('node-popUp');
	document.getElementById('node-cancelButton').onclick =
		cancelAction.bind(this, callback);
	document.getElementById('node-saveButton').onclick =
		saveLabel.bind(this, item, callback);
	document.getElementById('node-label').value = (item.label === undefined ? '' : item.label);
	popUp.style.display = 'block';
	// popup appears to the left of the mouse pointer
	popUp.style.top =
		`${event.clientY - (popUp.offsetHeight / 2) - popUp.offsetParent.offsetTop}px`;
	let left = event.clientX - popUp.offsetWidth - 3;
	popUp.style.left = `${(left < 0 ? 0 : left)}px`;
	document.getElementById('node-label').focus();
}

// Callback passed as parameter is ignored
function clearPopUp() {
	document.getElementById('node-saveButton').onclick = null;
	document.getElementById('node-cancelButton').onclick = null;
	document.getElementById('node-popUp').style.display = 'none';
}

function cancelEdit(callback) {
	clearPopUp();
	callback(null);
}

function saveLabel(item, callback) {
	item.label = document.getElementById('node-label').value;
	clearPopUp();
	if (item.label === "") {
		// if there is no label and it is an edge, blank the label, else cancel
		// (nodes must have a label)
		if ('from' in item) item.label = ' ';
		else {
			statusMsg("No label: cancelled", 'warn');
			callback(null);
		}
	}
	callback(item);
}

function duplEdge(from, to) {
	// if there is already a link from the 'from' node to the 'to' node, return it
	return data.edges.get({
		filter: function (item) {
			return (item.from == from) && (item.to == to)
		}
	})
}

function deleteMsg(item) {
	//constructs a nice string to tell the user what nodes and links are being deleted.
	let nNodes = item.nodes.length;
	let nEdges = item.edges.length;
	let msg = 'Delete ';
	if (nNodes > 0) msg = msg + nNodes + ' Factor' + (nNodes == 1 ?
		"" : "s");
	if (nNodes > 0 && nEdges > 0) msg = msg + ' and ';
	if (nEdges > 0) msg = msg + nEdges + ' Link' + (nEdges == 1 ? "" : "s");
	return msg + '?';
}

function changeCursor(newCursorStyle) {
	if (inAddMode) return;
	document.getElementById("net-pane").style.cursor = newCursorStyle;
	document.getElementById("navbar").style.cursor = newCursorStyle;
}

function unSelect() {
	/* unselect all nodes and edges */
	hideNotes();
	network.unselectAll();
}

// set  up a web worker to calculate network statistics in parallel with whatever
// the user is doing

var worker = new Worker('./js/betweenness.js');
var bc; //caches the betweenness centralities

function recalculateStats() {
	worker.postMessage([nodes.get(), edges.get()]);
}

worker.onmessage = function (e) {
	bc = e.data;
}


/* show status messages at the bottom of the window */

function statusMsg(msg, status) {
	let elem = document.getElementById("statusBar");
	switch(status) {
	case 'warn': elem.style.backgroundColor = 'yellow'; break;
	case 'error': elem.style.backgroundColor = 'red'; break;
	default: elem.style.backgroundColor = 'white'; break;
	}
	elem.innerHTML = htmlEntities(msg);
}

function htmlEntities(str) {
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&quot;');
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
		let label = "'" + data.nodes.get(factors[0]).label + "'";
		if (n == 1) return label;
		factors.shift();
		if (n == 2) return label.concat(' and ' + lf(factors));
		return label.concat(', ' + lf(factors));
	}
}

function listLinks(links) {
	// return a string listing the number of Links
	if (links.length > 1) return links.length + ' links';
	return '1 link';
}

/* zoom slider */

Network.prototype.zoom = function (scale) {
	let newScale = (scale === undefined ? 1 : scale);
	const animationOptions = {
		scale: newScale,
		animation: {
			duration: 300
		}
	};
	this.view.moveTo(animationOptions);
};

function zoomnet() {
	network.zoom(Number(document.getElementById("zoom").value));
}

function zoomincr(incr) {
	let newScale = Number(document.getElementById("zoom").value) + incr;
	if (newScale > 4) newScale = 4;
	if (newScale <= 0) newScale = 0.1;
	document.getElementById("zoom").value = newScale;
	network.zoom(newScale);
}


/* 
  -----------Operations related to the top button bar (not the side panel)-------------
 */


function plusNode() {
	if (inAddMode) {
		showPressed('addNode', 'remove');
		stopEdit();
		return;
		}
	changeCursor("cell");
	inAddMode = true;
	showPressed('addNode', 'add');
	network.addNodeMode();
}

function plusLink() {
	if (inAddMode) {
		showPressed('addLink', 'remove');
		stopEdit();
		return;
		}
	changeCursor("crosshair");
	inAddMode = true;
	showPressed('addLink', 'add');
	network.addEdgeMode();
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
	yUndoManager.redo()
}

function undoButtonstatus() {
	if (yUndoManager.undoStack.length == 0)
		document.getElementById('undo').classList.add('disabled');
	else document.getElementById('undo').classList.remove('disabled');
}

function redoButtonStatus() {
	if (yUndoManager.redoStack.length == 0)
		document.getElementById('redo').classList.add('disabled');
	else document.getElementById('redo').classList.remove('disabled');
}

function deleteNode() {
	network.deleteSelected();
}

var lastFileName = 'network.json'; // the name of the file last read in

function readSingleFile(e) {
	var file = e.target.files[0];
	if (!file) {
		return;
	}
	let fileName = file.name;
	lastFileName = fileName;
	statusMsg("Reading '" + fileName + "'");
	e.target.value = '';
	var reader = new FileReader();
	reader.onloadend = function (e) {
		try {
			loadFile(e.target.result);
			statusMsg("Read '" + fileName + "'");
		} catch (err) {
			statusMsg("Error reading '" + fileName + "': " + err.message, 'error');
			return;
		}
	};
	reader.readAsText(file);
}

function openFile() {
	document.getElementById('fileInput').click();
}

function loadFile(contents) {
	if (data.nodes.length > 0)
		if (!confirm(
				"Loading a file will delete the current network.  Are you sure you want to replace it?"
			)) return;
	unSelect();
	nodes.clear();
	edges.clear();

	if (contents.search('graphml') >= 0) data = parseGraphML(contents);
	else {
		if (contents.search('graph') >= 0) data = parseGML(contents);
		else data = loadJSONfile(contents);
	}
	network.setOptions({
		interaction: {
			hideEdgesOnDrag: data.nodes.length > 100,
			hideEdgesOnZoom: data.nodes.length > 100
		}
	});
	snapToGridOff();
	// in case parts of the previous network was hidden
	document.getElementById('hideAll').checked = true;
	document.getElementById('streamAll').checked = true;
	fit();
}

function loadJSONfile(json) {
	json = JSON.parse(json);
	if (json.version && (version > json.version)) {
		statusMsg("Warning: file was created in an earlier version", 'warn');
	}
	if (json.lastNodeSample) lastNodeSample = json.lastNodeSample;
	if (json.lastLinkSample) lastLinkSample = json.lastLinkSample;
	if ('source' in json.edges[0]) {
		// the file is from Gephi and needs to be translated
		let parsed = parseGephiNetwork(json, {
			edges: {
				inheritColors: false
			},
			nodes: {
				fixed: false,
				parseColor: true
			}
		});
		nodes.add(cleanArray(parsed.nodes, {
			clientID: null,
			color: null
		}));
		edges.add(cleanArray(parsed.edges, {
			clientID: null,
			color: null
		}));
	} else {
		nodes.add(cleanArray(json.nodes, {
			clientID: null
		}));
		edges.add(cleanArray(json.edges, {
			clientID: null
		}));
	}
	if (json.samples) {
		samples.nodes = json.samples.nodes;
		samples.edges = json.samples.edges;
		network.setOptions({
			edges: clean(samples.edges.edge0, {
				groupLabel: null
			}),
			groups: samples.nodes,
			nodes: {
				group: 'group0'
			}
		})
		refreshSampleNodes();
		refreshSampleLinks();
		for (let groupId in samples.nodes) {
			ySamplesMap.set(groupId, {node: samples.nodes[groupId], clientID: clientID});
			}
		for (let edgeId in samples.edges) {
			ySamplesMap.set(edgeId, {edge: samples.edges[edgeId], clientID: clientID});
			}
	}
	return {
		nodes: nodes,
		edges: edges
	}
}

function parseGraphML(graphML) {
	let options = {
		attributeNamePrefix: "",
		attrNodeName: "attr",
		textNodeName: "txt",
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
			message: result.err.msg + "(line " + result.err.line + ")"
		};
	}
	let jsonObj = parser.parse(graphML, options);
	nodes.add(jsonObj.graphml.graph.node.map((n) => {
		return {
			id: n.attr.id,
			label: getLabel(n.data)
		}
	}));
	edges.add(jsonObj.graphml.graph.edge.map((e) => {
		return {
			id: e.attr.id,
			from: e.attr.source,
			to: e.attr.target
		}
	}));
	return {
		nodes: nodes,
		edges: edges
	};

	function getLabel(arr) {
		for (let at of arr) {
			if (at.attr.key == "label") return at.txt
		}
	}
}

function parseGML(gml) {
	let tokens = gml.match(/\S+/g);
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
					node.id = tokens.shift();
					break;
				case 'label':
					node.label = tokens.shift().replace(/"/g, '');
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
					edge.id = tokens.shift();
					break;
				case 'source':
					edge.to = tokens.shift();
					break;
				case 'target':
					edge.from = tokens.shift();
					break;
				case 'label':
					edge.label = tokens.shift().replace(/"/g, '');
					break;
				default:
					break;
				}
				tok = tokens.shift(); // ]
			}
			if (edge.id == undefined) edge.id = edgeId++;
			edges.add(edge);
			break;
		default:
			break;
		}
		tok = tokens.shift();
	}
	return {
		nodes: nodes,
		edges: edges
	}
}

function refreshSampleNodes() {
	let sampleElements = Array.from(document.getElementsByClassName('sampleNode'));
	for (let i = 0; i < sampleElements.length; i++) {
		let groupId = 'group' + i;
		sampleElements[i].net.setOptions({
			groups: {
				[groupId]: samples.nodes[groupId]
			}
		});
		sampleElements[i].net.redraw()
	}
}

function refreshSampleLinks() {
	let sampleElements = Array.from(document.getElementsByClassName('sampleLink'));
	for (let i = 0; i < sampleElements.length; i++) {
		let edge = sampleElements[i].dataSet.get()[0];
		edge = Object.assign(edge, samples.edges['edge' + i]);
		edge.label = edge.groupLabel;
		sampleElements[i].dataSet.remove(edge);
		sampleElements[i].dataSet.add(edge);
	}
}

/* 
Browser will only ask for name and location of the file to be saved if
it has a user setting to do so.  Otherwise, it is saved at a default
download location with a default name.
 */

function saveJSONfile() {
	network.storePositions();
	let json = JSON.stringify({
		saved: new Date(Date.now()).toLocaleString(),
		version: version,
		lastNodeSample: lastNodeSample,
		lastLinkSample: lastLinkSample,
		samples: samples,
		nodes: cleanArray(data.nodes.get(), {
			clientId: null,
			color: null
		}),
		edges: cleanArray(data.edges.get(), {
			clientId: null
		})
	});
	saveStr(json, 'json');
}

function saveStr(str, extn) {
	let element = document.getElementById("download");
	element.setAttribute('href', 'data:text/plain;charset=utf-8,' +
		encodeURIComponent(str));
	let pos = lastFileName.indexOf(".");
	lastFileName = lastFileName.substr(0, pos < 0 ? lastFileName.length : pos) + '.' + extn;
	element.setAttribute('download', lastFileName);
	element.click();
}

function exportCVS () {
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
	let str = 'Creator "PRISM ' + version + ' on ' + new Date(Date.now()).toLocaleString() 
		+ '"\ngraph\n[\n\tdirected 1\n';
	for (let node of data.nodes.get()) {
		str += '\tnode\n\t[\n\t\tid ' + node.id;
		if (node.label) str += '\n\t\tlabel "' + node.label + '"';
		str += '\n\t]\n';
		}
	for (let edge of data.edges.get()) {
		str += '\tedge\n\t[\n\t\tsource ' + edge.from;
		str += '\n\t\ttarget ' + edge.to;
		if (edge.label) str += '\n\t\tlabel "' + edge.label + '"';
		str += '\n\t]\n';
		}
	str += '\n]';
	saveStr(str, 'gml');	
}

/* Share modal dialog */

// Get the modal
var modal = document.getElementById("shareModal");

// Get the button that opens the modal
var btn = document.getElementById("share");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// Get the input element to be filled with the link
var inputElem = document.getElementById('text-to-copy');

// And the place to say that the link has been copied to the clipboard
var copiedText = document.getElementById('copied-text');

// When the user clicks the button, open the modal 
btn.onclick = function () {
	let linkToShare = window.location.origin + window.location
		.pathname + '?room=' + room;
	copiedText.style.display = 'none';
	modal.style.display = "block";
	inputElem.setAttribute('size', linkToShare.length);
	inputElem.value = linkToShare;
	inputElem.select();
	network.storePositions();
}

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
	modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
	if (event.target == modal) {
		modal.style.display = "none";
	}
}

document.getElementById('copy-text').addEventListener('click',
	function (e) {
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


function togglePanel() {
	// Hide/unhide the side panel
	if (container.panelHidden) {
		container.style.gridTemplateColumns = "5fr minmax(210px, 1fr)";
		panel.classList.remove('hide');
	} else {
		panel.classList.add('hide');
		container.style.gridTemplateColumns = "1fr 0px";
	}
	container.panelHidden = !container.panelHidden;
}


/* ---------operations related to the side panel -------------------------------------*/

// Panel

var tabOpen = null;

function openTab(tabId) {
	let i, tabcontent, tablinks;

	// Get all elements with class="tabcontent" and hide them by moving them off screen
	tabcontent = document.getElementsByClassName("tabcontent");
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].classList.add('hide');
	}

	// Get all elements with class="tablinks" and remove the class "active"
	tablinks = document.getElementsByClassName("tablinks");
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(" active", "");
	}

	// Show the current tab, and add an "active" class to the button that opened the tab
	document.getElementById(tabId).classList.remove('hide');
	event.currentTarget.className += " active";

	tabOpen = tabId;
	if (tabOpen == 'nodesTab') showNodeData();
	if (tabOpen == 'linksTab') showEdgeData();
}

function storeButtonStatus() {
	buttonStatus = {
		autoLayout: document.getElementById('autolayoutswitch').checked,
		snapToGrid: document.getElementById('snaptogridswitch').checked,
		layout: document.getElementById('layoutSelect').value,
		curve: document.getElementById('curveSelect').value,
		linkRadius: getRadioVal('hide'),
		stream: getRadioVal('stream'),
		showLabels: document.getElementById('showLabelSwitch').value,
		sizing: document.getElementById('sizing').value
	};
}

function saveButtonStatus(event) {
	event.stackItem.meta.set('buttons', buttonStatus);
	storeButtonStatus();
}

function setButtonStatus(event) {
	let settings;
	if (event.type == "undo")
		settings = yUndoManager.undoStack[yUndoManager.undoStack.length - 1].meta.get('buttons');
	else settings = event.stackItem.meta.get('buttons');
	document.getElementById('autolayoutswitch').checked = settings.autoLayout;
	document.getElementById('snaptogridswitch').checked = settings.snapToGrid;
	document.getElementById('layoutSelect').value = settings.layout;
	document.getElementById('curveSelect').checked = settings.curve;
	document.getElementById('autolayoutswitch').checked = settings.autoLayout;
	setRadioVal('hide', settings.linkRadius);
	setRadioVal('stream', settings.stream);
	document.getElementById('showLabelSwitch').value = settings.showLabels;
	document.getElementById('sizing').value = settings.sizing;
}

// Factors and Links Tabs

function applySampleToNode() {
	let selectedNodeIds = network.getSelectedNodes();
	if (selectedNodeIds.length == 0) return;
	let nodesToUpdate = [];
	let sample = event.currentTarget.group;
	for (let node of data.nodes.get(selectedNodeIds)) {
		node.group = sample;
		claim(node);
		nodesToUpdate.push(node);
	}
	data.nodes.update(nodesToUpdate);
	lastNodeSample = sample;
}

function applySampleToLink() {
	let sample = event.currentTarget.groupLink;
	let selectedEdges = network.getSelectedEdges();
	if (selectedEdges.length == 0) return;
	let edgesToUpdate = [];
	for (let edge of data.edges.get(selectedEdges)) {
		edge = Object.assign(edge, deepCopy(samples.edges[sample]));
		edge.group = sample;
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
  	}
  else {
  	node.fixed = false;
  	data.nodes.update(node);
  	}
}

// Notes

function showNodeData() {
	let panel = document.getElementById("nodeDataPanel");
	let selectedNodes = network.getSelectedNodes();
	if (tabOpen == 'nodesTab' && selectedNodes.length == 1) {
		let nodeId = selectedNodes[0];
		let node = data.nodes.get(nodeId);
		document.getElementById('fixed').checked = (node.fixed ? true: false);
		document.getElementById("nodeLabel").innerHTML = (node.label ? node.label : "");
		document.getElementById('nodeNotes').innerHTML = '<textarea class="notesTA" id="nodesTA"</textarea>';
		let textarea = document.getElementById('nodesTA');
		let title = (node.title ? node.title : "");
		textarea.innerHTML = title.replace(/<\/br>/g, '\n');
		textarea.addEventListener('blur', updateNodeNotes);
		panel.classList.remove('hide');
		displayStatistics(nodeId);
	} else {
		panel.classList.add('hide')
	}
}

function updateNodeNotes() {
	data.nodes.update({
		id: network.getSelectedNodes()[0],
		title: document.getElementById('nodesTA').value.replace(/\n/g, '</br>'),
		clientID: undefined
	});
}

function showEdgeData() {
	let panel = document.getElementById("edgeDataPanel");
	let selectedEdges = network.getSelectedEdges();
	if (tabOpen == 'linksTab' && selectedEdges.length == 1) {
		let edgeId = selectedEdges[0];
		let edge = data.edges.get(edgeId);
		document.getElementById("edgeLabel").innerHTML = (edge.label ? edge.label : "");
		document.getElementById('edgeNotes').innerHTML = '<textarea class="notesTA" id="edgesTA"</textarea>';
		let textarea = document.getElementById('edgesTA');
		let title = (edge.title ? edge.title : "");
		textarea.innerHTML = title.replace(/<\/br>/g, '\n');
		textarea.addEventListener('blur', updateEdgeNotes);
		panel.classList.remove('hide');
	} else {
		panel.classList.add('hide')
	}
}

function updateEdgeNotes() {
	data.edges.update({
		id: network.getSelectedEdges()[0],
		title: document.getElementById('edgesTA').value.replace(/\n/g, '</br>'),
		clientID: undefined
	});
}
function hideNotes() {
	document.getElementById("nodeDataPanel").classList.add('hide')
	document.getElementById("edgeDataPanel").classList.add('hide')
}

// Statistics specific to a node

function displayStatistics(nodeId) {

	// leverage (outDegree / inDegree)
	let inDegree = network.getConnectedNodes(nodeId, 'from').length;
	let outDegree = network.getConnectedNodes(nodeId, 'to').length;
	let leverage = (inDegree == 0) ? '--' : (outDegree / inDegree).toPrecision(3);
	document.getElementById('leverage').textContent = leverage;

	document.getElementById('bc').textContent =
		(bc[nodeId] >= 0 ? (bc[nodeId]).toPrecision(3) : '--');
}


// Network tab

function autoLayoutSwitch(e) {
	let switchOn = e.target.checked;
	if (switchOn && snapToGridToggle) snapToGridOff(); // no snapping with auto layout.
	network.storePositions(); // record current positions so it can be undone
	network.setOptions({
		physics: {
			enabled: switchOn
		}
	});
}

function autoLayoutOff() {
	document.getElementById('autolayoutswitch').checked = false;
	network.setOptions({
		physics: {
			enabled: false
		}
	});
}

function setGravity() {
	let gravity = -(Number(document.getElementById("antiGravity").value));
	network.setOptions({physics: {barnesHut: {gravitationalConstant: gravity}}});
}

function snapToGridSwitch(e) {
	snapToGridToggle = e.target.checked;
	if (snapToGridToggle) {
		autoLayoutOff();
		let positions = network.getPositions();
		data.nodes.update(
			data.nodes.get().map(n => {
				n.x = positions[n.id].x;
				n.y = positions[n.id].y;
				snapToGrid(n);
				claim(n);
				return n;
			})
		);
	}
}

function snapToGridOff() {
	document.getElementById('snaptogridswitch').checked = false;
	snapToGridToggle = false;
}

function selectLayout() {
	let layout = {
		hierarchical: {
			enabled: false
		}
	};
	if (document.getElementById('layoutSelect').value === 'Hierarchical')
		layout = {
			hierarchical: {
				enabled: true,
				sortMethod: 'directed',
				shakeTowards: 'leaves',
				levelSeparation: 50
			}
		};
	network.setOptions({
		layout: layout,
		physics: {
			enabled: true,
			stabilization: true
		}
	});
	// allow the physics module to re-arrange the nodes and then turn it off again
	network.once('stabilized', () => {
		network.setOptions({
			physics: {
				enabled: false,
				stabilization: false
			}
		})
	})

}

function selectCurve() {
	network.setOptions({
		edges: {
			smooth: document.getElementById('curveSelect').value === 'Curved'
		}
	});
}

function updateNetBack(event) {
	document.getElementById('underlay').style.backgroundColor = event.target.value;
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
		unHideLabels()
	}
}

function hideLabels() {
	// move the label to the hiddenLabel property and set the label to an empty string
	let nodesToUpdate = [];
	data.nodes.forEach(
		function (n) {
			n.hiddenLabel = n.label;
			n.label = "";
			nodesToUpdate.push(n);
		}
	);
	data.nodes.update(nodesToUpdate);

	let edgesToUpdate = [];
	data.edges.forEach(
		function (n) {
			n.hiddenLabel = n.label;
			n.label = "";
			edgesToUpdate.push(n);
		}
	);
	data.edges.remove(edgesToUpdate);
	data.edges.add(edgesToUpdate);
}

function unHideLabels() {
	let nodesToUpdate = [];
	data.nodes.forEach(
		function (n) {
			if (n.hiddenLabel) n.label = n.hiddenLabel;
			n.hiddenLabel = undefined;
			nodesToUpdate.push(n);
		}
	);
	data.nodes.update(nodesToUpdate);

	let edgesToUpdate = [];
	data.edges.forEach(
		function (n) {
			if (n.hiddenLabel) n.label = n.hiddenLabel;
			n.hiddenLabel = undefined;
			edgesToUpdate.push(n);
		}
	);
	data.edges.remove(edgesToUpdate);
	data.edges.add(edgesToUpdate);
}

function getRadioVal(name) {
	// get list of radio buttons with specified name
	let radios = document.getElementsByName(name);
	// loop through list of radio buttons
	for (let i = 0, len = radios.length; i < len; i++) {
		if (radios[i].checked)
			return radios[i].value;
	}
}

function setRadioVal(name, value) {
		// get list of radio buttons with specified name
		let radios = document.getElementsByName(name);
		// loop through list of radio buttons
		for (let i = 0, len = radios.length; i < len; i++) {
			radios[i].checked = (radios[i].value == value)
		}
	}
	
function hideDistantOrStreamNodes() {
	// get the intersection of the nodes (and links) in radius and up or downstream,
	// and then hide everything not in that intersection

	let radius = getRadioVal('hide');
	let stream = getRadioVal('stream');
	
	let selectedNodes = network.getSelectedNodes();
	if (selectedNodes.length == 0 && !(radius == 'All' && stream == 'All')) {
		statusMsg('Select a Factor first', 'error');
		// unhide everything
		document.getElementById('hideAll').checked = true;
		document.getElementById('streamAll').checked = true;
		data.nodes.update(data.nodes.map((node) => {
			node.hidden = false;
			return node
		}))
		data.edges.update(data.edges.map((edge) => {
			edge.hidden = false;
			return edge
		}))
		return;
	}

	// radius
	let nodeIdsInRadiusSet = new Set();
	let linkIdsInRadiusSet = new Set();

	if (radius == 'All') {
		data.nodes.forEach(node => nodeIdsInRadiusSet.add(node.id));
		data.edges.forEach(edge => linkIdsInRadiusSet.add(edge.id));
	} else inSet(selectedNodes, radius);

	// stream	
	let nodeIdsInStreamSet = new Set();
	let linkIdsInStreamSet = new Set();

	if (stream == undefined) return;
	if (stream == 'All') {
		data.nodes.forEach(node => nodeIdsInStreamSet.add(node.id));
		data.edges.forEach(edge => linkIdsInStreamSet.add(edge.id));
	} else {
		if (stream == 'upstream') upstream(selectedNodes);
		else downstream(selectedNodes);
	}

	//intersection
	let nodesToShow = nodeIdsInRadiusSet.intersection(nodeIdsInStreamSet);
	let linksToShow = linkIdsInRadiusSet.intersection(linkIdsInStreamSet);

	// update the network
	data.nodes.update(data.nodes.map((node) => {
		node.hidden = !nodesToShow.has(node.id);
		return node
	}))
	data.edges.update(data.edges.map((edge) => {
		edge.hidden = !linksToShow.has(edge.id);
		return edge
	}))

	function inSet(nodeIds, radius) {
		// recursive function to collect nodes within radius links from any
		// of the nodes listed in nodeIds
		if (radius < 0) return;
		nodeIds.forEach(function (nId) {
			nodeIdsInRadiusSet.add(nId);
			let links = network.getConnectedEdges(nId);
			if (links && radius > 0) links.forEach(function (lId) {
				linkIdsInRadiusSet.add(lId);
			});
			let linked = network.getConnectedNodes(nId);
			if (linked) inSet(linked, radius - 1);
		})
	}

	function upstream(nodeIds) {
		// recursively add the nodes in and upstream of those in nodeIds
		if (nodeIds.length == 0) return;
		nodeIds.forEach(function (nId) {
			if (!nodeIdsInStreamSet.has(nId)) {
				nodeIdsInStreamSet.add(nId);
				let links = data.edges.get({
					filter: function (item) {
						return item.to == nId
					}
				});
				if (links) links.forEach(function (link) {
					linkIdsInStreamSet.add(link.id);
					upstream([link.from]);
				});
			}
		});
	}

	function downstream(nodeIds) {
		// recursively add the nodes in and downstream of those in nodeIds
		if (nodeIds.length == 0) return;
		nodeIds.forEach(function (nId) {
			if (!nodeIdsInStreamSet.has(nId)) {
				nodeIdsInStreamSet.add(nId);
				let links = data.edges.get({
					filter: function (item) {
						return item.from == nId
					}
				});
				if (links) links.forEach(function (link) {
					linkIdsInStreamSet.add(link.id);
					downstream([link.to]);
				});
			}
		});
	}
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
		case 'Leverage':
			{
				let inDegree = network.getConnectedNodes(node.id, 'from').length;
				let outDegree = network.getConnectedNodes(node.id, 'to').length;
				node.value = (inDegree == 0) ? 0 : (outDegree / inDegree);
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