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

/*
UI actions / components implement the following interface:
class IUIAction {
	constructor();
	resize();
	deactivate();
	draw();
}
*/

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
		// I am not happy with how RE is working so I have turned it off
		return;
		/*dx = (this.re_graph.width - 100) / this.current_tick;
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
		this.re_graph_ctx.stroke();*/
	}
	get_r0() {
		let infection_duration_time = this.recovery_time / 1000,
			collisions_per_balls_per_second = 2 * this.n_collisions / this.n_balls / ((this.current_tick - 60) / 60); // -60 to compensate for earlier hack
		// scalar * seconds * collisions / ball / second = collisions per ball for the infection duration
		return this.default_sim_props.transmission_rate * infection_duration_time * collisions_per_balls_per_second;
	}
	get_re() {
		// I am not happy with how RE is working so I have turned it off
		return 0;

		/*// this.spread is: [1, infected, vulnerable, recovered, this.get_r0(), this.get_re()]
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
		let spread_per_sec = 60 * (dy / tick_total);

		// find infection count t_i days ago
		tick_total = 0;
		let target_ticks = this.recovery_time;
		for (i = this.spread.length - 1; i >= 0; i--) {
			tick_total += this.spread[i][0];
			if (tick_total >= target_ticks)
				break;
		}

		let current_infection_count = this.spread[this.spread.length - 1][1] + this.spread[this.spread.length - 1][3],
			ti_infection_count = i < 0 ? 0 : this.spread[i][1] + this.spread[i][3];

		return (this.recovery_time / 1000 * spread_per_sec) / (current_infection_count - ti_infection_count);
		//return (tick_total / 60 * spread_per_sec) / (current_infection_count - ti_infection_count);
		
		//return spread_per_sec / this.spread[this.spread.length - 1][1] * this.recovery_time / 1000;*/
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
			this.r0_display.innerHTML = `Estimated R0: ${this.get_r0().toFixed(1)}`;
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
