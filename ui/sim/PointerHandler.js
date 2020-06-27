/*
UI actions / components implement the following interface:
class IUIAction {
	constructor();
	resize();
	deactivate();
	draw();
}
*/

class PointerHandler {
	constructor(parent) {
		this.parent = parent;

		this.current_selected = null;

		this.mousemovehandler = this.mousemove.bind(this);
		this.parent.canvas.addEventListener("mousemove", this.mousemovehandler, false);
		this.clickhandler = this.click.bind(this);
		this.parent.canvas.addEventListener("click", this.clickhandler, false);
		this.wheelhandler = this.wheel.bind(this);
		this.parent.canvas.addEventListener("wheel", this.wheelhandler, false);

		this.parent.pointer.setAttribute("data-selected", "");
	}
	analyzePoint(e) {
		let rect = this.parent.canvas.getBoundingClientRect(),
			xy = this.parent.screen_to_coord(e.clientX - rect.left, e.clientY - rect.top),
			x = xy[0],
			y = xy[1],
			scene = this.parent.scene;
		for (let i = scene.length - 1; i >= 0; i--) {
			if (scene[i] instanceof Ball) {
				if ((x - scene[i].x) * (x - scene[i].x) + (y - scene[i].y) * (y - scene[i].y) <= scene[i].r * scene[i].r) {
					return scene[i];
				}
			} else if (scene[i] instanceof Line) {
				// TODO
			} else if (scene[i] instanceof Wall) {
				if (between(x, scene[i].left, scene[i].right) && between(y, scene[i].top, scene[i].bottom)) {
					return scene[i];
				}
			}
		}
		return null;
	}
	click(e) {
		let obj = this.analyzePoint(e);
		if (obj != null) {
			if (obj instanceof Ball) {
				obj.state = states.infected;
				obj.infected_time = this.parent.current_tick;
			} else if (obj instanceof Line) {

			} else if (obj instanceof Wall) {

			}
			this.parent.render_needed = true;
		}
	}
	mousemove(e) {
		let obj = this.analyzePoint(e);
		if (this.current_selected != null) {
			this.current_selected.selected = false;
		}
		this.current_selected = obj;
		if (this.current_selected != null) {
			this.current_selected.selected = true;
		}
		this.parent.render_needed = true;
	}
	wheel(e) {
		//console.log(e);
		let obj = this.analyzePoint(e);
		if (obj != null && obj instanceof Wall) {
			e.preventDefault();
			obj.opening += e.deltaY / 2;
			if (obj.opening < 0)
				obj.opening = 0;
			obj.update_opening();
			this.parent.render_needed = true;
		}
	}
	resize() {
		// future proofing
	}
	deactivate() {
		this.parent.pointer.removeAttribute("data-selected");
		this.parent.canvas.removeEventListener("mousemove", this.mousemovehandler, false);
		this.parent.canvas.removeEventListener("click", this.clickhandler, false);
		this.parent.canvas.removeEventListener("wheel", this.wheelhandler, false);
		if (this.current_selected != null) {
			this.current_selected.selected = false;
		}
	}
	draw() {

	}
}
