/* 
The main entry point for PRISM.  
Sets up the data structures for the netwok.
 */
"use strict";


var version = 0.9;

var network = null;
var nodes = new vis.DataSet();
var edges = new vis.DataSet();
var data = {
	nodes: nodes,
	edges: edges
};

var lastNodeSample = null;
var lastLinkSample = null;
var inAddMode = false; // true when adding a new Factor to the network; used to choose cursor pointer

function getRandomData(nNodes) {
	// randomly create some nodes and edges
	var SFNdata = getScaleFreeNetwork(nNodes);
	nodes.add(SFNdata.nodes);
	edges.add(SFNdata.edges);
	recalculateStats();
};

function draw() {

	// for testing, append #XXX to the URL of the page, where XXX is the number
	// of factors to include in a random network
	let nNodes = window.location.hash.substr(1);
	if (nNodes) getRandomData(nNodes); // start with some random network

	// create a network
	var container = document.getElementById('net-pane');
	var options = {
		physics: {
			enabled: false,
			stabilization: false
		},
		edges: {
			color: {
				color: 'black'
			}
		},
		groups: groups,
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
				document.getElementById('node-operation').innerHTML = "Edit Factor";
				editNode(data, cancelNodeEdit, callback);
			},
			addEdge: function(data, callback) {
				inAddMode = false;
				changeCursor("auto");
				if (data.from == data.to) {
					var r = confirm("Do you want to connect the Factor to itself?");
					if (r != true) {
						callback(null);
						return;
					}
				}
				if (lastLinkSample) data = Object.assign(data, groupEdges[lastLinkSample]);
				callback(data);
			},
			editEdge: {
				editWithoutDrag: function(data, callback) {
					document.getElementById('edge-operation').innerHTML = "Edit Edge";
					editEdgeWithoutDrag(data, callback);
				}
			},
			deleteNode: function(data, callback) {
				var r = confirm(`Confirm deletion of ${data.nodes.length} nodes and ${data.edges.length} edges?`);
				if (r != true) {
					callback(null);
					return;
				}
				callback(data);
			},
			controlNodeStyle: {
				shape: 'dot',
				color: 'black',
				group: 'group8'
			}
		}
	};

	network = new vis.Network(container, data, options);

	// listen for click events on the network pane
	network.on("doubleClick", function(params) {
		if (params.nodes.length === 1) {
			network.editNode();
		} else {
			network.fit();
			document.getElementById('zoom').value = 'fit';
		}
	});
	network.on('selectNode', function() {
		statusMsg(listFactors(network.getSelectedNodes()) + ' selected');
		displayNotes();
	});
	network.on('deselectNode', function() {
		hideNotes();
		clearStatusBar();
	});
	network.on('hoverNode', function() {
		if (!inAddMode) changeCursor('grab');
	});
	network.on('blurNode', function() {
		changeCursor('default');
	});
	network.on('dragStart', function() {
		if (!inAddMode) changeCursor('grabbing');
	});
	network.on('dragging', function() {
		if (!inAddMode) changeCursor('grabbing');
	});
	network.on('dragEnd', function() {
		if (!inAddMode) changeCursor('grab');
	});

	// listen for changes to the network structure
	data.nodes.on('add', recalculateStats);
	data.nodes.on('remove', recalculateStats);
	data.edges.on('add', recalculateStats);
	data.edges.on('remove', recalculateStats);

}

function changeCursor(newCursorStyle) {
	document.getElementById("net-pane").style.cursor = newCursorStyle;
	document.getElementById("navbar").style.cursor = newCursorStyle;
}

function editNode(data, cancelAction, callback) {
	inAddMode = false;
	changeCursor('auto');
	let popUp = document.getElementById('node-popUp');
	document.getElementById('node-cancelButton').onclick = cancelAction.bind(this, callback);
	document.getElementById('node-saveButton').onclick = saveNodeData.bind(this, data, callback);
	popUp.style.top = `${event.clientY - popUp.offsetHeight / 2}px`;
	popUp.style.left = `${event.clientX - popUp.offsetWidth - 3}px`;
	popUp.style.display = 'block';
	document.getElementById('node-label').value = data.label;
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
		document.getElementById("statusBar").innerHTML = "No label: cancelled";
		callback(null);
	} else callback(data);
}

/* Not currently used

function editEdgeWithoutDrag(data, callback) {
    // filling in the popup DOM elements
    document.getElementById('edge-label').value = data.label;
    document.getElementById('edge-saveButton').onclick = saveEdgeData.bind(this, data, callback);
    document.getElementById('edge-cancelButton').onclick = cancelEdgeEdit.bind(this, callback);
    document.getElementById('edge-popUp').style.display = 'block';
}

function clearEdgePopUp() {
    document.getElementById('edge-saveButton').onclick = null;
    document.getElementById('edge-cancelButton').onclick = null;
    document.getElementById('edge-popUp').style.display = 'none';
}

function cancelEdgeEdit(callback) {
    clearEdgePopUp();
    callback(null);
}

function saveEdgeData(data, callback) {
    if (typeof data.to === 'object')
        data.to = data.to.id
    if (typeof data.from === 'object')
        data.from = data.from.id
    data.label = document.getElementById('edge-label').value;
    clearEdgePopUp();
    callback(data);
}
 */

function init() {
	draw();
}

var worker = new Worker('./js/betweenness.js');
var bc = [];

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

function listFactors(nodes) {
	// return a string listing the labels of the given nodes
	let str = 'Factor';
	if (nodes.length > 1) str = str + 's';
	return str + ' ' + lf(nodes);
}

function lf(nodes) {
	// return a string of the node labels, separated by commas and 'and'
	let n = nodes.length;
	let label = data.nodes.get(nodes[0]).label
	if (n == 1) return label;
	nodes.shift();
	if (n == 2) return label.concat(' and ' + lf(nodes));
	return label.concat(', ' + lf(nodes));
}

function clearStatusBar() {
	statusMsg("<br>");
}

// Clicking anywhere other than on the tabs clears the status bar 
// (note trick: click is processed in the capturing phase)
document.getElementById("net-pane").addEventListener("click", () => {
	clearStatusBar();
}, true);
