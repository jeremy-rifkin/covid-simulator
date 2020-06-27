let red = "#e56a59",
	grey = "#c6c6c6",
	yellow = "#e8e388",
	blue = "#7dcef1";

let states = {
	/* The state of the ball with respect to the virus */
	vulnerable: grey, // never infected; grey
	infected: red, // infected but not yet showing symptoms; yellow (once it's used)
	symptomatic: red, // infected and showing symptoms; red
	recovered: blue   // no longer able to be infected; blue
};

// MAL TODO Why can I not select some of the balls somtimes?

class SimProperties {
	/* SimProperties hold the default properties for a specific simulation
	*/
	constructor(sim_id, parent, simulation_default_properties) {
		this.id = sim_id;
		this.parent = parent;
		// setToDefault will set the master default values
		this.setToDefault();
		// apply the default properties default to the simulation
		this.simulation_default_properties = simulation_default_properties;
		this.apply_simulation_defaults();
		// lastly, check if simulation properties were saved locally
		if (localStorage.getItem(`default_sim_props_${sim_id}`) != null) {
			try {
				let props = JSON.parse(localStorage.getItem(`default_sim_props_${this.id}`));
				for (let prop in props) {
					this[prop] = props[prop];
				}
			} catch { }
		}
		// setup gui
		this.init_gui();
	}
	save_props() {
		// sadly we can't just JSON.stringify(this) because this is cyclic.
		let properties_to_save = ["days_per_second", "infectious_days", "presymptomatic_days",
			"reinfectable_rate", "transmission_rate", "ball_radius", "ball_velocity", "wall_openings",
			"n_balls"];
		let copy = {};
		for (let prop of properties_to_save)
			copy[prop] = this[prop];
		localStorage.setItem(`default_sim_props_${this.id}`, JSON.stringify(copy));
	}
	setToDefault() {
		// defaults about the virus and its transmission
		this.days_per_second = 2;
		this.infectious_days = 16;
		this.presymptomatic_days = 4;
		this.reinfectable_rate = 0.0;
		this.presymptomatic_transmission_rate = .2;
		this.transmission_rate = 1.0;

		// defaults about the balls
		this.ball_radius = 2;
		this.ball_velocity = 7.0;

		// defaults about the board
		this.wall_openings = 0;
		this.n_balls = 0;
	}
	apply_simulation_defaults() {
		for (let property in this.simulation_default_properties) {
			this[property] = this.simulation_default_properties[property];
		}
	}
	apply_board_defaults() {
		/* Hack to allow for calling some functions _after_ the parent Sim
		has appropriately set its default_sim_props to this.
		This is necessary so that the Ball constructor can grab the default radius from
		this.
		*/
		// TODO MAL: Broken for now. I first need to check to see how many balls are there,
		// and then either add more or remove them.  Or I can remove all the balls and
		// add them all back in (which might be better if we go towards having a default
		// state for some balls, e.g., start with 1 infected ball).
		this.parent.do_add_balls(this.n_balls);
	}
	reset_to_default() {
		this.setToDefault();
		this.apply_simulation_defaults();
		this.apply_board_defaults();
		this.update_dat();

		// TODO MAL: I'm still not seeing the update to radius, velocity, etc reflected when I press this button....
	}
	init_gui() {
		// setup dat gui
		var dat_gui = new dat.GUI({ autoPlace: false });
		this.parent.container.appendChild(dat_gui.domElement);
		// radius
		let dat_radius = dat_gui.add(this, "ball_radius", 0.1, 5);
		dat_radius.onChange(function (v) {
			for (let e of this.parent.scene) {
				if (e instanceof Ball) {
					e.r = v;
				}
			}
			this.parent.render_needed = true;
			this.save_props();
		}.bind(this));
		// velocity
		let dat_velocity = dat_gui.add(this, "ball_velocity", 0.1, 20, 0.01);
		dat_velocity.onChange(function (v) {
			for (let e of this.parent.scene) {
				if (e instanceof Ball) {
					let m = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
					e.vx *= v / m;
					e.vy *= v / m;
				}
			}
			this.parent.render_needed = true;
			this.save_props();
		}.bind(this));
		// wall openings
		let dat_wall = dat_gui.add(this, "wall_openings", 0, 40);
		dat_wall.onChange(function (v) {
			for (let e of this.parent.scene) {
				if (e instanceof Wall) {
					e.opening = v;
					e.update_opening();
				}
			}
			this.parent.render_needed = true;
			this.save_props();
		}.bind(this));
		// transmission rate
		let dat_transmission = dat_gui.add(this, "transmission_rate", 0, 1, 0.01);
		dat_transmission.onChange(function (v) {
			this.save_props();
		}.bind(this));
		// infectious days
		let dat_recovery = dat_gui.add(this, "infectious_days", 0, 20, 0.1);
		dat_recovery.onChange(function (v) {
			//this.infectious_days
			this.recovery_time = v * 1000;
			this.save_props();
		}.bind(this));
		// reset properties
		let dat_reset_to_default = dat_gui.add(this, "reset_to_default").name("reset properties");
		// this is hacky and bad -- MAL Why is this hacky and bad?
		this.update_dat = function () {
			dat_radius.updateDisplay();
			dat_velocity.updateDisplay();
			dat_wall.updateDisplay();
			dat_transmission.updateDisplay();
			dat_recovery.updateDisplay();
			this.save_props();
		}.bind(this);
	}
	update_dat() { } // this will be redefined in init_gui
	timeDiffToDays(time_diff) {
		/* Takes in a time difference (in ms) and returns the number of days represented

		parameters :
			time_diff (DOMHighResTimeStamp) : difference between two timestamps in milliseconds
		returns :
			days (int)
		*/
		// performance.now() returns a timestamp in milliseconds
		// interesting; why this instead of Date.now()?
		this.days_per_second * time_diff / 1000;
	}

}

