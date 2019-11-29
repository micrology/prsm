// Add event listeners to tab buttons
document.getElementById("nodesButton").addEventListener("click", () => {
    openTab("nodesTab");
}, false);
document.getElementById("linksButton").addEventListener("click", () => {
    openTab("linksTab");
}, false);
document.getElementById("statisticsButton").addEventListener("click", () => {
    openTab("statisticsTab");
}, false);

function openTab(tabId) {
    // Declare all variables
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabId).style.display = "block";
    event.currentTarget.className += " active";
}

// start with first tab open
document.getElementById("nodesButton").click();

// samples: add listeners

// Get all elements with class="sampleNode" and add listener
let samples = document.getElementsByClassName("sampleNode");
for (let i = 0; i < samples.length; i++) {
    samples[i].addEventListener("click", () => {
        applySampleToNode();
    }, false);
}
// and to all sampleLinks
samples = document.getElementsByClassName("sampleLink");
for (let i = 0; i < samples.length; i++) {
    samples[i].addEventListener("click", () => {
        applySampleToLink();
    }, false);
}

// Clicking anywhere else clears the status bar (note trick: click is processed in the capturing phase)
document.getElementById("container").addEventListener("click", () => {
    clearStatusBar();
}, true);

function applySampleToNode() {
    let target = event.currentTarget.id;
    let selectedNodeIds = network.getSelectedNodes();
    let sampleFormat = sampleFormats.find(({
        format
    }) => format === target);
    for (let e of data.nodes.get(selectedNodeIds)) {
        e = Object.assign(e, sampleFormat);
        data.nodes.update(e);
    }
    network.redraw();
   statusMsg("Clicked " + target + " for nodes " + selectedNodeIds);
}

function applySampleToLink() {
    let target = event.currentTarget.id;
    statusLsg("Clicked " + target);
}

function clearStatusBar() {
    statusMsg("<br>");
}
