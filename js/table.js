import * as Y from 'yjs';
import {WebsocketProvider} from 'y-websocket';
import {IndexeddbPersistence} from 'y-indexeddb';
import {listen, elem, deepCopy} from './utils.js';
import Tabulator from 'tabulator-tables';

const shortAppName = 'PRSM';
const version = '1.6.8';

var debug = [];
window.debug = debug;
var room;
const doc = new Y.Doc();
var websocket = 'wss://cress.soc.surrey.ac.uk/wss'; // web socket server URL
var clientID; // unique ID for this browser
var yNodesMap; // shared map of nodes
var yEdgesMap; // shared map of edges
var ySamplesMap; // shared map of styles
var yNetMap; // shared map of network state
var yUndoManager; // shared list of commands for undo
var factorsTable; // the factors table
var linksTable; //the links table
var initialising = true; // true until the tables have been loaded
var styleMap; // conversion from style name to style id
var nAttributes = 0; // number of attributes
var attributeTitles = {}; // titles of each of the attributes

window.addEventListener('load', () => {
	elem('version').innerHTML = version;
	setUpTabs();
	startY();
});

/**
 * add event listeners for the Factor and Link tabs
 */

function setUpTabs() {
	elem('factors-table').style.display = 'block';
	elem('links-table').style.display = 'none';
	elem('factors-table-tab').classList.add('active');

	let tabs = document.getElementsByClassName('table-tab');
	for (let i = 0; i < tabs.length; i++) {
		listen(tabs[i].id, 'click', (e) => {
			let tabs = document.getElementsByClassName('table-tab');
			for (let i = 0; i < tabs.length; i++) {
				tabs[i].classList.remove('active');
			}
			e.currentTarget.classList.add('active');
			let tabcontent = document.getElementsByClassName('table');
			for (let i = 0; i < tabcontent.length; i++) {
				tabcontent[i].style.display = 'none';
			}
			elem(e.currentTarget.dataset.table).style.display = 'block';
			if (e.currentTarget.dataset.table == 'factors-table') initialiseFactorTable()
			else initialiseLinkTable();
		});
	}
}
/**
 * create a new shared document and connect to the WebSocket provider
 */
function startY() {
	// get the room number from the URL, or if none, complain
	let url = new URL(document.location);
	room = url.searchParams.get('room');
	if (room == null || room == '') alert('No room name');
	else room = room.toUpperCase();
	debug = [url.searchParams.get('debug')];
	document.title = document.title + ' ' + room;
	const persistence = new IndexeddbPersistence(room, doc);
	// when the connectio has been made, start building the table
	persistence.once('synced', () => {
		console.log(exactTime() + ' local content loaded');
		buildStyleMap();
		initialiseFactorTable();
		initialiseLinkTable();
	});
	const wsProvider = new WebsocketProvider(websocket, 'prsm' + room, doc);
	wsProvider.on('sync', () => {
		console.log(exactTime() + ' remote content loaded');
	});
	wsProvider.on('status', (event) => {
		console.log(exactTime() + event.status + (event.status == 'connected' ? ' to' : ' from') + ' room ' + room); // logs when websocket is "connected" or "disconnected"
	});

	yNodesMap = doc.getMap('nodes');
	yEdgesMap = doc.getMap('edges');
	ySamplesMap = doc.getMap('samples');
	yNetMap = doc.getMap('network');
	yUndoManager = new Y.UndoManager([yNodesMap, yEdgesMap, yNetMap]);

	clientID = doc.clientID;
	console.log('My client ID: ' + clientID);

	/* 
	for convenience when debugging
	 */
	window.debug = debug;
	window.clientID = clientID;
	window.yNodesMap = yNodesMap;
	window.yEdgesMap = yEdgesMap;
	window.yNetMap = yNetMap;
	window.attributeTitles = attributeTitles;

	yNodesMap.observe((event) => {
		yjsTrace('yNodesMap.observe', event.transaction.local, event);
		if (!event.transaction.local && !initialising) {
			let adds = [],
				updates = [],
				deletes = [];
			event.changes.keys.forEach((value, key) => {
				switch (value.action) {
					case 'add':
						adds.push(convertNode(yNodesMap.get(key)));
						break;
					case 'update':
						updates.push(convertNode(yNodesMap.get(key)));
						break;
					case 'delete':
						deletes.push(key);
						break;
				}
			});
			updateFromAndToLabels(updates);
			if (adds) factorsTable.addData(adds);
			if (updates) factorsTable.updateData(updates);
			if (deletes) factorsTable.deleteRow(deletes);
		}
		yjsTrace('yNodesMap.observe finished', event.transaction.local, event);
	});
	yEdgesMap.observe((event) => {
		yjsTrace('yEdgesMap.observe', event.transaction.local, event);
		if (!event.transaction.local && !initialising) {
			let adds = [],
				updates = [],
				deletes = [];
			event.changes.keys.forEach((value, key) => {
				switch (value.action) {
					case 'add':
						adds.push(convertEdge(yEdgesMap.get(key)));
						break;
					case 'update':
						updates.push(convertEdge(yEdgesMap.get(key)));
						break;
					case 'delete':
						deletes.push(key);
						break;
				}
			});
			if (adds) linksTable.addData(adds);
			if (updates) linksTable.updateData(updates);
			if (deletes) linksTable.deleteRow(deletes);
		}
		yjsTrace('yEdgesMap.observe finished', event.transaction.local, event);
	});
	yNetMap.observe((event) => {
		yjsTrace('YNetMap.observe', event.transaction.local, event);
		for (let key of event.keysChanged) {
			let obj = yNetMap.get(key);
			switch (key) {
				case 'mapTitle':
				case 'maptitle': {
					let title = obj;
					let div = elem('maptitle');
					if (title == 'Untitled map') {
						div.classList.add('unsetmaptitle');
					} else {
						div.classList.remove('unsetmaptitle');
						document.title = `${title}: ${shortAppName} table`;
					}
					if (title !== div.innerText) div.innerText = title;
					break;
				}
				case 'attributeTitles': {
					if (!initialising) {
						attributeTitles = obj;
						let colComps = factorsTable.getColumns();
						for (let attributeFieldName in obj) {
							let colComp = colComps.find((c) => c.getField() == attributeFieldName);
							if (colComp) {
								if (obj[attributeFieldName] == '*deleted*') {
									colComp.delete();
								} else {
									colComp.updateDefinition({title: obj[attributeFieldName]});
								}
							} else {
								if (obj[attributeFieldName] != '*deleted*') {
									nAttributes++;
									factorsTable.addColumn({
										title: obj[attributeFieldName],
										editableTitle: true,
										field: attributeFieldName,
										editor: 'input',
										width: 100,
										headerContextMenu: headerContextMenu,
									});
								}
							}
						}
					}
					break;
				}
				default:
					break;
			}
		}
	});
	yUndoManager.on('stack-item-added', (event) => {
		yjsTrace('yUndoManager.on stack-item-added', true, event);
		undoRedoButtonStatus();
	});
	yUndoManager.on('stack-item-popped', (event) => {
		yjsTrace('yUndoManager.on stack-item-popped', true, event);
		undoRedoButtonStatus();
	});
} // end startY()

