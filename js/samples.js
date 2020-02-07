import {
	Network
}
from "vis-network/peer/esm/vis-network";

import {
	DataSet
}
from "vis-data";

export const samples = {
nodes: {
	base: {
		groupLabel: 'Sample',
		borderWidth: 2,
		borderWidthSelected: 1,
		chosen: true,
		color: {
			border: 'black',
			background: 'white',
			highlight: {
				border: 'black',
				background: 'white'
				},
			hover: {
				border: 'black',
				background: 'white'
			},
		},
		font: {
			color: 'black',
			size: 14
		},
		labelHighlightBold: true,
		shape: 'ellipse',
		shapeProperties: {
			borderDashes: false
		},
		size: 50,
		widthConstraint: {
			minimum: 50
		},
		heightConstraint: {
			minimum: 20
		}
	},
	//------------------------------
	// blue bordered white ellipse 
	group0: {
		color: {
			border: '#0000ff',
			background: "white",
			},
		font: {
			color: 'black',
		},
	},

	//------------------------------
	// black bordered white ellipse 

	group1: {
		color: {
			border: 'black',
			background: "white",
		},
		font: {
			color: 'black',
		},
	},

	//------------------------------
	// black bordered green ellipse 

	group2: {
		color: {
			border: 'black',
			background: "#99e699",
		},
		font: {
			color: 'black',
		},
	},

	//------------------------------
	// black bordered pink ellipse 

	group3: {
		color: {
			border: 'black',
			background: "#ffccdd",
		},
		font: {
			color: 'black',
		},
	},

	//------------------------------
	// black dashed bordered pink ellipse 

	group4: {
		color: {
			border: 'black',
			background: "#ffccdd",
		},
		font: {
			color: 'black',
		},
		shapeProperties: {
			borderDashes: true
		},
	},


	//------------------------------
	// black bordered blue ellipse 

	group5: {
		color: {
			border: 'black',
			background: "#b3ccff",
		},
		font: {
			color: 'black',
		},
	},
	
	//------------------------------
	// black bordered yellow ellipse 


	group6: {
		color: {
			border: 'black',
			background: "#ffff99",
		},
		font: {
			color: 'black',
		},
	},


	//------------------------------
	//  black large text only 

	group7: {
		color: {
			border: 'black',
			background: "#ffff99",
		},
		font: {
			color: 'black',
			size: 20
		},
		labelHighlightBold: true,
		shape: 'text',
	},

	//------------------------------
	//  red text only 

	group8: {
		color: {
			border: 'black',
			background: "#ffff99",
		},
		font: {
			color: 'red',
			size: 20
		},
		shape: 'text',
	}

}, // end of node samples


edges: {

	base: {
			arrows: {
			to: {
				enabled: true,
				type: "arrow"
			},
			middle: {
				enabled: false
			},
			from: {
				enabled: false,
			}
		},
		color: {
			color: 'black',
			highlight: 'black',
			hover: 'black',
			inherit: false,
			opacity: 1.0
		},
		dashes: false,
		font: '20px sans-serif black',
		hoverWidth: 1,
		label: '',
		selectionWidth: 1,
		selfReferenceSize: 20,
		width: 1
	},

	// simple directed black link

	edge0: {
		color: {
			color: 'black',
		},
	},

	// simple directed blue link

	edge1: {
		color: {
			color: 'blue',
		},
	},

	// simple directed red link

	edge2: {
		color: {
			color: 'red',
		},
	},

	// simple directed green link

	edge3: {
		color: {
			color: 'green',
		},
	},
	
	// simple directed grey link

	edge4: {
		color: {
			color: 'grey',
		},
	},

	// medium directed yellow link

	edge5: {
		color: {
			color: 'gold',
		},
		width: 4
	},

	//  directed black dashed link

	edge6: {
		color: {
			color: 'black',
		},
		dashes: [10, 10],
		width: 5
	},

	//  directed green dashed link

	edge7: {
		color: {
			color: 'green',
		},
		dashes: [10, 10],
		width: 5
	},


	//  directed black link with middle arrow

	edge8: {
		arrows: {
			middle: {
				enabled: true,
				type: "arrow"
			},
		},
		color: {
			color: 'black',
		},
	}

} // end of edges samples

}

