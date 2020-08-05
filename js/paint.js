/**
 * Underlay drawing for Participatory System Mapper
 * @author Nigel Gilbert
 * @email n.gilbert@surrey.ac.uk
 * @date June 2020
 *
 * After setup, when user selects a tool from the toolbox, the mouse is used to paint on the temp canvas.
 * When the tool is finished, a set of painting commands is stored; then those commands are used to redraw the network canvas.
 *
 */

import {yPointsArray, network, drawingSwitch} from './prism.js';
import * as Hammer from 'hammerjs';
/**
 * Initialisation
 */

/* default canvas attributes */
let defaultOptions = {
	lineWidth: 2,
	strokeStyle: '#000000',
	fillStyle: '#ffffff',
	font: '16px sans-serif',
	fontColor: '#000000',
	globalAlpha: 1.0,
	globalCompositeOperation: 'source-over',
	lineJoin: 'round',
	lineCap: 'round',
};

let selectedTool = null;

/* globals */
let underlay;
let tempCanvas;
let tempctx;
let dpr = window.devicePixelRatio || 1;

window.yPointsArray = yPointsArray;

const GRIDSPACING = 50;

/**
 * create the canvases and add listeners for mouse and touch events
 * initialise the array holding drawing commands
 */

export function setUpPaint() {
	underlay = document.getElementById('underlay');
	tempCanvas = setUpCanvas('temp-canvas');
	tempctx = getContext(tempCanvas);

	let mc = new Hammer.Manager(tempCanvas, {
		recognizers: [
			[Hammer.Tap],
			[Hammer.Pan, {direction: Hammer.DIRECTION_ALL, threshold: 1}],
		],
	});
	mc.on('tap', mouseDespatch);
	mc.on('panstart', mouseDespatch);
	mc.on('panmove', mouseDespatch);
	mc.on('panend', mouseDespatch);
	/* 	window.onorientationchange = function () {
		tempCanvas = setUpCanvas('temp-canvas');
	}; */
}
/**
 * set up the dimensions of and return the canvas at the id
 * @param {string} id - canvas id
 * @returns {element}
 */
function setUpCanvas(id) {
	const canvas = document.getElementById(id);
	// Get the size of the canvas in CSS pixels.
	let rect = canvas.parentNode.getBoundingClientRect();
	// Give the canvas pixel dimensions of their CSS size * the device pixel ratio.
	canvas.width = rect.width * dpr;
	canvas.height = rect.height * dpr;
	canvas.tabIndex = 0; // required to enable mouse click to generate blur event
	return canvas;
}

/**
 * return the context for the provided canvas
 * @param {canvas} canvas
 * @returns {context}
 */
function getContext(canvas) {
	let ctx = canvas.getContext('2d');
	ctx.scale(dpr, dpr);
	ctx.lineWidth = defaultOptions.lineWidth;
	ctx.strokeStyle = defaultOptions.strokeStyle;
	ctx.fillStyle = defaultOptions.fillstyle;
	ctx.font = defaultOptions.font;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	return ctx;
}

/**
 * add listeners for when the tool buttons are clicked
 */
export function setUpToolbox() {
	let tools = document.querySelectorAll('.tool');
	Array.from(tools).forEach((tool) => {
		tool.addEventListener('click', selectTool);
	});
}
/**
 *
 * Toolbox
 */

/**
 * event listener: when user clicks a tool icon
 * unselect previous tool, select this one
 * and remember which tool is now selected
 * The undo and image tools are special, because they act
 * immediately when the icon is clicked
 *
 * @param {object} event
 */
function selectTool(event) {
	// cleanup any remaining empty input box
	let inpBox = document.getElementById('input');
	if (inpBox) {
		textHandler.saveText(event);
	}
	let tool = event.currentTarget;
	if (tool.id == 'undo') {
		undoHandler.undo();
		// previous tool remains selected
		return;
	}
	//second click on selected tool - unselect it
	if (selectedTool === tool.id) {
		deselectTool();
		return;
	}
	// changing tool; unselect previous one
	deselectTool();
	selectedTool = tool.id;
	tool.classList.add('selected');
	// display options dialog
	toolHandler(selectedTool).optionsDialog();
	// if tool is 'image', get image file from user
	if (tool.id == 'image') {
		let fileInput = document.createElement('input');
		fileInput.id = 'fileInput';
		fileInput.setAttribute('type', 'file');
		fileInput.setAttribute('accept', 'image/*');
		fileInput.addEventListener('change', imageHandler.loadImage);
		fileInput.click();
	}
}

/**
 * unmark the selected tool, close the option dialog and set tool to null
 */
export function deselectTool() {
	if (selectedTool) {
		document.getElementById(selectedTool).classList.remove('selected');
	}
	selectedTool = null;
	closeOptionsDialogs();
}
/**
 * remove any option dialog that is open
 */
