import {Network} from 'vis-network/peer/';
import {DataSet} from 'vis-data/peer';
import {
	listen,
	elem,
	splitText,
	deepMerge,
	deepCopy,
	standardize_color,
	dragElement,
	statusMsg,
	clearStatusBar
} from './utils.js';
import {updateLastSamples} from './prsm.js';
import {styles} from './samples.js';

const NODESTYLEWIDTH = 10; // chars for label splitting

/**
 * The samples are each a mini vis-network showing just one node or two nodes and a link
 */
export function setUpSamples() {
	// create sample configurations
	configSamples();
	// Get all elements with class='sampleNode' and add listener and canvas
	let emptyDataSet = new DataSet([]);
	let sampleElements = document.getElementsByClassName('sampleNode');
	for (let i = 0; i < sampleElements.length; i++) {
		let groupId = 'group' + i;
		let sampleElement = sampleElements[i];
		let sampleOptions = styles.nodes[groupId];
		let groupLabel = styles.nodes[groupId].groupLabel;
		let nodeDataSet = new DataSet([
			deepMerge(
				{
					id: '1',
					label: groupLabel == undefined ? '' : groupLabel,
					value: styles.nodes['base'].scaling.max,
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
			editNodeStyle(sampleElement, groupId);
		});
		sampleElement.addEventListener('click', () => {
			updateLastSamples(groupId, null);
		});
		sampleElement.groupNode = groupId;
		sampleElement.dataSet = nodeDataSet;
	}
	// and to all sampleLinks
	sampleElements = document.getElementsByClassName('sampleLink');
	for (let i = 0; i < sampleElements.length; i++) {
		let sampleElement = sampleElements[i];
		let groupId = 'edge' + i;
		let groupLabel = styles.edges[groupId].groupLabel;
		let sampleOptions = styles.edges[groupId];
		let edgeDataSet = new DataSet([
			deepMerge(
				{
					id: '1',
					from: 1,
					to: 2,
					label: groupLabel == undefined ? '' : groupLabel,
				},
				sampleOptions,
				{
					font: {
						size: 24,
						color: 'black',
						align: 'top',
						vadjust: -40,
					},
					widthConstraint: 80,
				}
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
			editLinkStyle(sampleElement, groupId);
		});
		sampleElement.addEventListener('click', () => {
			updateLastSamples(null, groupId);
		});
		sampleElement.groupLink = groupId;
		sampleElement.dataSet = edgeDataSet;
	}
}
/**
 * assemble configurations by merging the specifics into the default
 */
function configSamples() {
	let base = styles.nodes.base;
	for (let prop in styles.nodes) {
		let grp = deepMerge(base, styles.nodes[prop]);
		// make the hover and highlight colors the same as the basic ones
		grp.color.highlight = {};
		grp.color.highlight.border = grp.color.border;
		grp.color.highlight.background = grp.color.background;
		grp.color.hover = {};
		grp.color.hover.border = grp.color.border;
		grp.color.hover.background = grp.color.background;
		grp.font.size = base.font.size;
		styles.nodes[prop] = grp;
	}
	base = styles.edges.base;
	for (let prop in styles.edges) {
		let grp = deepMerge(base, styles.edges[prop]);
		grp.color.highlight = grp.color.color;
		grp.color.hover = grp.color.color;
		styles.edges[prop] = grp;
	}
}
/**
 * create the sample network
 * @param {HTMLelement} wrapper
 * @param {dataset} sampleData
 */
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

listen('nodeEditCancel', 'click', nodeEditCancel);
listen('nodeEditName', 'keyup', nodeEditSave);
listen('nodeEditFillColor', 'input', nodeEditSave);
listen('nodeEditBorderColor', 'input', nodeEditSave);
listen('nodeEditFontColor', 'input', nodeEditSave);
listen('nodeEditShape', 'change', nodeEditSave);
listen('nodeEditBorder', 'change', nodeEditSave);
listen('nodeEditFontSize', 'change', nodeEditSave);
listen('nodeEditSubmit', 'click', nodeEditSubmit);
/**
 * open the dialog to edit a node style
 * @param {HTMLelement} styleElement
 * @param {Integer} groupId
 */
function editNodeStyle(styleElement, groupId) {
	styleElement.net.unselectAll();
	let container = elem('nodeStyleEditorContainer');
	container.styleElement = styleElement;
	container.groupId = groupId;
	// save the current style format (so that there can be a revert in case of cancelling the edit)
	container.origGroup = deepCopy(styles.nodes[groupId]);
	// save the div in which the style is displayed
	container.styleElement = styleElement;
	// set the style dialog widgets with the current values for the group style
	updateNodeEditor(groupId);
	// display the style dialog
	nodeEditorShow(styleElement);
}
/**
 * ensure that the edit node style dialog shows the current state of the style
 * @param {Integer} groupId
 */
function updateNodeEditor(groupId) {
	let group = styles.nodes[groupId];
	elem('nodeEditName').value = group.groupLabel;
	elem('nodeEditFillColor').value = standardize_color(group.color.background);
	elem('nodeEditBorderColor').value = standardize_color(group.color.border);
	elem('nodeEditFontColor').value = standardize_color(group.font.color);
	elem('nodeEditShape').value = group.shape;
	elem('nodeEditBorder').value = getDashes(
		group.shapeProperties.borderDashes,
		group.borderWidth
	);
	elem('nodeEditFontSize').value = group.font.size;
}
/**
 * save changes to the style made with the edit dialog to the style object
 */
function nodeEditSave() {
	let groupId = elem('nodeStyleEditorContainer').groupId;
	let group = styles.nodes[groupId];
	group.groupLabel = splitText(elem('nodeEditName').value, NODESTYLEWIDTH);
	if (group.groupLabel === '') group.groupLabel = 'Sample';
	group.color.background = elem('nodeEditFillColor').value;
	group.color.border = elem('nodeEditBorderColor').value;
	group.color.highlight.background = group.color.background;
	group.color.highlight.border = group.color.border;
	group.color.hover.background = group.color.background;
	group.color.hover.border = group.color.border;
	group.font.color = elem('nodeEditFontColor').value;
	group.shape = elem('nodeEditShape').value;
	let border = elem('nodeEditBorder').value;
	group.shapeProperties.borderDashes = groupDashes(border);
	group.borderWidth = border == 'none' ? 0 : 4;
	group.font.size = parseInt(elem('nodeEditFontSize').value);
	nodeEditUpdateStyleSample(group);
}
/**
 * update the style sample to show changes to style
 * @param {Object} group
 */
function nodeEditUpdateStyleSample(group) {
	let groupId = elem('nodeStyleEditorContainer').groupId;
	let styleElement = elem('nodeStyleEditorContainer').styleElement;
	let node = styleElement.dataSet.get('1');
	node.label = group.groupLabel;
	node = deepMerge(node, styles.nodes[groupId], {chosen: false});
	let dataSet = styleElement.dataSet;
	dataSet.update(node);
}
/**
 * cancel any editing of the style and revert to what it was previously
 */
function nodeEditCancel() {
	// restore saved group format
	let groupId = elem('nodeStyleEditorContainer').groupId;
	styles.nodes[groupId] = elem('nodeStyleEditorContainer').origGroup;
	nodeEditUpdateStyleSample(styles.nodes[groupId]);
	nodeEditorHide();
}
/**
 * hide the node style editor dialog
 */
function nodeEditorHide() {
	elem('nodeStyleEditorContainer').classList.add('hideEditor');
}
/**
 * show the node style editor dialog
 */
function nodeEditorShow() {
	let panelRect = elem('panel').getBoundingClientRect();
	let container = elem('nodeStyleEditorContainer');
	container.style.top = `${panelRect.top}px`;
	container.style.left = `${panelRect.left - 300}px`;
	container.classList.remove('hideEditor');
}
/**
 * save the edited style and close the style editor.  Update the nodes
 * in the map and the legend to the current style
 */
function nodeEditSubmit() {
	nodeEditSave();
	nodeEditorHide();
	// apply updated style to all nodes having that style
	let groupId = elem('nodeStyleEditorContainer').groupId;
	reApplySampleToNodes([groupId], true);
	window.ySamplesMap.set(groupId, {
		node: styles.nodes[groupId],
		clientID: window.clientId,
	});
	updateLegend();
	window.network.redraw();
}
/**
 * update all nodes in the map with this style to the current style features
 * @param {IntegerArray} groupIds
 * @param {Boolean} force override any existing individual node styling
 */
export function reApplySampleToNodes(groupIds, force) {
	let nodesToUpdate = window.data.nodes.get({
		filter: (item) => {
			return groupIds.includes(item.grp);
		},
	});
	window.data.nodes.update(
		nodesToUpdate.map((node) => {
			return force
				? deepMerge(node, styles.nodes[node.grp])
				: deepMerge(styles.nodes[node.grp], node);
		})
	);
}

listen('linkEditCancel', 'click', linkEditCancel);
listen('linkEditName', 'keyup', linkEditSave);
listen('linkEditLineColor', 'input', linkEditSave);
listen('linkEditWidth', 'input', linkEditSave);
listen('linkEditDashes', 'input', linkEditSave);
listen('linkEditArrows', 'change', linkEditSave);
listen('linkEditSubmit', 'click', linkEditSubmit);
/**
 * open the dialog to edit a link style
 * @param {HTMLelement} styleElement
 * @param {Integer} groupId
 */
function editLinkStyle(styleElement, groupId) {
	let container = elem('linkStyleEditorContainer');
	container.styleElement = styleElement;
	container.groupId = groupId;
	// save the current style format (so that there can be a revert in case of cancelling the edit)
	container.origGroup = deepCopy(styles.edges[groupId]);
	// set the style dialog widgets with the current values for the group style
	updateLinkEditor(groupId);
	// display the style dialog
	linkEditorShow(styleElement);
}
/**
 * ensure that the edit link style dialog shows the current state of the style
 * @param {Integer} groupId
 */
function updateLinkEditor(groupId) {
	let group = styles.edges[groupId];
	elem('linkEditName').value = group.groupLabel;
	elem('linkEditLineColor').value = standardize_color(group.color.color);
	elem('linkEditWidth').value = group.width;
	elem('linkEditDashes').value = getDashes(group.dashes, 1);
	elem('linkEditArrows').value = getArrows(group.arrows);
}
/**
 * save changes to the style made with the edit dialog to the style object
 */
function linkEditSave() {
	let groupId = elem('linkStyleEditorContainer').groupId;
	let group = styles.edges[groupId];
	group.groupLabel = elem('linkEditName').value;
	if (group.groupLabel === '') group.groupLabel = 'Sample';
	group.color.color = elem('linkEditLineColor').value;
	group.color.highlight = group.color.color;
	group.color.hover = group.color.color;
	group.width = parseInt(elem('linkEditWidth').value);
	group.dashes = groupDashes(elem('linkEditDashes').value);
	groupArrows(elem('linkEditArrows').value);
	linkEditUpdateStyleSample(group);
	/**
	 * Set the link object properties to show various arrow types
	 * @param {string} val
	 */
	function groupArrows(val) {
		if (val != '') {
			group.arrows.from.enabled = false;
			group.arrows.middle.enabled = false;
			group.arrows.to.enabled = false;
			switch (val) {
				case 'none':
					break;
				case 'circle':
					group.arrows.to.enabled = true;
					group.arrows.to.type = 'circle';
					break;
				default:
					group.arrows.to.enabled = true;
					group.arrows.to.type = 'vee';
					break;
			}
		}
	}
}
/**
 * update the style sample to show changes to style
 * @param {Object} group
 */
function linkEditUpdateStyleSample(group) {
	// update the style edge to show changes to style
	let groupId = elem('linkStyleEditorContainer').groupId;
	let styleElement = elem('linkStyleEditorContainer').styleElement;
	let edge = styleElement.dataSet.get('1');
	edge.label = group.groupLabel;
	edge = deepMerge(edge, styles.edges[groupId], {chosen: false});
	let dataSet = styleElement.dataSet;
	dataSet.update(edge);
}
/**
 * cancel any editing of the style and revert to what it was previously
 */
function linkEditCancel() {
	// restore saved group format
	let groupId = elem('linkStyleEditorContainer').groupId;
	styles.edges[groupId] = elem('linkStyleEditorContainer').origGroup;
	linkEditorHide();
}
/**
 * hide the link style editor dialog
 */
function linkEditorHide() {
	elem('linkStyleEditorContainer').classList.add('hideEditor');
}
/**
 * show the link style editor dialog
 */
function linkEditorShow() {
	let panelRect = elem('panel').getBoundingClientRect();
	let container = elem('linkStyleEditorContainer');
	container.style.top = `${panelRect.top}px`;
	container.style.left = `${panelRect.left - 300}px`;
	container.classList.remove('hideEditor');
}
/**
 * save the edited style and close the style editor.  Update the links
 * in the map and the legend to the current style
 */
function linkEditSubmit() {
	linkEditSave();
	linkEditorHide();
	// apply updated style to all edges having that style
	let groupId = elem('linkStyleEditorContainer').groupId;
	reApplySampleToLinks([groupId], true);
	window.ySamplesMap.set(groupId, {
		edge: styles.edges[groupId],
		clientID: window.clientId,
	});
	updateLegend();
	window.network.redraw();
}
/**
 * update all links in the map with this style to the current style features
 * @param {IntegerArray} groupIds
 * @param {Boolean} force override any existing individual edge styling
 */
export function reApplySampleToLinks(groupIds, force) {
	let edgesToUpdate = window.data.edges.get({
		filter: (item) => {
			return groupIds.includes(item.grp);
		},
	});
	window.data.edges.update(
		edgesToUpdate.map((edge) => {
			return force
				? deepMerge(edge, styles.edges[edge.grp])
				: deepMerge(styles.edges[edge.grp], edge);
		})
	);
}
/**
 * convert from style object properties to dashed border menu selection
 * @param {any} bDashes select menu value
 * @param {Integer} bWidth border width
 */
function getDashes(bDashes, bWidth) {
	let val = bDashes.toString();
	if (Array.isArray(bDashes)) {
		if (bDashes[0] == 10) val = 'dashes';
		else val = 'dots';
	} else if (bWidth == 0) val = 'none';
	return val;
}
/**
 * Convert from dashed menu selectio to style object properties
 * @param {string} val
 */
function groupDashes(val) {
	switch (val) {
		case 'true': // dashes [5,15] for node borders
			return true;
		case 'dashes': // dashes for links
			return [10, 10];
		case 'false': // solid
			return false;
		case 'none': //solid, zero width
			return false;
		case 'dots':
			return [2, 8];
		default:
			return false;
	}
}
/**
 * Convert from style object properties to arrow menu selection
 * @param {Object} prop
 */
function getArrows(prop) {
	let val = 'none';
	if (prop.to && prop.to.enabled && prop.to.type == 'circle') val = 'circle';
	else if (prop.to && prop.to.enabled) val = 'to';
	return val;
}

/*  ------------display the map legend (includes all styles with a groupLable that is neither blank or 'Sample') */

var legendData = {nodes: new DataSet(), edges: new DataSet()};
var legendNetwork = null;
const LEGENDSPACING = 50;
const HALFLEGENDWIDTH = 50;
/**
 * display a legend on the map (but only if the styles have been given names)
 * @param {Boolean} warn true if user is switching display legend on, but there is nothing to show
 */
export function legend(warn = true) {
	clearLegend();

	let sampleNodeDivs = document.getElementsByClassName('sampleNode');
	let nodes = Array.from(sampleNodeDivs).filter(
		(elem) => elem.dataSet.get('1').groupLabel != 'Sample'
	);
	let sampleEdgeDivs = document.getElementsByClassName('sampleLink');
	let edges = Array.from(sampleEdgeDivs).filter(
		(elem) =>
			!['Sample', '', ' '].includes(elem.dataSet.get('1').groupLabel)
	);
	let nItems = nodes.length + edges.length;
	if (nItems == 0) {
		if (warn)
			statusMsg(
				'Nothing to include in the Legend - rename some styles first',
				'warn'
			);
		document.getElementById('showLegendSwitch').checked = false;
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
	legendBox.style.height = LEGENDSPACING * nItems + title.offsetHeight + 'px';
	legendBox.style.width = HALFLEGENDWIDTH * 2 + 'px';
	let canvas = document.createElement('div');
	canvas.className = 'legendCanvas';
	canvas.style.height = LEGENDSPACING * nItems + 'px';
	legendBox.appendChild(canvas);

	dragElement(legendBox, title);

	legendNetwork = new Network(canvas, legendData, {
		physics: {enabled: false},
		interaction: {zoomView: false, dragView: false},
	});
	legendNetwork.moveTo({scale: 0.8});
	let height = LEGENDSPACING / 2;
	for (let i = 0; i < nodes.length; i++) {
		let node = deepMerge(styles.nodes[nodes[i].groupNode]);
		node.id = i + 10000;
		let nodePos = legendNetwork.DOMtoCanvas({
			x: HALFLEGENDWIDTH,
			y: height,
		});
		node.x = nodePos.x;
		node.y = nodePos.y;
		node.label = splitText(node.groupLabel, 12);
		node.fixed = true;
		node.chosen = false;
		node.margin = 3;
		legendData.nodes.update(node);
		height += LEGENDSPACING;
	}
	for (let i = 0; i < edges.length; i++) {
		let edge = deepMerge(styles.edges[edges[i].groupLink]);
		let edgePos = legendNetwork.DOMtoCanvas({
			x: HALFLEGENDWIDTH,
			y: height,
		});
		edge.label = edge.groupLabel;
		edge.id = i + 10000;
		edge.from = i + 20000;
		edge.to = i + 30000;
		edge.smooth = 'horizontal';
		edge.font = {size: 12, color: 'black', align: 'top', vadjust: -10};
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
	legendNetwork.fit({});
}
/**
 * remove the legend from the map
 */
export function clearLegend() {
	legendData.nodes.clear();
	legendData.edges.clear();
	if (legendNetwork) legendNetwork.destroy();
	let legendBox = document.getElementById('legendBox');
	if (legendBox) legendBox.remove();
}
/**
 * redraw the legend (to show updated styles)
 */
function updateLegend() {
	if (document.getElementById('showLegendSwitch').checked) {
		legend(false);
		clearStatusBar()
	}
}
// to aid debugging
window.legend = legend;
window.legendData = legendData;
