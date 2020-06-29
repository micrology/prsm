/**
 * Underlay drawing for Participatory System Mapper
 * @author Nigel Gilbert
 * @email n.gilbert@surrey.ac.uk
 * @date June 2020
 *
 * After setup, when user selects a tool from the toolbox, the mouse is used to paint on the temp canvas.
 * When the tool is finished, a set of painting commands is stored; then those commands are used to redraw the main canvas.
 *
 */

import {yPointsArray} from './prism.js';
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
	alpha: 1.0,
	composite: 'source-over',
	roundCorners: true,
};

let selectedTool = null;

/* globals */
let underlay;
let mainCanvas;
let mainctx;
let tempCanvas;
let tempctx;
let dpr = window.devicePixelRatio || 1;

window.yPointsArray = yPointsArray;

/**
 * create the canvases and add listeners for mouse events
 * initialise the array holding darwing commands
 */
export function setUpPaint() {
	underlay = document.getElementById('underlay');
	mainCanvas = setUpCanvas('main-canvas');
	mainctx = getContext(mainCanvas);
	tempCanvas = setUpCanvas('temp-canvas');
	tempctx = getContext(tempCanvas);

	tempCanvas.addEventListener('mousedown', mouseDespatch);
	tempCanvas.addEventListener('mousemove', mouseDespatch);
	tempCanvas.addEventListener('mouseup', mouseDespatch);

	yPointsArray.push([['endShape']]);
}
/**
 * set up and return the canvas at the id
 * @param {string} id - canvas id
 * @returns {element}
 */
