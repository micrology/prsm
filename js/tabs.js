// Add event listeners to tab buttons
document.getElementById("nodesButton").addEventListener("click", () => {
    openTab("nodesTab");
}, false);
document.getElementById("linksButton").addEventListener("click", () => {
    openTab("linksTab");
}, false);
document.getElementById("networkButton").addEventListener("click", () => {
    openTab("networkTab");
}, false);
// Clicking anywhere else clears the status bar (note trick: click is processed in the capturing phase)
document.getElementById("net-pane").addEventListener("click", () => {
    clearStatusBar();
}, true);


function openTab(tabId) {
    // Declare all variables
    var i, tabcontent, tablinks;

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
}
// Factors and Links Tabs

// samples

// Get all elements with class="sampleNode" and add listener and canvas
let emptyDataSet = new vis.DataSet([]);
let sampleElements, sampleFormat;
sampleElements = document.getElementsByClassName("sampleNode");
for (let i = 0; i < sampleElements.length; i++) {
	sampleElement = sampleElements[i];
    sampleElement.addEventListener("click", () => {applySampleToNode();}, false);
    sampleFormat = sampleFormats.find(({format}) => format === sampleElement.id);
	let nodeDataSet = new vis.DataSet([Object.assign({id:1, label: 'Sample'}, sampleFormat)])
    let sampleNetwork = initSample(sampleElement, {nodes: nodeDataSet, edges: emptyDataSet});
    sampleNetwork.on("doubleClick", function(params) {
        if (params.nodes.length === 1) {
            sampleNetwork.editNode();
        }
    });
}
// and to all sampleLinks
sampleElements = document.getElementsByClassName("sampleLink");
for (let i = 0; i < sampleElements.length; i++) {
	sampleElement = sampleElements[i];
    sampleElement.addEventListener("click", () => {applySampleToLink();}, false);
    sampleFormat = sampleFormats.find(({format}) => format === sampleElement.id);
	let edgeDataSet = new vis.DataSet([Object.assign({from: 1, to: 2}, sampleFormat)])
	let nodesDataSet = new vis.DataSet([{id:1}, {id:2}])
    initSample(sampleElement, {nodes: nodesDataSet, edges: edgeDataSet});
}

function initSample(wrapper, sampleData) {
	let options = {interaction: {
						dragNodes:false,
						dragView: false,
						selectable: true,
						zoomView: false},
					manipulation: {
						enabled: false,
						editNode: function(data, callback) {
							// filling in the popup DOM elements
							document.getElementById('node-operation').innerHTML = "Group name";
							editNode(data, cancelNodeEdit, callback);
							}
						},
					layout: {
						hierarchical: {
							enabled: true,
							direction: 'LR'
							}
						}
					};
	let network = new vis.Network(wrapper, sampleData, options);
	network.storePositions();
	wrapper.network = network;
	return network;
}

function applySampleToNode() {
    let target = event.currentTarget.id;
    let selectedNodeIds = network.getSelectedNodes();
    let sampleFormat = sampleFormats.find(({
        format
    }) => format === target);
    for (let e of data.nodes.get(selectedNodeIds)) {
        e = Object.assign(e, sampleFormat);
        data.nodes.update(e);
    }
    network.unselectAll();
    network.redraw();
    statusMsg("Factors "  + selectedNodeIds + ' changed');
}

function applySampleToLink() {
    let target = event.currentTarget.id;
    let selectedEdges = network.getSelectedEdges();
    let sampleFormat = sampleFormats.find(({
        format
    }) => format === target);
    for (let e of data.edges.get(selectedEdges)) {
        e = Object.assign(e, sampleFormat);
        data.edges.update(e);
    }
    network.unselectAll();
    network.redraw();
    statusMsg(selectedEdges + ' changed');
}


// Network tab

document.getElementById('autolayoutswitch').addEventListener('click', autoLayoutSwitch);

function autoLayoutSwitch(e) {
	network.setOptions({'physics': {'enabled': e.target.checked}});
}
																																																	
function selectLayout() {
	network.setOptions({layout: {hierarchical: document.getElementById('layoutSelect').value === 'Hierarchical'}});
}

function selectCurve() {
	network.setOptions({edges: {smooth: document.getElementById('curveSelect').value === 'Curved'}});
}
// start with first tab open
document.getElementById("networkButton").click();
		