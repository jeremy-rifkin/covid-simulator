class Wall {
	constructor(parent, x, y) {
		/* Construct a Wall object with a width 4 and a default height of the entire screen.

		Non-field paramaters: None

		Fields :
			parent (Sim) : the parent Sim instance, passed in

		*/
		this.parent = parent; // ref to parent sim instance
		let w = 4,
			h = this.parent.screen_h;
		this.x = x;
		this.y = y;
		this.h = h;
		this.left = x - w / 2;
		this.right = x + w / 2;
		this.top = y + h / 2;
		this.bottom = y - h / 2;
		this.opening = 0;
		this.edges = [
			new Line(this.parent, [this.left, this.bottom], [this.left, this.bottom + h / 2]),
			new Line(this.parent, [this.left, this.bottom + h / 2], [this.right, this.bottom + h / 2]),
			new Line(this.parent, [this.right, this.bottom], [this.right, this.bottom + h / 2]),

			new Line(this.parent, [this.left, this.top], [this.left, this.top - h / 2]),
			new Line(this.parent, [this.left, this.top - h / 2], [this.right, this.top - h / 2]),
			new Line(this.parent, [this.right, this.top], [this.right, this.top - h / 2])
		];
		this.selected = false;
		this.resolve_balls();
	}
	resolve_balls() {
		/* Check to see if any ball in the scene has collided with this wall.
		*/
		// MAL TODO: This is n^2, and memory doesn't seem like it should be an issue.
		// What about updating the collision parts of lines and boards to be in a LUT?
		// Then balls could register themselves in the LUT and collision-detection should be easy....
		for (let e of this.parent.scene) {
			if (e instanceof Ball) {
				if (between(e.x, this.left, this.right)) {
					if (between(e.y, this.top, this.top - this.h / 2 + this.opening)
						|| between(e.y, this.bottom, this.bottom + this.h / 2 - this.opening)) {
						let epsilon = 0.01;
						if (e.x < this.x) {
							e.x = this.left - epsilon;
						} else {
							e.x = this.right + epsilon;
						}
					}
				}
			}
		}
		this.parent.render_needed = true;
	}
	update_opening() {
		this.edges[0].p2[1] = this.bottom + this.h / 2 - this.opening;
		this.edges[1].p2[1] = this.bottom + this.h / 2 - this.opening;
		this.edges[2].p2[1] = this.bottom + this.h / 2 - this.opening;
		this.edges[1].p1[1] = this.bottom + this.h / 2 - this.opening;

		this.edges[3].p2[1] = this.top - this.h / 2 + this.opening;
		this.edges[4].p2[1] = this.top - this.h / 2 + this.opening;
		this.edges[5].p2[1] = this.top - this.h / 2 + this.opening;
		this.edges[4].p1[1] = this.top - this.h / 2 + this.opening;
		this.resolve_balls();
	}
	update() {

	}
	updateAgainst(obj) {
		if (obj instanceof Ball) {
			let did_collide = 0;
			for (let e of this.edges)
				did_collide |= e._line_collision(obj);
			if (!did_collide)
				for (let e of this.edges)
					e._endpoint_collision(obj);
		} else {
			// TODO?
		}
	}
	draw() {
		if (this.selected) {
			this.parent.ctx.fillStyle = "rgba(205, 205, 205, .4)";
			this.parent.ctx.fillRect(...this.parent.coord_to_screen(this.left, this.top), (this.right - this.left) * this.parent.px_per_unit, (this.top - this.bottom) * this.parent.px_per_unit);
		}
		for (let e of this.edges)
			e.draw();
	}
}
