import {Network} from 'vis-network/peer/';
import {DataSet} from 'vis-data/peer';
import {deepMerge, standardize_color, dragElement} from './utils.js';
import {statusMsg} from './prism.js';
export const samples = {
	nodes: {
		base: {
			groupLabel: 'Sample',
			borderWidth: 1,
			borderWidthSelected: 1,
			chosen: true,
			color: {
				border: '#000000',
				background: '#ffffff',
				highlight: {
					border: '#000000',
					background: '#ffffff',
				},
				hover: {
					border: '#000000',
					background: '#ffffff',
				},
			},
			font: {
				color: '#000000',
				size: 14,
			},
			labelHighlightBold: true,
			shape: 'ellipse',
			shapeProperties: {
				borderDashes: false,
			},
			scaling: {
				min: 10,
				max: 20,
				label: {
					enabled: true,
					min: 10,
					max: 20,
				},
			},
		},
		//------------------------------
		// blue bordered white ellipse
		group0: {
			color: {
				border: '#0000ff',
				background: '#ffffff',
			},
			font: {
				color: '#000000',
			},
		},
		//------------------------------
		// black bordered white ellipse
		group1: {
			color: {
				border: '#000000',
				background: '#ffffff',
			},
			font: {
				color: '#000000',
			},
		},
		//------------------------------
		// black bordered green ellipse
		group2: {
			color: {
				border: '#000000',
				background: '#99e699',
			},
			font: {
				color: '#000000',
			},
		},
		//------------------------------
		// black bordered pink ellipse
		group3: {
			color: {
				border: '#000000',
				background: '#ffccdd',
			},
			font: {
				color: '#000000',
			},
		},
		//------------------------------
		// black dashed bordered pink ellipse
		group4: {
			color: {
				border: '#000000',
				background: '#ffccdd',
			},
			font: {
				color: '#000000',
			},
			shapeProperties: {
				borderDashes: true,
			},
		},
		//------------------------------
		// black bordered blue ellipse
		group5: {
			color: {
				border: '#000000',
				background: '#b3ccff',
			},
			font: {
				color: '#000000',
			},
		},
		//------------------------------
		// black bordered yellow ellipse
		group6: {
			color: {
				border: '#000000',
				background: '#ffff99',
			},
			font: {
				color: '#000000',
			},
		},
		//------------------------------
		//  black large text only
		group7: {
			color: {
				border: '#000000',
				background: '#ffff99',
			},
			font: {
				color: '#000000',
				size: 20,
			},
			labelHighlightBold: true,
			shape: 'text',
		},
		//------------------------------
		//  red text only
		group8: {
			color: {
				border: '#000000',
				background: '#ffff99',
			},
			font: {
				color: '#ff0000',
				size: 20,
			},
			shape: 'text',
		},
	}, // end of node samples
	edges: {
		base: {
			arrows: {
				to: {
					enabled: true,
					type: 'arrow',
				},
				middle: {
					enabled: false,
				},
				from: {
					enabled: false,
				},
			},
			color: {
				color: '#000000',
				highlight: '#000000',
				hover: '#000000',
				inherit: false,
				opacity: 1.0,
			},
			dashes: false,
			font: {
				size: 20,
			},
			hoverWidth: 1,
			label: '',
			selectionWidth: 1,
			width: 1,
			groupLabel: '',
		},
		// simple directed black link
		edge0: {
			color: {
				color: '#000000',
			},
		},
		// simple directed green link
		edge1: {
			color: {
				color: '#00cc00',
			},
		},
		// simple directed red link
		edge2: {
			color: {
				color: '#ff0000',
			},
		},
		// simple directed blue link
		edge3: {
			color: {
				color: '#0000ff',
			},
		},
		// simple directed grey link
		edge4: {
			color: {
				color: '#808080',
			},
		},
		// medium directed dark yellow link
		edge5: {
			color: {
				color: '#e6b800',
			},
			width: 2,
		},
		//  directed black dashed link
		edge6: {
			color: {
				color: '#000000',
			},
			dashes: [10, 10],
			width: 3,
		},
		//  directed green dashed link
		edge7: {
			color: {
				color: '#008000',
			},
			dashes: [10, 10],
			width: 3,
		},
		//  directed black link with middle arrow
		edge8: {
			arrows: {
				middle: {
					enabled: true,
					type: 'arrow',
				},
				to: {
					enabled: true,
					type: 'arrow',
				},
			},
			color: {
				color: '#000000',
			},
		},
	}, // end of edges samples
};
export function setUpSamples() {
	// The samples are each a mini vis-network showing just one node or two nodes and a link
	// create sample configurations
	configSamples();
	// Get all elements with class='sampleNode' and add listener and canvas
	let emptyDataSet = new DataSet([]);
	let sampleElements = document.getElementsByClassName('sampleNode');
	for (let i = 0; i < sampleElements.length; i++) {
		let groupId = 'group' + i;
		let sampleElement = sampleElements[i];
		let sampleOptions = samples.nodes[groupId];
		let groupLabel = samples.nodes[groupId].groupLabel;
		let nodeDataSet = new DataSet([
			deepMerge(
				{
					id: '1',
					label: groupLabel == undefined ? '' : groupLabel,
					value: 50,
				},
				sampleOptions,
				{chosen: false}
			),
		]);
		initSample(sampleElement, {
			nodes: nodeDataSet,
			edges: emptyDataSet,
		});
		sampleElement.addEventListener('dblclick', () => {
			editNodeSample(sampleElement, groupId);
		});
		sampleElement.groupNode = groupId;
		sampleElement.dataSet = nodeDataSet;
	}
	// and to all sampleLinks
	sampleElements = document.getElementsByClassName('sampleLink');
	for (let i = 0; i < sampleElements.length; i++) {
		let sampleElement = sampleElements[i];
		let groupId = 'edge' + i;
		let sampleOptions = samples.edges[groupId];
		let edgeDataSet = new DataSet([
			deepMerge(
				{
					id: '1',
					from: 1,
					to: 2,
				},
				sampleOptions
			),
		]);
		let nodesDataSet = new DataSet([
			{
				id: 1,
			},
			{
				id: 2,
			},
		]);
		initSample(sampleElement, {
			nodes: nodesDataSet,
			edges: edgeDataSet,
		});
		sampleElement.addEventListener('dblclick', () => {
			editLinkSample(sampleElement, groupId);
		});
		sampleElement.groupLink = groupId;
		sampleElement.dataSet = edgeDataSet;
	}
}

