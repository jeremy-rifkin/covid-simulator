let screen_w = 256, // my screen
	screen_h = 132.6, // my screen
	dt = 1 / 60,
	sim_duration = 1000,
	current_tick = 0,
	n_balls = 70,
	n_collisions = 0,
	default_velocity = 12,
	default_radius = 2;

class Ball {
	constructor() {
		this.r = default_radius;
		this.m = 10;
		this.x = -screen_w/2 + this.r + Math.random() * (screen_w - 2 * this.r);
		this.y = -screen_h/2 + this.r + Math.random() * (screen_h - 2 * this.r);
		let theta = Math.random() * 2 * Math.PI;
		this.vx = default_velocity * Math.cos(theta);
		this.vy = default_velocity * Math.sin(theta);
		this.n_collisions = 0;
	}
	update() {
		this.x += this.vx * dt;
		this.y += this.vy * dt;
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
	
				// n_collisions will be multiplied by two at the end
				n_collisions++;
				this.n_collisions++;
				obj.n_collisions++;
			}
		} else if(obj instanceof Line) {
			// we're actually going to pass the collision off to Line.updateAgainst
			obj.updateAgainst(this);
		}
	}
}

function between(v, a, b) {
	return v >= Math.min(a, b) && v <= Math.max(a, b);
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
			return true;
		}
		return false;
	}
	_endpoint_collision(obj) {
		// check collision with endpoints real quick
		let bx = obj.x,
			by = obj.y;
		// p1
		if((bx - this.p1[0]) * (bx - this.p1[0]) + (by - this.p1[1]) * (by - this.p1[1]) <= obj.r * obj.r
		  && (bx - this.p1[0]) * obj.vx + (by - this.p1[1]) * obj.vy <= 0) {
			obj.vx *= -1;
			obj.vy *= -1;
		}
		// p2
		if((bx - this.p2[0]) * (bx - this.p2[0]) + (by - this.p2[1]) * (by - this.p2[1]) <= obj.r * obj.r
		  && (bx - this.p2[0]) * obj.vx + (by - this.p2[1]) * obj.vy <= 0) {
			obj.vx *= -1;
			obj.vy *= -1;
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
}

let borders = [
	new Line([0, 0], [0, 0], false),
	new Line([0, 0], [0, 0], false),
	new Line([0, 0], [0, 0], false),
	new Line([0, 0], [0, 0], false)
];
borders[0].set([-screen_w/2, -screen_h/2], [-screen_w/2,  screen_h/2]); // l
borders[1].set([ screen_w/2, -screen_h/2], [ screen_w/2,  screen_h/2]); // r
borders[2].set([-screen_w/2,  screen_h/2], [ screen_w/2,  screen_h/2]); // t
borders[3].set([-screen_w/2, -screen_h/2], [ screen_w/2, -screen_h/2]); // b

function avg_collisions() {
	//let t = 0, d = 0;
	//for(let e of scene)
	//	if(e instanceof Ball) {
	//		t += e.n_collisions;
	//		d++;
	//	}
	//let avg_collision_per_ball = t /  d;
	//console.log(avg_collision_per_ball / (current_tick / 60)); // average collisions per ball per second
	return 2 * n_collisions / n_balls / (current_tick / 60);
}


function do_sim() {
	current_tick = 0;
	n_collisions = 0;
	let scene = [];

	for(let b of borders)
		scene.push(b);
	
	for(let i = 0; i < n_balls; i++) {
		scene.push(new Ball);
	}
	
	function update() {
		for(let i = 0; i < scene.length; i++) {
			for(let j = i + 1; j < scene.length; j++) {
				scene[i].updateAgainst(scene[j]);
			}
			scene[i].update();
		}
		//let total_v = 0, total_count = 0;
		//for(let e of scene) {
		//	if(e instanceof Ball) {
		//		total_v += Math.sqrt(e.vx*e.vx + e.vy*e.vy);
		//		total_count++;
		//	}
		//}
		//if(total_count != n_balls)
		//	throw "oops";
		//console.log(total_v / total_count);
	}
	for(let i = 0; i < 120; i++) { // simulate for 2 seconds so balls have a chance to resolve overlaps
		update();
	}
	n_collisions = 0; // reset
	while(current_tick < sim_duration) {
		current_tick++;
		update();
	}
}

// n_balls
//for(let _n = 10; _n <= 1000; _n += 10) {
//	n_balls = _n;
//	do_sim();
//	console.log(n_balls, avg_collisions());
//}
//console.log("--------------------");
// velocity
//n_balls = 400;
//for(let _v = 0; _v <= 60; _v += 1) {
//	//_v = 30;
//	default_velocity = _v;
//	do_sim();
//	console.log(avg_collisions());
//	//break;
//}

// test lookup table:
for(let _n = 0; ; _n += 100) {
	n_balls = _n;
	if(Math.PI * default_radius*default_radius * n_balls / (screen_w * screen_h) > Math.PI * Math.sqrt(3) / 6)
		break;
	process.stdout.write((Math.PI * default_radius*default_radius * n_balls / (screen_w * screen_h)).toString() + "\t");
	for(_v = 0; _v <= 60; _v += 10) {
		default_velocity = _v;
		do_sim();
		process.stdout.write("\t" + avg_collisions().toString());
	}
	process.stdout.write("\n");
}