class Ball {
	/* A Ball represents a person in this simulation.

	Ball tracks its own ball_velocity, its own infection state, and how many other Balls it has infected.
	*/
	constructor(parent) {
		/* Construct a new Ball instance with its parent Sim-specified default ball_radius
		and its mass as a default 10,
		placing it randomly in the parent Sim instance screen with a random direction
		and the default ball_velocity given by its parent Sim.

		non-field parameters:
			None

		fields:
			parent (Sim) : parent Sim passed in
			r (<type>) : ball_radius
			m (<type>) : mass
			vs (float) : x ball_velocity
			vy (float) : y ball_velocity
			selected (boolean) : True if this ball is selected in the simulation by the user (only during setup?)
			state (states enum) : virus state of the ball
			infected_time (time) : time at which the state became infected
			reproduction_count (int) : the number of Balls this Ball has infected
		*/
		this.parent = parent; // ref to parent sim instance
		this.r = this.parent.default_sim_props.ball_radius;
		this.m = 10;
		do {
			this.x = (-this.parent.screen_w / 2 + this.r) + Math.random() * (this.parent.screen_w - (2 * this.r));
			this.y = (-this.parent.screen_h / 2 + this.r) + Math.random() * (this.parent.screen_h - (2 * this.r));
		} while (!this.parent.is_good_spawn(this.x, this.y));

		let theta = Math.random() * 2 * Math.PI;
		this.vx = this.parent.default_sim_props.ball_velocity * Math.cos(theta);
		this.vy = this.parent.default_sim_props.ball_velocity * Math.sin(theta);
		this.selected = false;
		this.state = states.vulnerable;
		this.infected_time = this.state == states.infected ? current_tick : null;
		this.reproduction_count = 0;
	}
	update() {
		/* Update the location of the Ball by ball_velocity and virus state of the Ball

		If this ball has been infected for more than parent.recovery_time, make it "recovered".
		*/
		//console.log(this);
		this.x += this.vx * this.parent.dt;
		this.y += this.vy * this.parent.dt;
		// check our infection time
		if (this.state == states.infected && (this.parent.current_tick - this.infected_time) * this.parent.dt * 1000 >= this.parent.recovery_time) {
			// JR note: parent.dt * 1000 should be the tick duration in milliseconds
			// so the left hand side is the total milliseconds since infection
			this.state = states.recovered;
			//this.infected_time = null;
		}
	}
	rotate(v, theta) {
		/* Taking in a ball_velocity vector, rotate by theta.
		*/
		return [
			v[0] * Math.cos(theta) - v[1] * Math.sin(theta),
			v[0] * Math.sin(theta) + v[1] * Math.cos(theta)
		];
	}
	updateBallInfectionStatesOnCollision(b1) {
		/* update the infection state of b1 based on a collision with this */
		// TODO MAL
		// To see some issues (I probably borked the reproduction when I refactored,
		// or possible the 60 second / tick hack has weird effects on different balls),
		// use the first sim. Reset it, pick a ball, and watch it go.
		// Some of the infections spread fast, but others don't spread.
		// and I'm pretty sure the transmission rate is 1
		if (this.state == states.infected && b1.state == states.vulnerable) {
			// infect b1 if this is infected
			if (Math.random() <= this.parent.default_sim_props.transmission_rate) {
				b1.state = states.infected;
				b1.infected_time = this.parent.current_tick;
				this.reproduction_count++;
			}
		}
	}
	updateAgainst(obj) {
		/* Update the Ball based on a collision with obj

		If obj is an infected Ball,
		infect this probabilistically based on parent Sim's default transmission rate.
		*/
		if (obj instanceof Ball) {
			// go ahead and handle ball v. ball collision here
			// appeals can be sent to the supreme court
			let dx = obj.x - this.x,
				dy = obj.y - this.y;
			// check collision
			if (dx * dx + dy * dy <= (obj.r + this.r) * (obj.r + this.r)) {
				// do elastic
				let dvx = this.vx - obj.vx,
					dvy = this.vy - obj.vy;
				// if dot product of the ball_velocity vector and vector between balls is negative, they're
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
				// technically a collision for both particles, but we will only increment
				// n_collisions once and it will be multiplied by two later
				if (this.parent.current_tick >= 60) // TODO: hacky...
					this.parent.n_collisions++;

				// do infection
				this.updateBallInfectionStatesOnCollision(obj);
				obj.updateBallInfectionStatesOnCollision(this);
			}
		} else if (obj instanceof Line) {
			// we're actually going to pass the collision off to Line.updateAgainst
			obj.updateAgainst(this);
		} else if (obj instanceof Wall) {
			// again, pass off to the wall update method
			obj.updateAgainst(this);
		} else {
			throw "Ball ran into an unexpected object"
		}
	}
	draw() {
		/* Draw this Ball, altering the stroke if this Ball is selected. */
		this.parent.ctx.fillStyle = this.state
		this.parent.ctx.beginPath();
		this.parent.ctx.arc(...this.parent.coord_to_screen(this.x, this.y), this.r * this.parent.px_per_unit, 0, 2 * Math.PI);
		this.parent.ctx.fill();
		if (this.selected) {
			this.parent.ctx.strokeStyle = "#000";
			this.parent.ctx.lineWidth = 1;
			this.parent.ctx.stroke();
		}
	}
}

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

