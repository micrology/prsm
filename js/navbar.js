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
    let panel = document.getElementById("panel");
    if (getComputedStyle(document.getElementById("panel")).display == "none") {
        container.style.gridTemplateColumns = "1fr 200px";
        panel.style.display = "block";
    } else {
        container.style.gridTemplateColumns = "1fr 0px";
        panel.style.display = "none";
    }
}

const fileElem = document.getElementById("fileElem");

fileElem.addEventListener("change", function(event) {
    let files = fileElem.files;
    if (files.length) {
        let myFile = this.files[0];
        let fileName = myFile.name;
        lastFileName = fileName;
        let reader = new FileReader();

        reader.addEventListener('load', function(e) {
            try {
                let json = JSON.parse(e.target.result);
                loadJSONfile(json);
                statusMsg("Read '" + fileName + "'");
            } catch (err) {
                statusMsg("Error reading '" + fileName + "': " + err.message);
                return;
            }
        });
        reader.readAsBinaryString(myFile);
    }
}, false);

function doClickOpenFile() {
    fileElem.click();
}

function loadJSONfile(json) {
    nodes.clear();
    edges.clear();
    let options = {
        edges: {
            inheritColors: false
        },
        nodes: {
            fixed: false,
            parseColor: true
        }
    };
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
    if (data.nodes.length > 100) {
			network.setOptions({interaction: {
				hideEdgesOnDrag: true,
				hideEdgesOnZoom: true,
		  }});
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
    document.getElementById("container").style.cursor = "cell";
    network.addNodeMode();
}

function plusLink() {
    // TODO
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