function closeOptionsDialogs() {
	let box = document.getElementById('optionsBox');
	if (box) box.remove();
}
/**
 * despatch to and perform tool actions
 */

/**
 * all mouse and touch events for the canvas are handled here - despatch to the selected tool
 * @param {object} event
 */
function mouseDespatch(event) {
	event.preventDefault();
	if (!selectedTool) return;
	let type = event.type;
	if (type == 'tap') type = 'panend';
	toolHandler(selectedTool)[type](event.srcEvent);
}

/**
 * deal with each tool, managing mouse events appropriately
 * yields drawing commands in yPointsArray[] that record what the effect of
 * each tool is
 */

/**
 * superclass for all tool handlers
 */
class ToolHandler {
	constructor() {
		this.isPanstart = false;
		this.startX = 0;
		this.startY = 0;
		this.endX = 0;
		this.endY = 0;
		this.strokeStyle = defaultOptions.strokeStyle;
		this.lineWidth = defaultOptions.lineWidth;
		this.fillStyle = defaultOptions.fillStyle;
		this.font = defaultOptions.font;
		this.fontColor = defaultOptions.fontColor;
		this.globalAlpha = defaultOptions.globalAlpha;
		this.globalCompositeOperation = defaultOptions.globalCompositeOperation;
		this.lineJoin = defaultOptions.lineJoin;
		this.lineCap = defaultOptions.lineCap;
	}
	/**
	 * mouse has been pressed - note the starting mouse position and options
	 * @param {event} e
	 */
	panstart(e) {
		if (this.isPanstart) return;
		tempCanvas.focus();
		this.endPosition(e);
		this.startX = this.endX;
		this.startY = this.endY;
		this.isPanstart = true;
		applyOptions(tempctx, this.options());
		yPointsArray.push([['options', this.options()]]);
	}
	/**
	 * note the mouse coordinates relative to the canvas
	 * @param {event} e
	 */
	endPosition(e) {
		this.endX =
			(e.offsetX * tempCanvas.width) / (dpr * tempCanvas.clientWidth);
		if (this.endX < 0) this.endX = 0;
		if (this.endX > tempCanvas.offsetWidth)
			this.endX = tempCanvas.offsetWidth;
		this.endY =
			(e.offsetY * tempCanvas.height) / (dpr * tempCanvas.clientHeight);
		if (this.endY < 0) this.endY = 0;
		if (this.endY > tempCanvas.offsetHeight)
			this.endY = tempCanvas.offsetHeight;
	}
	/**
	 * do something as the mouse moves
	 */
	panmove() {}
	/**
	 * panend means the shape has been completed - add a marker to record that
	 */
	panend() {
		yPointsArray.push([['endShape']]);
		this.isPanstart = false;
		network.redraw();
	}
	/**
	 * return an object with the current canvas drawing options
	 * @returns {object}
	 */
	options() {
		return {
			strokeStyle: this.strokeStyle,
			lineWidth: this.lineWidth,
			fillStyle: this.fillStyle,
			font: this.font,
			fontColor: this.fontColor,
			globalAlpha: this.globalAlpha,
			globalCompositeOperation: this.globalCompositeOperation,
			lineJoin: this.lineJoin,
			lineCap: this.lineCap,
		};
	}
	/**
	 * create a dialog box to allow the user to choose options for the current shape
	 * sub classes fill the box with controls
	 * @param {string} tool
	 * @returns {element}
	 */
	optionsDialog(tool) {
		let box = document.createElement('div');
		box.className = 'options';
		box.id = 'optionsBox';
		box.style.top =
			document.getElementById(tool).getBoundingClientRect().top -
			underlay.getBoundingClientRect().top +
			'px';
		box.style.left =
			document.getElementById(tool).getBoundingClientRect().right +
			10 +
			'px';
		underlay.appendChild(box);
		return box;
	}
}

/* ========================================================== line ================================================ */

class LineHandler extends ToolHandler {
	constructor() {
		super();
		this.axes = false;
	}
	panmove(e) {
		if (this.isPanstart) {
			this.endPosition(e);
			if (this.axes) {
				if (this.endX - this.startX > this.endY - this.startY)
					this.endY = this.startY;
				else this.endX = this.startX;
			}
			drawHelper.clear(tempctx);
			drawHelper.line(tempctx, [
				this.startX,
				this.startY,
				this.endX,
				this.endY,
			]);
		}
	}
	panend() {
		if (this.isPanstart) {
			yPointsArray.push([
				[
					'line',
					[
						DOMtoCanvasX(this.startX),
						DOMtoCanvasY(this.startY),
						DOMtoCanvasX(this.endX),
						DOMtoCanvasY(this.endY),
					],
				],
			]);
			super.panend();
		}
	}
	optionsDialog() {
		let box = super.optionsDialog('line');
		box.innerHTML = `
	<div>Line width</div><div><input id="lineWidth" type="text" size="2"></div>
	<div>Colour</div><div><input id="lineColour" type="color"></div>
	<div>Axes</div><div><input type="checkbox" id="axes"></div>`;
		let widthInput = document.getElementById('lineWidth');
		widthInput.value = this.lineWidth;
		widthInput.addEventListener('change', () => {
			this.lineWidth = parseInt(widthInput.value);
			if (this.lineWidth > 99) this.lineWidth = 99;
		});
		let lineColor = document.getElementById('lineColour');
		lineColor.value = this.strokeStyle;
		lineColor.addEventListener('blur', () => {
			this.strokeStyle = lineColor.value;
		});
		let axes = document.getElementById('axes');
		axes.checked = this.axes;
		axes.addEventListener('change', () => {
			this.axes = axes.checked;
		});
	}
}
let lineHandler = new LineHandler();

