class Line {
	constructor(parent, p1, p2, render_line = true) {
		/* Construct a line object.

		Non-field parameters: None

		Fields:
			parent (Sim) : parent Sim, passed in
			p1 (Point) : starting point of line, passed in
			p2 (Point) : ending point of line, passed in
			render_line (boolean) : ?
		*/
		this.parent = parent; // ref to parent sim instance
		this.p1 = p1;
		this.p2 = p2;
		this.render_line = render_line;
	}
	set(p1, p2) {
		this.p1 = p1;
		this.p2 = p2;
	}
	update() { }
	reflect(obj, x, y) { // reflect across a normal
		// pt on line
		let bx = obj.x,
			by = obj.y;
		// check dot product real quick
		if ((bx - x) * obj.vx + (by - y) * obj.vy <= 0) {
			// reflect ball_velocity vector
			let n = [obj.x - x, obj.y - y],
				n_mag = Math.sqrt(n[0] * n[0] + n[1] * n[1]),
				v = [obj.vx, obj.vy],
				v2n = 2 * v[0] * n[0] + 2 * v[1] * n[1];
			obj.vx = v[0] - v2n / (n_mag * n_mag) * n[0];
			obj.vy = v[1] - v2n / (n_mag * n_mag) * n[1];
		}
	}
	_line_collision(obj) {
		let bx = obj.x,
			by = obj.y;
		// optimizing delta_x^2 + delta_y^2 with constraint ax + by + c = 0
		let a, b, c;
		if (this.p1[0] - this.p2[0] == 0) {
			// vertical edge case
			a = 1;
			b = 0;
			c = -this.p1[0];
		} else {
			// regular
			let m = (this.p1[1] - this.p2[1]) / (this.p1[0] - this.p2[0]);
			a = -m;
			b = 1;
			c = -(-m * this.p1[0] + this.p1[1]);
		}
		// find closest point on line
		let x = -(a * b * by - b * b * bx + a * c) / (a * a + b * b),
			y = -(a * b * bx - a * a * by + b * c) / (a * a + b * b);
		// check for collision with line and check that the collision is within the line segment
		if (between(x, this.p1[0], this.p2[0])
			&& between(y, this.p1[1], this.p2[1])
			&& (bx - x) * (bx - x) + (by - y) * (by - y) <= obj.r * obj.r) {
			// collision has occurred
			// dot product will be checked in .reflect()
			this.reflect(obj, x, y);
			return true; // TODO: bad
		}
		return false; // TODO: bad
	}
	_endpoint_collision(obj) {
		// check collision with endpoints real quick
		let bx = obj.x,
			by = obj.y;
		// p1
		if ((bx - this.p1[0]) * (bx - this.p1[0]) + (by - this.p1[1]) * (by - this.p1[1]) <= obj.r * obj.r
			&& (bx - this.p1[0]) * obj.vx + (by - this.p1[1]) * obj.vy <= 0) {
			this.reflect(obj, this.p1[0], this.p1[1]);
		}
		// p2
		if ((bx - this.p2[0]) * (bx - this.p2[0]) + (by - this.p2[1]) * (by - this.p2[1]) <= obj.r * obj.r
			&& (bx - this.p2[0]) * obj.vx + (by - this.p2[1]) * obj.vy <= 0) {
			this.reflect(obj, this.p2[0], this.p2[1]);
		}
	}
	updateAgainst(obj) {
		/* If obj is a Ball, update the Ball based on a side-on or endpoint collision with this line.
		*/
		if (obj instanceof Ball) {
			if (!this._line_collision(obj))
				this._endpoint_collision(obj);
		} else {
			//TODO MAL why?
			//throw "Unexpected collision by non-Ball object"
		}
	}
	draw() {
		if (this.render_line) {
			this.parent.ctx.strokeStyle = "#000";
			this.parent.ctx.lineWidth = 2;
			this.parent.ctx.beginPath();
			this.parent.ctx.moveTo(...this.parent.coord_to_screen(...this.p1));
			this.parent.ctx.lineTo(...this.parent.coord_to_screen(...this.p2));
			this.parent.ctx.stroke();
		}
	}
}