function yjsTrace(where, source, what) {
	if (window.debug.includes('yjs')) {
		console.log(exactTime(), source ? 'local' : 'non-local', where, what);
	}
}
function exactTime() {
	let d = new Date();
	return `${d.toLocaleTimeString()}:${d.getMilliseconds()} `;
}

/**
 * create a map with a key for each style label and a value of its style id - helper for
 * building the Style table column
 */
function buildStyleMap() {
	styleMap = new Map();
	ySamplesMap.forEach((styleObj, styleId) => {
		styleMap.set(styleObj.groupLabel, styleId);
	});
}

var headerContextMenu = [
	{
		label: 'Delete Column',
		action: function (e, column) {
			deleteColumn(e, column);
		},
	},
];

/**
 * define the Factor table
 */
function initialiseFactorTable() {
	console.log('start initialiseFactorTable', exactTime());
	let tabledata = Array.from(yNodesMap.values()).map((n) => {
		return convertNode(n);
	});
	factorsTable = new Tabulator('#factors-table', {
		data: tabledata, //assign data to table
		layout: "fitDataTable",
		height: window.innerHeight - 130,
		clipboard: true,
		dataLoaded: () => {
			initialising = false;
		},
		index: 'id',
		columnTitleChanged: function (column) {
			updateColumnTitle(column);
		},
		cellEdited: function (cell) {
			updateNodeCellData(cell);
		},
		columnHeaderVertAlign: 'bottom',
		columns: [
			{title: 'Label', field: 'label', editor: 'textarea', frozen: true, maxWidth: 300},
			{
				title: 'Format',
				columns: [
					{
						title: 'Style',
						field: 'groupLabel',
					},
					{
						title: 'Shape',
						field: 'shape',
						editor: 'select',
						editorParams: {values: {box: 'box', ellipse: 'ellipse', circle: 'disk', text: 'none'}},
					},
					{
						title: 'Fill Colour',
						field: 'backgroundColor',
						formatter: 'color',
						width: 15,
						headerVertical: true,
						cssClass: 'grey',
					},
					{
						title: 'Border width',
						field: 'borderWidth',
						editor: 'number',
						editorParams: {
							min: 0,
							max: 20,
						},
						width: 15,
						headerVertical: true,
					},
					{
						title: 'Border Colour',
						field: 'borderColor',
						formatter: 'color',
						width: 15,
						headerVertical: true,
						cssClass: 'grey',
					},
					{
						title: 'Border Style',
						field: 'shapeProperties',
						mutator: convertBorderStyle,
						headerVertical: true,
						cssClass: 'grey',
					},
					{
						title: 'Font colour',
						field: 'fontColor',
						formatter: 'color',
						width: 15,
						headerVertical: true,
						cssClass: 'grey',
					},
					{
						title: 'Font size',
						field: 'fontSize',
						width: 15,
						headerVertical: true,
						cssClass: 'grey',
					},
				],
			},
		],
	});
	// add all the user defined attribute columns
	attributeTitles = yNetMap.get('attributeTitles') || {};
	for (let field in attributeTitles) {
		if (attributeTitles[field] != '*deleted*') {
			nAttributes++;
			factorsTable.addColumn({
				title: attributeTitles[field],
				editableTitle: true,
				field: field,
				editor: 'input',
				width: getWidthOfTitle(attributeTitles[field]),
				headerContextMenu: headerContextMenu,
			});
		}
	}
	window.factorsTable = factorsTable;
	console.log('end initialiseFactorTable', exactTime());
}