/* ========================================================== rect ================================================ */

class RectHandler extends ToolHandler {
	constructor() {
		super();
		this.roundCorners = true;
		this.globalAlpha = 0.5;
	}
	panstart(e) {
		super.panstart(e);
		underlay.style.cursor = 'crosshair';
	}
	panmove(e) {
		if (this.isPanstart) {
			this.endPosition(e);
			let startX = this.startX;
			let startY = this.startY;
			let endX = this.endX;
			let endY = this.endY;
			// ensure that the rect can be drawn from top left to bottom right, or vice versa
			if (Math.abs(startX) > Math.abs(endX)) {
				[startX, endX] = [endX, startX];
			}
			if (Math.abs(startY) > Math.abs(endY)) {
				[startY, endY] = [endY, startY];
			}
			drawHelper.clear(tempctx);
			let width = endX - startX;
			let height = endY - startY;
			drawHelper[this.roundCorners ? 'rrect' : 'rect'](tempctx, [
				startX,
				startY,
				width,
				height,
			]);
		}
	}
	panend() {
		if (this.isPanstart) {
			if (Math.abs(this.startX) > Math.abs(this.endX)) {
				[this.startX, this.endX] = [this.endX, this.startX];
			}
			if (Math.abs(this.startY) > Math.abs(this.endY)) {
				[this.startY, this.endY] = [this.endY, this.startY];
			}
			let width = DOMtoCanvasX(this.endX) - DOMtoCanvasX(this.startX);
			let height = DOMtoCanvasY(this.endY) - DOMtoCanvasY(this.startY);
			if (width > 0 && height > 0) {
				yPointsArray.push([
					[
						this.roundCorners ? 'rrect' : 'rect',
						[
							DOMtoCanvasX(this.startX),
							DOMtoCanvasY(this.startY),
							width,
							height,
						],
					],
				]);
			}
			underlay.style.cursor = 'auto';
			super.panend();
		}
	}
	optionsDialog() {
		let box = super.optionsDialog('rect');
		box.innerHTML = `
	<div>Border width</div><div><input id="borderWidth" type="text" size="2"></div>
  <div>Border Colour</div><div><input id="borderColour" type="color"></div>
  <div>Fill Colour</div><div><input id="fillColour" type="color"></div>
  <div>Rounded</div><input type="checkbox" id="rounded"></div>`;
		let widthInput = document.getElementById('borderWidth');
		widthInput.value = this.lineWidth;
		widthInput.addEventListener('blur', () => {
			this.lineWidth = parseInt(widthInput.value);
			if (this.lineWidth > 99) this.lineWidth = 99;
		});
		let borderColor = document.getElementById('borderColour');
		borderColor.value = this.strokeStyle;
		borderColor.addEventListener('blur', () => {
			this.strokeStyle = borderColor.value;
		});
		let fillColor = document.getElementById('fillColour');
		fillColor.value = this.fillStyle;
		fillColor.addEventListener('blur', () => {
			this.fillStyle = fillColor.value;
		});
		let rounded = document.getElementById('rounded');
		rounded.checked = this.roundCorners;
		rounded.addEventListener('change', () => {
			this.roundCorners = rounded.checked;
		});
	}
}
let rectHandler = new RectHandler();

/* ========================================================== text ================================================ */
String.prototype.splice = function (index, count, add) {
	if (index < 0) {
		index = this.length;
	}
	return this.slice(0, index) + (add || '') + this.slice(index + count);
};

const border = 10;