export function  setUpSamples() {
	// The samples are each a mini vis-network showing just one node or two nodes and a link

	// create sample configurations
	configSamples();
	
	// Get all elements with class="sampleNode" and add listener and canvas
	let emptyDataSet = new DataSet([]);
	let sampleElements = document.getElementsByClassName("sampleNode");
	for (let i = 0; i < sampleElements.length; i++) {
		let groupId = 'group' + i;
		let sampleElement = sampleElements[i];
		let groupLabel = samples.nodes[groupId].groupLabel;
		let nodeDataSet = new DataSet([{
			id: "1",
			label: (groupLabel == undefined ? "" : groupLabel),
			group: groupId,
			chosen: false
		}]);
		initSample(sampleElement, {
			nodes: nodeDataSet,
			edges: emptyDataSet
		});
		sampleElement.addEventListener('dblclick', () => {
			editNodeSample(sampleElement, samples, groupId)
		});
		sampleElement.group = groupId;
		sampleElement.dataSet = nodeDataSet;
	}
	// and to all sampleLinks
	sampleElements = document.getElementsByClassName("sampleLink");
	for (let i = 0; i < sampleElements.length; i++) {
		let sampleElement = sampleElements[i];
		let groupId = 'edge' + i;
		let edgeDataSet = new DataSet([Object.assign({
			id: "1",
			from: 1,
			to: 2
		}, samples.edges[groupId])])
		let nodesDataSet = new DataSet([{
			id: 1
		}, {
			id: 2
		}])
		initSample(sampleElement, {
			nodes: nodesDataSet,
			edges: edgeDataSet
		});
		sampleElement.addEventListener('dblclick', () => {
			editLinkSample(sampleElement, samples, groupId)
		});
		sampleElement.groupLink = groupId;
		sampleElement.dataSet = edgeDataSet;
	}
}

function configSamples() {
// assemble configurations by merging the specifics into the default

	let base = samples.nodes.base;
	for (let prop in samples.nodes) {
		let grp = {...deepCopy(base), ...samples.nodes[prop]};
		// make the hover and highlight colors the same as the basic ones
		grp.color.highlight = {};
		grp.color.highlight.border = grp.color.border;
		grp.color.highlight.background = grp.color.background;
		grp.color.hover = {};
		grp.color.hover.border = grp.color.border;
		grp.color.hover.background = grp.color.background;
		grp.font.size = base.font.size;
		samples.nodes[prop] = grp;
		}
	base = samples.edges.base;
	for (let prop in samples.edges) {
		let grp = {...deepCopy(base), ...samples.edges[prop]};
		grp.color.highlight = grp.color.color;
		grp.color.hover = grp.color.color;	
		samples.edges[prop] = grp;
		}
}

export function deepCopy(inObject) {
  let outObject, value, key;
  if (typeof inObject !== "object" || inObject === null) {
    return inObject // Return the value if inObject is not an object
  }
  // Create an array or object to hold the values
  outObject = Array.isArray(inObject) ? [] : {}
  for (key in inObject) {
    value = inObject[key]
    // Recursively (deep) copy for nested objects, including arrays
    outObject[key] = (typeof value === "object" && value !== null) ? deepCopy(value) : value
  }
  return outObject
}

function editNodeSample(sampleElement, samples, groupId) {
	let drawer = document.getElementById("editNodeDrawer");
	getNodeSampleEdit(sampleElement, samples.nodes[groupId]);
	document.getElementById('sampleNodeEditorSubmitButton').addEventListener('click', () => {
		saveNodeSampleEdit(sampleElement, samples, groupId)
	}, {once: true});
	drawer.style.top =
		`${document.getElementById('panel').getBoundingClientRect().top}px`;
	drawer.style.left =
		`${document.getElementById('panel').getBoundingClientRect().left - 300}px`;
	drawer.classList.remove("hideDrawer");
}

function getNodeSampleEdit(sampleElement, group) {
	document.getElementsByName("nodeLabel")[0].value = sampleElement.dataSet.get("1").label;
	getColor("fillColor", group.color.background);
	getColor("borderColor", group.color.border);
	getColor("fontColor", group.font.color);
	getSelection("shape", group.shape);
	getDashes("borderType", group.shapeProperties.borderDashes);
	getSelection("fontSize", group.font.size);
}

function editLinkSample(sampleElement, samples, groupId) {
	let drawer = document.getElementById("editLinkDrawer");
	getLinkSampleEdit(sampleElement, samples.edges[groupId]);
	document.getElementById('sampleLinkEditorSubmitButton').addEventListener('click', () => {
		saveLinkSampleEdit(sampleElement, samples, groupId)
	}, {once: true});
	drawer.style.top =
		`${document.getElementById('panel').getBoundingClientRect().top}px`;
	drawer.style.left =
		`${document.getElementById('panel').getBoundingClientRect().left - 300}px`;
	drawer.classList.remove("hideDrawer");
}

function getLinkSampleEdit(sampleElement, group) {
	document.getElementsByName("edgeLabel")[0].value = sampleElement.dataSet.get("1").label;
	getColor("lineColor", group.color.color);
	getSelection("width", group.width);
	getSelection("dashes", group.dashes);
	getArrows("arrows", group.arrows);
}

