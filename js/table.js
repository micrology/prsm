import * as Y from 'yjs';
import {WebsocketProvider} from 'y-websocket';
import {IndexeddbPersistence} from 'y-indexeddb';
import {listen, elem, deepCopy, timeAndDate} from './utils.js';
import Tabulator from 'tabulator-tables';
import { version } from '../package.json';

const shortAppName = 'PRSM';

var debug = [];
window.debug = debug;
var room;
const doc = new Y.Doc();
var websocket = 'wss://cress.soc.surrey.ac.uk/wss'; // web socket server URL
var clientID; // unique ID for this browser
var yNodesMap; // shared map of nodes
var yEdgesMap; // shared map of edges
var yNetMap; // shared map of network state
var yUndoManager; // shared list of commands for undo
var factorsTable; // the factors table
var linksTable; //the links table
var openTable; // the table that is currently on view
var initialising = true; // true until the tables have been loaded
var nAttributes = 0; // number of attributes
var attributeTitles = {}; // titles of each of the attributes
var myNameRec; // my name etc.

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
			openTable =
				e.currentTarget.dataset.table == 'factors-table' ? initialiseFactorTable() : initialiseLinkTable();
			if (filterDisplayed) closeFilter();
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
	// when the connection has been made, start building the table
	persistence.once('synced', () => {
		console.log(exactTime() + ' local content loaded');
		openTable = initialiseFactorTable();
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
		if (event.transaction.origin && !initialising) {
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
		if (event.transaction.origin && !initialising) {
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
	myNameRec = JSON.parse(localStorage.getItem('myName'));
	myNameRec.id = clientID;
	console.log('My name: ' + myNameRec.name);
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
 * @return {Tabulate} the table
 */
function initialiseFactorTable() {
	let tabledata = Array.from(yNodesMap.values()).map((n) => {
		return convertNode(n);
	});
	factorsTable = new Tabulator('#factors-table', {
		data: tabledata, //assign data to table
		layout: 'fitDataTable',
		height: window.innerHeight - 130,
		clipboard: true,
		clipboardCopyConfig:{ 
			columnHeaders: true, //do not include column headers in clipboard output
			columnGroups: false, //do not include column groups in column headers for printed table
			rowGroups: false, //do not include row groups in clipboard output
			columnCalcs: false, //do not include column calculation rows in clipboard output
			dataTree: false, //do not include data tree in printed table
			formatCells: false, //show raw cell values without formatter
		},
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
			{title: 'Modified', field: 'modifiedTime', cssClass: 'grey'},
			{
				title: 'Format',
				columns: [
					{
						title: 'Style',
						field: 'groupLabel',
						cssClass: 'grey',
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
						editor: colorEditor,
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
						editor: colorEditor,
				},
					{
						title: 'Border Style',
						field: 'borderStyle',
						headerVertical: true,
						editor: 'select',
						editorParams: {values: ['Solid', 'Dashed', 'Dotted', 'None']},
					},
					{
						title: 'Font colour',
						field: 'fontColor',
						formatter: 'color',
						width: 15,
						headerVertical: true,
						editor: colorEditor,
					},
					{
						title: 'Font size',
						field: 'fontSize',
						width: 15,
						headerVertical: true,
						editor: 'number',
						editorParams: {
							min: 10,
							max: 30,
						},
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
	return factorsTable;
}

/**
 * spread some deep values to the top level to suit the requirements of the Tabulator package better
 * NB: any such converted values cannot then be edited without special attention (in updateEdgeCellData)
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
	if (n.groupLabel == 'Sample') n.groupLabel = '--';
	n.borderStyle = n.shapeProperties.borderDashes;
	if (n.borderWidth == 0) n.borderStyle = 'None';
	else {
		if (Array.isArray(n.borderStyle)) n.borderStyle = 'Dotted';
		else n.borderStyle = n.borderStyle ? 'Dashed' : 'Solid';
	}
	if (n.modified) n.modifiedTime = timeAndDate(n.modified.time);
	else if (n.created) n.modifiedTime = timeAndDate(n.created.time);
	else n.modifiedTime = '--';
	return n;
}

/**
 * store the user's edit to the cell value
 * @param {cellComponent} cell
 */
function updateNodeCellData(cell) {
	// get the old value of the node
	let node = deepCopy(yNodesMap.get(cell.getRow().getData().id));
	// update it with the cell's new value
	node = convertNodeBack(node, cell.getField(), cell.getValue());
	node.modified = {time: Date.now(), user: myNameRec.name};
	cell.getTable().updateData([{id: node.id, modifiedTime: timeAndDate(node.modified.time)}]);
	// sync it
	yNodesMap.set(node.id, node);
	updateFromAndToLabels([node]);
}

/**
 * Convert the properties of the node back into the format required by vis-network
 * @param {Object} node 
 * @param {String} field 
 * @param {Any} value 
 */
function convertNodeBack(node, field, value) {
	switch (field) {
		case 'borderStyle':
			if (node.borderWidth == 0) node.borderWidth = 4;
			switch (value) {
				case 'None':
					node.borderWidth = 0;
					node.shapeProperties.borderDashes = false;
					break;
				case 'Dotted':
					node.shapeProperties.borderDashes = false;
					break;
				case 'Dashed':
					node.shapeProperties.borderDashes = true;
					break;
				case 'Solid':
					node.shapeProperties.borderDashes = false;
					break;
			}
			break;
		case 'backgroundColor':
			node.color.background = value;
			break;
		case 'borderColor':
			node.color.border = value;
			break;
		case 'fontColor':
			node.font.color = value;
			break;
		case 'fontSize':
			node.font.size = value;
			break;
		default:
			break;
	}
	return node;
}

/**
 * define the Link table
 * @return {Tabulate} the table
 */
function initialiseLinkTable() {
	let tabledata = Array.from(yEdgesMap.values()).map((n) => {
		return convertEdge(n);
	});

	linksTable = new Tabulator('#links-table', {
		data: tabledata, //assign data to table
		clipboard: true,
		clipboardCopyConfig:{
			columnHeaders: true, //do not include column headers in clipboard output
			columnGroups: false, //do not include column groups in column headers for printed table
			rowGroups: false, //do not include row groups in clipboard output
			columnCalcs: false, //do not include column calculation rows in clipboard output
			dataTree: false, //do not include data tree in printed table
			formatCells: false, //show raw cell values without formatter
		},
		layout: 'fitDataTable',
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
			{title: 'Modified', field: 'modifiedTime', cssClass: 'grey'},
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
							values: ['vee', 'arrow','bar', 'circle', 'box', 'diamond', 'none'],
						},
					},
					{
						title: 'Colour',
						field: 'arrowColor',
						formatter: 'color',
						width: 15,
						headerVertical: true,
						editor: colorEditor,
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
						title: 'Line Style',
						field: 'lineStyle',
						editor: 'select',
						editorParams: {
							values: ['Solid', 'Dashed', 'Dotted'],
						},
						headerVertical: true,
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
	return linksTable;
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
	if (e.groupLabel == 'Sample') e.groupLabel = '--';
	if (Array.isArray(e.dashes)) e.lineStyle = 'Dotted';
	else if (e.dashes) e.lineStyle = 'Dashed';
	else e.lineStyle = 'Solid';
	let conversions = {
		arrowColor: ['color', 'color'],
		fontSize: ['font', 'size'],
	};
	for (let prop in conversions) {
		e[prop] = e[conversions[prop][0]][conversions[prop][1]];
	}
	if (e.modified) e.modifiedTime = timeAndDate(e.modified.time);
	else if (e.created) e.modifiedTime = timeAndDate(e.created.time);
	else e.modifiedTime = '--';
	return e;
}
/**
 * When a node is updated, the update may include a change of its label.  Make the corresponding changes to the
 * references to that node in the Links table
 * @param {Array} nodes - array of updated nodes
 */
function updateFromAndToLabels(nodes) {
	let linksToUpdate = [];
	nodes.forEach((node) => {
		linksToUpdate = linksToUpdate.concat(
			Array.from(yEdgesMap.values()).filter((e) => e.from == node.id || e.to == node.id)
		);
	});
	linksTable.updateOrAddData(linksToUpdate.map((e) => convertEdge(e)));
}

/**
 * store the user's edit to the cell value
 * @param {cellComponent} cell
 */
function updateEdgeCellData(cell) {
	// get the old value of the edge
	let edge = deepCopy(yEdgesMap.get(cell.getRow().getData().id));
	// update it with the cell's new value
	edge[cell.getField()] = cell.getValue();
	edge = convertEdgeBack(edge, cell.getField(), cell.getValue());
	edge.modified = {time: Date.now(), user: myNameRec.name};
	cell.getTable().updateData([{id: edge.id, modifiedTime: timeAndDate(edge.modified.time)}]);
	// sync it
	yEdgesMap.set(edge.id, edge);
}
/**
 * Convert the properties of the edge back into the format required by vis-network
 * @param {Object} edge 
 * @param {String} field 
 * @param {Any} value 
 */
function convertEdgeBack(edge, field, value) {
	switch (field) {
		case 'arrowShape':
			edge.arrows.to.type = edge.arrowShape;
			break;
		case 'fontSize':
			edge.font.size = edge.fontSize;
			break;
		case 'lineStyle':
			switch (value) {
				case 'Solid':
					edge.dashes = false;
					break;
				case 'Dashed':
					edge.dashes = [10, 10];
					break;
				case 'Dotted':
					edge.dashes = [2, 8];
					break;
				default:
					edge.dashes = value;
					break;
			}
			break;
		case 'arrowColor':
			edge.color.color = edge.arrowColor;
			break
	}
	return edge;
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
/**
 * Use the browser standard color picker to edit the cell colour
 * @param {CellComponent} cell - the cell component for the editable cell
 * @param {Function} onRendered - function to call when the editor has been rendered
 * @param {Function} success function to call to pass the successfuly updated value to Tabulator
 * @return {DOMElement} the editor element
 */
function colorEditor(cell, onRendered, success) {
	let editor = document.createElement('input');
	editor.setAttribute('type', 'color');
	editor.style.width = '100%';
	editor.style.padding = '0px';
	editor.style.boxSizing = 'border-box';

	editor.value = cell.getValue();

	//set focus on the select box when the editor is selected (timeout allows for editor to be added to DOM)
	onRendered(function () {
		editor.focus();
		editor.style.css = '100%';
	});

	//when the value has been set, trigger the cell to update
	function successFunc() {
		success(editor.value);
	}

	editor.addEventListener('change', successFunc);
	editor.addEventListener('blur', successFunc);

	return editor;
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

listen('filter', 'click', setUpFilter);

var filterDisplayed = false;

/**
 * Display a dialog box to get the filter parameters
 */
function setUpFilter() {
	let filterDiv = elem('filter-dialog');
	if (filterDisplayed) {
		closeFilter();
		return;
	}
	filterDisplayed = true;
	let select = document.createElement('select');
	select.id = 'filter-field';
	let i = 0;
	openTable.getColumns().forEach((colComp) => {
		let def = colComp.getDefinition();
		if (def.formatter != 'color')
			// cannot sort by color
			select[i++] = new Option(def.title, def.field);
	});
	filterDiv.appendChild(select);
	filterDiv.insertAdjacentHTML('afterbegin', 'Filter: ');
	filterDiv.insertAdjacentHTML(
		'beforeend',
		`
	<select id="filter-type">
		<option value="like">contains</option>
		<option value="=">matches</option>
		<option value="starts">starts with</option>
		<option value="ends">ends with</option>
		<option value="=">=</option>
		<option value="<"><</option>
		<option value="<="><=</option>
		<option value=">">></option>
		<option value=">=">>=</option>
		<option value="!=">!=</option>
  	</select>
	  <input id="filter-value" type="text">
	  <button id= "filter-close"><i class="fas fa-times"></i></button>`
	);
	listen('filter-field', 'change', updateFilter);
	listen('filter-type', 'change', updateFilter);
	listen('filter-value', 'keyup', updateFilter);
	listen('filter-close', 'click', closeFilter);
}

/**
 * Update the table to show only the rows that pass the filter
 */
function updateFilter() {
	let select = elem('filter-field'),
		type = elem('filter-type');
	let filterVal = select.options[select.selectedIndex].value;
	var typeVal = type.options[type.selectedIndex].value;
	if (filterVal) {
		openTable.setFilter(filterVal, typeVal, elem('filter-value').value);
	}
}

function closeFilter() {
	elem('filter-dialog').innerHTML = '';
	openTable.clearFilter();
	filterDisplayed = false;
}

listen('copy', 'click', copyTable);

function copyTable() {
	openTable.copyToClipboard("all")
}