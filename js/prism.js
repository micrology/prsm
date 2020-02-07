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
	getScaleFreeNetwork
}
from "./exampleUtil.js";

import {
	samples, setUpSamples, deepCopy
}
from "./samples.js";
	
import 'vis-network/dist/vis-network.min.css';

/* for esLint: */
/* global Modernizr */
/*
Remember to start the WS provider first:
	npx y-websocket-server
*/

const version = "0.93";

const GRIDSPACING = 100;

var network;
var room;
var nodes; 
var edges;
var data;
var clientID;
var yNodesMap;
var yEdgesMap;
var yUndoManager;
var panel;
var container;

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
	document.getElementById("net-pane").addEventListener("click", () => {
		clearStatusBar()
	}, true);
	document.getElementById("openFile").addEventListener("click", openFile);
	document.getElementById("saveFile").addEventListener("click", saveJSONfile);
	document.getElementById("panelToggle").addEventListener("click", togglePanel);
	document.getElementById("addNode").addEventListener("click", plusNode);
	document.getElementById("addLink").addEventListener("click", plusLink);
	document.getElementById("deleteNode").addEventListener("click", deleteNode);
	document.getElementById('undo').addEventListener('click', undo);
	document.getElementById('redo').addEventListener('click', redo);
	document.getElementById('fileInput').addEventListener('change', readSingleFile);
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
	document.getElementById('snaptogridswitch').addEventListener('click', snapToGridSwitch);
	document.getElementById('netBackColorWell').addEventListener('input', updateNetBack);
	document.getElementById('allFactors').addEventListener('click', selectAllFactors);
	document.getElementById('allEdges').addEventListener('click', selectAllEdges);
	document.getElementById('showLabelSwitch').addEventListener('click', labelSwitch);
	document.getElementById('layoutSelect').addEventListener('change', selectLayout);
	document.getElementById('curveSelect').addEventListener('change', selectCurve);
	document.getElementById('zoom').addEventListener('change', zoomnet);
	Array.from(document.getElementsByName("hide")).forEach((elem) => {
		elem.addEventListener('change', hideDistantOrStreamNodes)
	});
	Array.from(document.getElementsByName("stream")).forEach((elem) => {
		elem.addEventListener('change', hideDistantOrStreamNodes)
	});
	Array.from(document.getElementsByClassName("sampleNode")).forEach( (elem) =>
			elem.addEventListener("click", () => { applySampleToNode() }, false));
	Array.from(document.getElementsByClassName("sampleLink")).forEach( (elem) =>
			elem.addEventListener("click", () => { applySampleToLink() }, false));
}

function setUpPage() {
	container = document.getElementById("container");
	panel = document.getElementById("panel");
	panel.classList.add('hide');
	container.panelHidden = true;
	setUpSamples();
	hideNotes();
	document.getElementById('version').innerHTML = version;
}

