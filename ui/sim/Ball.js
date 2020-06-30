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
			this.parent.recovered++;
			this.parent.infected--;
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
		if (this.state == states.infected && b1.state == states.vulnerable) {
			// infect b1 if this is infected
			if (Math.random() <= this.parent.default_sim_props.transmission_rate) {
				b1.state = states.infected;
				b1.infected_time = this.parent.current_tick;
				this.parent.infected++;
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
