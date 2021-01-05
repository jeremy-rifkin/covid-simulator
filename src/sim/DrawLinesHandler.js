/*
UI actions / components implement the following interface:
class IUIAction {
	constructor();
	resize();
	deactivate();
	draw();
}
*/

class DrawLinesHandler {
	constructor(parent) {
		this.parent = parent;

		this.p1 = null;
		this.last_xy = null;

		this.mousemovehandler = this.mousemove.bind(this);
		this.parent.canvas.addEventListener("mousemove", this.mousemovehandler, false);
		this.clickhandler = this.click.bind(this);
		this.parent.canvas.addEventListener("click", this.clickhandler, false);
		this.rightclickhandler = this.rightclick.bind(this);
		this.parent.canvas.addEventListener("contextmenu", this.rightclickhandler, false);

		this.parent.drawlines.setAttribute("data-selected", "");
	}
	click(e) {
		let rect = this.parent.canvas.getBoundingClientRect(),
			xy = this.parent.screen_to_coord(e.clientX - rect.left, e.clientY - rect.top);
		if (this.p1 == null) {
			this.p1 = xy;
		} else {
			this.parent.scene.push(new Line(this.parent, this.p1, xy));
			this.p1 = xy;
		}
		this.parent.render_needed = true;
	}
	rightclick(e) {
		e.preventDefault();
		//let rect = this.parent.canvas.getBoundingClientRect(),
		//	xy = this.parent.screen_to_coord(e.clientX - rect.left, e.clientY - rect.top);
		this.p1 = null;
	}
	mousemove(e) {
		let rect = this.parent.canvas.getBoundingClientRect();
		this.last_xy = this.parent.screen_to_coord(e.clientX - rect.left, e.clientY - rect.top);
		this.parent.render_needed = true;
	}
	resize() {
		// future proofing
	}
	deactivate() {
		this.parent.drawlines.removeAttribute("data-selected");
		this.parent.canvas.removeEventListener("mousemove", this.mousemovehandler, false);
		this.parent.canvas.removeEventListener("click", this.clickhandler, false);
		this.parent.canvas.removeEventListener("contextmenu", this.rightclickhandler, false);
		this.parent.render_needed = true;
	}
	draw() {
		if (this.p1 != null && this.last_xy != null) {
			this.parent.ctx.strokeStyle = "#000";
			this.parent.ctx.lineWidth = 2;
			this.parent.ctx.beginPath();
			this.parent.ctx.moveTo(...this.parent.coord_to_screen(...this.p1));
			this.parent.ctx.lineTo(...this.parent.coord_to_screen(...this.last_xy));
			this.parent.ctx.stroke();
		}
	}
}