class TextHandler extends ToolHandler {
	constructor() {
		super();
		this.inp = null;
		this.writing = false;
		this.font = defaultOptions.font;
		this.fillStyle = defaultOptions.fontColor;
	}
	panstart(e) {
		if (this.writing) return;
		this.startX = e.offsetX;
		this.startY = e.offsetY;
		this.div = document.createElement('div');
		underlay.appendChild(this.div);
		this.div.style.position = 'absolute';
		this.div.style.zIndex = 1002;
		this.div.style.boxSizing = 'border-box';
		this.div.style.border = border + 'px solid lightgrey';
		this.div.style.left = this.startX - border + 'px';
		this.div.style.top = this.startY - border + 'px';
		this.div.style.width = '300px';
		this.div.style.height = 2 * border + 50 + 'px';
		this.div.style.cursor = 'move';
		this.inp = document.createElement('textarea');
		this.div.appendChild(this.inp);
		this.inp.setAttribute('id', 'input');
		this.inp.setAttribute('type', 'text');
		this.inp.style.font = this.font;
		this.inp.style.color = this.fillStyle;
		this.inp.style.position = 'absolute';
		this.inp.style.boxSizing = 'border-box';
		this.inp.style.width = '100%';
		this.inp.style.height = '100%';
		this.inp.style.resize = 'none';
		this.inp.wrap = 'off';
		this.inp.addEventListener('keyup', this.insertNewlines.bind(this));
		this.inp.style.overflow = 'hidden';
		//  create a small square box at the bottom right to use as the resizing handle
		this.resizer = document.createElement('div');
		this.resizer.classList.add('resize');
		this.resizer.id = 'resizer';
		this.div.appendChild(this.resizer);
		this.resizer.cursor = 'nwse-resize';
		this.unfocusfn = this.unfocus.bind(this);
		document.addEventListener('click', this.unfocusfn);
		this.writing = true;
		this.dragElement(this.div);
		super.panstart(e);
		this.inp.focus();
	}
	// tap to start a text box
	panend(e) {
		this.panstart(e);
	}
	insertNewlines() {
		// If the width of the chars in textarea are greater than its width then insert newline
		if (this.inp.scrollWidth > this.inp.clientWidth) {
			let lastSpace = this.inp.value.lastIndexOf(' ');
			this.inp.value = this.inp.value.splice(lastSpace, 1, '\n');
		}
	}
	unfocus(e) {
		if (this.inp.value.length > 0 && this.writing) {
			this.saveText(e);
		}
	}
	saveText(e) {
		if (
			this.writing &&
			e.target != this.inp &&
			e.target != this.div &&
			e.target != this.resizer
		) {
			let text = this.inp.value;
			if (text.length > 0) {
				yPointsArray.push([
					[
						'text',
						[
							text,
							DOMtoCanvasX(
								((this.div.offsetLeft + 12) *
									tempCanvas.width) /
									(dpr * tempCanvas.clientWidth)
							), // '12' allows for border and outline
							DOMtoCanvasY(
								((this.div.offsetTop + 14) *
									tempCanvas.height) /
									(dpr * tempCanvas.clientHeight)
							),
						],
					],
				]);
			}
			this.writing = false;
			underlay.removeChild(this.div);
			document.removeEventListener('click', this.unfocusfn);
			underlay.style.cursor = 'auto';
			super.panend();
		}
	}
	optionsDialog() {
		let box = super.optionsDialog('text');
		box.innerHTML = `
	<div>Size</div><div><input id="fontSize" type="text" size="2"></div>
	<div>Colour</div><div><input id="fontColor" type="color"></div>`;
		let fontSizeInput = document.getElementById('fontSize');
		fontSizeInput.value = parseInt(this.font);
		fontSizeInput.addEventListener('blur', () => {
			this.font =
				fontSizeInput.value + 'px ' + this.fontFamily(this.font);
		});
		let fontColor = document.getElementById('fontColor');
		fontColor.value = this.fillStyle;
		fontColor.addEventListener('blur', () => {
			this.fillStyle = fontColor.value;
		});
	}
	/**
	 * returns the font-family from a CSS font definition, e.g. "16px sans-serif"
	 * @param {string} str
	 */
	fontFamily(str) {
		return str.substring(str.indexOf(' ') + 1);
	}
	/**
	 * allow user to move and resize the DIV
	 * @param {element} elem
	 */
	dragElement(elem) {
		let resizing = false;
		let lastPosX = 0;
		let lastPosY = 0;
		let width = 0;
		let height = 0;
		let isDragging = false;

		let mc = new Hammer(elem);
		mc.add(new Hammer.Pan({direction: Hammer.DIRECTION_ALL, threshold: 0}));
		mc.on('pan', handleDrag);

		function handleDrag(e) {
			let target = e.target;
			if (!isDragging) {
				isDragging = true;
				lastPosX = elem.offsetLeft;
				lastPosY = elem.offsetTop;
				let rect = elem.getBoundingClientRect();
				width = rect.width;
				height = rect.height;
				resizing = target.id == 'resizer';
			}
			if (resizing) {
				let newWidth = width + e.deltaX;
				let newHeight = height + e.deltaY;
				elem.style.width = `${newWidth}px`;
				elem.style.height = `${newHeight}px`;
			} else {
				// move
				let posX = e.deltaX + lastPosX;
				let posY = e.deltaY + lastPosY;
				elem.style.left = posX + 'px';
				elem.style.top = posY + 'px';
			}
			if (e.isFinal) {
				isDragging = false;
				resizing = false;
			}
		}
	}
}
let textHandler = new TextHandler();

