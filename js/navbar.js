var lastFileName = 'network.json';


document.getElementById("js-navbar-toggle").addEventListener("click", closeMainNav);

const navMenuItems = document.querySelectorAll(".nav-links");
const closeDropdownMenuSelectingItem = (() => navMenuItems.forEach((item) => item.addEventListener("click", closeMainNav)))();

document.getElementById("openFile").addEventListener("click", doClickOpenFile);
document.getElementById("saveFile").addEventListener("click", saveJSONfile);
document.getElementById("panelToggle").addEventListener("click", togglePanel);
document.getElementById("addNode").addEventListener("click", plusNode);
document.getElementById("addLink").addEventListener("click", plusLink);
document.getElementById("deleteNode").addEventListener("click", deleteNode);

function closeMainNav() {
    document.getElementById("js-menu").classList.toggle("active");
}

function togglePanel() {
    let container = document.getElementById("container");
    if (getComputedStyle(container).gridTemplateColumns.match(/\d+px\s(\d+)px/)[1] == 0) {
        container.style.gridTemplateColumns = "1fr 200px";
    } else {
        container.style.gridTemplateColumns = "1fr 0px";
    }
}

/* 
function togglePanel() {
    let container = document.getElementById("container");
    let panel = document.getElementById("panel");
    if (getComputedStyle(document.getElementById("panel")).display == "none") {
        container.style.gridTemplateColumns = "1fr 200px";
        panel.style.display = "block";
    } else {
        container.style.gridTemplateColumns = "1fr 0px";
        panel.style.display = "none";
    }
}
 */

document.getElementById('fileInput').addEventListener('change', readSingleFile, false);

function readSingleFile(e) {
  var file = e.target.files[0];
  if (!file) {
    return;
  }
  let fileName = file.name;
  lastFileName = fileName;
  statusMsg("Reading '" + fileName + "'");
  var reader = new FileReader();
  reader.onload = function(e) {
  	try {
			let json = JSON.parse(e.target.result);
			loadJSONfile(json);
			statusMsg("Read '" + fileName + "'");
		} catch (err) {
			statusMsg("Error reading '" + fileName + "': " + err.message);
			return;
		}
  };
  reader.readAsText(file);
}

function doClickOpenFile() {
 	document.getElementById('fileInput').click();
}


function loadJSONfile(json) {
    nodes.clear();
    edges.clear();
    hideNotes();
    let options = {
        edges: {
            inheritColors: false
        },
        nodes: {
            fixed: false,
            parseColor: true
        }
    };
    if (json.version && (version > json.version)) {
    	statusMsg("Warning: file was created in an earlier version of PRISM");
    	}
    if ('source' in json.edges[0]) {
        // the file is from Gephi and needs to be translated
        let parsed = vis.parseGephiNetwork(json, options);
        nodes.add(parsed.nodes);
        edges.add(parsed.edges);
    } else {
        nodes.add(json.nodes);
        edges.add(json.edges);
    }
    data = {
        nodes: nodes,
        edges: edges
    };
	network.setOptions({interaction: {
		hideEdgesOnDrag: data.nodes.length > 100,
		hideEdgesOnZoom: data.nodes.length > 100
		  }});
/* TODO
	if (json.groups) {
		groups = json.groups;
		network.setOptions({groups: groups});
		}
 */
	if (json.groupEdges) {
		groupEdges = json.groupEdges;
		}
    network.setData(data);
}

/* 
Browser will only ask for name and location of the file to be saved if
it has a user setting to do so.  Otherwise, it is saved at a default
download location with a default name.
 */

function saveJSONfile() {
    let json = JSON.stringify({
    	saved: new Date(Date.now()).toLocaleString(),
    	version: version,
    	groups: network.groups.groups,
    	groupEdges: groupEdges,
        nodes: data.nodes.get(),
        edges: data.edges.get()
    });
    let element = document.getElementById("download");
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(json));
    element.setAttribute('download', lastFileName);
    element.click();
}

function plusNode() {
    statusMsg("Add Node mode");
    inAddMode = true;
    changeCursor("cell");
    network.addNodeMode();
}

function plusLink() {
    statusMsg("Add Edge mode");
    inAddMode = true;
    changeCursor("crosshair");
    network.addEdgeMode();
}

function deleteNode() {
    network.deleteSelected();
}

vis.Network.prototype.zoom = function(scale) {
	if (scale === 'fit') {
		this.view.fit();
		return;
		}
    let newScale = (scale === undefined ? 1 : scale);
    const animationOptions = {
        scale: newScale,
        animation: {
            duration: 300
        }
    };
    this.view.moveTo(animationOptions);
};

function zoomnet() {
    network.zoom(document.getElementById("zoom").value);
}