/**
 * spread some deep values to the top level to suit the requirements of the Tabulator package better
 * NB: any such converted values cannotthen be edited without special attentyion (in updateEdgeCellData)
 * @param {Object} node
 * @returns {object} the node augmented with new properties
 */
function convertNode(node) {
	let n = deepCopy(node);
	let conversions = {
		borderColor: ['color', 'border'],
		backgroundColor: ['color', 'background'],
		fontFace: ['font', 'face'],
		fontColor: ['font', 'color'],
		fontSize: ['font', 'size'],
	};
	for (let prop in conversions) {
		n[prop] = n[conversions[prop][0]][conversions[prop][1]];
	}
	return n;
}

/**
 * store the user's edit to the cell value
 * @param {cellComponent} cell
 */
function updateNodeCellData(cell) {
	// get the old value of the node
	let node = yNodesMap.get(cell.getRow().getData().id);
	// update it with the cell's new value
	node[cell.getField()] = cell.getValue();
	// sync it
	yNodesMap.set(node.id, node);
	updateFromAndToLabels([node]);
}

/**
 * define the Link table
 */
function initialiseLinkTable() {
	console.log('start initialiseLinkTable', exactTime());
	let tabledata = Array.from(yEdgesMap.values()).map((n) => {
		return convertEdge(n);
	});

	linksTable = new Tabulator('#links-table', {
		data: tabledata, //assign data to table
		clipboard: true,
		layout: "fitDataTable",
		height: window.innerHeight - 130,
		dataLoaded: () => {
			initialising = false;
		},
		index: 'id',
		cellEdited: function (cell) {
			updateEdgeCellData(cell);
		},
		columnHeaderVertAlign: 'bottom',
		columns: [
			{title: 'From', field: 'fromLabel', width: 300, cssClass: 'grey'},
			{title: 'To', field: 'toLabel', width: 300, cssClass: 'grey'},
			{
				title: 'Format',
				columns: [
					{
						title: 'Style',
						field: 'groupLabel',
						cssClass: 'grey',
					},
					{
						title: 'Arrow',
						//						width: 100,
						field: 'arrowShape',
						headerVertical: true,
						editor: 'select',
						editorParams: {
							values: ['vee', 'bar', 'circle', 'box', 'diamond', 'none'],
							/* 							values: {
								vee: 'Sharp',
								bar: 'Bar',
								circle: 'Circle',
								box: 'Box',
								diamond: 'Diamond',
								none: 'None',
							},*/
						},
					},
					{
						title: 'Colour',
						field: 'arrowColor',
						formatter: 'color',
						width: 15,
						headerVertical: true,
						cssClass: 'grey',
					},
					{
						title: 'Width',
						field: 'width',
						editor: 'number',
						editorParams: {
							min: 0,
							max: 20,
						},
						width: 15,
						headerVertical: true,
					},
					{
						title: 'Style',
						field: 'lineStyle',
						headerVertical: true,
						cssClass: 'grey',
					},
					{
						title: 'Font size',
						field: 'fontSize',
						width: 15,
						editor: 'select',
						editorParams: {
							values: [10, 14, 18],
						},
						headerVertical: true,
					},
				],
			},
		],
	});
	window.linksTable = linksTable;
	console.log('end initialiseLinkTable', exactTime());
}

/**
 * spread some deep values to the top level to suit the requirements of the Tabulator package better
 * NB: any such converted values cannotthen be edited without special attentyion (in updateEdgeCellData)
 * @param {Object} node
 * @returns {object} the node augmented with new properties
 */