/* ========================================================== pencil ================================================ */
class PencilHandler extends ToolHandler {
	constructor() {
		super();
		this.lineCap = 'butt';
		this.lineJoin = 'round';
	}
	panmove(e) {
		if (this.isPanstart) {
			this.endPosition(e);
			drawHelper.pencil(tempctx, [
				this.startX,
				this.startY,
				this.endX,
				this.endY,
			]);
			this.record();
			this.startX = this.endX;
			this.startY = this.endY;
		}
	}
	panend(e) {
		if (this.isPanstart) {
			this.endPosition(e);
			this.record();
			super.panend();
		}
	}
	record() {
		let scaledLW = Math.round(this.lineWidth / network.body.view.scale);
		yPointsArray.push([
			[
				'pencil',
				[
					DOMtoCanvasX(this.startX),
					DOMtoCanvasY(this.startY),
					DOMtoCanvasX(this.endX),
					DOMtoCanvasY(this.endY),
					scaledLW,
				],
			],
		]);
	}
	optionsDialog() {
		let box = super.optionsDialog('pencil');
		box.innerHTML = `
		<div>Width</div><div><input id="pencilWidth" type="text" size="2"></div>
		<div>Colour</div><div><input id="pencilColor" type="color"></div>`;
		let widthInput = document.getElementById('pencilWidth');
		widthInput.value = this.lineWidth;
		widthInput.addEventListener('blur', () => {
			this.lineWidth = parseInt(widthInput.value);
			if (this.lineWidth > 99) this.lineWidth = 99;
		});
		let pencilColor = document.getElementById('pencilColor');
		pencilColor.value = this.strokeStyle;
		pencilColor.addEventListener('blur', () => {
			this.strokeStyle = pencilColor.value;
		});
	}
}
let pencilHandler = new PencilHandler();

/* ========================================================== marker ================================================ */
class MarkerHandler extends ToolHandler {
	constructor() {
		super();
		this.globalCompositeOperation = 'multiply';
		this.fillStyle = '#ffff00';
		this.markerWidth = 30;
	}
	panmove(e) {
		if (this.isPanstart) {
			this.endPosition(e);
			this.record();
			drawHelper.marker(tempctx, [
				this.startX,
				this.startY,
				this.markerWidth,
			]);
			this.startX = this.endX;
			this.startY = this.endY;
		}
	}
	panend(e) {
		if (this.isPanstart) {
			this.endPosition(e);
			this.record();
			super.panend();
		}
	}
	record() {
		yPointsArray.push([
			[
				'marker',
				[
					DOMtoCanvasX(this.startX),
					DOMtoCanvasY(this.startY),
					Math.round(this.markerWidth / network.body.view.scale),
				],
			],
		]);
	}
	optionsDialog() {
		let box = super.optionsDialog('marker');
		box.innerHTML = `
		<div>Width</div><div><input id="markerWidth" type="text" size="2"></div>
		<div>Colour</div><div><input id="markerColor" type="color"></div>`;
		let widthInput = document.getElementById('markerWidth');
		widthInput.value = this.markerWidth;
		widthInput.addEventListener('blur', () => {
			this.markerWidth = parseInt(widthInput.value);
			if (this.markerWidth > 99) this.markerWidth = 99;
		});
		let markerColor = document.getElementById('markerColor');
		markerColor.value = this.fillStyle;
		markerColor.addEventListener('blur', () => {
			this.fillStyle = markerColor.value;
		});
	}
}
let markerHandler = new MarkerHandler();

/* ========================================================== eraser ================================================ */
/* the same as a marker, but with white ink and a special, bespoke cursor */

class EraserHandler extends ToolHandler {
	constructor() {
		super();
		this.fillStyle = '#ffffff';
		this.markerWidth = 30;
	}
	panstart(e) {
		super.panstart(e);
		underlay.style.cursor = 'none';
	}
	panmove(e) {
		if (this.isPanstart) {
			this.cursor('#ffffff', 1);
			this.endPosition(e);
			this.record();
			drawHelper.marker(tempctx, [
				this.startX,
				this.startY,
				this.markerWidth,
			]);
			this.startX = this.endX;
			this.startY = this.endY;
			this.cursor('#000000', 2);
		}
	}
	panend(e) {
		if (this.isPanstart) {
			this.endPosition(e);
			this.record();
			underlay.style.cursor = 'auto';
			super.panend();
		}
	}
	record() {
		yPointsArray.push([
			[
				'marker',
				[
					DOMtoCanvasX(this.startX),
					DOMtoCanvasY(this.startY),
					Math.round(this.markerWidth / network.body.view.scale),
				],
			],
		]);
	}
	/**
	 * draw a circle at the mouse to simulate a cursor
	 * @param {string} color - as hex
	 * @param {integer} width
	 */
	cursor(color, width) {
		tempctx.beginPath();
		tempctx.arc(
			this.startX,
			this.startY,
			Math.round(this.markerWidth / 2 - width),
			0,
			2 * Math.PI
		);
		tempctx.strokeStyle = color;
		tempctx.stroke();
	}
	optionsDialog() {
		let box = super.optionsDialog('eraser');
		box.innerHTML = `
		<div>Width</div><div><input id="eraserWidth" type="text" size="2"></div>`;
		let widthInput = document.getElementById('eraserWidth');
		widthInput.value = this.markerWidth;
		widthInput.addEventListener('blur', () => {
			this.markerWidth = parseInt(widthInput.value);
			if (this.markerWidth < 3) this.markerWidth = 4;
			if (this.markerWidth > 99) this.markerWidth = 99;
		});
	}
}
let eraserHandler = new EraserHandler();

