var version = 0.9;

var network = null;
var nodes = new vis.DataSet();
var edges = new vis.DataSet();
var data;

var lastNodeSample = null;
var lastLinkSample = null;

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

    // create a network
    var container = document.getElementById('net-pane');
    var options = {
        //configure: 'nodes,edges',
        //physics: { enabled: false },
        groups: groups,
        nodes: { group: 'group0' },
        interaction: {
            multiselect: true,
            hover: true,
            zoomView: false
        },
        layout: {
        	improvedLayout:true
        },
        manipulation: {
            enabled: false,
            addNode: function(data, callback) {
                // filling in the popup DOM elements
                data.label = '';
                data.group = lastNodeSample;
                document.getElementById('node-operation').innerHTML = "Add Factor";
                editNode(data, clearNodePopUp, callback);
            },
            editNode: function(data, callback) {
                // filling in the popup DOM elements
                document.getElementById('node-operation').innerHTML = "Edit Factor";
                editNode(data, cancelNodeEdit, callback);
            },
            addEdge: function(data, callback) {
				changeCursor("auto");
                if (data.from == data.to) {
                    var r = confirm("Do you want to connect the Factor to itself?");
                    if (r != true) {
                        callback(null);
                        return;
                    }
                }
//                 document.getElementById('edge-operation').innerHTML = "Add Edge";
//                 editEdgeWithoutDrag(data, callback);
					data = Object.assign(data, groupEdges[lastLinkSample]);
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
            }
        }
    };
    
    getRandomData();  // start with some random network
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
	changeCursor('grab');
	});
	network.on('blurNode', function () {
	changeCursor('default');
	});
	network.on('dragStart', function () {
	changeCursor('grabbing');
	});
	network.on('dragging', function () {
	changeCursor('grabbing');
	});
	network.on('dragEnd', function () {
	changeCursor('grab');
	});	

}

function changeCursor(newCursorStyle){
	document.getElementById("net-pane").style.cursor = newCursorStyle;
  }

function editNode(data, cancelAction, callback) {
	changeCursor('auto');
    document.getElementById('node-saveButton').onclick = saveNodeData.bind(this, data, callback);
    document.getElementById('node-cancelButton').onclick = cancelAction.bind(this, callback);
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

function statusMsg(msg) {
    document.getElementById("statusBar").innerHTML = msg;
}

function clearStatusBar() {
    statusMsg("<br>");
}

