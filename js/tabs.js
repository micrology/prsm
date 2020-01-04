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

var tabOpen = null;

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

	tabOpen = tabId;
	if (tabOpen == 'nodesTab') displayNotes();
}
// Factors and Links Tabs

// samples

// Get all elements with class="sampleNode" and add listener and canvas
let emptyDataSet = new vis.DataSet([]);
let sampleElements, sampleFormat;
sampleElements = document.getElementsByClassName("sampleNode");
for (let i = 0; i < sampleElements.length; i++) {
	sampleElement = sampleElements[i];
	sampleElement.addEventListener("click", () => {
		applySampleToNode();
	}, false);
	let nodeDataSet = new vis.DataSet([{
		id: 1,
		label: 'Sample',
		group: 'group' + i
	}]);
	let sampleNetwork = initSample(sampleElement, {
		nodes: nodeDataSet,
		edges: emptyDataSet
	});
	sampleNetwork.on("doubleClick", function(params) {
		if (params.nodes.length === 1) {
			sampleNetwork.editNode();
		}
	});
	sampleElement.group = 'group' + i;
}
// and to all sampleLinks
sampleElements = document.getElementsByClassName("sampleLink");
for (let i = 0; i < sampleElements.length; i++) {
	sampleElement = sampleElements[i];
	sampleElement.addEventListener("click", () => {
		applySampleToLink();
	}, false);
	let edgeDataSet = new vis.DataSet([Object.assign({
		from: 1,
		to: 2,
		value: 7
	}, groupEdges['edge' + i])])
	let nodesDataSet = new vis.DataSet([{
		id: 1
	}, {
		id: 2
	}])
	initSample(sampleElement, {
		nodes: nodesDataSet,
		edges: edgeDataSet
	});
	sampleElement.groupLink = 'edge' + i;
}

function initSample(wrapper, sampleData) {
	let options = {
		interaction: {
			dragNodes: false,
			dragView: false,
			selectable: true,
			zoomView: false
		},
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
		},
		groups: groups
	};
	let network = new vis.Network(wrapper, sampleData, options);
	network.storePositions();
	wrapper.network = network;
	return network;
}

function applySampleToNode() {
	let selectedNodeIds = network.getSelectedNodes();
	if (selectedNodeIds.length == 0) return;
	let nodesToUpdate = [];
	for (let node of data.nodes.get(selectedNodeIds)) {
		node.group = event.currentTarget.group;
		nodesToUpdate.push(node);
	}
	data.nodes.update(nodesToUpdate);
	network.unselectAll();
	hideNotes();
	lastNodeSample = event.currentTarget.group;
}

function applySampleToLink() {
	let selectedEdges = network.getSelectedEdges();
	if (selectedEdges.length == 0) return;
	let edgesToUpdate = [];
	for (let edge of data.edges.get(selectedEdges)) {
		edge = Object.assign(edge, groupEdges[event.currentTarget.groupLink]);
		edgesToUpdate.push(edge);
	}
	data.edges.update(edgesToUpdate);
	network.unselectAll();
	hideNotes();
	lastLinkSample = event.currentTarget.groupLink;
}

// Notes

document.getElementById('notes').addEventListener('click', addEditor);

var editor = null;

function addEditor() {
	editor = new nicEditor({
		buttonList: ['bold', 'italic', 'underline'],
		iconsPath: 'js/nicEdit/nicEditorIcons.gif',
		maxHeight: '30px'
	}).panelInstance('notes', {
		hasPanel: true
	});
	editor.addEvent('blur', removeEditor);
}

function removeEditor() {
	if (editor.nicInstances.length > 0) {
		let title = stripTags(editor.nicInstances[0].getContent(), "<b><i><div><font>");
		let nodeId = network.getSelectedNodes()[0];
		data.nodes.update({
			id: nodeId,
			title: title
		});

		editor.removeInstance('notes');
	}
}

function stripTags(input, allowed) {

	// making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
	allowed = (((allowed || '') + '').toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join('')

	var tags = /<\/?([a-z0-9]*)\b[^>]*>?/gi
	var commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi

	var after = input
	// removes tha '<' char at the end of the string to replicate PHP's behaviour
	after = (after.substring(after.length - 1) === '<') ? after.substring(0, after.length - 1) : after

	// recursively remove tags to ensure that the returned string doesn't contain forbidden tags after previous passes (e.g. '<<bait/>switch/>')
	while (true) {
		var before = after
		after = before.replace(commentsAndPhpTags, '').replace(tags, function($0, $1) {
			return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : ''
		})

		// return once no more tags are removed
		if (before === after) {
			return after
		}
	}
}

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
		let title = node.title;
		document.getElementById("notes").innerHTML = (title ? title : "");
		panel.classList.remove('hide');
		displayStatistics(nodeId);
	} else {
		panel.classList.add('hide')
	}
}

