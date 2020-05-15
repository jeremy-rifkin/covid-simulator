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
		this.vx = 5 * Math.cos(theta);
		this.vy = 5 * Math.sin(theta);
		this.state = Math.random() < 0.05 ? states.infected : states.vulnerable;
		this.infected_time = this.state == states.infected ? Date.now() : null;
	}
	update() {
		this.x += this.vx * dt;
		this.y += this.vy * dt;
		if(this.x - this.r < -w / 2 && this.vx < 0) {
			this.x = -w / 2 + this.r;
			this.vx *= -1;
		} else if(this.x + this.r > w / 2 && this.vx > 0) {
			this.x = w / 2 - this.r;
			this.vx *= -1;
		}
		if(this.y - this.r < -h / 2 && this.vy < 0) {
			this.y = -h / 2 + this.r;
			this.vy *= -1;
		} else if(this.y + this.r > h / 2 && this.vy > 0) {
			this.y = h / 2 - this.r;
			this.vy *= -1;
		}
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
		let dx = obj.x - this.x,
			dy = obj.y - this.y;
		// check collision
		if(dx*dx + dy*dy <= (obj.r + this.r) * (obj.r + this.r)) {
			// do elastic
			let dvx = this.vx - obj.vx,
				dvy = this.vy - obj.vy;
			// if dot product of the velocity vector and vector between balls is negative, they're
			// going in the same direction and we don't want to update or the balls will stick
			if (dvx * dx + dvy * dy >= 0) { // TODO
				let theta = -Math.atan2(obj.y - this.y, obj.x - this.x);
				let m1 = this.m,
					m2 = obj.m,
					mt = m1 + m2;
				// rotate velocities
				let u1 = this.rotate([this.vx, this.vy], theta),
					u2 = this.rotate([obj.vx, obj.vy], theta);
				// elastic collision
				let v1 = [u1[0] * (m1 - m2) / mt + u2[0] * 2 * m2 / mt, u1[1]],
					v2 = [u2[0] * (m2 - m1) / mt + u1[0] * 2 * m1 / mt, u2[1]];
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
		//console.log(...screentopx(this.x, this.y), this.r * pxperunit, 0, 2 * Math.PI);
		ctx.fill();
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
	//let total = 0;
	//for(let e of scene) {
	//	total += .5 * e.m * (e.vx*e.vx + e.vy*e.vy);
	//}
	//console.log(total);
}

window.addEventListener("resize", resize, false);
function resize() {
	pxw = canvas.width = window.innerWidth;
	pxh = canvas.height = window.innerHeight;
	w = window.innerWidth / pxperunit;
	h = window.innerHeight / pxperunit;
	render();
}
resize();

function init() {
	for(let i = 0; i < 40; i++) {
		scene.push(new Ball);
	}
	window.requestAnimationFrame(loop);
}

init();
