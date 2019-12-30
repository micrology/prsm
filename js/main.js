var version = 0.9;

var network = null;
var nodes = new vis.DataSet();
var edges = new vis.DataSet();
var data;

var lastNodeSample = null;
var lastLinkSample = null;
var inAddMode = false;

function getRandomData() {
    // randomly create some nodes and edges
    var SFNdata = getScaleFreeNetwork(25);
    nodes.add(SFNdata.nodes);
    edges.add(SFNdata.edges);
    data = {
        nodes: nodes,
        edges: edges
    };
};

function draw() {

    getRandomData();  // start with some random network

    // create a network
    var container = document.getElementById('net-pane');
    var options = {
        //configure: 'nodes,edges',
        physics: {
          stabilization: false
        },
        groups: groups,
        nodes: { group: 'group0' },
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
            controlNodeStyle: {shape: 'dot', color: 'black', group: 'group8'}
        }
    };
    
    network = new vis.Network(container, data, options);

    network.on("doubleClick", function(params) {
        if (params.nodes.length === 1) {
            network.editNode();
        } 
        else {
        	network.fit();
        	document.getElementById('zoom').value='fit';
        	}
    });
    network.on('selectNode', function() {
    	statusMsg('Factors ' + network.getSelectedNodes() + ' selected');
    	displayNotes();
    	});
    network.on('deselectNode',  function() {
    	hideNotes();
    	});
    network.on('hoverNode', function () {
		if (!inAddMode) changeCursor('grab');
	});
	network.on('blurNode', function () {
		changeCursor('default');
	});
	network.on('dragStart', function () {
		if (!inAddMode) changeCursor('grabbing');
	});
	network.on('dragging', function () {
		if (!inAddMode) changeCursor('grabbing');
	});
	network.on('dragEnd', function () {
		if (!inAddMode) changeCursor('grab');
	});	
	
	data.nodes.on('add', recalculateStats);
	data.nodes.on('remove', recalculateStats);
	data.edges.on('add', recalculateStats);
	data.edges.on('remove', recalculateStats);
	
}

function changeCursor(newCursorStyle){
	document.getElementById("net-pane").style.cursor = newCursorStyle;
	document.getElementById("navbar").style.cursor = newCursorStyle;
  }

function editNode(data, cancelAction, callback) {
	inAddMode = false;
	changeCursor('auto');
    document.getElementById('node-cancelButton').onclick = cancelAction.bind(this, callback);
    document.getElementById('node-saveButton').onclick = saveNodeData.bind(this, data, callback);
    document.getElementById('node-popUp').style.top = `${event.clientY}px`;
    document.getElementById('node-popUp').style.left = `${event.clientX}px`;
    document.getElementById('node-popUp').style.display = 'block';
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

function init() {
    draw();
}

/* 
var myWorker = new Worker('worker.js');
first.onchange = function() {
  myWorker.postMessage([first.value,second.value]);
  console.log('Message posted to worker');
}

second.onchange = function() {
  myWorker.postMessage([first.value,second.value]);
  console.log('Message posted to worker');
}
onmessage = function(e) {
  console.log('Message received from main script');
  var workerResult = 'Result: ' + (e.data[0] * e.data[1]);
  console.log('Posting message back to main script');
  postMessage(workerResult);
}
myWorker.onmessage = function(e) {
  result.textContent = e.data;
  console.log('Message received from worker');
}
 */


function statusMsg(msg) {
    document.getElementById("statusBar").innerHTML = msg;
}

function clearStatusBar() {
    statusMsg("<br>");
}