function startY() {

	// create a new shared document and start the WebSocket provider

	// get the room number from the URL, or if none, generate a new one
	let url = new URL(document.location);
	room = url.searchParams.get('room');
	if (room == null) room = rndString(20);

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
	guarantee that the the ids of nodes will differ from the ids of edges 
	 */
	yNodesMap = doc.getMap('nodes');
	yEdgesMap = doc.getMap('edges');

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
	window.yUndoManager = yUndoManager;
	window.samples = samples;

	/* 
	nodes.on listens for when local nodes or edges are changed (added, updated or removed).
	If a local node is removed, the yMap is updated to broadcat to other clients that the node 
	has been deleted. If a local node is added or updated, that is also broadcast, with a 
	copy of the node, augmented with this client's ID, so that the originator can be identified.
	Nodes that are not originated locally are not broadcast (if they were, there would be a 
	feedback loop, with each client re-broadcasting everything it received)
	 */

	nodes.on('*', (event, properties, origin) => {
		console.log(new Date().toLocaleTimeString() + ': nodes.on: ' +
			event + JSON.stringify(properties.items) + 'origin: ' + origin);
		properties.items.forEach(id => {
			if (origin == null) {
				if (event == 'remove') {
					yNodesMap.delete(id.toString());
					console.log('deleted from YMapNodes: ' + id);
				} else {
					let obj = nodes.get(id);
					if (obj.clientID == undefined) obj.clientID = clientID;
					if (obj.clientID == clientID) {
						yNodesMap.set(id.toString(), obj);
						console.log(new Date().toLocaleTimeString() + ': added to YMapNodes: ' + JSON.stringify(obj));
					}
				}
			}
		})
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

	yUndoManager.on('stack-item-added', () => {
		undoButtonstatus();
		redoButtonStatus();
	});

	yUndoManager.on('stack-item-popped', () => {
		undoButtonstatus();
		redoButtonStatus();
	});

}

function rndString(length) {
	// generate a random string of length digits to use as the room number
	let str = "";
	for (let i = 0; i < length; i++) {
		str = str + (Math.random() * 10).toFixed().toString();
	}
	return str;
}

function getRandomData(nNodes) {
	// randomly create some nodes and edges
	let SFNdata = getScaleFreeNetwork(nNodes);
	nodes.add(SFNdata.nodes);
	edges.add(SFNdata.edges);
	recalculateStats();
}

// to handle iPad viewport sizing problem
window.onresize = function() {
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
			// default edge format is edge-
			edges: samples.edges.edge0,
			groups: samples.nodes,
			// default node format is group0
			nodes: {
				group: 'group0'
			},
			interaction: {
				multiselect: true,
				hover: true,
				zoomView: false
			},
			layout: {
				improvedLayout: (data.nodes.length < 150)
			},
			manipulation: {
				enabled: false,
				addNode: function(data, callback) {
					// filling in the popup DOM elements
					data.label = '';
					if (lastNodeSample) data.group = lastNodeSample;
					document.getElementById('node-operation').innerHTML = "Add Factor";
					editNode(data, clearNodePopUp, callback);
				},
				editNode: function(data, callback) {
					// filling in the popup DOM elements
					document.getElementById('node-operation').innerHTML = "Edit Factor Label";
					editNode(data, cancelNodeEdit, callback);
				},
				addEdge: function(data, callback) {
					inAddMode = false;
					changeCursor("auto");
					if (data.from == data.to) {
						let r = confirm(
							"Do you want to connect the Factor to itself?"
						);
						if (r != true) {
							callback(null);
							return;
						}
					}
					if (duplEdge(data.from, data.to).length > 0) {
						alert("There is already a link from this Factor to the other.")
						callback(null);
						return;
					}
					if (lastLinkSample) data = Object.assign(data, samples.edges[lastLinkSample]);
					callback(data);
				},
				editEdge: {
					editWithoutDrag: function(data, callback) {
						// filling in the popup DOM elements
						document.getElementById('node-operation').innerHTML = "Edit Link Label";
						editNode(data, cancelNodeEdit, callback);
						}
				},
				deleteNode: function(data, callback) {
					let r = confirm(deleteMsg(data));
					if (r != true) {
						callback(null);
						return;
					}
					callback(data);
				},
				deleteEdge: function(data, callback) {
					let r = confirm(deleteMsg(data));
					if (r != true) {
						callback(null);
						return;
					}
					callback(data);
				},
				controlNodeStyle: {
					shape: 'dot',
					color: 'red',
					group: 'group8'
				}
			},
			/* 
					physics: {
						forceAtlas2Based: {
							avoidOverlap: 0.2, 
							springConstant: 0.002
							}, 
						solver: 'forceAtlas2Based'
					}
			 */
		};

		network = new Network(netPane, data, options);
		network.storePositions();

		window.network = network;

		// start with factor tab open, but hidden
		document.getElementById("nodesButton").click();

		// listen for click events on the network pane
		network.on('click', function() {
			clearStatusBar()
		});
		network.on("doubleClick", function(params) {
			if (params.nodes.length === 1) {
				network.editNode();
				}
			else if (params.edges.length === 1) {
				network.editEdgeMode();
				} 
			else {
				network.fit();
				document.getElementById('zoom').value = network
					.getScale();
			}
		});
		network.on('selectNode', function() {
			statusMsg(listFactors(network.getSelectedNodes()) +
				' selected');
			displayNotes();
		});
		network.on('deselectNode', function() {
			hideNotes();
			clearStatusBar();
		});
		network.on('hoverNode', function() {
			changeCursor('grab');
		});
		network.on('blurNode', function() {
			changeCursor('default');
		});
		network.on('dragStart', function() {
			changeCursor('grabbing');
		});
		network.on('dragging', function() {
			changeCursor('grabbing');
		});
		network.on('dragEnd', function(event) {
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

function claim(item) {
	// remove any existing clientID, to show that I now
	// own this and can broadcast my changes to the item
	item.clientID = undefined;
}

function snapToGrid(node) {
	node.x = (GRIDSPACING) * Math.round(node.x / (GRIDSPACING));
	node.y = (GRIDSPACING) * Math.round(node.y / (GRIDSPACING));
}

function editNode(data, cancelAction, callback) {
	inAddMode = false;
	changeCursor('auto');
	let popUp = document.getElementById('node-popUp');
	document.getElementById('node-cancelButton').onclick =
		cancelAction.bind(this, callback);
	document.getElementById('node-saveButton').onclick =
		saveNodeData.bind(this, data, callback);
	popUp.style.display = 'block';
	// popup appears to the left of the mouse pointer
	popUp.style.top =
		`${event.clientY - popUp.offsetHeight / 2}px`;
	popUp.style.left =
		`${event.clientX - popUp.offsetWidth - 3}px`;
	document.getElementById('node-label').value = (data.label === undefined ? '' : data.label);
	document.getElementById('node-label').focus();
}

// Callback passed as parameter is ignored
function clearNodePopUp() {
	document.getElementById('node-saveButton').onclick = null;
	document.getElementById('node-cancelButton').onclick = null;
	document.getElementById('node-popUp').style.display = 'none';
}

function cancelNodeEdit(callback) {
	clearNodePopUp();
	callback(null);
}

function saveNodeData(data, callback) {
	data.label = document.getElementById('node-label').value;
	clearNodePopUp();
	if (data.label === "") {
		statusMsg("No label: cancelled");
		callback(null);
	} else callback(data);
}

function duplEdge(from, to) {
	// if there is already a link from the 'from' node to the 'to' node, return it
	return data.edges.get({
		filter: function(item) {
			return (item.from == from) && (item.to == to)
		}
	})
}

function deleteMsg(data) {
	//constructs a nice string to tell the user what nodes and links are being deleted.
	let nNodes = data.nodes.length;
	let nEdges = data.edges.length;
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

worker.onmessage = function(e) {
	bc = e.data;
}


/* show status messages at the bottom of the window */

function statusMsg(msg) {
	document.getElementById("statusBar").innerHTML = msg;
}

function clearStatusBar() {
	statusMsg("<br>");
}

function listFactors(factors) {
	// return a string listing the labels of the given nodes
	let str = 'Factor';
	if (factors.length > 1) str = str + 's';
	return str + ' ' + lf(factors);
}

function lf(factors) {
	// recursive fn to return a string of the node labels, separated by commas and 'and'
	let n = factors.length;
	let label = data.nodes.get(factors[0]).label
	if (n == 1) return label;
	factors.shift();
	if (n == 2) return label.concat(' and ' + lf(factors));
	return label.concat(', ' + lf(factors));
}

/* 
  -----------Operations related to the top button bar (not the side panel)-------------
 */

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
	reader.onloadend = function(e) {
		try {
			let json = JSON.parse(e.target.result);
			loadJSONfile(json);
			statusMsg("Read '" + fileName + "'");
		} catch (err) {
			statusMsg("Error reading '" + fileName + "': " + err
				.message);
			return;
		}
	};
	reader.readAsText(file);
}

function openFile() {
	document.getElementById('fileInput').click();
}


function loadJSONfile(json) {
	if (data.nodes.length > 0)
		if (!confirm(
				"Loading a file will delete the current network.  Are you sure you want to replace it?"
			)) return;
	unSelect();
	nodes.clear();
	edges.clear();
	let options = {
		edges: {
			inheritColors: false
		},
		nodes: {
			fixed: false,
			parseColor: true
		}
	};
	if (json.version && (version > json.version)) {
		statusMsg(
			"Warning: file was created in an earlier version of PRISM"
		);
	}
	if (json.lastNodeSample) lastNodeSample = json.lastNodeSample;
	if (json.lastLinkSample) lastLinkSample = json.lastLinkSample;
	if ('source' in json.edges[0]) {
		// the file is from Gephi and needs to be translated
		let parsed = parseGephiNetwork(json, options);
		nodes.add(clean(parsed.nodes));
		edges.add(clean(parsed.edges));
	} else {
		nodes.add(clean(json.nodes));
		edges.add(clean(json.edges));
	}
	data = {
		nodes: nodes,
		edges: edges
	};
	network.setOptions({
		interaction: {
			hideEdgesOnDrag: data.nodes.length > 100,
			hideEdgesOnZoom: data.nodes.length > 100
		}
	});
	/* TODO
		if (json.groups) {
			groups = json.groups;
			network.setOptions({groups: groups});
			}
	if (json.groupEdges) {
		groupEdges = json.groupEdges;
	}
		 */
	snapToGridOff();
	// in case parts of the previous network was hidden
	document.getElementById('hideAll').checked = true;
	document.getElementById('streamAll').checked = true;
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
		groups: network.groups.groups,
		sampleEdges: samples.edges,
		nodes: clean(data.nodes.get()),
		edges: clean(data.edges.get())
	});
	let element = document.getElementById("download");
	element.setAttribute('href', 'data:text/plain;charset=utf-8,' +
		encodeURIComponent(json));
	element.setAttribute('download', lastFileName);
	element.click();
}

function clean(items) {
	// return a copy of an array of objects, with some properties removed
	/*eslint no-unused-vars: ["error", { "ignoreRestSiblings": true }]*/
	return items.map(({
		clientID, color, ...keepAttrs
	}) => keepAttrs)
}

function plusNode() {
	statusMsg("Add Node mode");
	changeCursor("cell");
	inAddMode = true;
	network.addNodeMode();
}

function plusLink() {
	statusMsg("Add Edge mode");
	changeCursor("crosshair");
	inAddMode = true;
	network.addEdgeMode();
}

function deleteNode() {
	network.deleteSelected();
}

Network.prototype.zoom = function(scale) {
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
	network.zoom(document.getElementById("zoom").value);
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
btn.onclick = function() {
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
span.onclick = function() {
	modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
	if (event.target == modal) {
		modal.style.display = "none";
	}
}

document.getElementById('copy-text').addEventListener('click',
	function(e) {
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
	if (tabOpen == 'nodesTab') displayNotes();
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

// Notes

var lastSelectedNode;

function displayNotes() {
	let panel = document.getElementById("oneNodeSelected");
	let selectedNodes = network.getSelectedNodes();
	if (selectedNodes != lastSelectedNode) panel.classList.add('hide');
	if (tabOpen == 'nodesTab' && selectedNodes.length == 1) {
		let nodeId = selectedNodes[0];
		let node = data.nodes.get(nodeId);
		let label = (node.label ? node.label : node.hiddenLabel);
		document.getElementById("nodeLabel").innerHTML = (label ? label : "");
		let title = (node.title ? node.title : "");
		addNotesTA(title);
		panel.classList.remove('hide');
		displayStatistics(nodeId);
	} else {
		panel.classList.add('hide')
	}
}

function addNotesTA(str) {
	document.getElementById('notes').innerHTML =
		'<textarea class="notesTA" id="notesTA"</textarea>';
	let textarea = document.getElementById('notesTA');
	textarea.innerHTML = str.replace(/<\/br>/g, '\n');
	textarea.addEventListener('blur', updateNotes);
}

function updateNotes() {
	data.nodes.update({
		id: network.getSelectedNodes()[0],
		title: document.getElementById('notesTA').value.replace(/\n/g, '</br>'),
		clientID: undefined
	});
}

function hideNotes() {
	document.getElementById("oneNodeSelected").classList.add('hide')
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
				shakeTowards: 'leaves'
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
		function(n) {
			n.hiddenLabel = n.label;
			n.label = "";
			nodesToUpdate.push(n);
		}
	);
	data.nodes.update(nodesToUpdate);
}

function unHideLabels() {
	let nodesToUpdate = [];
	data.nodes.forEach(
		function(n) {
			if (n.hiddenLabel) n.label = n.hiddenLabel;
			n.hiddenLabel = undefined;
			nodesToUpdate.push(n);
		}
	);
	data.nodes.update(nodesToUpdate);
}

function getRadioVal(name) {
	// get list of radio buttons with specified name
	let radios = document.getElementsByName(name);
	// loop through list of radio buttons
	for (let i = 0, len = radios.length; i < len; i++) {
		if (radios[i].checked)
			return radios[i].value; // if so, hold its value in val
	}
}

// Performs intersection operation between called set and otherSet 
Set.prototype.intersection = function(otherSet) {
	let intersectionSet = new Set();
	for (var elem of otherSet)
		if (this.has(elem)) intersectionSet.add(elem);
	return intersectionSet;
}

function hideDistantOrStreamNodes() {
	// get the intersection of the nodes (and links) in radius and up or downstream,
	// and then hide everything not in that intersection

	let selectedNodes = network.getSelectedNodes();
	if (selectedNodes.length == 0) {
		statusMsg('Select a Factor first');
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

	let radius = getRadioVal('hide');
	if (radius == 'All') {
		data.nodes.forEach(node => nodeIdsInRadiusSet.add(node.id));
		data.edges.forEach(edge => linkIdsInRadiusSet.add(edge.id));
	} else inSet(selectedNodes, radius);

	// stream	
	let nodeIdsInStreamSet = new Set();
	let linkIdsInStreamSet = new Set();

	let stream = getRadioVal('stream');
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
		nodeIds.forEach(function(nId) {
			nodeIdsInRadiusSet.add(nId);
			let links = network.getConnectedEdges(nId);
			if (links && radius > 0) links.forEach(function(lId) {
				linkIdsInRadiusSet.add(lId);
			});
			let linked = network.getConnectedNodes(nId);
			if (linked) inSet(linked, radius - 1);
		})
	}

	function upstream(nodeIds) {
		// recursively add the nodes in and upstream of those in nodeIds
		if (nodeIds.length == 0) return;
		nodeIds.forEach(function(nId) {
			if (!nodeIdsInStreamSet.has(nId)) {
				nodeIdsInStreamSet.add(nId);
				let links = data.edges.get({
					filter: function(item) {
						return item.to == nId
					}
				});
				if (links) links.forEach(function(link) {
					linkIdsInStreamSet.add(link.id);
					upstream([link.from]);
				});
			}
		});
	}

	function downstream(nodeIds) {
		// recursively add the nodes in and downstream of those in nodeIds
		if (nodeIds.length == 0) return;
		nodeIds.forEach(function(nId) {
			if (!nodeIdsInStreamSet.has(nId)) {
				nodeIdsInStreamSet.add(nId);
				let links = data.edges.get({
					filter: function(item) {
						return item.from == nId
					}
				});
				if (links) links.forEach(function(link) {
					linkIdsInStreamSet.add(link.id);
					downstream([link.to]);
				});
			}
		});
	}
}