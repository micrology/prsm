/**
 * Create a random scale free network, used only for testing and demoing
 * Taken from the vis-network distribution
 *
 * Created by Alex on 5/20/2015.
 */
export function getScaleFreeNetwork(nodeCount) {
	var nodes = [];
	var edges = [];
	var connectionCount = [];

	// randomly create some nodes and edges
	for (var i = 0; i < nodeCount; i++) {
		nodes.push({
			id: String(i),
			label: String(i),
			value: 1,
		});

		connectionCount[i] = 0;

		// create edges in a scale-free-network way
		if (i == 1) {
			var from = i;
			var to = 0;
			edges.push({
				from: from.toString(),
				to: to.toString(),
			});
			connectionCount[from]++;
			connectionCount[to]++;
		} else if (i > 1) {
			var conn = edges.length * 2;
			var rand = Math.floor(seededRandom() * conn);
			var cum = 0;
			var j = 0;
			while (j < connectionCount.length && cum < rand) {
				cum += connectionCount[j];
				j++;
			}

			from = i;
			to = j;
			edges.push({
				from: from.toString(),
				to: to.toString(),
			});
			connectionCount[from]++;
			connectionCount[to]++;
		}
	}

	return {
		nodes: nodes,
		edges: edges,
	};
}

var randomSeed = 764; // Math.round(Math.random()*1000);
function seededRandom() {
	var x = Math.sin(randomSeed++) * 10000;
	return x - Math.floor(x);
}

export function deepCopy(inObject) {
	let outObject, value, key;
	if (typeof inObject !== 'object' || inObject === null) {
		return inObject; // Return the value if inObject is not an object
	}
	// Create an array or object to hold the values
	outObject = Array.isArray(inObject) ? [] : {};
	for (key in inObject) {
		value = inObject[key];
		// Recursively (deep) copy for nested objects, including arrays
		outObject[key] =
			typeof value === 'object' && value !== null
				? deepCopy(value)
				: value;
	}
	return outObject;
}

export function cleanArray(arr, propsToRemove) {
	return arr.map((item) => {
		return clean(item, propsToRemove);
	});
}

export function clean(source, propsToRemove) {
	// return a copy of an object, with the properties in the object propsToRemove removed
	let out = {};
	for (let key in source) {
		if (!(key in propsToRemove)) out[key] = source[key];
	}
	return out;
}

export function strip(obj, allowed) {
	return Object.fromEntries(
		Object.entries(obj).filter(
			([key, val]) => allowed.includes(key) // eslint-disable-line no-unused-vars
		)
	);
}

// Performs intersection operation between called set and otherSet
Set.prototype.intersection = function (otherSet) {
	let intersectionSet = new Set();
	for (var elem of otherSet) if (this.has(elem)) intersectionSet.add(elem);
	return intersectionSet;
};

export function dragElement(elmnt, header) {
	var pos1 = 0,
		pos2 = 0,
		pos3 = 0,
		pos4 = 0;
	header.onmousedown = dragMouseDown;

	function dragMouseDown(e) {
		e = e || window.event;
		e.preventDefault();
		// get the mouse cursor position at startup:
		pos3 = e.clientX;
		pos4 = e.clientY;
		document.onmouseup = closeDragElement;
		// call a function whenever the cursor moves:
		document.onmousemove = elementDrag;
	}

	function elementDrag(e) {
		e = e || window.event;
		e.preventDefault();
		// calculate the new cursor position:
		pos1 = pos3 - e.clientX;
		pos2 = pos4 - e.clientY;
		pos3 = e.clientX;
		pos4 = e.clientY;
		// set the element's new position:
		elmnt.style.top = elmnt.offsetTop - pos2 + 'px';
		elmnt.style.left = elmnt.offsetLeft - pos1 + 'px';
	}

	function closeDragElement() {
		// stop moving when mouse button is released:
		document.onmouseup = null;
		document.onmousemove = null;
	}
}

export function standardize_color(str) {
	let ctx = document.createElement('canvas').getContext('2d');
	ctx.fillStyle = str;
	return ctx.fillStyle;
}