function saveNodeSampleEdit(sampleElement, samples, groupId) {
	let group = samples.nodes[groupId];
	group.groupLabel = document.getElementsByName("nodeLabel")[0].value;
	setColor("fillColor", group, "color", "background");
	setColor3("fillColor", group, "color", "highlight", "background");
	setColor3("fillColor", group, "color", "hover", "background");
	setColor("borderColor", group, "color", "border");
	setColor3("borderColor", group, "color", "highlight", "border");
	setColor3("borderColor", group, "color", "hover", "border");
	setColor("fontColor", group, "font", "color");
	setShape(group);
	setBorderType(group);
	setFontSize(group);
	window.network.setOptions({
		groups: samples.nodes
	})
	let node = sampleElement.dataSet.get("1");
	node.label = group.groupLabel;
	let dataSet = sampleElement.dataSet;
	dataSet.remove(node);
	dataSet.add(node);
	sampleElement.net.setOptions({
		groups: samples.nodes
	});
	document.getElementById("editNodeDrawer").classList.add("hideDrawer");
	window.network.redraw();
}

function saveLinkSampleEdit(sampleElement, samples, groupId) {
	let group = samples.edges[groupId];
	group.groupLabel = document.getElementsByName("edgeLabel")[0].value;
	setColor("lineColor", group, "color", "color");
	setColor("lineColor", group, "color", "highlight");
	setColor("lineColor", group, "color", "hover");
	let val = document.getElementsByName("width")[0].value;
	if (val != "") group.width = parseInt(val, 10);
	val = document.getElementsByName("dashes")[0].value;
	if (val != "") group.dashes = deString(val);
	val = document.getElementsByName("arrows")[0].value;
	if (val != "") {
		group.arrows.from = {enabled: false};
		group.arrows.middle = {enabled: false};
		group.arrows.to = {enabled: false};	
		switch (val) {
		case "toMiddleFrom": 
			group.arrows.from = {enabled: true};
			// falls through
		case "toMiddle":
			group.arrows.middle = {enabled: true};
			// falls through
		case "to":
			group.arrows.to = {enabled: true};
			}
		}
	let edge = sampleElement.dataSet.get("1");
	edge.label = group.groupLabel;
	let dataSet = sampleElement.dataSet;
	dataSet.remove(edge);
	dataSet.add(edge);
	reApplySampleToLinks(groupId);
	document.getElementById("editLinkDrawer").classList.add("hideDrawer");
	window.network.redraw();
}

function reApplySampleToLinks(groupId) {
	let edgesToUpdate = data.edges.get({filter: item => {return item.group == groupId}});
	for (let edge of edgesToUpdate) {
		edge = Object.assign(edge, deepCopy(samples.edges[groupId]));
	}
	data.edges.update(edgesToUpdate);
}		
		
function standardize_color(str) {
	let ctx = document.createElement("canvas").getContext("2d");
	ctx.fillStyle = str;
	return ctx.fillStyle;
}

function getColor(well, prop) {
	document.getElementsByName(well)[0].value = standardize_color(prop);
}

function setColor(well, obj, prop1, prop2) {
	if (obj[prop1] === undefined) obj[prop1] = {};
	obj[prop1][prop2] = document.getElementsByName(well)[0].value;
}

function setColor3(well, obj, prop1, prop2, prop3) {
	if (obj[prop1] === undefined) obj[prop1] = {};
	if (obj[prop1][prop2] === undefined) obj[prop1][prop2] = {};
	obj[prop1][prop2][prop3] = document.getElementsByName(well)[0].value;
}

function setShape(obj) {
	let val = document.getElementsByName("shape")[0].value;
	if (val != "") obj.shape = val;
}

function getDashes(name, val) {
	if (Array.isArray(val)) val = 'dots';
	else val = val.toString(); 
	document.getElementsByName(name)[0].value = val;
}
	
function setBorderType(obj) {
	let val = document.getElementsByName("borderType")[0].value;
	if (obj.shapeProperties === undefined) obj.shapeProperties = {};
	if (val != "") obj.shapeProperties.borderDashes = deString(val);
}

function deString(val) {
	switch (val) {
		case "true":
			return true;
		case "false":
			return false;
		case "dots":
			return [3, 3];
		default:
			return val;
	}
}

function setFontSize(obj) {
	let val = document.getElementsByName("fontSize")[0].value;
	if (obj.font == undefined) obj.font = {};
	if (val != "") obj.font.size = val;
}

function getSelection(name, prop) {
	if (
		Array.from(document.getElementsByName(name)[0].options)
		.map(opt => opt.value)
		.includes(prop.toString())
	)
		document.getElementsByName(name)[0].value = prop;
	else document.getElementsByName(name)[0].selectedIndex = 0;
}

function getArrows(name, prop) {
	let val = 'to';
	if (prop.from && prop.from.enabled) val = 'toMiddleFrom';
	else if (prop.middle && prop.middle.enabled) val = 'toMiddle';
	document.getElementsByName(name)[0].value = val;
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
		},
		layout: {
			hierarchical: {
				enabled: true,
				direction: 'LR'
			}
		},
		groups: samples.nodes
	};
	let net = new Network(wrapper, sampleData, options);
	net.storePositions();
	wrapper.net = net;
	return net;
}

