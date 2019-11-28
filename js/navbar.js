let mainNav = document.getElementById("js-menu");
let navBarToggle = document.getElementById("js-navbar-toggle");

const closeMainNav = function() {
  mainNav.classList.toggle("active");
}

navBarToggle.addEventListener("click", closeMainNav);

const navMenuItems = document.querySelectorAll(".nav-links");
const closeDropdownMenuSelectingItem = (() => navMenuItems.forEach((item) => item.addEventListener("click", closeMainNav)))();

let panelToggle = document.getElementById("panelToggle");
panelToggle.addEventListener("click", togglePanel);

function togglePanel() {
	let container = document.getElementById("container");
	let panel = document.getElementById("panel");
	if (getComputedStyle(document.getElementById("panel")).display == "none") {
		container.style.gridTemplateColumns = "1fr 200px";
		panel.style.display = "block";
		}
	else {
		container.style.gridTemplateColumns = "1fr 0px";
		panel.style.display = "none";
	}
}

document.getElementById("openFile").addEventListener("click", getJSONfile);

async function getJSONfile() {
	nodes.clear();
	edges.clear();
	fetch('data/BBE2019.json')
    .then(function(response) {
      if (!response.ok) {
        throw new Error("HTTP error, status = " + response.status);
      }
      return response.json();
    })
    .then(function(json) {
    	let options = { 
    		edges: { 
    			inheritColors: false
					},
			nodes: {
				fixed: false,
				parseColor: true
					}
			};
    	let parsed = vis.parseGephiNetwork(json, options);
		nodes.add(parsed.nodes);
		edges.add(parsed.edges);
		data = {
			nodes: nodes,
			edges: edges
		};
		network.setData(data);
    })
    .catch(function(error) {
      console.log('Error: ' + error.message)
    });
    return data;
}


document.getElementById("addNode").addEventListener("click", plusNode);

function plusNode() {
	document.getElementById("statusBar").innerHTML = "Add Node mode";
	document.getElementById("container").style.cursor = "cell";
	network.addNodeMode();
	}

document.getElementById("deleteNode").addEventListener("click", deleteNode);

function deleteNode() {
	document.getElementById("statusBar").innerHTML = "Add Node mode";
	document.getElementById("container").style.cursor = "cell";
	network.addNodeMode();
	}


vis.Network.prototype.zoom = function (scale) {
	let newScale = (scale === undefined ? 1 : scale);
    const animationOptions = {
        scale: newScale,
        animation: { duration: 300 }
    };
    this.view.moveTo(animationOptions);
};

function zoomnet() {
	network.zoom(document.getElementById("zoom").value);
}

function dblclk(arg) {
	document.getElementById("statusBar").innerHTML = JSON.stringify(arg);
}