function hideNotes() {
	document.getElementById("oneNodeSelected").classList.add('hide')
}

hideNotes();

// Statistics specific to a node

function displayStatistics(nodeId) {

	let inDegree = network.getConnectedNodes(nodeId, 'from').length;
	let outDegree = network.getConnectedNodes(nodeId, 'to').length;
	let leverage = (inDegree == 0) ? '--' : (outDegree / inDegree).toPrecision(3);
	document.getElementById('leverage').textContent = leverage;
	document.getElementById('bc').textContent = (bc[nodeId]).toPrecision(3);
}


// Network tab

document.getElementById('autolayoutswitch').addEventListener('click', autoLayoutSwitch);

function autoLayoutSwitch(e) {
	network.setOptions({
		'physics': {
			'enabled': e.target.checked
		}
	});
}

function selectLayout() {
	network.setOptions({
		layout: {
			hierarchical: document.getElementById('layoutSelect').value === 'Hierarchical'
		}
	});
}

function selectCurve() {
	network.setOptions({
		edges: {
			smooth: document.getElementById('curveSelect').value === 'Curved'
		}
	});
}

function updateNetBack(picker) {
	document.getElementById('net-pane').style.background = picker.jscolor.toHEXString();
}

function selectAllFactors() {
	network.selectNodes(network.body.nodeIndices);
}

function selectAllEdges() {
	network.selectEdges(network.body.edgeIndices);
}

document.getElementById('showLabelSwitch').addEventListener('click', labelSwitch);

var labelsShown = true;

function labelSwitch(e) {
	if (labelsShown) {
		labelsShown = false;
		hideLabels();
	} else {
		labelsShown = true;
		unHideLabels()
	}
}

function hideLabels() {
	let nodesToUpdate = [];
	data.nodes.forEach(
		function(n) {
			if (n.hiddenLabel == undefined) n.hiddenLabel = n.label;
			n.label = undefined;
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

function selectDim(sel) {
	if (sel == 'All') unDimAll();
	else hideDistantNodes(sel);
}

function hideDistantNodes(radius) {
	unDimAllNodes();
	unDimAllLinks();
	let selectedNodes = network.getSelectedNodes();
	if (selectedNodes == null || selectedNodes == lastSelectedNode) return;
	dimAllNodes();
	dimAllLinks();

	let nodeIdsInRadius = new Set();
	let linkIdsInRadius = new Set();
	nn(selectedNodes, radius);
	unDimNodes(data.nodes.get(Array.from(nodeIdsInRadius)));
	unDimLinks(data.edges.get(Array.from(linkIdsInRadius)));
	if (selectedNodes.length == 1) network.focus(selectedNodes[0]);

	function nn(nodeIds, radius) {
		if (radius < 0) return;
		nodeIds.forEach(function(nId) {
			nodeIdsInRadius.add(nId);
			let links = network.getConnectedEdges(nId);
			if (links) links.forEach(function(lId) {
				linkIdsInRadius.add(lId);
			});
			let linked = network.getConnectedNodes(nId);
			if (linked) nn(linked, radius - 1);
		})
	}
}

const dimColor = "#E5E7E9";

function dimAllNodes() {
	dimNodes(data.nodes.get());
}

function dimNodes(nodeArray) {
	data.nodes.update(nodeArray.map(dimNode));
}

function unDimAllNodes() {
	unDimNodes(data.nodes.get());
}

function unDimNodes(nodeArray) {
	data.nodes.update(nodeArray.map(unDimNode));
}

function dimAllLinks() {
	dimLinks(data.edges.get());
}

function dimLinks(edgeArray) {
	data.edges.update(edgeArray.map(dimLink));
}

function unDimAllLinks() {
	unDimLinks(data.edges.get());
}

function unDimLinks(edgeArray) {
	data.edges.update(edgeArray.map(unDimLink));
}

function dimNode(node) {
	node.hiddenLabel = node.label;
	node.hiddenColor = node.color;
	node.label = undefined;
	node.color = dimColor;
	return node;
}

function unDimNode(node) {
	if (node.label == undefined) node.label = node.hiddenLabel;
	if (node.color == dimColor) node.color = node.hiddenColor;
	node.hiddenLabel = undefined;
	node.hiddenColor = undefined;
	return node;
}

function dimLink(link) {
	link.hiddenColor = link.color;
	link.color = dimColor;
	return link;
}

function unDimLink(link) {
	if (link.color == dimColor) link.color = link.hiddenColor;
	link.hiddenColor = undefined;
	return link;
}

function unDimAll() {
	unDimAllNodes();
	unDimAllLinks();
}

// start with first tab open
document.getElementById("networkButton").click();
