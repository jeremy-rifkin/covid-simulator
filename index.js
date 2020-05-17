let canvas = document.getElementById("c"),
	ctx = canvas.getContext("2d"),
	graph = document.getElementById("graph"),
	graph_ctx = graph.getContext("2d"),
	px_per_unit = 10,
	screen_px_w,
	screen_px_h,
	screen_w,
	screen_h,
	dt = 1/60; // TODO

let play_pause = document.getElementById("playpause"),
	circle_add = document.getElementById("circleadd"),
	pointer = document.getElementById("pointer"),
	draw_lines = document.getElementById("drawlines");

graph.width = 300;
graph.height = 200;

function pxtoscreen(x, y) {
	// TODO
}

function screentopx(x, y) {
	return [
		(x + (screen_w / 2)) / screen_w * screen_px_w,
		screen_px_h * (1 - (y + (screen_h / 2)) / screen_h)
	];
}

let red = "#e56a59",
	grey = "#c6c6c6",
	yellow = "#e8e388",
	blue = "#7dcef1";

let states = {
	vulnerable: 0,
	infected: 1,
	recovered: 2
};

let recovery_time = 1000 * 20;

// TODO: make sure tick based time comparison is accurate

let simulation_running = true,
	delay = 1000 * 5;

let scene = [];

let current_tick = 0;
let spread = []; // [delta_tick, infected, vulnerable, recovered]
let n_balls = 70;

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
		this.state = Math.random() < 0.05 ? states.infected : states.vulnerable;
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
		ctx.arc(...screentopx(this.x, this.y), this.r * px_per_unit, 0, 2 * Math.PI);
		ctx.fill();
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
	draw() {
		if(this.line) {
			ctx.strokeStyle = "#000";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(...screentopx(...this.p1));
			ctx.lineTo(...screentopx(...this.p2));
			ctx.stroke();
		}
	}
}

class Wall {
	constructor() {
		let x = 0,
			y = 0,
			w = 4,
			h = screen_h * .8;
		//this.left = x - w/2;
		//this.right = x + w/2;
		//this.top = y + h/2;
		//this.bottom = y - h/2;
		let left = x - w/2,
			right = x + w/2,
			top = y + h/2,
			bottom = y - h/2;
		this.left = left;
		this.right = right;
		this.top = top;
		this.bottom = bottom;
		this.edges = [
			new Line([left, bottom], [left, top]),
			new Line([left, top], [right, top]),
			new Line([right, top], [right, bottom]),
			new Line([right, bottom], [left, bottom])
		];
	}
	update() {}
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
		for(let e of this.edges)
			e.draw();
	}
}

function draw_graph() {
	if(spread.length == 0)
		return;
	let dx = graph.width / current_tick,
		x,
		h = graph.height,
		ph = h - 10;
	graph_ctx.clearRect(0, 0, graph.width, graph.height);
	graph_ctx.lineWidth = 2;
	let colors = [red, grey, blue];
	for(let p = 1; p <= 3; p++) {
		x = 0;
		graph_ctx.strokeStyle = colors[p - 1];
		graph_ctx.beginPath();
		graph_ctx.moveTo(x, h - spread[0][p] / 70 * ph);
		x += dx;
		for(let i = 1; i < spread.length; i++) {
			graph_ctx.lineTo(x, h - spread[i][p] / 70 * ph);
			x += dx * spread[i][0];
		}
		graph_ctx.lineTo(x, h - spread[spread.length - 1][p] / 70 * ph);
		graph_ctx.stroke();
	}
}

function is_good_spawn(x, y) {
	for(let o of scene) {
		if(o instanceof Wall) {
			return !(between(x, o.left,  o.right) && between(y, o.top,  o.bottom));
		}
	}
	return true;
}

function update() {
	current_tick++;
	for(let i = 0; i < scene.length; i++) {
		for(let j = i + 1; j < scene.length; j++) {
			scene[i].updateAgainst(scene[j]);
		}
		scene[i].update();
	}
	let vulnerable = 0,
		infected = 0,
		recovered = 0;
	for(let e of scene) {
		if(e instanceof Ball) {
			switch(e.state) {
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
	if(spread.length > 0
	  && infected == spread[spread.length - 1][1]
	  && vulnerable == spread[spread.length - 1][2]
	  && recovered == spread[spread.length - 1][3])
		spread[spread.length - 1][0]++;
	else
		spread.push([1, infected, vulnerable, recovered]);
	
	document.getElementById("count").innerHTML = `<span style="color: ${grey}">${vulnerable}</span> + <span style="color: ${red}">${infected}</span> + <span style="color: ${blue}">${recovered}</span> = ${vulnerable + infected + recovered}`;
	
	if(infected == 0 && spread[spread.length - 1][0] * dt * 1000 >= delay) {
		// bring graph and count to top for good measure
		document.getElementById("count").style.zIndex = 3;
		graph.style.zIndex = 3;
		simulation_running = false;
	}
}

function render() {
	ctx.clearRect(0, 0, screen_px_w, screen_px_h);
	for(let e of scene)
		e.draw();
	draw_graph();
}

let last_tick = performance.now();

function loop() {
	window.requestAnimationFrame(loop);
	let t = performance.now();
	let did_update = false;
	if(simulation_running && t - last_tick >= dt * 1000) { // TODO: use while loop?
		did_update = true;
		last_tick += dt * 1000;
		update();
	}
	if(did_update)
		render();
	// print out total kinetic energy (helpful for making sure the physics is right):
	//let total = 0;
	//for(let e of scene) {
	//	if(e instanceof Ball)
	//		total += .5 * e.m * (e.vx*e.vx + e.vy*e.vy);
	//}
	//console.log(total);
}

let borders = [
	new Line([0, 0], [0, 0], false),
	new Line([0, 0], [0, 0], false),
	new Line([0, 0], [0, 0], false),
	new Line([0, 0], [0, 0], false)
];

window.addEventListener("resize", resize, false);
function resize() {
	screen_px_w = canvas.width = window.innerWidth;
	screen_px_h = canvas.height = window.innerHeight;
	screen_w = window.innerWidth / px_per_unit;
	screen_h = window.innerHeight / px_per_unit;
	// redo borders
	borders[0].set([-screen_w/2, -screen_h/2], [-screen_w/2,  screen_h/2]); // l
	borders[1].set([ screen_w/2, -screen_h/2], [ screen_w/2,  screen_h/2]); // r
	borders[2].set([-screen_w/2,  screen_h/2], [ screen_w/2,  screen_h/2]); // t
	borders[3].set([-screen_w/2, -screen_h/2], [ screen_w/2, -screen_h/2]); // b
	// don't trap balls outside the screen
	// TODO: give objects a .onresize() method?
	let epsilon = 0.01;
	for(let e of scene)
		if(e instanceof Ball) {
			if(e.x < -screen_w/2)
				e.x = -screen_w/2 + epsilon;
			else if(e.x > screen_w/2)
				e.x = screen_w/2 - epsilon;
			if(e.y < -screen_h/2)
				e.y = -screen_h/2 + epsilon;
			else if(e.y > screen_h/2)
				e.y = screen_h/2 - epsilon;
		}
	render();
}
resize();

function init() {
	for(let b of borders)
		scene.push(b);
	scene.push(new Wall);
	for(let i = 0; i < n_balls; i++)
		scene.push(new Ball);
	scene.push(new Line([-40, 0], [-50, -10]));
	scene.push(new Line([-40, 0], [-50,  10]));
	
	window.requestAnimationFrame(loop);
}

init();