/* ========================================================== image ================================================ */
/**
 * ImageHandler works differently.  The image is read from a file and put into a <img> element as a dataURI.
 *  When the user is satisfied, indicated by clicking outside the image, it is drawn on the main canvas.
 *
 * Selecting the file is handled within the selectTool fn, not here, because of the restriction that file dialogs can
 * only be opended from direct user action.
 */

const resizeBox = 10; // size in pixels of small square that is the resizing handle

class ImageHandler extends ToolHandler {
	constructor() {
		super();
		this.image = null;
		this.resizing = false;
	}
	loadImage(e) {
		if (e.target.files) {
			let file = e.target.files[0];
			let reader = new FileReader();
			reader.readAsDataURL(file);

			reader.onloadend = function (e) {
				let image = new Image();
				imageHandler.image = image;
				image.src = e.target.result;
				image.onload = function (e) {
					let image = e.target;
					image.origWidth = image.width;
					image.origHeight = image.height;
					underlay.appendChild(image);
					// check that the image is smaller than the canvas - if not, rescale it so that it fits
					let hScale = Math.ceil(
						image.origWidth / (underlay.offsetWidth - 100)
					);
					let vScale = Math.ceil(
						image.origHeight / (underlay.offsetHeight - 100)
					);
					let scale = 1;
					if (hScale > 1.0 || vScale > 1.0)
						scale = Math.max(hScale, vScale);
					image.width = Math.round(image.origWidth / scale);
					image.startWidth = image.width;
					image.style.width = image.width + 'px';
					image.height = Math.round(image.origHeight / scale);
					image.startHeight = image.height;
					image.style.height = image.height + 'px';
					image.left = (underlay.offsetWidth - image.width) / 2;
					image.style.left = image.left + 'px';
					image.top = (underlay.offsetHeight - image.height) / 2;
					image.style.top = image.top + 'px';
					//					image.style.boxSizing = 'border-box';
					image.style.position = 'absolute';
					imageHandler.paintImage(
						image,
						image.origWidth,
						image.origHeight,
						image.left,
						image.top,
						image.width,
						image.height
					);
					imageHandler.image = image;
					underlay.removeChild(image);
				};
			};
		}
	}
	paintImage(image, ow, oh, left, top, width, height) {
		tempctx.drawImage(image, 0, 0, ow, oh, left, top, width, height);
		//  create a small square box at the bottom right to use as the resizing handle
		tempctx.fillStyle = 'black';
		tempctx.fillRect(
			left + width - resizeBox,
			top + height - resizeBox,
			resizeBox,
			resizeBox
		);
		// add marching ants
		antMarch(left, top, width, height);
	}
	/**
	 * startX and startY are mouse locations at the start of the drag
	 * endX and endY are the locations of the mouse pointer during the drag
	 * endX - startX, endY - startY are thus the drag vector
	 * origWidth and origHeight are the size of the image when first loaded
	 * startWidth and startHeight are the width and height at the start of resizing
	 * startLeft and startTop are the position of the top left of the image at the start of dragging
	 * image.left, image.top, image.width and image.height are the values during dragging and resizing that change as the mouse moves
	 *
	 */
	panstart(e) {
		super.panstart(e);
		this.image.startLeft = this.image.left;
		this.image.startTop = this.image.top;
		const resizingBlock = 2 * resizeBox; // give a little leeway for pointer
		this.resizing =
			this.startX >= this.image.left + this.image.width - resizingBlock &&
			this.startX <= this.image.left + this.image.width &&
			this.startY >= this.image.top + this.image.height - resizingBlock &&
			this.startY <= this.image.top + this.image.height;
		underlay.style.cursor = this.resizing ? 'nwse-resize' : 'move';
	}
	panmove(e) {
		if (this.isPanstart) {
			this.endPosition(e);
			drawHelper.clear(tempctx);
			if (this.resizing) {
				let hScale =
					(this.image.startWidth + this.endX - this.startX) /
					this.image.startWidth;
				let vScale =
					(this.image.startHeight + this.endY - this.startY) /
					this.image.startHeight;
				let scale = Math.max(hScale, vScale);
				hScale = scale;
				vScale = scale;
				this.image.width = Math.max(
					20,
					Math.round(this.image.startWidth * hScale)
				);
				this.image.height = Math.max(
					20,
					Math.round(this.image.startHeight * vScale)
				);
				this.paintImage(
					this.image,
					this.image.origWidth,
					this.image.origHeight,
					this.image.left,
					this.image.top,
					this.image.width,
					this.image.height
				);
			} else {
				this.image.left =
					this.image.startLeft + this.endX - this.startX;
				this.image.top = this.image.startTop + this.endY - this.startY;
				this.paintImage(
					this.image,
					this.image.origWidth,
					this.image.origHeight,
					this.image.left,
					this.image.top,
					this.image.width,
					this.image.height
				);
			}
		}
	}
	/**
	 * if the user clicks anywhere outside the image, stop moving and resizing and copy the image to
	 * the canvas
	 * @param {event} e
	 */
	panend(e) {
		this.isPanstart = false;
		this.endPosition(e);
		if (
			!(
				this.endX >= this.image.left &&
				this.endX <= this.image.left + this.image.width &&
				this.endY >= this.image.top &&
				this.endY <= this.image.top + this.image.height
			)
		) {
			yPointsArray.push([
				[
					'image',
					[
						this.image.src,
						DOMtoCanvasX(this.image.left),
						DOMtoCanvasY(this.image.top),
						this.image.origWidth,
						this.image.origHeight,
						this.image.width,
						this.image.height,
					],
				],
			]);
			underlay.style.cursor = 'auto';
			if (timer) clearTimeout(timer);
			super.panend();
			deselectTool();
		} else {
			if (this.resizing) {
				this.resizing = false;
				this.image.startWidth = this.image.width;
				this.image.startHeight = this.image.height;
			} else {
				this.image.left =
					this.image.startLeft + this.endX - this.startX;
				this.image.top = this.image.startTop + this.endY - this.startY;
			}
		}
	}
	optionsDialog() {
		/* none */
	}
}
let ant = 0;
let timer = null; // timer to advance ants.  To cancel ants, clear this timer
/**
 * draw 'marching ants' around a rectangle
 * @param {Number} left
 * @param {Number} top
 * @param {Number} width
 * @param {Number} height
 */