function setUpCanvas(id) {
	const canvas = document.getElementById(id);
	// Get the size of the canvas in CSS pixels.
	let rect = canvas.getBoundingClientRect();
	// Give the canvas pixel dimensions of their CSS size * the device pixel ratio.
	canvas.width = rect.width * dpr;
	canvas.height = rect.height * dpr;
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
		if (fileInput.files.length == 0) {
			document.getElementById('image').classList.remove('selected');
			selectedTool = null;
		}
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
 * all mouse events are handled here - despatch to the selected tool
 * @param {object} event
 */
function mouseDespatch(event) {
	event.preventDefault();
	if (!selectedTool) return;
	toolHandler(selectedTool)[event.type](event);
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
		this.isMouseDown = false;
		this.startX = 0;
		this.startY = 0;
		this.endX = 0;
		this.endY = 0;
		this.strokeStyle = defaultOptions.strokeStyle;
		this.fillStyle = defaultOptions.fillStyle;
		this.lineWidth = defaultOptions.lineWidth;
		this.font = defaultOptions.font;
		this.globalAlpha = defaultOptions.alpha;
		this.globalCompositeOperation = defaultOptions.composite;
	}
	/**
	 * mouse has been pressed - note the starting mouse position
	 * @param {event} e
	 */
	mousedown(e) {
		this.endPosition(e);
		this.startX = this.endX;
		this.startY = this.endY;
		this.isMouseDown = true;
	}
	/**
	 * note the mouse coordinates relative to the canvas
	 * @param {event} e
	 */
	endPosition(e) {
		this.endX = e.offsetX - tempCanvas.offsetLeft;
		this.endY = e.offsetY - tempCanvas.offsetTop;
	}
	/**
	 * do something as the mouse moves
	 */
	mousemove() {}
	/**
	 * mouseup means the shape has been completed - add a marker to record that
	 */
	mouseup() {
		yPointsArray.push([['endShape']]);
		this.isMouseDown = false;
		redraw();
	}
	/**
	 * return an object with the current canvas drawing options, either those chosen by the user,
	 * or the defaults
	 * @returns {object}
	 */
	options() {
		return {
			strokeStyle: this.strokeStyle || defaultOptions.strokeStyle,
			fillStyle: this.fillStyle || defaultOptions.fillStyle,
			lineWidth:
				this.lineWidth != undefined
					? this.lineWidth
					: defaultOptions.lineWidth,
			font: this.font || defaultOptions.font,
			globalAlpha: this.globalAlpha || defaultOptions.alpha,
			globalCompositeOperation:
				this.globalCompositeOperation || defaultOptions.composite,
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
	mousemove(e) {
		if (this.isMouseDown) {
			this.endPosition(e);
			if (this.axes) {
				if (this.endX - this.startX > this.endY - this.startY)
					this.endY = this.startY;
				else this.endX = this.startX;
			}
			drawHelper.clear(tempctx);
			drawHelper.line(tempctx, this.options(), [
				this.startX,
				this.startY,
				this.endX,
				this.endY,
			]);
		}
	}
	mouseup() {
		if (this.isMouseDown) {
			yPointsArray.push([
				[
					'line',
					this.options(),
					[
						DOMtoCanvasX(this.startX),
						DOMtoCanvasY(this.startY),
						DOMtoCanvasX(this.endX),
						DOMtoCanvasY(this.endY),
					],
				],
			]);
			super.mouseup();
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
		widthInput.focus();
		widthInput.addEventListener('change', () => {
			this.lineWidth = parseInt(widthInput.value);
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
	mousedown(e) {
		super.mousedown(e);
		underlay.style.cursor = 'crosshair';
	}
	mousemove(e) {
		if (this.isMouseDown) {
			this.endPosition(e);
			drawHelper.clear(tempctx);
			let width = this.endX - this.startX;
			let height = this.endY - this.startY;
			drawHelper[this.roundCorners ? 'rrect' : 'rect'](
				tempctx,
				this.options(),
				[
					this.startX,
					this.startY,
					width > 0 ? width : -width,
					height > 0 ? height : -height,
				]
			);
		}
	}
	mouseup() {
		if (this.isMouseDown) {
			console.log(
				this.startX,
				this.startY,
				DOMtoCanvasX(this.startX),
				DOMtoCanvasY(this.startY)
			);
			let width = DOMtoCanvasX(this.endX) - DOMtoCanvasX(this.startX);
			let height = DOMtoCanvasY(this.endY) - DOMtoCanvasY(this.startY);
			yPointsArray.push([
				[
					this.roundCorners ? 'rrect' : 'rect',
					this.options(),
					[
						DOMtoCanvasX(this.startX),
						DOMtoCanvasY(this.startY),
						width > 0 ? width : -width,
						height > 0 ? height : -height,
					],
				],
			]);
			underlay.style.cursor = 'auto';
			super.mouseup();
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
		widthInput.focus();
		widthInput.addEventListener('blur', () => {
			this.lineWidth = parseInt(widthInput.value);
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
const border = 10;

class TextHandler extends ToolHandler {
	constructor() {
		super();
		this.inp = null;
		this.writing = false;
		this.font = defaultOptions.font;
		this.fillStyle = defaultOptions.fontColor;
	}
	mousedown(e) {
		if (this.writing) return;
		this.startX = e.offsetX - tempCanvas.offsetLeft;
		this.startY = e.offsetY - tempCanvas.offsetTop;
		this.inp = document.createElement('textarea');
		underlay.appendChild(this.inp);
		this.inp.setAttribute('id', 'input');
		this.inp.setAttribute('type', 'text');
		this.inp.style.font = this.font;
		this.inp.style.color = this.fillStyle;
		this.inp.style.border = border + 'px solid lightgrey';
		this.inp.style.position = 'absolute';
		this.inp.style.left = (this.startX - border) + 'px';
		this.inp.style.top = (this.startY - border) + 'px';
		this.inp.style.width = '300px';
		this.inp.style.zIndex = 1002;
		this.unfocusfn = this.unfocus.bind(this);
		document.addEventListener('click', this.unfocusfn);
		this.writing = true;
		underlay.style.cursor = 'text';
		this.inp.focus();
		dragImage(this.inp);
	}
	unfocus(e) {
		if (this.inp.value.length > 0 && this.writing) {
			this.saveText(e);
		}
	}
	saveText(e) {
		if (this.writing && e.target != this.inp) {
			let text = this.inp.value;
			if (text.length > 0) {
				yPointsArray.push([
					[
						'text',
						this.options(),
						[
							text,
							DOMtoCanvasX(
								this.inp.offsetLeft - tempCanvas.offsetLeft + 12
							), // '11' allows for border and outline
							DOMtoCanvasY(
								this.inp.offsetTop - tempCanvas.offsetTop + 13
							),
						],
					],
				]);
			}
			this.writing = false;
			underlay.removeChild(this.inp);
			document.removeEventListener('click', this.unfocusfn);
			underlay.style.cursor = 'auto';
			super.mouseup();
		}
	}
	optionsDialog() {
		let box = super.optionsDialog('text');
		box.innerHTML = `
	<div>Size</div><div><input id="fontSize" type="text" size="2"></div>
	<div>Colour</div><div><input id="fontColor" type="color"></div>`;
		let fontSizeInput = document.getElementById('fontSize');
		fontSizeInput.value = parseInt(this.font);
		fontSizeInput.focus();
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
}
let textHandler = new TextHandler();

/* ========================================================== pencil ================================================ */
class PencilHandler extends ToolHandler {
	constructor() {
		super();
	}
	mousemove(e) {
		if (this.isMouseDown) {
			this.endPosition(e);
			drawHelper.pencil(tempctx, this.options(), [
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
	mouseup(e) {
		if (this.isMouseDown) {
			this.endPosition(e);
			this.record();
			super.mouseup();
		}
	}
	record() {
		yPointsArray.push([
			[
				'pencil',
				this.options(),
				[
					DOMtoCanvasX(this.startX),
					DOMtoCanvasY(this.startY),
					DOMtoCanvasX(this.endX),
					DOMtoCanvasY(this.endY),
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
		widthInput.focus();
		widthInput.addEventListener('blur', () => {
			this.lineWidth = parseInt(widthInput.value);
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
		this.globalAlpha = 0.2;
		this.globalCompositeOperation = 'source-over';
		this.strokeStyle = '#ffff00';
		this.lineWidth = 30;
	}
	mousemove(e) {
		if (this.isMouseDown) {
			this.endPosition(e);
			drawHelper.marker(tempctx, this.options(), [
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
	mouseup(e) {
		if (this.isMouseDown) {
			this.endPosition(e);
			this.record();
			super.mouseup();
		}
	}
	record() {
		yPointsArray.push([
			[
				'marker',
				this.options(),
				[
					DOMtoCanvasX(this.startX),
					DOMtoCanvasY(this.startY),
					DOMtoCanvasX(this.endX),
					DOMtoCanvasY(this.endY),
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
		widthInput.value = this.lineWidth;
		widthInput.focus();
		widthInput.addEventListener('blur', () => {
			this.lineWidth = parseInt(widthInput.value);
		});
		let markerColor = document.getElementById('markerColor');
		markerColor.value = this.strokeStyle;
		markerColor.addEventListener('blur', () => {
			this.strokeStyle = markerColor.value;
		});
	}
}
let markerHandler = new MarkerHandler();

/* ========================================================== eraser ================================================ */
/* the same as a marker, but with white ink and a special, bespoke cursor */

class EraserHandler extends ToolHandler {
	constructor() {
		super();
		this.strokeStyle = '#ffffff';
		this.lineWidth = 30;
	}
	mousedown(e) {
		super.mousedown(e);
		underlay.style.cursor = 'none';
	}
	mousemove(e) {
		if (this.isMouseDown) {
			this.cursor('#ffffff', 1);
			this.endPosition(e);
			drawHelper.marker(tempctx, this.options(), [
				this.startX,
				this.startY,
				this.endX,
				this.endY,
			]);
			this.record();
			this.startX = this.endX;
			this.startY = this.endY;
			this.cursor('#000000', 2);
		}
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
			Math.round(this.lineWidth / 2 - width),
			0,
			2 * Math.PI
		);
		tempctx.strokeStyle = color;
		tempctx.lineWidth = width;
		tempctx.stroke();
	}
	mouseup(e) {
		if (this.isMouseDown) {
			this.endPosition(e);
			this.record();
			super.mouseup();
			underlay.style.cursor = 'auto';
		}
	}
	record() {
		yPointsArray.push([
			[
				'marker',
				this.options(),
				[
					DOMtoCanvasX(this.startX),
					DOMtoCanvasY(this.startY),
					DOMtoCanvasX(this.endX),
					DOMtoCanvasY(this.endY),
				],
			],
		]);
	}
	optionsDialog() {
		let box = super.optionsDialog('eraser');
		box.innerHTML = `
		<div>Width</div><div><input id="eraserWidth" type="text" size="2"></div>`;
		let widthInput = document.getElementById('eraserWidth');
		widthInput.value = this.lineWidth;
		widthInput.focus();
		widthInput.addEventListener('blur', () => {
			this.lineWidth = parseInt(widthInput.value);
			if (this.lineWidth < 3) this.lineWidth = 4;
		});
	}
}
let eraserHandler = new EraserHandler();

/* ========================================================== image ================================================ */
/**
 * ImageHandler works differently.  The image is read from a file and put into a <img> element as a dataURI.  This DOM
 * element can them be easily moved and/or resized.  When the user is satisfied, indicated by clicking outside the <img>,
 * it is drawn on the main canvas.
 *
 * Selecting the file is handled within the selectTool fn, not here, because of the restriction that file dialogs can
 * only be opended from direct user action.
 */
class ImageHandler extends ToolHandler {
	constructor() {
		super();
		this.image = null;
	}
	loadImage(e) {
		if (e.target.files) {
			imageHandler.isMouseDown = true;
			let file = e.target.files[0];
			let reader = new FileReader();
			reader.readAsDataURL(file);

			reader.onloadend = function (e) {
				let image = new Image();
				imageHandler.image = image;
				image.src = e.target.result;
				image.onload = function (e) {
					// wrap the image in a div so that the rsize box can be position relative to that div
					let wrap = document.createElement('div');
					wrap.id = 'wrap';
					wrap.style.position = 'absolute';
					wrap.style.zIndex = 1000;
					let image = e.target;
					image.id = 'image';
					underlay.appendChild(wrap);
					wrap.appendChild(image);
					// check that the image is smaller than the canvas - if not, rescale it so that it fits
					let hScale = Math.ceil(
						image.offsetWidth / (underlay.offsetWidth - 100)
					);
					let vScale = Math.ceil(
						image.offsetHeight / (underlay.offsetHeight - 100)
					);
					if (hScale > 1.0 || vScale > 1.0) {
						let scale = Math.max(hScale, vScale);
						image.style.width = `${Math.round(
							image.offsetWidth / scale
						)}px`;
					}
					wrap.style.left =
						(underlay.offsetWidth - image.offsetWidth) / 2 + 'px';
					wrap.style.top =
						(underlay.offsetHeight - image.offsetHeight) / 2 + 'px';
					//  create a small square box at the bottom right to use as the resizing handle
					let resize = document.createElement('div');
					resize.classList.add('resize');
					resize.id = 'resizer';
					wrap.appendChild(resize);
					image.classList.add('marching-ants');
					underlay.addEventListener(
						'click',
						imageHandler.mouseup.bind(imageHandler)
					);
					wrap.origWidth = image.width;
					wrap.origHeight = image.height;
					dragImage(wrap);
				};
			};
		}
	}
	/**
	 * if the user clicks anywhere outside the image, stop moving and resizing and copy the image to
	 * the canvas
	 * @param {event} e
	 */
	mouseup(e) {
		if (
			this.isMouseDown &&
			e.target.id != 'image' &&
			e.target.id != 'resizer' &&
			e.target.id != 'wrap'
		) {
			e.target.style.cursor = 'auto';
			let wrap = this.image.parentNode;
			yPointsArray.push([
				[
					'image',
					this.options(),
					[
						this.image.src,
						DOMtoCanvasX(wrap.offsetLeft),
						DOMtoCanvasY(wrap.offsetTop),
						wrap.origWidth,
						wrap.origHeight,
						wrap.offsetWidth,
						wrap.offsetHeight,
					],
				],
			]);
			this.image.classList.remove('marching-ants');
			underlay.removeChild(wrap);
			super.mouseup();
		} else {
			e.target.style.cursor =
				e.target.id == 'resizer' ? 'nwse-resize' : 'move';
		}
	}
	optionsDialog() {
		/* none */
	}
}

/**
 * allow user to move and resize the image
 * @param {element} wrap
 */
function dragImage(wrap) {
	let pos1 = 0,
		pos2 = 0,
		pos3 = 0,
		pos4 = 0,
		width,
		height,
		resizing;

	wrap.onmousedown = dragMouseDown;

	function dragMouseDown(e) {
		e = e || window.event;
		e.preventDefault();
		// find the startimg width and height of the image
		let rect = wrap.getBoundingClientRect();
		width = rect.width;
		height = rect.height;
		// get the mouse cursor position at startup:
		pos3 = e.clientX;
		pos4 = e.clientY;
		wrap.onmouseup = closeDragElement;
		// call a function whenever the cursor moves:
		wrap.onmousemove = elementDrag;
		// note whether the user is moving or resizing (i.e. has the pointer over the resize handle)
		resizing = e.target.id == 'resizer';
	}

	function elementDrag(e) {
		e = e || window.event;
		e.preventDefault();
		if (resizing) {
			wrap.style.cursor = 'nwse-resize';
			// constrain the resizing to keep the original image proportions
			let hScale = (width + (e.clientX - pos3)) / width;
			let vScale = (height + (e.clientY - pos4)) / height;
			let scale = Math.max(hScale, vScale);
			let newWidth = Math.round(width * scale);
			let newHeight = Math.round(height * scale);
			wrap.firstChild.style.width = `${newWidth}px`;
			wrap.firstChild.style.height = `${newHeight}px`;
		} else {
			// move
			e.target.style.cursor = 'move';
			// calculate the new cursor position:
			pos1 = pos3 - e.clientX;
			pos2 = pos4 - e.clientY;
			pos3 = e.clientX;
			pos4 = e.clientY;
			// set the element's new position:
			wrap.style.top = wrap.offsetTop - pos2 + 'px';
			wrap.style.left = wrap.offsetLeft - pos1 + 'px';
		}
	}

	function closeDragElement() {
		// stop moving and resizing when mouse button is released:
		resizing = false;
		wrap.onmouseup = null;
		wrap.onmousemove = null;
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
		if (len == 1) return;
		let i;
		for (i = len - 2; i > 0 && points[i][0] !== 'endShape'; i--);
		yPointsArray.delete(i + 1, len - i - 1);
		redraw();
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

/**
 * redraw the main canvas, using the stored commands in yPointsArray[]
 */
export function redraw() {
	drawHelper.clear(tempctx);
	drawHelper.clear(mainctx);
	yPointsArray.forEach((point) => {
		drawHelper[point[0]](mainctx, point[1], point[2]);
	});
}

/**
 *  Like ctx.rect, but with rounded corners
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
/* ==========================================drag and zoom =======================================*/
/**
 * allow for the canvas being translated, returning a coordinate adjusted for
 * the current translation and zoom
 *
 */

function DOMtoCanvasX(x) {
	let mat = mainctx.getTransform();
	return (dpr * x - mat.e) / mat.a;
}

function DOMtoCanvasY(y) {
	let mat = mainctx.getTransform();
	return (dpr * y - mat.f) / mat.d;
}
/**
 * move the canvas (translate) by x, y pixels
 *
 * @param {Number} x
 * @param {Number} y
 */
export function dragCanvas(x, y) {
	mainctx.translate(x, y);
	redraw();
}
/**
 * scale the canvas according to the zoom level, with the scaling origin at the middle of the canvas
 * @param {Number} scale
 */

export function zoomCanvas(scale) {
	mainctx.setTransform(
		dpr * scale,
		0,
		0,
		dpr * scale,
		(-(scale - 1) * mainCanvas.width) / 2,
		(-(scale - 1) * mainCanvas.height) / 2
	);
	redraw();
}

/**
 * set the origin of the drawing canvas to the centre of the network view
 * @param {Object} {x, y} -  position returned by network.getViewPosition, the centre of the network
 */
export function positionCanvas({x, y}) {
	let mat = mainctx.getTransform();
	mat.e = -x * dpr;
	mat.f = -y * dpr;
	mainctx.setTransform(mat);
	redraw();
}

/**
 * ================================methods to redraw the canvas, one for each tool========================
 */
let drawHelper = {
	clear: function (ctx) {
		ctx.save();
		// Use the identity matrix while clearing the canvas
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		// Restore the transform
		ctx.restore();
		ctx.beginPath();
	},
	line: function (ctx, options, [startX, startY, endX, endY]) {
		ctx.beginPath();
		applyOptions(ctx, options);
		ctx.moveTo(startX, startY);
		ctx.lineTo(endX, endY);
		ctx.stroke();
	},
	rect: function (ctx, options, [startX, startY, width, height]) {
		ctx.beginPath();
		applyOptions(ctx, options);
		ctx.lineJoin = 'miter';
		ctx.rect(startX, startY, width, height);
		if (options.lineWidth > 0) ctx.stroke();
		// treat white as transparent
		if (options.fillStyle !== '#ffffff') ctx.fill();
	},
	rrect: function (ctx, options, [startX, startY, width, height]) {
		ctx.beginPath();
		applyOptions(ctx, options);
		ctx.roundRect(startX, startY, width, height, 10);
		if (options.lineWidth > 0) ctx.stroke();
		if (options.fillStyle !== '#ffffff') ctx.fill();
	},
	text: function (ctx, options, [text, x, y]) {
		ctx.beginPath();
		ctx.textBaseline = 'top';
		applyOptions(ctx, options);
		//	ctx.fillText(text, startX, startY + 3);
		let lineHeight = ctx.measureText('M').width * 1.2;
		let lines = text.split('\n');
		for (let i = 0; i < lines.length; ++i) {
			ctx.fillText(lines[i], x, y);
			y += lineHeight;
		}
	},
	pencil: function (ctx, options, [startX, startY, endX, endY]) {
		ctx.beginPath();
		applyOptions(ctx, options);
		ctx.moveTo(startX, startY);
		ctx.lineTo(endX, endY);
		ctx.stroke();
	},
	marker: function (ctx, options, [startX, startY, endX, endY]) {
		ctx.beginPath();
		applyOptions(ctx, options);
		ctx.moveTo(startX, startY);
		ctx.lineTo(endX, endY);
		ctx.stroke();
	},
	eraser: {
		/* never called: eraser uses 'marker'*/
	},
	image: function (ctx, options, [src, x, y, ow, oh, w, h]) {
		let img = new Image();
		img.src = src;
		ctx.beginPath();
		applyOptions(ctx, options);
		img.onload = function () {
			ctx.drawImage(this, 0, 0, ow, oh, x, y, w, h);
		};
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

window.redraw = redraw;
window.mainctx = mainctx;