function convertEdge(edge) {
	let e = deepCopy(edge);
	e.fromLabel = yNodesMap.get(e.from).label;
	e.toLabel = yNodesMap.get(e.to).label;
	e.arrowShape = e.arrows.to.type;
	if (Array.isArray(e.dashes)) e.lineStyle = 'Dots';
	else if (e.dashes) e.lineStyle = 'Dashes';
	else e.lineStyle = 'Solid';
	let conversions = {
		arrowColor: ['color', 'color'],
		fontColor: ['font', 'color'],
		fontSize: ['font', 'size'],
	};
	for (let prop in conversions) {
		e[prop] = e[conversions[prop][0]][conversions[prop][1]];
	}
	return e;
}
/**
 * When a node is updated, the update may include a change of its label.  Make the corresponding changes to the
 * references to that node in the Links table
 * @param {Array} nodes - array of updated nodes
 */
function updateFromAndToLabels(nodes) {
	console.log('start updateFromAndToLabels', exactTime())
	let linksToUpdate = [];
	nodes.forEach((node) => {
		linksToUpdate = linksToUpdate.concat(
			Array.from(yEdgesMap.values()).filter((e) => e.from == node.id || e.to == node.id)
		);
	});
	linksTable.updateOrAddData(linksToUpdate.map((e) => convertEdge(e)));
	console.log('end updateFromAndToLabels', exactTime())
}

/**
 * store the user's edit to the cell value
 * @param {cellComponent} cell
 */
function updateEdgeCellData(cell) {
	// get the old value of the edge
	let edge = yEdgesMap.get(cell.getRow().getData().id);
	// update it with the cell's new value
	edge[cell.getField()] = cell.getValue();
	// sync it
	edge.arrows.to.type = edge.arrowShape;
	edge.font.size = edge.fontSize;
	yEdgesMap.set(edge.id, edge);
}

/**
 * store the user's new title for the column
 * @param {ColComponent} column
 */

function updateColumnTitle(column) {
	let newTitle = column.getDefinition().title;
	column.updateDefinition({width: getWidthOfTitle(newTitle)});
	attributeTitles[column.getField()] = newTitle;
	yNetMap.set('attributeTitles', attributeTitles);
}

/**
 * Convert the network format of a border style to a human readable one
 * @param {Array|true|undefned} value
 */
function convertBorderStyle(value) {
	let style = value.borderDashes;
	if (Array.isArray(style)) return 'Dotted';
	return style ? 'Dashed' : 'Solid';
}

/**
 * return the length of the string in pixels when displayed using given font
 * @param {String} text
 * @param {String} fontname
 * @param {Number} fontsize
 * @return {Number} pixels
 */
function getWidthOfTitle(text, fontname = 'Oxygen', fontsize = 13.33) {
	if (getWidthOfTitle.c === undefined) {
		getWidthOfTitle.c = document.createElement('canvas');
		getWidthOfTitle.ctx = getWidthOfTitle.c.getContext('2d');
	}
	let fontspec = fontsize + ' ' + fontname;
	if (getWidthOfTitle.ctx.font !== fontspec) getWidthOfTitle.ctx.font = fontspec;
	return getWidthOfTitle.ctx.measureText(text + '  ').width + 90;
}

listen('col-insert', 'click', addColumn);

/**
 * user has clicked the button to add a column for a user-defined attribute
 */
function addColumn() {
	nAttributes++;
	factorsTable.addColumn({
		title: 'Att ' + nAttributes,
		editableTitle: true,
		field: 'att' + nAttributes,
		editor: 'input',
		width: 100,
		headerContextMenu: headerContextMenu,
	});
	attributeTitles['att' + nAttributes] = 'Att ' + nAttributes;
	console.log('addColumn', attributeTitles);
	yNetMap.set('attributeTitles', attributeTitles);
}

/**
 * delete the column from the table and mark the data as deleted
 * @param {colComponent} column
 */
function deleteColumn(e, column) {
	attributeTitles[column.getField()] = '*deleted*';
	yNetMap.set('attributeTitles', attributeTitles);
	column.delete();
}

listen('undo', 'click', undo);
listen('redo', 'click', redo);

function undo() {
	yUndoManager.undo();
}

function redo() {
	yUndoManager.redo();
}

function undoRedoButtonStatus() {
	setButtonDisabledStatus('undo', yUndoManager.undoStack.length === 0);
	setButtonDisabledStatus('redo', yUndoManager.redoStack.length === 0);
}

/**
 * Change the visible state of a button
 * @param {String} id
 * @param {Boolean} state - true to make the button disabled
 */
function setButtonDisabledStatus(id, state) {
	if (state) elem(id).classList.add('disabled');
	else elem(id).classList.remove('disabled');
}