function antMarch(left, top, width, height) {
	if (timer) clearTimeout(timer);
	march();

	function march() {
		ant++;
		if (ant > 16) ant = 0;
		drawAnts();
		timer = setTimeout(march, 100);
	}
	function drawAnts() {
		tempctx.save();
		tempctx.strokeStyle = 'white';
		tempctx.strokeRect(left, top, width, height);
		tempctx.strokeStyle = 'rgba(176, 190, 197, 0.8)';
		tempctx.setLineDash([2, 4]);
		tempctx.lineDashOffset = -ant;
		tempctx.strokeRect(left, top, width, height);
		tempctx.restore();
	}
}
let imageHandler = new ImageHandler();

/* ========================================================== undo ================================================ */
class UndoHandler extends ToolHandler {
	constructor() {
		super();
	}
	/**
	 *  starting with the last of the recorded yPointsArray, delete backwards until the previous 'endShape'
	 *  and then redraw what remains
	 */
	undo() {
		let len = yPointsArray.length;
		let points = yPointsArray.toArray();
		if (len == 0) return;
		let i;
		for (i = len - 2; i >= 0 && points[i][0] !== 'endShape'; i--);
		yPointsArray.delete(i + 1, len - i - 1);
		deselectTool();
		network.redraw();
	}
}
let undoHandler = new UndoHandler();

const toolToHandler = {
	line: lineHandler,
	rect: rectHandler,
	text: textHandler,
	pencil: pencilHandler,
	marker: markerHandler,
	eraser: eraserHandler,
	image: imageHandler,
	undo: undoHandler,
};
/**
 * return the correct instance of toolHandler for the given tool
 * @param {string} tool
 * @returns {instance}
 */
function toolHandler(tool) {
	return toolToHandler[tool];
}

/* ==========================================drag and zoom =======================================*/
/**
 * allow for the canvas being translated, returning a coordinate adjusted for
 * the current translation and zoom, so that it is relative to the origin at the centre
 * with scale = 1.
 */

function DOMtoCanvasX(x) {
	return (
		((dpr * tempCanvas.clientWidth * x) / tempCanvas.width -
			network.body.view.translation.x) /
		network.body.view.scale
	);
}

function DOMtoCanvasY(y) {
	return (
		((dpr * tempCanvas.clientHeight * y) / tempCanvas.height -
			network.body.view.translation.y) /
		network.body.view.scale
	);
}

/**
 * ================================methods to redraw the canvas, one for each tool========================
 */

/**
 * redraw the main canvas, using the stored commands in yPointsArray[]
 */