function configSamples() {
	// assemble configurations by merging the specifics into the default
	let base = samples.nodes.base;
	for (let prop in samples.nodes) {
		let grp = deepMerge(base, samples.nodes[prop]);
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
		let grp = deepMerge(base, samples.edges[prop]);
		grp.color.highlight = grp.color.color;
		grp.color.hover = grp.color.color;
		samples.edges[prop] = grp;
	}
}

function editNodeSample(sampleElement, groupId) {
	let drawer = document.getElementById('editNodeDrawer');
	getNodeSampleEdit(sampleElement, samples.nodes[groupId]);
	document.getElementById('sampleNodeEditorSubmitButton').addEventListener(
		'click',
		() => {
			saveNodeSampleEdit(sampleElement, samples, groupId);
		},
		{
			once: true,
		}
	);
	document.getElementById('sampleNodeEditorCancelButton').addEventListener(
		'click',
		() => {
			cancelSampleEdit();
		},
		{
			once: true,
		}
	);
	drawer.style.top = `${
		document.getElementById('panel').getBoundingClientRect().top
	}px`;
	drawer.style.left = `${
		document.getElementById('panel').getBoundingClientRect().left - 300
	}px`;
	drawer.classList.remove('hideDrawer');
}

function getNodeSampleEdit(sampleElement, group) {
	document.getElementsByName(
		'nodeLabel'
	)[0].value = sampleElement.dataSet.get('1').label;
	getColor('fillColor', group.color.background);
	getColor('borderColor', group.color.border);
	getColor('fontColor', group.font.color);
	getSelection('shape', group.shape);
	getDashes('borderType', group.shapeProperties.borderDashes);
	getSelection('fontSize', group.font.size);
}

function editLinkSample(sampleElement, groupId) {
	let drawer = document.getElementById('editLinkDrawer');
	getLinkSampleEdit(sampleElement, samples.edges[groupId]);
	document.getElementById('sampleLinkEditorSubmitButton').addEventListener(
		'click',
		() => {
			saveLinkSampleEdit(sampleElement, samples, groupId);
		},
		{
			once: true,
		}
	);
	document.getElementById('sampleLinkEditorCancelButton').addEventListener(
		'click',
		() => {
			cancelSampleEdit();
		},
		{
			once: true,
		}
	);
	drawer.style.top = `${
		document.getElementById('panel').getBoundingClientRect().top
	}px`;
	drawer.style.left = `${
		document.getElementById('panel').getBoundingClientRect().left - 300
	}px`;
	drawer.classList.remove('hideDrawer');
}

function getLinkSampleEdit(sampleElement, group) {
	document.getElementsByName(
		'edgeLabel'
	)[0].value = sampleElement.dataSet.get('1').label;
	getColor('lineColor', group.color.color);
	getSelection('width', group.width);
	getSelection('dashes', group.dashes);
	getArrows('arrows', group.arrows);
}

