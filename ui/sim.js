class Ball {
	constructor() {
		this.r = 2;
		this.m = 10;
		do {
			this.x = -screen_w/2 + this.r + Math.random() * (screen_w - 2 * this.r);
			this.y = -screen_h/2 + this.r + Math.random() * (screen_h - 2 * this.r);
		} while(!is_good_spawn(this.x, this.y)); // TODO: safeguard infinite loop
		let theta = Math.random() * 2 * Math.PI;
		this.vx = 12 * Math.cos(theta);
		this.vy = 12 * Math.sin(theta);
		this.state = states.vulnerable;
		this.infected_time = this.state == states.infected ? current_tick : null;
	}
	update() {
		this.x += this.vx * dt;
		this.y += this.vy * dt;
		// check our infection time
		if(this.state == states.infected && (current_tick - this.infected_time) * dt * 1000 >= recovery_time) {
			this.state = states.recovered;
			this.infected_time = null;
		}
	}
	rotate(v, theta) {
		return [
			v[0] * Math.cos(theta) - v[1] * Math.sin(theta),
			v[0] * Math.sin(theta) + v[1] * Math.cos(theta)
		];
	}
	updateAgainst(obj) {
		if(obj instanceof Ball) {
			// go ahead and handle ball v. ball collision here
			// appeals can be sent to the supreme court
			let dx = obj.x - this.x,
				dy = obj.y - this.y;
			// check collision
			if(dx*dx + dy*dy <= (obj.r + this.r) * (obj.r + this.r)) {
				// do elastic
				let dvx = this.vx - obj.vx,
					dvy = this.vy - obj.vy;
				// if dot product of the velocity vector and vector between balls is negative, they're
				// going in the same direction and we don't want to update or the balls will stick
				if (dvx * dx + dvy * dy >= 0) {
					let theta = -Math.atan2(obj.y - this.y, obj.x - this.x);
					let m1 = this.m,
						m2 = obj.m,
						total_mass = m1 + m2;
					// rotate velocities
					let u1 = this.rotate([this.vx, this.vy], theta),
						u2 = this.rotate([obj.vx, obj.vy], theta);
					// elastic collision
					let v1 = [u1[0] * (m1 - m2) / total_mass + u2[0] * 2 * m2 / total_mass, u1[1]],
						v2 = [u2[0] * (m2 - m1) / total_mass + u1[0] * 2 * m1 / total_mass, u2[1]];
					// rotate back
					v1 = this.rotate(v1, -theta);
					v2 = this.rotate(v2, -theta);
					// reapply
					this.vx = v1[0];
					this.vy = v1[1];
					obj.vx = v2[0];
					obj.vy = v2[1];
				}
	
				// do infection
				if(this.state == states.vulnerable && obj.state == states.infected) {
					this.state = states.infected;
					this.infected_time = current_tick;
				}
				// both ways
				if(obj.state == states.vulnerable && this.state == states.infected) {
					obj.state = states.infected;
					obj.infected_time = current_tick;
				}
			}
		} else if(obj instanceof Line) {
			// we're actually going to pass the collision off to Line.updateAgainst
			obj.updateAgainst(this);
		} else if(obj instanceof Wall) {
			// again, pass off to the wall update method
			obj.updateAgainst(this);
		}
	}
	draw() {
		switch(this.state) {
			case states.vulnerable:
				ctx.fillStyle = grey;
				break;
			case states.infected:
				ctx.fillStyle = red;
				break;
			case states.recovered:
				ctx.fillStyle = blue;
				break;
			default:
				throw "oops";
		}
		ctx.beginPath();
		ctx.arc(...coord_to_screen(this.x, this.y), this.r * px_per_unit, 0, 2 * Math.PI);
		ctx.fill();
		//if((mouse_x - this.x) * (mouse_x - this.x) + (mouse_y - this.y) * (mouse_y - this.y) <= this.r * this.r) {
		//	ctx.strokeStyle = "#000";
		//	ctx.lineWidth = 2;
		//	ctx.stroke();
		//}
	}
}

