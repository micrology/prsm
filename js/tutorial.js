/*********************************************************************************************************************  

PRSM Participatory System Mapper 

	Copyright (C) 2022  Nigel Gilbert prsm@prsm.uk

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.


This module handles the display of tutorial help messages to beginners.  
 ******************************************************************************************************************** */

/**
 * Class to display help messages in sequence as a user guide
 *
 * Each HTML element that should have a tutorial message should include the attributes:
 * data-step {number} specifies the order of the sequence of messages
 * data-tutorial: the message (can include HTML tags)
 * data-position: the location of the message relative to the element, one of
 * above, above-left, above-middle, above-right, left, right and below and their variants
 * or splash (which positions the message in the middle of the viewport)
 * To initialise:
 *  tutorial = new Tutorial()
 *  tutorial.start()
 *
 *  tutorial.onstep(Array of step numbers or a step number, callback) Evaluate call back
 *       after displaying tutorial message
 *  tutorial.onexit(callback) Evaluate callback when user finishes or skips the tutorial
 */
export default class Tutorial {
	constructor() {
		this.step = 0
		this.steps = Array.from(document.querySelectorAll("[data-step]")).sort(
			(a, b) => {
				return parseInt(a.dataset.step) - parseInt(b.dataset.step)
			}
		)
		this.back = null
	}
	/**
	 * initialise the step counter and display the first step
	 * @param {number} start optional step to start at (if not provided, start at the lowest numbered step)
	 */
	start(start) {
		if (start !== undefined) this.step = start
		this.stepStart()
	}
	/**
	 * create a tutorial element and position it
	 */
	stepStart() {
		const elem = this.steps[this.step]
		const text = elem.dataset.tutorial
		const position = elem.dataset.position
		const classToAdd = elem.dataset.tutorialclass
		let prevLegend = "Back"
		let nextLegend = "Next"
		// first and last have special buttons
		if (this.step === 0) prevLegend = "Skip"
		if (this.step === this.steps.length - 1) nextLegend = "Done"
		const dialog = document.createElement("div")
		dialog.className = `tutorial-dialog ${position}`
		if (classToAdd) dialog.classList.add(classToAdd)
		dialog.id = "tutorial"
		dialog.innerHTML = `
<div class="tutorial-arrow ${position}"></div>
<div class="x-button" id="tutorial-cancel">&times;</div>
<div class="text">
    ${text}
</div>
<input
    type="button"
    value="${nextLegend}"
    id="next"
    class="tutorial-button next"
/>
<input
    type="button"
    value="${prevLegend}"
    id="prev"
    class="tutorial-button prev"
/>
</div>`
		dialog.style.visibility = "hidden"
		document.querySelector("body").appendChild(dialog)
		// position the tutorial item and the border around the item being explained
		const dialogBR = dialog.getBoundingClientRect()
		const elemBR = elem.getBoundingClientRect()
		let top = elemBR.top
		let left = elemBR.left
		if (position === "splash") {
			if (!this.back) {
				this.back = document.createElement("div")
				this.back.classList.add("tutorial-background")
				elem.insertAdjacentElement("afterend", this.back)
			}
			dialog.classList.add("splash")
			if (this.step === 0) {
				// initial splash screen for new users
				dialog.classList.add("intro-splash")
				const img = document.createElement("img")
				img.src = new URL(
					"../icons/PRSMlogo200.png?as=webp&width=80",
					import.meta.url
				)
				document.getElementById("intro-logo").appendChild(img)
			}
		} else {
			const border = document.createElement("div")
			border.className = "tutorial-border"
			border.id = "tutorial-border"
			border.style.top = elemBR.top - 3 + "px"
			border.style.left = elemBR.left - 3 + "px"
			border.style.width = elemBR.width + "px"
			border.style.height = elemBR.height + "px"
			document.querySelector("body").appendChild(border)
			switch (position) {
				case "below":
				case "below-right":
				case "below-middle":
				case "below-left":
					top = elemBR.bottom + 15
					break
				case "above":
				case "above-left":
				case "above-middle":
				case "above-right":
					top = elemBR.top - dialogBR.height - 15
					break
				case "right":
				case "right-middle":
				case "right-bottom":
					left = elemBR.right + 15
					break
				case "left":
				case "left-middle":
				case "left-bottom":
					left = elemBR.left - dialogBR.width - 15
					break
				default:
					console.log(`Tutorial: Unknown data-position at step ${this.step}`)
					break
			}
			// ensure the dialog is in the viewport
			if (top < 0) top = 0
			if (top > window.innerHeight - dialogBR.height)
				top = window.innerHeight - dialogBR.height
			if (left < 0) left = 0
			if (left > window.innerWidth - dialogBR.width)
				left = window.innerWidth - dialogBR.width
			dialog.style.top = top + "px"
			dialog.style.left = left + "px"
		}
		dialog.style.visibility = ""

		// add event listeners to buttons to increment/decrement step,
		// destroy this dialog and then call step() to display next one
		document.querySelector("#next").addEventListener("click", () => {
			this.step += 1
			this.stepFinish()
		})
		document.querySelector("#prev").addEventListener("click", () => {
			this.step -= 1
			this.stepFinish()
		})
		document.querySelector("#tutorial-cancel").addEventListener("click", () => {
			this.step = this.steps.length
			this.stepFinish()
		})
		// call onsstepstart function if to run now
		this.runStepStart()
	}
	runStepStart() {
		if (this.onstep === undefined) return
		if (Array.isArray(this.onstep)) {
			if (this.onstep.indexOf(this.step) === -1) return
		} else {
			if (this.onstep !== this.step) return
		}
		if (typeof this.onstepfn === "function") this.onstepfn()
	}
	/**
	 * destroy the tutorial dialog, remove the border around the item being explained, and
	 * and call stepStart() to display the next one
	 */
	stepFinish() {
		const dialog = document.querySelector("#tutorial")
		if (dialog) dialog.remove()
		const border = document.querySelector("#tutorial-border")
		if (border) border.remove()
		if (this.step < 0 || this.step >= this.steps.length) this.stepsEnd()
		else this.stepStart()
	}
	/**
	 * called on exit
	 */
	stepsEnd() {
		if (this.back) {
			this.back.remove()
			this.back = null
		}
		if (typeof this.onexitfn === "function") this.onexitfn()
	}
	/**
	 * store the cleanup function until needed
	 * @param {function} callback
	 */
	onexit(callback) {
		this.onexitfn = callback
	}
	onstep(step, callback) {
		this.onstep = step
		this.onstepfn = callback
	}
}
