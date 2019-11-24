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

document.getElementById("addNode").addEventListener("click", plusNode);

function plusNode() {
	document.getElementById("statusBar").innerHTML = "Add Node mode";
	document.getElementById("container").style.cursor = "cell";
	network.addNodeMode();
	}