class Sim {
	constructor(sim_id, container, simulation_default_properties) {
		// build DOM
		this.container = container;

		this.canvas = document.createElement("canvas");
		this.canvas.setAttribute("class", "canvas");
		this.container.appendChild(this.canvas);
		this.ctx = this.canvas.getContext("2d");

		this.graph = document.createElement("canvas");
		this.graph.setAttribute("class", "spread_graph");
		this.container.appendChild(this.graph);
		this.graph.width = 300;
		this.graph.height = 200;
		this.graph_ctx = this.graph.getContext("2d");

		this.re_graph = document.createElement("canvas");
		this.re_graph.setAttribute("class", "re_graph");
		this.container.appendChild(this.re_graph);
		this.re_graph.width = 400;
		this.re_graph.height = 300;
		this.re_graph_ctx = this.re_graph.getContext("2d");

		this.infection_count = document.createElement("div");
		this.infection_count.setAttribute("class", "infection_count");
		this.container.appendChild(this.infection_count);

		this.r0_display = document.createElement("div");
		this.r0_display.setAttribute("class", "r0");
		this.container.appendChild(this.r0_display);

		this.controls = document.createElement("div");
		this.controls.setAttribute("class", "controls");
		this.container.appendChild(this.controls);

		this.playpause = document.createElement("div");
		this.playpause.innerHTML = `<i class="fas fa-play"></i>`;
		this.playpause.addEventListener("click", this.toggle_running.bind(this), false);
		this.controls.appendChild(this.playpause);

		this.circleadd = document.createElement("div");
		this.circleadd.innerHTML = `<i class="fas fa-plus-circle"></i>`;
		this.circleadd.addEventListener("click", this.add_balls_callback.bind(this), false);
		this.controls.appendChild(this.circleadd);
		this.circleadd_overlay = null;
		this.circleadd_modal = null;

		this.current_ui_action = null;

		this.pointer = document.createElement("div");
		this.pointer.innerHTML = `<i class="fas fa-mouse-pointer"></i>`;
		this.pointer.addEventListener("click", function () {
			if (this.current_ui_action instanceof PointerHandler) {
				this.cancel_action();
			} else {
				this.cancel_action();
				this.current_ui_action = new PointerHandler(this);
			}
		}.bind(this), false);
		this.controls.appendChild(this.pointer);

		this.drawlines = document.createElement("div");
		this.drawlines.innerHTML = `<i class="fas fa-pencil-ruler"></i>`;
		this.drawlines.addEventListener("click", function () {
			if (this.current_ui_action instanceof DrawLinesHandler) {
				this.cancel_action();
			} else {
				this.cancel_action();
				this.current_ui_action = new DrawLinesHandler(this);
			}
		}.bind(this), false);
		this.controls.appendChild(this.drawlines);

		this.drawwalls = document.createElement("div");
		this.drawwalls.innerHTML = `<i class="fas fa-border-none"></i>`;
		this.drawwalls.addEventListener("click", function () {
			if (this.current_ui_action instanceof DrawWallsHandler) {
				this.cancel_action();
			} else {
				this.cancel_action();
				this.current_ui_action = new DrawWallsHandler(this);
			}
		}.bind(this), false);
		this.controls.appendChild(this.drawwalls);

		this.download = document.createElement("div");
		this.download.innerHTML = `<i class="fas fa-download"></i>`;
		this.download.addEventListener("click", function () {
			this.download_sim();
		}.bind(this), false);
		this.controls.appendChild(this.download);

		this.upload = document.createElement("div");
		this.upload.innerHTML = `<i class="fas fa-upload"></i>`;
		this.upload.addEventListener("click", function () {
			this.upload_sim();
		}.bind(this), false);
		this.controls.appendChild(this.upload);

		this.reset = document.createElement("div");
		this.reset.innerHTML = `<i class="fas fa-undo"></i>`;
		this.reset.addEventListener("click", this.reset_sim.bind(this), false);
		this.controls.appendChild(this.reset);

		// initialize everything else
		this.screen_px_w = null;
		this.screen_px_h = null;
		this.screen_w = null;
		this.screen_h = null;
		this.px_per_unit = null;
		this.units_per_screen = 200;

		this.dt = 1 / 60;
		this.simulation_running = false;
		this.force_run = false;
		this.render_needed = false;
		this.last_tick = performance.now();
		this.recovery_time = 1000 * 20;
		this.delay = 1000 * 5;
		this.current_tick = 0;
		this.n_balls = 0;
		this.n_collisions = 0;
		this.scene = [];
		this.spread = []; // [delta_tick, infected, vulnerable, recovered, r0, re]

		this.borders = [
			new Line(this, [0, 0], [0, 0], false),
			new Line(this, [0, 0], [0, 0], false),
			new Line(this, [0, 0], [0, 0], false),
			new Line(this, [0, 0], [0, 0], false)
		];
		for (let b of this.borders)
			this.scene.push(b);

		window.addEventListener("resize", this.resize.bind(this), false);
		this.resize();
		window.requestAnimationFrame(this.loop.bind(this));

		// JR note: I moved the property gui into the SimProperties class. SimProperties just needed
		// some extra info, mainly a parent pointer. I also was able to resolve the issue of the
		// reset button not working by calling the update_dat method after re-applying the defaults.
		this.default_sim_props = new SimProperties(sim_id, this, simulation_default_properties);
		this.default_sim_props.apply_board_defaults();
	}
	resize() {
		this.screen_px_w = this.canvas.width = this.container.getBoundingClientRect().width | 0;
		this.screen_px_h = this.canvas.height = this.screen_px_w * .7 | 0;
		this.px_per_unit = this.screen_px_w / this.units_per_screen;
		this.screen_w = this.screen_px_w / this.px_per_unit;
		this.screen_h = this.screen_px_h / this.px_per_unit;
		this.container.style.height = this.screen_px_h + "px";

		// redo borders
		this.borders[0].set([-this.screen_w / 2, -this.screen_h / 2], [-this.screen_w / 2, this.screen_h / 2]); // l
		this.borders[1].set([this.screen_w / 2, -this.screen_h / 2], [this.screen_w / 2, this.screen_h / 2]); // r
		this.borders[2].set([-this.screen_w / 2, this.screen_h / 2], [this.screen_w / 2, this.screen_h / 2]); // t
		this.borders[3].set([-this.screen_w / 2, -this.screen_h / 2], [this.screen_w / 2, -this.screen_h / 2]); // b

		// don't trap balls outside the screen
		// TODO: give objects a .onresize() method?
		let epsilon = 0.01;
		for (let e of this.scene)
			if (e instanceof Ball) {
				if (e.x < -this.screen_w / 2)
					e.x = -this.screen_w / 2 + epsilon;
				else if (e.x > this.screen_w / 2)
					e.x = this.screen_w / 2 - epsilon;
				if (e.y < -this.screen_h / 2)
					e.y = -this.screen_h / 2 + epsilon;
				else if (e.y > this.screen_h / 2)
					e.y = this.screen_h / 2 - epsilon;
			}
		if (this.current_ui_action)
			this.current_ui_action.resize();
		this.render_needed = true;
	}
	screen_to_coord(x, y) {
		return [
			this.screen_w * x / this.screen_px_w - this.screen_w / 2,
			-(this.screen_h * (y / this.screen_px_h - 1) + this.screen_h / 2)
		];
	}
	coord_to_screen(x, y) {
		return [
			(x + (this.screen_w / 2)) / this.screen_w * this.screen_px_w,
			this.screen_px_h * (1 - (y + (this.screen_h / 2)) / this.screen_h)
		];
	}
	is_good_spawn(x, y) {
		for (let o of this.scene) {
			if (o instanceof Wall) {
				if (between(x, o.left, o.right) && between(y, o.top, o.bottom)) {
					return false;
				}
			}
		}
		return true;
	}
	draw_graphs() {
		this.graph_ctx.clearRect(0, 0, this.graph.width, this.graph.height);
		this.re_graph_ctx.clearRect(0, 0, this.re_graph.width, this.re_graph.height);
		if (this.spread.length == 0)
			return;
		// spread graph
		let dx = this.graph.width / this.current_tick,
			x,
			h = this.graph.height,
			ph = h - 10;
		this.graph_ctx.lineWidth = 2;
		let colors = [red, grey, blue];
		for (let p = 1; p <= 3; p++) {
			x = 0;
			this.graph_ctx.strokeStyle = colors[p - 1];
			this.graph_ctx.beginPath();
			this.graph_ctx.moveTo(x, h - this.spread[0][p] / this.n_balls * ph);
			x += dx;
			for (let i = 1; i < this.spread.length; i++) {
				this.graph_ctx.lineTo(x, h - this.spread[i][p] / this.n_balls * ph);
				x += dx * this.spread[i][0];
			}
			this.graph_ctx.lineTo(x, h - this.spread[this.spread.length - 1][p] / this.n_balls * ph);
			this.graph_ctx.stroke();
		}

		// R_E graph
		dx = (this.re_graph.width - 100) / this.current_tick;
		x = 0;
		h = this.re_graph.height - 100;
		ph = h - 10;
		this.re_graph_ctx.lineWidth = 2;
		//let max_r = this.spread[this.spread.length - 1][4]; // TODO: r0-re consistency
		let max_r = this.spread[0][5];
		for (let i = 1; i < this.spread.length; i++) {
			if (this.spread[i][5] > max_r)
				max_r = this.spread[i][5];
		}
		this.re_graph_ctx.font = "14px Arial";
		this.re_graph_ctx.textBaseline = "middle";
		this.re_graph_ctx.textAlign = "center";
		this.re_graph_ctx.fillStyle = "#dcdcdc";
		this.re_graph_ctx.strokeStyle = "#dcdcdc";
		let lines = [max_r, .5 * max_r, 2.4, 1];
		for (let p of lines) {
			this.re_graph_ctx.beginPath();
			this.re_graph_ctx.moveTo(0, h - p / max_r * ph);
			this.re_graph_ctx.lineTo(this.re_graph.width - 100, h - p / max_r * ph);
			this.re_graph_ctx.stroke();

			let textbox = this.re_graph_ctx.measureText(p.toFixed(1));
			this.re_graph_ctx.clearRect((this.re_graph.width - 100) / 2 - textbox.width / 2 - 3, h - p / max_r * ph - 2, textbox.width + 6, 4);
			this.re_graph_ctx.fillText(p.toFixed(1), (this.re_graph.width - 100) / 2, h - p / max_r * ph);
		}

		this.re_graph_ctx.strokeStyle = "#000";
		this.re_graph_ctx.beginPath();
		this.re_graph_ctx.moveTo(x, h - this.spread[0][5] / max_r * ph);
		x += dx;
		for (let i = 1; i < this.spread.length; i++) {
			this.re_graph_ctx.lineTo(x, h - this.spread[i][5] / max_r * ph);
			x += dx * this.spread[i][0];
		}
		this.re_graph_ctx.lineTo(x, h - this.spread[this.spread.length - 1][5] / max_r * ph);
		this.re_graph_ctx.textAlign = "left";
		this.re_graph_ctx.fillStyle = "#3c3c3c";
		//this.re_graph_ctx.fillText("R effective", x + 5, h - this.spread[this.spread.length - 1][5] / max_r * ph);
		this.re_graph_ctx.fillText(`R effective = ${this.spread[this.spread.length - 1][5].toFixed(1)}`, x + 5, h - this.spread[this.spread.length - 1][5] / max_r * ph);
		this.re_graph_ctx.stroke();
	}
	get_r0() {
		let infection_duration_time = this.recovery_time / 1000,
			collisions_per_balls_per_second = 2 * this.n_collisions / this.n_balls / ((this.current_tick - 60) / 60); // -60 to compensate for earlier hack
		// scalar * seconds * collisions / ball / second = collisions per ball for the infection duration
		return this.default_sim_props.transmission_rate * infection_duration_time * collisions_per_balls_per_second;
	}
	get_re() {
		// find an interval of 120 ticks (dt=120)
		let tick_total = 0,
			i,
			target_dx = 120;
		for (i = this.spread.length - 1; i >= 0; i--) {
			tick_total += this.spread[i][0];
			if (tick_total >= target_dx)
				break;
		}
		if (tick_total < target_dx)
			return 0; //this.get_r0();
		// y = infected + recovered
		let dy = (this.spread[this.spread.length - 1][1] + this.spread[this.spread.length - 1][3])
			- (this.spread[i][1] + this.spread[i][3]);
		// dy / tick_total = dy / dt = d(I+R)/dt = new cases per tick
		///let new_cases_per_second = 60 * (dy / tick_total);
		// assumption has been recovery_time * d(I+R)/dt = R0 / I, which would mean
		// R0 = recovery_time * d(I+R)/dt * I but that's clearly incorrect. TODO:
		///return new_cases_per_second * this.spread[this.spread.length - 1][1] * this.recovery_time / 1000;
		let spread_per_sec = 60 * (dy / tick_total);
		return spread_per_sec / this.spread[this.spread.length - 1][1] * this.recovery_time / 1000;
	}
	/*
	get_re() {
		// find an interval of 120 ticks (dt=120)
		let tick_total = 0,
			i,
			target_dx = 300;
		for (i = this.spread.length - 1; i >= 0; i--) {
			tick_total += this.spread[i][0];
			if (tick_total >= target_dx)
				break;
		}
		if (tick_total < target_dx)
			return 0; //this.get_r0();
		// y = infected + recovered
		let dy = (this.spread[this.spread.length - 1][1] + this.spread[this.spread.length - 1][3])
				   - (this.spread[i][1] + this.spread[i][3]);
		// dy / tick_total = dy / dt = d(I+R)/dt = new cases per tick
		let new_cases_per_second = 60 * (dy / tick_total);
		// assumption has been recovery_time * d(I+R)/dt = R0 * I, which would mean
		// R0 = recovery_time * d(I+R)/dt * I but that's clearly incorrect. TODO:
		//return new_cases_per_second * this.spread[this.spread.length - 1][1] * this.recovery_time / 1000;

		let f_s = this.spread[this.spread.length - 1][2] / this.n_balls,
			f_i = this.spread[this.spread.length - 1][1] / this.n_balls,
			ds = this.spread[this.spread.length - 1][2] - this.spread[i][2],
			di = this.spread[this.spread.length - 1][1] - this.spread[i][1],
			dr = this.spread[this.spread.length - 1][3] - this.spread[i][3],
			beta = -1 / (f_s * f_i) * ds / tick_total,
			nu = (beta * f_s * f_i - di / tick_total) / f_i,
			RE = beta / nu;
		//let RE = - (1 / (f_s * f_i) * ds / tick_total) / (1 / f_i * dr / tick_total);
		return RE;
	}
	*/
	update() {
		this.current_tick++;
		for (let i = 0; i < this.scene.length; i++) {
			for (let j = i + 1; j < this.scene.length; j++) {
				this.scene[i].updateAgainst(this.scene[j]);
			}
			this.scene[i].update();
		}
		let vulnerable = 0,
			infected = 0,
			recovered = 0;
		for (let e of this.scene) {
			if (e instanceof Ball) {
				switch (e.state) {
					case states.vulnerable:
						vulnerable++;
						break;
					case states.infected:
						infected++;
						break;
					case states.recovered:
						recovered++;
						break;
					default:
						throw "oops";
				}
			}
		}
		if (this.spread.length > 0
			&& infected == this.spread[this.spread.length - 1][1]
			&& vulnerable == this.spread[this.spread.length - 1][2]
			&& recovered == this.spread[this.spread.length - 1][3])
			this.spread[this.spread.length - 1][0]++;
		else {
			this.spread.push([1, infected, vulnerable, recovered, this.get_r0(), this.get_re()]);
			this.infection_count.innerHTML = `<span style="color: ${grey}">${vulnerable}</span> + <span style="color: ${red}">${infected}</span> + <span style="color: ${blue}">${recovered}</span> = ${vulnerable + infected + recovered}`;
		}
		// TODO: start cutting off this.spread once it gets really long?
		// TODO: make it more steppy..

		if (this.current_tick % 10 == 0 && this.current_tick > 60 && this.n_balls > 0) {
			//this.r0_display.innerHTML = `Simulation R0 = ${Math.round(this.get_r0() * 10) / 10}`;
			this.r0_display.innerHTML = `Inherent R0 = ${this.get_r0().toFixed(1)}`;
		}

		if (!this.force_run && infected == 0 && this.spread.length > 0 && this.spread[this.spread.length - 1][0] * this.dt * 1000 >= this.delay) {
			this.pause();
		}
	}
	render() {
		this.ctx.clearRect(0, 0, this.screen_px_w, this.screen_px_h);
		for (let e of this.scene)
			e.draw();
		this.draw_graphs();
		if (this.current_ui_action)
			this.current_ui_action.draw();
	}
	loop() {
		window.requestAnimationFrame(this.loop.bind(this));
		if (this.simulation_running) {
			let t = performance.now(),
				did_update = false;
			while (t - this.last_tick >= this.dt * 1000) {
				did_update = true;
				this.last_tick += this.dt * 1000;
				this.update();
			}
			if (did_update)
				this.render();
			else if (this.render_needed) {
				this.render_needed = false;
				this.render();
			}
		} else if (this.render_needed) {
			this.render_needed = false;
			this.render();
		}
	}
	play() {
		this.playpause.innerHTML = `<i class="fas fa-pause"></i>`;
		this.simulation_running = true;
		this.last_tick = performance.now();
		let infected = 0;
		for (let e of this.scene)
			if (e instanceof Ball && e.state == states.infected)
				infected++;
		if (!this.force_run && infected == 0 && this.spread.length > 0 && this.spread[this.spread.length - 1][0] * this.dt * 1000 >= this.delay)
			this.force_run = true;
		// undo potential bring to front
		this.infection_count.style.zIndex = null;
		this.graph.style.zIndex = null;
		this.re_graph.style.zIndex = null;
		this.r0_display.style.zIndex = null;

		//this.infection_count.style.background = null;
		//this.graph.style.background = null;
		//this.r0_display.style.background = null;
	}
	pause() {
		this.playpause.innerHTML = `<i class="fas fa-play"></i>`;
		this.simulation_running = false;
		// bring graph and count to top for good measure
		this.infection_count.style.zIndex = 3;
		this.graph.style.zIndex = 3;
		this.re_graph.style.zIndex = 3;
		this.r0_display.style.zIndex = 3;

		//this.infection_count.style.background = "rgba(0, 0, 0, .05)";
		//this.graph.style.background = "rgba(0, 0, 0, .05)";
		//this.r0_display.style.background = "rgba(0, 0, 0, .05)";
	}
	toggle_running() {
		if (this.simulation_running) {
			this.pause();
		} else {
			this.play();
		}
	}
	add_balls_callback() {
		this.circleadd_overlay = document.createElement("div");
		this.circleadd_overlay.setAttribute("class", "overlay");
		this.circleadd_overlay.addEventListener("click", this.close_add_balls_modal.bind(this), false);
		document.body.appendChild(this.circleadd_overlay);

		let text = document.createElement("div");
		text.innerHTML = "Number of balls?";

		let input = document.createElement("input");
		input.type = "text";
		input.style.margin = "20px 0px";
		input.addEventListener("keydown", function (e) {
			if (e.keyCode == 13) {
				this.do_add_balls(parseInt(input.value));
				this.close_add_balls_modal();
				input.value = "";
			} else if (e.keyCode == 27) {
				this.close_add_balls_modal();
			}
		}.bind(this), false);

		let wrapper = document.createElement("div");
		wrapper.setAttribute("class", "wrapper");

		let submit = document.createElement("div");
		submit.setAttribute("class", "submit");
		submit.innerHTML = "Go";
		submit.addEventListener("click", function (e) {
			this.do_add_balls(parseInt(input.value));
			this.close_add_balls_modal();
			input.value = "";
		}.bind(this), false);
		wrapper.appendChild(submit);

		this.circleadd_modal = document.createElement("div");
		this.circleadd_modal.setAttribute("class", "modal");
		this.circleadd_modal.appendChild(text);
		this.circleadd_modal.appendChild(input);
		this.circleadd_modal.appendChild(wrapper);
		document.body.appendChild(this.circleadd_modal);
		input.focus();
	}
	do_add_balls(q) {
		if (!isNaN(q) && q > 0) {
			this.n_balls += q;
			for (let i = 0; i < q; i++)
				this.scene.push(new Ball(this));
		}
		this.render_needed = true;
	}
	close_add_balls_modal() {
		this.circleadd_overlay.remove();
		this.circleadd_modal.remove();
	}
	cancel_action() {
		if (this.current_ui_action == null)
			return;
		this.current_ui_action.deactivate();
		this.current_ui_action = null;
	}
	download_sim() {
		let sim_props = ["recovery_time", "delay", "current_tick", "n_balls", "n_collisions", "spread"],
			ball_props = ["r", "m", "x", "y", "vx", "vy", "state", "infected_time"],
			line_props = ["p1", "p2", "render_line"],
			wall_props = ["x", "y", "opening"];
		let copy = {};
		for (let p of sim_props)
			copy[p] = this[p];
		copy["default_sim_props"] = {
			ball_radius: this.default_sim_props.ball_radius,
			ball_velocity: this.default_sim_props.ball_velocity,
			wall_openings: this.default_sim_props.wall_openings,
			transmission_rate: this.default_sim_props.transmission_rate,
			infectious_days: this.default_sim_props.infectious_days
		}
		copy.scene = [];
		for (let obj of this.scene) {
			if (obj instanceof Ball) {
				let oc = { type: "ball" };
				for (let p of ball_props)
					oc[p] = obj[p];
				copy.scene.push(oc);
			} else if (obj instanceof Line) {
				let oc = { type: "line" };
				for (let p of line_props)
					oc[p] = obj[p];
				copy.scene.push(oc);
			} else if (obj instanceof Wall) {
				let oc = { type: "wall" };
				for (let p of wall_props)
					oc[p] = obj[p];
				copy.scene.push(oc);
			}
		}
		let data = encodeURIComponent(JSON.stringify(copy));
		var a = document.createElement("a");
		a.setAttribute("href", "data:text/plain;charset=utf-8," + data);
		a.setAttribute("download", "sim.json");
		a.style.display = "none";
		document.body.appendChild(a);
		a.click();
		a.remove();
	}
	upload_sim() {
		// <input type="file" id="input" multiple>
		let input = document.createElement("input");
		input.setAttribute("type", "file");
		input.style.display = "none";
		document.body.appendChild(input);
		input.click();
		input.addEventListener("change", function () {
			if (input.files.length != 1) {
				console.log("crap");
				input.remove();
				return;
			}
			var reader = new FileReader();
			reader.onload = function (e) {
				let data = JSON.parse(e.target.result);
				let sim_props = ["recovery_time", "delay", "current_tick", "n_balls", "n_collisions", "spread"],
					ball_props = ["r", "m", "x", "y", "vx", "vy", "state", "infected_time"],
					line_props = ["p1", "p2", "render_line"],
					wall_props = ["x", "y", "opening"];
				for (let p of sim_props)
					this[p] = data[p];
				this.default_sim_props.ball_radius = data.default_sim_props.ball_radius;
				this.default_sim_props.ball_velocity = data.default_sim_props.ball_velocity;
				this.default_sim_props.wall_openings = data.default_sim_props.wall_openings;
				this.default_sim_props.transmission_rate = data.default_sim_props.transmission_rate;
				this.default_sim_props.infectious_days = data.default_sim_props.infectious_days;
				this.default_sim_props.update_dat();
				this.scene = [];
				for (let obj of data.scene) {
					switch (obj.type) {
						case "ball":
							let b = new Ball(this);
							for (let p of ball_props)
								b[p] = obj[p];
							this.scene.push(b);
							break;
						case "line":
							let l = new Line(this);
							for (let p of line_props)
								l[p] = obj[p];
							this.scene.push(l);
							break;
						case "wall":
							let w = new Wall(this, obj.x, obj.y);
							w.opening = obj.opening;
							w.update_opening();
							this.scene.push(w);
							break;
					}
				}
				for (let i = 0; i < 4; i++)
					this.borders[i] = this.scene[i];
				this.pause();
				this.force_run = false;
				this.render_needed = true;
			}.bind(this);
			reader.readAsText(input.files[0]);
			input.remove();
		}.bind(this), false);
	}
	reset_sim() {
		this.pause();
		this.cancel_action();
		this.simulation_running = false;
		this.force_run = false;
		this.last_tick = performance.now();
		this.recovery_time = 1000 * 20;
		this.delay = 1000 * 5;
		this.current_tick = 0;
		this.n_balls = 0;
		this.n_collisions = 0;
		this.scene = [];
		this.spread = [];
		this.render_needed = true;
		this.infection_count.innerHTML = "";
		this.r0_display.innerHTML = "";
		for (let b of this.borders)
			this.scene.push(b);
		this.default_sim_props.apply_board_defaults();
	}
}