function saveNodeSampleEdit(sampleElement, samples, groupId) {
	let group = samples.nodes[groupId];
	group.groupLabel = document.getElementsByName('nodeLabel')[0].value;
	setColor('fillColor', group, 'color', 'background');
	setColor3('fillColor', group, 'color', 'highlight', 'background');
	setColor3('fillColor', group, 'color', 'hover', 'background');
	setColor('borderColor', group, 'color', 'border');
	setColor3('borderColor', group, 'color', 'highlight', 'border');
	setColor3('borderColor', group, 'color', 'hover', 'border');
	setColor('fontColor', group, 'font', 'color');
	setShape(group);
	setBorderType(group);
	setFont(group);
	let node = sampleElement.dataSet.get('1');
	node.label = group.groupLabel;
	node = deepMerge(node, samples.nodes[groupId]);
	let dataSet = sampleElement.dataSet;
	dataSet.update(node);
	reApplySampleToNodes(groupId);
	window.ySamplesMap.set(groupId, {
		node: samples.nodes[groupId],
		clientID: window.clientId,
	});
	document.getElementById('editNodeDrawer').classList.add('hideDrawer');
	if (legendNetwork) legend();
	window.network.redraw();
}

function saveLinkSampleEdit(sampleElement, samples, groupId) {
	let group = samples.edges[groupId];
	group.groupLabel = document.getElementsByName('edgeLabel')[0].value;
	setColor('lineColor', group, 'color', 'color');
	setColor('lineColor', group, 'color', 'highlight');
	setColor('lineColor', group, 'color', 'hover');
	let val = document.getElementsByName('width')[0].value;
	if (val != '') group.width = parseInt(val, 10);
	val = document.getElementsByName('dashes')[0].value;
	if (val != '') group.dashes = deString(val);
	val = document.getElementsByName('arrows')[0].value;
	if (val != '') {
		group.arrows.from = {
			enabled: false,
		};
		group.arrows.middle = {
			enabled: false,
		};
		group.arrows.to = {
			enabled: false,
		};
		switch (val) {
			case 'none':
				break;
			case 'middle':
				group.arrows.middle = {
					enabled: true,
				};
				break;
			default:
				group.arrows.to = {
					enabled: true,
				};
				break;
		}
	}
	let edge = sampleElement.dataSet.get('1');
	edge.label = group.groupLabel;
	if (edge.label) {
		edge.font.align = 'top';
		edge.font.vadjust = -20;
		edge.font.size = 40;
		edge.widthConstraint = 80;
	}
	edge = deepMerge(edge, samples.edges[groupId]);
	let dataSet = sampleElement.dataSet;
	dataSet.update(edge);
	reApplySampleToLinks(groupId);
	window.ySamplesMap.set(groupId, {
		edge: samples.edges[groupId],
		clientID: window.clientId,
	});
	document.getElementById('editLinkDrawer').classList.add('hideDrawer');
	if (legendNetwork) legend();
	window.network.redraw();
}

function cancelSampleEdit() {
	document.getElementById('editLinkDrawer').classList.add('hideDrawer');
	document.getElementById('editNodeDrawer').classList.add('hideDrawer');
}
export function reApplySampleToNodes(groupId) {
	let nodesToUpdate = window.data.nodes.get({
		filter: (item) => {
			return item.grp == groupId;
		},
	});
	window.data.nodes.update(nodesToUpdate.map((node) => deepMerge(node, samples.nodes[groupId])));
}
export function reApplySampleToLinks(groupId) {
	let edgesToUpdate = window.data.edges.get({
		filter: (item) => {
			return item.grp == groupId;
		},
	});
	window.data.edges.update(edgesToUpdate.map((edge) => deepMerge(edge, samples.edges[groupId])));
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
	let val = document.getElementsByName('shape')[0].value;
	if (val != '') obj.shape = val;
}

function getDashes(name, val) {
	if (Array.isArray(val)) val = 'dots';
	else val = val.toString();
	document.getElementsByName(name)[0].value = val;
}

function setBorderType(obj) {
	let val = document.getElementsByName('borderType')[0].value;
	if (obj.shapeProperties === undefined) obj.shapeProperties = {};
	if (val != '') obj.shapeProperties.borderDashes = deString(val);
}

function deString(val) {
	switch (val) {
		case 'true':
			return true;
		case 'false':
			return false;
		case 'dashes':
			return [10, 10];
		case 'dots':
			return [3, 3];
		default:
			return val;
	}
}

function setFont(obj) {
	obj.font = {};
	obj.font.face = 'arial';
	obj.font.color = document.getElementsByName('fontColor')[0].value;
	let val = document.getElementsByName('fontSize')[0].value;
	obj.font.size = Number.isInteger(val) ? val : 14;
}

