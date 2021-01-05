/*
UI actions / components implement the following interface:
class IUIAction {
	constructor();
	resize();
	deactivate();
	draw();
}
*/

class DrawWallsHandler {
	constructor(parent) {
		this.parent = parent;

		this.width = 4;
		this.x = null;

		this.mousemovehandler = this.mousemove.bind(this);
		this.parent.canvas.addEventListener("mousemove", this.mousemovehandler, false);
		this.clickhandler = this.click.bind(this);
		this.parent.canvas.addEventListener("click", this.clickhandler, false);
		this.rightclickhandler = this.rightclick.bind(this);
		this.parent.canvas.addEventListener("contextmenu", this.rightclickhandler, false);

		this.parent.drawwalls.setAttribute("data-selected", "");
	}
	click(e) {
		let rect = this.parent.canvas.getBoundingClientRect();
		this.x = this.parent.screen_to_coord(e.clientX - rect.left, 0)[0];
		this.parent.scene.push(new Wall(this.parent, this.x, 0));
		this.parent.render_needed = true;
	}
	rightclick(e) {
		e.preventDefault();
		this.parent.cancel_action();
	}
	mousemove(e) {
		let rect = this.parent.canvas.getBoundingClientRect();
		this.x = this.parent.screen_to_coord(e.clientX - rect.left, 0)[0];
		this.parent.render_needed = true;
	}
	resize() {
		// future proofing
	}
	deactivate() {
		this.parent.drawwalls.removeAttribute("data-selected");
		this.parent.canvas.removeEventListener("mousemove", this.mousemovehandler, false);
		this.parent.canvas.removeEventListener("click", this.clickhandler, false);
		this.parent.canvas.removeEventListener("contextmenu", this.rightclickhandler, false);
		this.parent.render_needed = true;
	}
	draw() {
		let x = this.x,
			w = this.width,
			h = this.parent.screen_h;
		let left = x - w / 2,
			right = x + w / 2,
			top = h / 2,
			bottom = -h / 2;
		this.parent.ctx.strokeStyle = "#000";
		this.parent.ctx.lineWidth = 2;
		this.parent.ctx.beginPath();
		this.parent.ctx.moveTo(...this.parent.coord_to_screen(left, bottom));
		this.parent.ctx.lineTo(...this.parent.coord_to_screen(left, top));
		this.parent.ctx.lineTo(...this.parent.coord_to_screen(right, top));
		this.parent.ctx.lineTo(...this.parent.coord_to_screen(right, bottom));
		this.parent.ctx.lineTo(...this.parent.coord_to_screen(left, bottom));
		this.parent.ctx.stroke();
	}
}
