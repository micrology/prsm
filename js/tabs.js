// Add event listeners to tab buttons

document.getElementById("nodesButton").addEventListener("click", () => { openTab("nodesTab"); }, false);
document.getElementById("linksButton").addEventListener("click", () => { openTab("linksTab"); }, false);
document.getElementById("statisticsButton").addEventListener("click", () => { openTab("statisticsTab"); }, false);

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
let i;
for (i = 0; i < samples.length; i++) {
	samples[i].addEventListener("click", () => { applySampleToNode(); }, false);
}
// and to all sampleLinks
samples = document.getElementsByClassName("sampleLink");
for (i = 0; i < samples.length; i++) {
	samples[i].addEventListener("click", () => { applySampleToLink(); }, false);
}

// Clicking anywhere else clears the status bar (note trick: click is processed in the capturing phase)
document.getElementById("container").addEventListener("click", () => { clearStatusBar(); }, true);

function applySampleToNode() {
let target = event.currentTarget.id;
let selectedNodeIds = network.getSelectedNodes();
let sampleFormat = sampleFormats.find( ({sample}) => sample === target);
for (let e of data.nodes.get(selectedNodeIds)) {
//	e.color = {highlight: {border: "red"}};
	e = Object.assign(e, sampleFormat);
	data.nodes.update(e);
	}
network.redraw();
document.getElementById("statusBar").innerHTML = "Clicked " + target + " for nodes " + selectedNodeIds;
}

function applySampleToLink() {
let target = event.currentTarget.id;
document.getElementById("statusBar").innerHTML = "Clicked " + target;
}


function clearStatusBar() {
document.getElementById("statusBar").innerHTML = "<br>";
}

let sampleFormats = [{
	sample: "default",
	borderWidth: 1,
    borderWidthSelected: 2,
    chosen: true,
    color: {
      border: '#2B7CE9',
      background: '#97C2FC',
      highlight: {
        border: '#2B7CE9',
        background: '#D2E5FF'
      },
      hover: {
        border: '#2B7CE9',
        background: '#D2E5FF'
      }
    },
    font: {
      color: '#343434',
      size: 14, // px
      face: 'arial',
      background: 'none',
      strokeWidth: 0, // px
      strokeColor: '#ffffff',
      align: 'center',
      multi: true,
      vadjust: 0,
      bold: {
        color: '#343434',
        size: 14, // px
        face: 'arial',
        vadjust: 0,
        mod: 'bold'
      },
      ital: {
        color: '#343434',
        size: 14, // px
        face: 'arial',
        vadjust: 0,
        mod: 'italic',
      },
      boldital: {
        color: '#343434',
        size: 14, // px
        face: 'arial',
        vadjust: 0,
        mod: 'bold italic'
      },
      mono: {
        color: '#343434',
        size: 15, // px
        face: 'courier new',
        vadjust: 2,
        mod: ''
      }
    },
    icon: {
      face: 'FontAwesome',
      code: undefined,
      weight: undefined,
      size: 50,  //50,
      color:'#2B7CE9'
    },
    labelHighlightBold: true,
    mass: 1,
    physics: true,
    scaling: {
      min: 10,
      max: 30,
      label: {
        enabled: false,
        min: 14,
        max: 30,
        maxVisible: 30,
        drawThreshold: 5
      },
      customScalingFunction: function (min,max,total,value) {
        if (max === min) {
          return 0.5;
        }
        else {
          let scale = 1 / (max - min);
          return Math.max(0,(value - min)*scale);
        }
      }
    },
    shadow:{
      enabled: false,
      color: 'rgba(0,0,0,0.5)',
      size:10,
      x:5,
      y:5
    },
    shape: 'ellipse',
    shapeProperties: {
      borderDashes: false, // only for borders
      borderRadius: 6,     // only for box shape
      interpolation: false,  // only for image and circularImage shapes
      useImageSize: false,  // only for image and circularImage shapes
      useBorderWithImage: false  // only for image shape
    },
    size: 25,
    title: undefined,
    value: undefined,
    widthConstraint: false
  },
  {
  	sample: "nodeSample1",
	borderWidth: 1,
    borderWidthSelected: 2,
    chosen: true,
    color: {
      border: '#2B7CE9',
      background: "red", //'#97C2FC',
      highlight: {
        border: '#2B7CE9',
        background: '#D2E5FF'
      },
      hover: {
        border: '#2B7CE9',
        background: '#D2E5FF'
      }
    },
    labelHighlightBold: true,
    shadow:{
      enabled: false,
      color: 'rgba(0,0,0,0.5)',
      size:10,
      x:5,
      y:5
    },
    shape: 'star',
    shapeProperties: {
      borderDashes: false, // only for borders
      borderRadius: 6,     // only for box shape
      interpolation: false,  // only for image and circularImage shapes
      useImageSize: false,  // only for image and circularImage shapes
      useBorderWithImage: false  // only for image shape
    },
    size: 25
  },
  {
  	sample: "nodeSample2",
	borderWidth: 1,
    borderWidthSelected: 2,
    chosen: true,
    color: {
      border: '#2B7CE9',
      background: "yellow", //'#97C2FC',
      highlight: {
        border: '#2B7CE9',
        background: '#D2E5FF'
      },
      hover: {
        border: '#2B7CE9',
        background: '#D2E5FF'
      }
    },
    labelHighlightBold: true,
    shadow:{
      enabled: false,
      color: 'rgba(0,0,0,0.5)',
      size:10,
      x:5,
      y:5
    },
    shape: 'square',
    shapeProperties: {
      borderDashes: false, // only for borders
      borderRadius: 6,     // only for box shape
      interpolation: false,  // only for image and circularImage shapes
      useImageSize: false,  // only for image and circularImage shapes
      useBorderWithImage: false  // only for image shape
    },
    size: 50
  }];

	