function getSelection(name, prop) {
	if (
		Array.from(document.getElementsByName(name)[0].options)
			.map((opt) => opt.value)
			.includes(prop.toString())
	)
		document.getElementsByName(name)[0].value = prop;
	else document.getElementsByName(name)[0].selectedIndex = 0;
}

function getArrows(name, prop) {
	let val = 'none';
	if (prop.middle && prop.middle.enabled) val = 'middle';
	else if (prop.to && prop.to.enabled) val = 'to';
	document.getElementsByName(name)[0].value = val;
}

function initSample(wrapper, sampleData) {
	let options = {
		interaction: {
			dragNodes: false,
			dragView: false,
			selectable: true,
			zoomView: false,
		},
		manipulation: {
			enabled: false,
		},
		layout: {
			hierarchical: {
				enabled: true,
				direction: 'LR',
			},
		},
		edges: {
			value: 10, // to make the links more visible at very small scale for the samples
		},
	};
	let net = new Network(wrapper, sampleData, options);
	net.fit();
	net.storePositions();
	wrapper.net = net;
	return net;
}

var legendData = {nodes: new DataSet(), edges: new DataSet()};
var legendNetwork = null;
const LEGENDSPACING = 50;
const HALFLEGENDWIDTH = 40;

export function legend() {
	clearLegend();

	let sampleNodeDivs = document.getElementsByClassName('sampleNode');
	let nodes = Array.from(sampleNodeDivs).filter(
		(elem) => elem.dataSet.get('1').groupLabel != 'Sample'
	);
	let sampleEdgeDivs = document.getElementsByClassName('sampleLink');
	let edges = Array.from(sampleEdgeDivs).filter(
		(elem) => !['Sample', ''].includes(elem.dataSet.get('1').groupLabel)
	);
	let nItems = nodes.length + edges.length;
	if (nItems == 0) {
		statusMsg('Nothing to include in the Legend - rename some styles first', 'warn');
		return;
	}
	let legendBox = document.createElement('div');
	legendBox.className = 'legend';
	legendBox.id = 'legendBox';
	document.getElementById('main').appendChild(legendBox);
	let title = document.createElement('p');
	title.id = 'Legend';
	title.className = 'legendTitle';
	title.appendChild(document.createTextNode('Legend'));
	legendBox.appendChild(title);
	legendBox.style.height = (LEGENDSPACING * nItems + title.offsetHeight) + 'px';
	legendBox.style.width = (HALFLEGENDWIDTH * 2) + 'px';
	let canvas = document.createElement('div');
	canvas.className = 'legendCanvas';
	canvas.style.height = (LEGENDSPACING * nItems) + 'px';
	legendBox.appendChild(canvas);

	dragElement(legendBox, title);

	legendNetwork = new Network(canvas, legendData, {physics: {enabled: false},}); 

	let height = LEGENDSPACING / 2;
	for (let i = 0; i < nodes.length; i++) {
		let node = deepMerge(samples.nodes[nodes[i].groupNode]);
		node.id = i + 10000;
		let nodePos = legendNetwork.DOMtoCanvas({
			x: HALFLEGENDWIDTH,
			y: height,
		});
		node.x = nodePos.x;
		node.y = nodePos.y;
		node.label = node.groupLabel;
		if (node.label.length > 10) node.font.size = 8;
		node.fixed = true;
		node.chosen = false;
		node.widthConstraint = {maximum: HALFLEGENDWIDTH * 2};
		legendData.nodes.update(node);
		height += LEGENDSPACING;
	}
	for (let i = 0; i < edges.length; i++) {
		let edge = deepMerge(samples.edges[edges[i].groupLink]);
		let edgePos = legendNetwork.DOMtoCanvas({
			x: HALFLEGENDWIDTH,
			y: height,
		});
		edge.label = edge.groupLabel;
		edge.id = i + 10000;
		edge.from = i + 20000;
		edge.to = i + 30000;
		edge.smooth = 'horizontal';
		edge.font = {size: 12, color: 'black', align: 'top', vadjust: -2};
		edge.widthConstraint = 80;
		let nodes = [
			{
				id: edge.from,
				shape: 'dot',
				size: 5,
				x: edgePos.x - 25,
				y: edgePos.y,
				fixed: true,
			},
			{
				id: edge.to,
				shape: 'dot',
				size: 5,
				x: edgePos.x + 25,
				y: edgePos.y,
				fixed: true,
			},
		];
		legendData.nodes.update(nodes);
		legendData.edges.update(edge);
		height += LEGENDSPACING;
	}
}

export function clearLegend() {
	legendData.nodes.clear();
	legendData.edges.clear();
	if(legendNetwork) legendNetwork.destroy();
	let legendBox = document.getElementById('legendBox');
	if (legendBox) legendBox.remove();
}

window.legend = legend;
window.legendData = legendData;