export function redraw(netctx) {
	drawHelper.clear(tempctx);
	netctx.save();
	if (drawingSwitch) drawGrid(netctx);
	yPointsArray.forEach((point) => {
		drawHelper[point[0]](netctx, point[1], point[2]);
	});
	netctx.restore();
}

/**
 *  Like ctx.rect(), but with rounded corners
 */
CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
	if (w < 2 * r) r = w / 2;
	if (h < 2 * r) r = h / 2;
	this.beginPath();
	this.moveTo(x + r, y);
	this.arcTo(x + w, y, x + w, y + h, r);
	this.arcTo(x + w, y + h, x, y + h, r);
	this.arcTo(x, y + h, x, y, r);
	this.arcTo(x, y, x + w, y, r);
	this.closePath();
	return this;
};
/**
 * draw a faint evenly spaced grid over the drawing area
 * @param {CanvasContext} ctx
 */

function drawGrid(netctx) {
	let scale = network.body.view.scale;
	let width = network.body.container.clientWidth / scale;
	let height = network.body.container.clientHeight / scale;
	let cell = GRIDSPACING * scale;
	if (cell < 30) cell = 30;
	netctx.save();
	netctx.strokeStyle = 'rgba(211, 211, 211, 0.7)'; //'lightgrey';
	netctx.beginPath();
	for (let x = -(width / 2 + cell); x <= width / 2 + cell; x += cell) {
		// vertical grid lines
		netctx.moveTo(x, -(height / 2 + cell));
		netctx.lineTo(x, height / 2 + cell);
	}
	for (let y = -(height / 2 + cell); y <= height / 2 + cell; y += cell) {
		// horizontal grid lines
		netctx.moveTo(-(width / 2 + cell), y);
		netctx.lineTo(width / 2 + cell, y);
	}
	netctx.stroke();
	netctx.restore();
}

let imageCache = new Map();

let drawHelper = {
	clear: function (ctx) {
		// Use the identity matrix while clearing the canvas
		ctx.setTransform(2, 0, 0, 2, 0, 0);
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	},
	options: function (ctx, options) {
		applyOptions(ctx, options);
	},
	line: function (ctx, [startX, startY, endX, endY]) {
		ctx.beginPath();
		ctx.moveTo(startX, startY);
		ctx.lineTo(endX, endY);
		ctx.stroke();
	},
	rect: function (ctx, [startX, startY, width, height]) {
		ctx.beginPath();
		ctx.lineJoin = 'miter';
		ctx.rect(startX, startY, width, height);
		if (ctx.lineWidth > 0) ctx.stroke();
		// treat white as transparent
		if (ctx.fillStyle !== '#ffffff') ctx.fill();
	},
	rrect: function (ctx, [startX, startY, width, height]) {
		ctx.beginPath();
		ctx.roundRect(startX, startY, width, height, 10);
		if (ctx.lineWidth > 0) ctx.stroke();
		if (ctx.fillStyle !== '#ffffff') ctx.fill();
	},
	text: function (ctx, [text, x, y]) {
		ctx.textBaseline = 'top';
		ctx.beginPath();
		let lineHeight = ctx.measureText('M').width * 1.2;
		let lines = text.split('\n');
		for (let i = 0; i < lines.length; ++i) {
			ctx.fillText(lines[i], x, y);
			y += lineHeight;
		}
	},
	pencil: function (ctx, [startX, startY, endX, endY, width]) {
		ctx.lineWidth = width;
		ctx.beginPath();
		ctx.moveTo(startX, startY);
		ctx.lineTo(endX, endY);
		ctx.stroke();
	},
	marker: function (ctx, [startX, startY, width]) {
		let halfWidth = Math.round(width / 2);
		ctx.beginPath();
		ctx.roundRect(
			startX - halfWidth,
			startY - halfWidth,
			width,
			width,
			halfWidth
		);
		ctx.fill();
	},
	eraser: {
		/* never called: eraser uses 'marker'*/
	},
	image: function (ctx, [src, x, y, ow, oh, w, h]) {
		let xt = x + network.body.view.translation.x;
		let yt = y + network.body.view.translation.y;
		let img = imageCache.get(src.substring(0, 100));
		if (img == undefined) {
			// not yet cached, so create the Image
			img = new Image();
			img.src = src;
			imageCache.set(src.substring(0, 100), img);
			img.onload = function () {
				ctx.drawImage(this, 0, 0, ow, oh, xt, yt, w, h);
			};
		} else {
			ctx.drawImage(img, 0, 0, ow, oh, x, y, w, h);
		}
	},
	undo: {
		/* never called */
	},
	endShape: function () {
		/* noop */
	},
};

/**
 * apply the canvas options to the context
 * @param {context} ctx
 * @param {object} options - object with options as properties
 */

function applyOptions(ctx, options) {
	for (let option in options) ctx[option] = options[option];
}
