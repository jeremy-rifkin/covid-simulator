let canvas = document.getElementById("c"),
	ctx = canvas.getContext("2d"),
	pxperunit = 10,
	pxw,
	pxh,
	w,
	h,
	dt = 1/60;

function pxtoscreen(x, y) {
	// TODO
}

function screentopx(x, y) {
	return [
		(x + (w / 2)) / w * pxw,
		pxh * (1 - (y + (h / 2)) / h)
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

let recovery_time = 1000 * 10;

class Ball {
	constructor() {
		this.r = 2;
		this.m = 10;
		this.x = -w/2 + this.r + Math.random() * (w - 2 * this.r);
		this.y = -h/2 + this.r + Math.random() * (h - 2 * this.r);
		let theta = Math.random() * 2 * Math.PI;
		this.vx = 7 * Math.cos(theta);
		this.vy = 7 * Math.sin(theta);
		this.state = Math.random() < 0.05 ? states.infected : states.vulnerable;
		this.infected_time = this.state == states.infected ? Date.now() : null;
	}
	update() {
		this.x += this.vx * dt;
		this.y += this.vy * dt;
		// check our infection time
		if(this.state == states.infected && Date.now() - this.infected_time >= recovery_time) {
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
					this.infected_time = Date.now();
				}
				// both ways
				if(obj.state == states.vulnerable && this.state == states.infected) {
					obj.state = states.infected;
					obj.infected_time = Date.now();
				}
			}
		} else if(obj instanceof Line) {
			// we're actually going to pass the collision off to Line.updateAgainst
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
		ctx.arc(...screentopx(this.x, this.y), this.r * pxperunit, 0, 2 * Math.PI);
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
	updateAgainst(obj) {
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
		} else {
			// check collision with endpoints real quick
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
	}
	draw() {
		if(this.line) {
			ctx.strokeStyle = "#000";
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.moveTo(...screentopx(...this.p1));
			ctx.lineTo(...screentopx(...this.p2));
			ctx.stroke();
		}
	}
}

let scene = [];

function update() {
	for(let i = 0; i < scene.length; i++) {
		for(let j = i + 1; j < scene.length; j++) {
			scene[i].updateAgainst(scene[j]);
		}
		scene[i].update();
	}
}

function render() {
	ctx.clearRect(0, 0, pxw, pxh);
	for(let e of scene)
		e.draw();
}

function loop() {
	window.requestAnimationFrame(loop);
	update();
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
	pxw = canvas.width = window.innerWidth;
	pxh = canvas.height = window.innerHeight;
	w = window.innerWidth / pxperunit;
	h = window.innerHeight / pxperunit;
	// redo borders
	borders[0].set([-w/2, -h/2], [-w/2,  h/2]); // l
	borders[1].set([ w/2, -h/2], [ w/2,  h/2]); // r
	borders[2].set([-w/2,  h/2], [ w/2,  h/2]); // t
	borders[3].set([-w/2, -h/2], [ w/2, -h/2]); // b
	// don't trap balls outside the screen
	// TODO: give objects a .onresize() method?
	let epsilon = 0.01;
	for(let e of scene)
		if(e instanceof Ball) {
			if(e.x < -w/2)
				e.x = -w/2 + epsilon;
			else if(e.x > w/2)
				e.x = w/2 - epsilon;
			if(e.y < -h/2)
				e.y = -h/2 + epsilon;
			else if(e.y > h/2)
				e.y = h/2 - epsilon;
		}
	render();
}
resize();

function init() {
	for(let b of borders)
		scene.push(b);
	for(let i = 0; i < 70; i++)
		scene.push(new Ball);
	scene.push(new Line([-40, 0], [0, 10]));
	scene.push(new Line([-40, 10], [-40, -40]));
	window.requestAnimationFrame(loop);
}

init();
