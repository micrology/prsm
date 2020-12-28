export default class Tutorial {
	constructor() {
		this.step = 0;
		this.steps = Array.from(document.querySelectorAll('[data-step]')).sort(
			(a, b) => {
				return parseInt(a.dataset.step) - parseInt(b.dataset.step);
			}
		);
	}
	start(start) {
		// initialise the step counter and display the first step
		if (start !== undefined) this.step = start;
		this.stepStart();
	}
	stepStart() {
		// create dialog
		let elem = this.steps[this.step];
		let text = elem.dataset.tutorial;
		let position = elem.dataset.position;
		let prevLegend = 'Prev';
		let nextLegend = 'Next';
		if (this.step == 0) prevLegend = 'Skip';
		if (this.step == this.steps.length - 1) nextLegend = 'Done';
		let dialog = document.createElement('div');
		dialog.className = 'tutorial-dialog';
		dialog.id = 'tutorial';
		dialog.innerHTML = `
<div class="tutorial-arrow ${position}"></div>
<div class="x-button" id="tutorial-cancel"><span>&times;</span></div>
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
</div>`;
		dialog.style.visibility = 'hidden';
		document.querySelector('body').appendChild(dialog);

		let dialogBR = dialog.getBoundingClientRect();
		let elemBR = elem.getBoundingClientRect();
		let top = elemBR.top;
		let left = elemBR.left;
		if (position == 'splash') dialog.classList.add('splash');
		else {
			let border = document.createElement('div');
			border.className = 'tutorial-border';
			border.id = 'tutorial-border';
			border.style.top = elemBR.top - 3 + 'px';
			border.style.left = elemBR.left - 3 + 'px';
			border.style.width = elemBR.width + 'px';
			border.style.height = elemBR.height + 'px';
			document.querySelector('body').appendChild(border);
			switch (position) {
				case 'below':
				case 'below-right':
				case 'below-middle':
				case 'below-left':
					top = elemBR.bottom + 15;
					break;
				case 'above':
				case 'above-left':
				case 'above-middle':
				case 'above-right':
					top = elemBR.top - dialogBR.height - 15;
					break;
				case 'right':
				case 'right-middle':
				case 'right-bottom':
					left = elemBR.right + 15;
					break;
				case 'left':
				case 'left-middle':
				case 'left-bottom':
					left = elemBR.left - dialogBR.width - 15;
					break;
				default:
					console.log(
						`Tutorial: Unknown data-position at step ${this.step}`
					);
					break;
			}
			if (top < 0) top = 0;
			if (top > window.innerHeight - dialogBR.height)
				top = window.innerHeight - dialogBR.height;
			if (left < 0) left = 0;
			if (top > window.innerWidth - dialogBR.width)
				left = window.innerWidth - dialogBR.width;
			dialog.style.top = top + 'px';
			dialog.style.left = left + 'px';
		}
		dialog.style.visibility = '';

		// add event listeners to buttons to  increment/decrement step, destroy this dialog and call step to display next one
		document.querySelector('#next').addEventListener('click', () => {
			this.step += 1;
			this.stepFinish();
		});
		document.querySelector('#prev').addEventListener('click', () => {
			this.step -= 1;
			if (this.step < 0) this.stepFinish();
			this.stepFinish();
		});
		document
			.querySelector('#tutorial-cancel')
			.addEventListener('click', () => {
				this.step = this.steps.length;
				this.stepFinish();
			});
	}
	stepFinish() {
		// destroy the dialog and call stepStart to display the next one
		let dialog = document.querySelector('#tutorial');
		if (dialog) dialog.remove();
		let border = document.querySelector('#tutorial-border');
		if (border) border.remove();
		if (this.step < this.steps.length) this.stepStart();
		else this.stepsEnd();
	}
	stepsEnd() {
		if (typeof this.onexitfn === 'function') this.onexitfn();
	}
	onexit(callback) {
		this.onexitfn = callback;
	}
}