class Line {
	constructor(p1, p2, line=true) {
		this.p1 = p1;
		this.p2 = p2;
		this.line = line;
	}
	set(p1, p2) {
		this.p1 = p1;
		this.p2 = p2;
	}
	update() {}
	reflect(obj, x, y) { // reflect across a normal
		// pt on line
		let bx = obj.x,
			by = obj.y;
		// check dot product real quick
		if((bx - x) * obj.vx + (by - y) * obj.vy <= 0) {
			// reflect velocity vector
			let n = [obj.x - x, obj.y - y],
				n_mag = Math.sqrt(n[0]*n[0] + n[1]*n[1]),
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
		if(this.p1[0] - this.p2[0] == 0) {
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
		if(between(x, this.p1[0], this.p2[0])
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
		if((bx - this.p1[0]) * (bx - this.p1[0]) + (by - this.p1[1]) * (by - this.p1[1]) <= obj.r * obj.r
		  && (bx - this.p1[0]) * obj.vx + (by - this.p1[1]) * obj.vy <= 0) {
			this.reflect(obj, this.p1[0], this.p1[1]);
		}
		// p2
		if((bx - this.p2[0]) * (bx - this.p2[0]) + (by - this.p2[1]) * (by - this.p2[1]) <= obj.r * obj.r
		  && (bx - this.p2[0]) * obj.vx + (by - this.p2[1]) * obj.vy <= 0) {
			this.reflect(obj, this.p2[0], this.p2[1]);
		}
	}
	updateAgainst(obj) {
		if(obj instanceof Ball) {
			if(!this._line_collision(obj))
				this._endpoint_collision(obj);
		} else {
			// TODO?
		}
	}
	draw() {
		if(this.line) {
			ctx.strokeStyle = "#000";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(...coord_to_screen(...this.p1));
			ctx.lineTo(...coord_to_screen(...this.p2));
			ctx.stroke();
		}
	}
}

class Wall {
	constructor(x, y) {
		let w = 4,
			h = screen_h;
		this.left = x - w/2;
		this.right = x + w/2;
		this.top = y + h/2;
		this.bottom = y - h/2;
		this.edges = [
			new Line([this.left, this.bottom], [this.left, this.bottom + h / 2]),
			new Line([this.left, this.bottom + h / 2], [this.right, this.bottom + h / 2]),
			new Line([this.right, this.bottom], [this.right, this.bottom + h / 2]),

			new Line([this.left, this.top], [this.left, this.top - h / 2]),
			new Line([this.left, this.top - h / 2], [this.right, this.top - h / 2]),
			new Line([this.right, this.top], [this.right, this.top - h / 2])
		];
		// This is really *really* bad
		this.open_ticks = 0;
		this.tick_delta = .1;
	}
	open() {
		this.open_ticks = 120;
	}
	update() {
		if(this.open_ticks) {
			this.open_ticks--;
			this.edges[0].p2[1] -= this.tick_delta;
			this.edges[1].p2[1] -= this.tick_delta;
			this.edges[2].p2[1] -= this.tick_delta;
			this.edges[1].p1[1] -= this.tick_delta;

			this.edges[3].p2[1] += this.tick_delta;
			this.edges[4].p2[1] += this.tick_delta;
			this.edges[5].p2[1] += this.tick_delta;
			this.edges[4].p1[1] += this.tick_delta;
		}
	}
	updateAgainst(obj) {
		if(obj instanceof Ball) {
			let did_collide = 0;
			for(let e of this.edges)
				did_collide |= e._line_collision(obj);
			if(!did_collide)
				for(let e of this.edges)
					e._endpoint_collision(obj);
		} else {
			// TODO?
		}
	}
	draw() {
		if(!(mouse_x == null || mouse_y == null) && between(mouse_x, this.left, this.right) && between(mouse_y, this.top, this.bottom)) {
			ctx.fillStyle = "#cdcdcd";
			ctx.fillRect(...coord_to_screen(this.left, this.top), (this.right - this.left) * px_per_unit, (this.top - this.bottom) * px_per_unit);
		}
		for(let e of this.edges)
			e.draw();
	}
}


