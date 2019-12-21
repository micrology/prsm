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

// Notes

document.getElementById('notes').addEventListener('click', addEditor);

var editor = null;

function addEditor() {
	editor = new nicEditor({
		buttonList : ['fontSize','bold','italic','underline'], 
		iconsPath: 'js/nicEdit/nicEditorIcons.gif',
		maxHeight: '30px'}).panelInstance('notes', {hasPanel : true});
	editor.addEvent('blur', removeEditor);
	}
	
function removeEditor() {
	if (editor.nicInstances.length > 0) {
		let title = stripTags(editor.nicInstances[0].getContent(), "<b><i><div><font>");
		let nodeId = network.getSelectedNodes()[0];
        data.nodes.update({id: nodeId, title: title});

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
    after = before.replace(commentsAndPhpTags, '').replace(tags, function ($0, $1) {
      return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : ''
    })

    // return once no more tags are removed
    if (before === after) {
      return after
    }
  }
}

function displayNotes () {
	let panel = document.getElementById("1nodeSelected");
	if (tabOpen == 'nodesTab' && network.getSelectedNodes().length == 1) {
		panel.classList.remove('hide');
		}
	else {
		panel.classList.add('hide')
		}
}

function hideNotes() {
	document.getElementById("1nodeSelected").classList.add('hide')
}

hideNotes();

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
		