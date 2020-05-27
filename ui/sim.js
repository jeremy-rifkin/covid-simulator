let red = "#e56a59",
	grey = "#c6c6c6",
	yellow = "#e8e388",
	blue = "#7dcef1";

let states = {
	vulnerable: 0,
	infected: 1,
	recovered: 2
};

class Ball {
	constructor(parent) {
		this.parent = parent; // ref to parent sim instance
		this.r = this.parent.default_sim_props.radius;
		this.m = 10;
		do {
			this.x = -this.parent.screen_w/2 + this.r + Math.random() * (this.parent.screen_w - 2 * this.r);
			this.y = -this.parent.screen_h/2 + this.r + Math.random() * (this.parent.screen_h - 2 * this.r);
		} while(!this.parent.is_good_spawn(this.x, this.y));

		let theta = Math.random() * 2 * Math.PI;
		this.vx = this.parent.default_sim_props.velocity * Math.cos(theta);
		this.vy = this.parent.default_sim_props.velocity * Math.sin(theta);
		this.selected = false;
		this.state = states.vulnerable;
		this.infected_time = this.state == states.infected ? current_tick : null;
		this.reproduction_count = 0;
	}
	update() {
		//console.log(this);
		this.x += this.vx * this.parent.dt;
		this.y += this.vy * this.parent.dt;
		// check our infection time
		if(this.state == states.infected && (this.parent.current_tick - this.infected_time) * this.parent.dt * 1000 >= this.parent.recovery_time) {
			this.state = states.recovered;
			//this.infected_time = null;
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
				// technically a collision for both particles, but we will only increment
				// n_collisions once and it will be multiplied by two later
				if(this.parent.current_tick >= 60) // TODO: hacky...
					this.parent.n_collisions++;

				// do infection
				if(this.state == states.vulnerable && obj.state == states.infected) {
					// do infection chance
					if(Math.random() <= this.parent.default_sim_props.transmission_rate) {
						this.state = states.infected;
						this.infected_time = this.parent.current_tick;
						obj.reproduction_count++;
					}
				}
				// both ways
				if(obj.state == states.vulnerable && this.state == states.infected) {
					// do infection chance
					if(Math.random() <= this.parent.default_sim_props.transmission_rate) {
						obj.state = states.infected;
						obj.infected_time = this.parent.current_tick;
						this.reproduction_count++;
					}
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
				this.parent.ctx.fillStyle = grey;
				break;
			case states.infected:
				this.parent.ctx.fillStyle = red;
				break;
			case states.recovered:
				this.parent.ctx.fillStyle = blue;
				break;
			default:
				throw "oops";
		}
		this.parent.ctx.beginPath();
		this.parent.ctx.arc(...this.parent.coord_to_screen(this.x, this.y), this.r * this.parent.px_per_unit, 0, 2 * Math.PI);
		this.parent.ctx.fill();
		if(this.selected) {
			this.parent.ctx.strokeStyle = "#000";
			this.parent.ctx.lineWidth = 1;
			this.parent.ctx.stroke();
		}
	}
}

class Line {
	constructor(parent, p1, p2, render_line=true) {
		this.parent = parent; // ref to parent sim instance
		this.p1 = p1;
		this.p2 = p2;
		this.render_line = render_line;
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
		if(this.render_line) {
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
		this.parent = parent; // ref to parent sim instance
		let w = 4,
			h = this.parent.screen_h;
		this.x = x;
		this.y = y;
		this.h = h;
		this.left = x - w/2;
		this.right = x + w/2;
		this.top = y + h/2;
		this.bottom = y - h/2;
		this.opening = 0;
		this.edges = [
			new Line(this.parent, [this.left,  this.bottom        ], [this.left,  this.bottom + h / 2]),
			new Line(this.parent, [this.left,  this.bottom + h / 2], [this.right, this.bottom + h / 2]),
			new Line(this.parent, [this.right, this.bottom        ], [this.right, this.bottom + h / 2]),

			new Line(this.parent, [this.left,  this.top        ], [this.left,  this.top - h / 2]),
			new Line(this.parent, [this.left,  this.top - h / 2], [this.right, this.top - h / 2]),
			new Line(this.parent, [this.right, this.top        ], [this.right, this.top - h / 2])
		];
		this.selected = false;
		this.resolve_balls();
	}
	resolve_balls() {
		for(let e of this.parent.scene) {
			if(e instanceof Ball) {
				if(between(e.x, this.left, this.right)) {
					if(between(e.y, this.top, this.top - this.h / 2 + this.opening)
					|| between(e.y, this.bottom, this.bottom + this.h / 2 - this.opening)) {
						let epsilon = 0.01;
						if(e.x < this.x) {
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
		if(this.selected) {
			this.parent.ctx.fillStyle = "rgba(205, 205, 205, .4)";
			this.parent.ctx.fillRect(...this.parent.coord_to_screen(this.left, this.top), (this.right - this.left) * this.parent.px_per_unit, (this.top - this.bottom) * this.parent.px_per_unit);
		}
		for(let e of this.edges)
			e.draw();
	}
}

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
		let left = x - w/2,
			right = x + w/2,
			top = h/2,
			bottom = -h/2;
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
		if(this.p1 == null) {
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
		if(this.p1 != null && this.last_xy != null) {
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
		for(let i = scene.length - 1; i >= 0; i--) {
			if(scene[i] instanceof Ball) {
				if((x - scene[i].x) * (x - scene[i].x) + (y - scene[i].y) * (y - scene[i].y) <= scene[i].r * scene[i].r) {
					return scene[i];
				}
			} else if(scene[i] instanceof Line) {
				// TODO
			} else if(scene[i] instanceof Wall) {
				if(between(x, scene[i].left, scene[i].right) && between(y, scene[i].top, scene[i].bottom)) {
					return scene[i];
				}
			}
		}
		return null;
	}
	click(e) {
		let obj = this.analyzePoint(e);
		if(obj != null) {
			if(obj instanceof Ball) {
				obj.state = states.infected;
				obj.infected_time = this.parent.current_tick;
			} else if(obj instanceof Line) {

			} else if(obj instanceof Wall) {
				
			}
			this.parent.render_needed = true;
		}
	}
	mousemove(e) {
		let obj = this.analyzePoint(e);
		if(this.current_selected != null) {
			this.current_selected.selected = false;
		}
		this.current_selected = obj;
		if(this.current_selected != null) {
			this.current_selected.selected = true;
		}
		this.parent.render_needed = true;
	}
	wheel(e) {
		//console.log(e);
		let obj = this.analyzePoint(e);
		if(obj != null && obj instanceof Wall) {
			e.preventDefault();
			obj.opening += e.deltaY / 2;
			if(obj.opening < 0)
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
		if(this.current_selected != null) {
			this.current_selected.selected = false;
		}
	}
	draw() {
		
	}
}

class Sim {
	constructor(container) {
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
		this.pointer.addEventListener("click", function() {
			if(this.current_ui_action instanceof PointerHandler) {
				this.cancel_action();
			} else {
				this.cancel_action();
				this.current_ui_action = new PointerHandler(this);
			}
		}.bind(this), false);
		this.controls.appendChild(this.pointer);

		this.drawlines = document.createElement("div");
		this.drawlines.innerHTML = `<i class="fas fa-pencil-ruler"></i>`;
		this.drawlines.addEventListener("click", function() {
			if(this.current_ui_action instanceof DrawLinesHandler) {
				this.cancel_action();
			} else {
				this.cancel_action();
				this.current_ui_action = new DrawLinesHandler(this);
			}
		}.bind(this), false);
		this.controls.appendChild(this.drawlines);

		this.drawwalls = document.createElement("div");
		this.drawwalls.innerHTML = `<i class="fas fa-border-none"></i>`;
		this.drawwalls.addEventListener("click", function() {
			if(this.current_ui_action instanceof DrawWallsHandler) {
				this.cancel_action();
			} else {
				this.cancel_action();
				this.current_ui_action = new DrawWallsHandler(this);
			}
		}.bind(this), false);
		this.controls.appendChild(this.drawwalls);

		this.download = document.createElement("div");
		this.download.innerHTML = `<i class="fas fa-download"></i>`;
		this.download.addEventListener("click", function() {
			this.download_sim();
		}.bind(this), false);
		this.controls.appendChild(this.download);

		this.upload = document.createElement("div");
		this.upload.innerHTML = `<i class="fas fa-upload"></i>`;
		this.upload.addEventListener("click", function() {
			this.upload_sim();
		}.bind(this), false);
		this.controls.appendChild(this.upload);

		this.reset = document.createElement("div");
		this.reset.innerHTML = `<i class="fas fa-undo"></i>`;
		this.reset.addEventListener("click", this.reset_sim.bind(this), false);
		this.controls.appendChild(this.reset);
		
		function sim_props_class(pr) {
			this.radius = 2;
			this.velocity = 7;
			this.wall_openings = 0;
			this.transmission_rate = 1;
			this.infection_duration = 20; // TODO
			this.reset_to_default = function() {
				this.radius = 2;
				this.velocity = 7;
				this.wall_openings = 0;
				this.transmission_rate = 1;
				this.infection_duration = 20;
				pr.update_dat();
			}.bind(this);
		}
		this.default_sim_props = new sim_props_class(this);

		// check for saved props
		if(localStorage.getItem("default_sim_props") != null) {
			try {
				let props = JSON.parse(localStorage.getItem("default_sim_props"));
				for(let prop in props) {
					this.default_sim_props[prop] = props[prop];
				}
			} catch {}
		}
		let save_props = function() {
			localStorage.setItem("default_sim_props", JSON.stringify(this.default_sim_props));
		}.bind(this);

		var dat_gui = new dat.GUI({autoPlace: false});
		this.container.appendChild(dat_gui.domElement);
		let dat_radius = dat_gui.add(this.default_sim_props, "radius", 0.1, 5);
		dat_radius.onChange(function(v) {
			for(let e of this.scene) {
				if(e instanceof Ball) {
					e.r = v;
				}
			}
			this.render_needed = true;
			save_props();
		}.bind(this));
		let dat_velocity = dat_gui.add(this.default_sim_props, "velocity", 0.1, 20, 0.01);
		dat_velocity.onChange(function(v) {
			for(let e of this.scene) {
				if(e instanceof Ball) {
					let m = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
					e.vx *= v / m;
					e.vy *= v / m;
				}
			}
			this.render_needed = true;
			save_props();
		}.bind(this));
		let dat_wall = dat_gui.add(this.default_sim_props, "wall_openings", 0, 40);
		dat_wall.onChange(function(v) {
			for(let e of this.scene) {
				if(e instanceof Wall) {
					e.opening = v;
					e.update_opening();
				}
			}
			this.render_needed = true;
			save_props();
		}.bind(this));
		let dat_transmission = dat_gui.add(this.default_sim_props, "transmission_rate", 0, 1, 0.01);
		dat_transmission.onChange(function(v) {
			save_props();
		}.bind(this));
		let dat_recovery = dat_gui.add(this.default_sim_props, "infection_duration", 0, 20, 0.1);
		dat_recovery.onChange(function(v) {
			//this.default_sim_props.infection_duration
			this.recovery_time = v * 1000;
			save_props();
		}.bind(this));
		dat_gui.add(this.default_sim_props, "reset_to_default");
		// this is hacky and bad
		this.update_dat = function() {
			dat_radius.updateDisplay();
			dat_velocity.updateDisplay();
			dat_wall.updateDisplay();
			dat_transmission.updateDisplay();
			dat_recovery.updateDisplay();
			save_props();
		}.bind(this);

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
		for(let b of this.borders)
			this.scene.push(b);

		window.addEventListener("resize", this.resize.bind(this), false);
		this.resize();
		window.requestAnimationFrame(this.loop.bind(this));
	}
	resize() {
		this.screen_px_w = this.canvas.width = this.container.getBoundingClientRect().width | 0;
		this.screen_px_h = this.canvas.height = this.screen_px_w * .7 | 0;
		this.px_per_unit = this.screen_px_w / this.units_per_screen;
		this.screen_w = this.screen_px_w / this.px_per_unit;
		this.screen_h = this.screen_px_h / this.px_per_unit;
		this.container.style.height = this.screen_px_h + "px";

		// redo borders
		this.borders[0].set([-this.screen_w/2, -this.screen_h/2], [-this.screen_w/2,  this.screen_h/2]); // l
		this.borders[1].set([ this.screen_w/2, -this.screen_h/2], [ this.screen_w/2,  this.screen_h/2]); // r
		this.borders[2].set([-this.screen_w/2,  this.screen_h/2], [ this.screen_w/2,  this.screen_h/2]); // t
		this.borders[3].set([-this.screen_w/2, -this.screen_h/2], [ this.screen_w/2, -this.screen_h/2]); // b
		// don't trap balls outside the screen
		// TODO: give objects a .onresize() method?
		let epsilon = 0.01;
		for(let e of this.scene)
			if(e instanceof Ball) {
				if(e.x < -this.screen_w/2)
					e.x = -this.screen_w/2 + epsilon;
				else if(e.x > this.screen_w/2)
					e.x = this.screen_w/2 - epsilon;
				if(e.y < -this.screen_h/2)
					e.y = -this.screen_h/2 + epsilon;
				else if(e.y > this.screen_h/2)
					e.y = this.screen_h/2 - epsilon;
			}
		if(this.current_ui_action)
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
		for(let o of this.scene) {
			if(o instanceof Wall) {
				if(between(x, o.left,  o.right) && between(y, o.top,  o.bottom)) {
					return false;
				}
			}
		}
		return true;
	}
	draw_graphs() {
		this.graph_ctx.clearRect(0, 0, this.graph.width, this.graph.height);
		this.re_graph_ctx.clearRect(0, 0, this.re_graph.width, this.re_graph.height);
		if(this.spread.length == 0)
			return;
		// spread graph
		let dx = this.graph.width / this.current_tick,
			x,
			h = this.graph.height,
			ph = h - 10;
		this.graph_ctx.lineWidth = 2;
		let colors = [red, grey, blue];
		for(let p = 1; p <= 3; p++) {
			x = 0;
			this.graph_ctx.strokeStyle = colors[p - 1];
			this.graph_ctx.beginPath();
			this.graph_ctx.moveTo(x, h - this.spread[0][p] / this.n_balls * ph);
			x += dx;
			for(let i = 1; i < this.spread.length; i++) {
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
		for(let i = 1; i < this.spread.length; i++) {
			if(this.spread[i][5] > max_r)
				max_r = this.spread[i][5];
		}
		this.re_graph_ctx.font = "14px Arial";
		this.re_graph_ctx.textBaseline = "middle";
		this.re_graph_ctx.textAlign = "center";
		this.re_graph_ctx.fillStyle = "#dcdcdc";
		this.re_graph_ctx.strokeStyle = "#dcdcdc";
		let lines = [max_r, .5 * max_r, 2.4, 1];
		for(let p of lines) {
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
		for(let i = 1; i < this.spread.length; i++) {
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
			//collisions_per_balls_per_second = 2 * this.n_collisions / this.n_balls / ((this.current_tick - 60) / 60);
			collisions_per_balls_per_second = this.n_collisions / this.n_balls / ((this.current_tick - 60) / 60); // -60 to compensate for earlier hack
		return this.default_sim_props.transmission_rate * infection_duration_time * collisions_per_balls_per_second;
	}
	get_re() {
		let tick_total = 0,
			i,
			target_dx = 120;
		//if(this.current_tick <= target_dx)
		//	return 0;
		for(i = this.spread.length - 1; i >= 0; i--) {
			tick_total += this.spread[i][0];
			if(tick_total >= target_dx)
				break;
		}
		if(tick_total < target_dx)
			return 0; //this.get_r0();
		let dy = (this.spread[this.spread.length - 1][1] + this.spread[this.spread.length - 1][3])
					- (this.spread[i][1] + this.spread[i][3]);
		let spread_per_sec = 60 * (dy / tick_total);
		return spread_per_sec / this.spread[this.spread.length - 1][1] * this.recovery_time / 1000;
	}
	update() {
		this.current_tick++;
		for(let i = 0; i < this.scene.length; i++) {
			for(let j = i + 1; j < this.scene.length; j++) {
				this.scene[i].updateAgainst(this.scene[j]);
			}
			this.scene[i].update();
		}
		let vulnerable = 0,
			infected = 0,
			recovered = 0;
		for(let e of this.scene) {
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
		if(this.spread.length > 0
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

		if(this.current_tick % 10 == 0 && this.current_tick > 60 && this.n_balls > 0) {
			//this.r0_display.innerHTML = `Simulation R0 = ${Math.round(this.get_r0() * 10) / 10}`;
			this.r0_display.innerHTML = `Inherent R0 = ${this.get_r0().toFixed(1)}`;
		}
		
		if(!this.force_run && infected == 0 && this.spread.length > 0 && this.spread[this.spread.length - 1][0] * this.dt * 1000 >= this.delay) {
			this.pause();
		}
	}
	render() {
		this.ctx.clearRect(0, 0, this.screen_px_w, this.screen_px_h);
		for(let e of this.scene)
			e.draw();
		this.draw_graphs();
		if(this.current_ui_action)
			this.current_ui_action.draw();
	}
	loop() {
		window.requestAnimationFrame(this.loop.bind(this));
		if(this.simulation_running) {
			let t = performance.now(),
				did_update = false;
			while(t - this.last_tick >= this.dt * 1000) {
				did_update = true;
				this.last_tick += this.dt * 1000;
				this.update();
			}
			if(did_update)
				this.render();
			else if(this.render_needed) {
				this.render_needed = false;
				this.render();
			}
		} else if(this.render_needed) {
			this.render_needed = false;
			this.render();
		}
	}
	play() {
		this.playpause.innerHTML = `<i class="fas fa-pause"></i>`;
		this.simulation_running = true;
		this.last_tick = performance.now();
		let infected = 0;
		for(let e of this.scene)
			if(e instanceof Ball && e.state == states.infected)
				infected++;
		if(!this.force_run && infected == 0 && this.spread.length > 0 && this.spread[this.spread.length - 1][0] * this.dt * 1000 >= this.delay)
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
		if(this.simulation_running) {
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
		input.addEventListener("keydown", function(e) {
			if(e.keyCode == 13) {
				this.do_add_balls(parseInt(input.value));
				input.value = "";
			} else if(e.keyCode == 27) {
				this.close_add_balls_modal();
			}
		}.bind(this), false);

		let wrapper = document.createElement("div");
		wrapper.setAttribute("class", "wrapper");

		let submit = document.createElement("div");
		submit.setAttribute("class", "submit");
		submit.innerHTML = "Go";
		submit.addEventListener("click", function(e) {
			this.do_add_balls(parseInt(input.value));
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
		if(!isNaN(q) && q > 0) {
			this.n_balls += q;
			for(let i = 0; i < q; i++)
				this.scene.push(new Ball(this));
			this.close_add_balls_modal();
		}
		this.render_needed = true;
	}
	close_add_balls_modal() {
		this.circleadd_overlay.remove();
		this.circleadd_modal.remove();
	}
	cancel_action() {
		if(this.current_ui_action == null)
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
		for(let p of sim_props)
			copy[p] = this[p];
		copy["default_sim_props"] = {
			radius: this.default_sim_props.radius,
			velocity: this.default_sim_props.velocity,
			wall_openings: this.default_sim_props.wall_openings,
			transmission_rate: this.default_sim_props.transmission_rate,
			infection_duration: this.default_sim_props.infection_duration
		}
		copy.scene = [];
		for(let obj of this.scene) {
			if(obj instanceof Ball) {
				let oc = {type: "ball"};
				for(let p of ball_props)
					oc[p] = obj[p];
				copy.scene.push(oc);
			} else if(obj instanceof Line) {
				let oc = {type: "line"};
				for(let p of line_props)
					oc[p] = obj[p];
				copy.scene.push(oc);
			} else if(obj instanceof Wall) {
				let oc = {type: "wall"};
				for(let p of wall_props)
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
		input.addEventListener("change", function() {
			if(input.files.length != 1) {
				console.log("crap");
				input.remove();
				return;
			}
			var reader = new FileReader();
			reader.onload = function(e) {
				let data = JSON.parse(e.target.result);
				let sim_props = ["recovery_time", "delay", "current_tick", "n_balls", "n_collisions", "spread"],
					ball_props = ["r", "m", "x", "y", "vx", "vy", "state", "infected_time"],
					line_props = ["p1", "p2", "render_line"],
					wall_props = ["x", "y", "opening"];
				for(let p of sim_props)
					this[p] = data[p];
				this.default_sim_props.radius = data.default_sim_props.radius;
				this.default_sim_props.velocity = data.default_sim_props.velocity;
				this.default_sim_props.wall_openings = data.default_sim_props.wall_openings;
				this.default_sim_props.transmission_rate = data.default_sim_props.transmission_rate;
				this.default_sim_props.infection_duration = data.default_sim_props.infection_duration;
				this.update_dat();
				this.scene = [];
				for(let obj of data.scene) {
					switch(obj.type) {
						case "ball":
							let b = new Ball(this);
							for(let p of ball_props)
								b[p] = obj[p];
							this.scene.push(b);
							break;
						case "line":
							let l = new Line(this);
							for(let p of line_props)
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
				for(let i = 0; i < 4; i++)
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
		for(let b of this.borders)
			this.scene.push(b);
	}
}
