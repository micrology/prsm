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
document.getElementById("container").addEventListener("click", () => {
    clearStatusBar();
}, true);


function openTab(tabId) {
    // Declare all variables
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabId).style.display = "block";
    event.currentTarget.className += " active";
}
// Factors and Links Tabs

// samples

// Get all elements with class="sampleNode" and add listener and canvas
let emptyDataSet = new vis.DataSet([]);
let sampleElements = document.getElementsByClassName("sampleNode");
for (let i = 0; i < sampleElements.length; i++) {
	sampleElement = sampleElements[i];
    sampleElement.addEventListener("click", () => {applySampleToNode();}, false);
   let sampleFormat = sampleFormats.find(({format}) => format === sampleElement.id);
	let nodeDataSet = new vis.DataSet([Object.assign({id:1, label: 'Sample'}, sampleFormat)])
   initSample(sampleElement, {nodes: nodeDataSet, edges: emptyDataSet});
}
// and to all sampleLinks
samples = document.getElementsByClassName("sampleLink");
for (let i = 0; i < samples.length; i++) {
    samples[i].addEventListener("click", () => {
        applySampleToLink();
    }, false);
}

var network1;

function initSample(wrapper, sampleData) {
	let options = {interaction: {
						dragNodes:false,
						dragView: false,
						selectable: false,
						zoomView: false}};
	let network = new vis.Network(wrapper, sampleData, options);
	network1 = network;
	network1.storePositions();
	console.log(network1.body.data.nodes.get()[0].format)
	console.log(network1.body.data.nodes.get()[0].x)
	console.log(network1.body.data.nodes.get()[0].y)	
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
    statusMsg("Clicked " + target);
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
document.getElementById("nodesButton").click();
		