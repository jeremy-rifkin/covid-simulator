let canvas = document.getElementById("c"),
	ctx = canvas.getContext("2d"),
	graph = document.getElementById("graph"),
	graph_ctx = graph.getContext("2d"),
	px_per_unit,
	units_per_screen = 200, // width-wise
	screen_px_w,
	screen_px_h,
	screen_w,
	screen_h,
	dt = 1/60; // TODO

graph.width = 300;
graph.height = 200;

function screen_to_coord(x, y) {
	return [
		screen_w * x / screen_px_w - screen_w / 2,
		-(screen_h * (y / screen_px_h - 1) + screen_h / 2)
	];
}

function coord_to_screen(x, y) {
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


// TODO: make sure tick based time comparison is accurate

let simulation_running = false,
	recovery_time = 1000 * 20,
	delay = 1000 * 5,
	current_tick = 0,
	n_balls = 0,
	mouse_x = null,
	mouse_y = null;

let scene = [],
	spread = []; // [delta_tick, infected, vulnerable, recovered]

function between(v, a, b) {
	return v >= Math.min(a, b) && v <= Math.max(a, b);
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
		graph_ctx.moveTo(x, h - spread[0][p] / n_balls * ph);
		x += dx;
		for(let i = 1; i < spread.length; i++) {
			graph_ctx.lineTo(x, h - spread[i][p] / n_balls * ph);
			x += dx * spread[i][0];
		}
		graph_ctx.lineTo(x, h - spread[spread.length - 1][p] / n_balls * ph);
		graph_ctx.stroke();
	}
}

function is_good_spawn(x, y) {
	for(let o of scene) {
		if(o instanceof Wall) {
			if(between(x, o.left,  o.right) && between(y, o.top,  o.bottom)) {
				return false;
			}
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
	
	//if(infected == 0 && spread[spread.length - 1][0] * dt * 1000 >= delay) {
	//	// bring graph and count to top for good measure
	//	document.getElementById("count").style.zIndex = 3;
	//	graph.style.zIndex = 3;
	//	simulation_running = false;
	//}
}

function render() {
	ctx.clearRect(0, 0, screen_px_w, screen_px_h);
	for(let e of scene)
		e.draw();
	draw_graph();
}

let last_tick, render_needed = false;

function loop() {
	window.requestAnimationFrame(loop);
	if(simulation_running) {
		let t = performance.now(),
			did_update = false;
		if(t - last_tick >= dt * 1000) { // TODO: use while loop?
			did_update = true;
			last_tick += dt * 1000;
			update();
		}
		if(did_update)
			render();
	} else if(render_needed) {
		render();
		render_needed = false;
	}
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
	px_per_unit = screen_px_w / units_per_screen;
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
	last_tick = performance.now();
	window.requestAnimationFrame(loop);
}

init();


let play_pause = document.getElementById("playpause"),
	circle_add = document.getElementById("circleadd"),
	pointer = document.getElementById("pointer"),
	draw_lines = document.getElementById("drawlines"),
	draw_walls = document.getElementById("drawwalls");
	
let modes = {
	none: 0,
	pointer: 1,
	line: 2,
	wall: 3
};
let current_mode = modes.none;

function reset_buttons() {
	current_mode = modes.none;
	pointer.removeAttribute("data-selected");
	draw_lines.removeAttribute("data-selected");
	draw_walls.removeAttribute("data-selected");
}

// state for draw_lines
let line_p1 = undefined;

// play pause
play_pause.addEventListener("click", () => {
	if(simulation_running) {
		simulation_running = false;
		play_pause.innerHTML = `<i class="fas fa-play"></i>`;
	} else {
		simulation_running = true;
		last_tick = performance.now();
		play_pause.innerHTML = `<i class="fas fa-pause"></i>`;
	}
}, false);

// circle add and modal
let overlay = document.getElementById("overlay"),
    modal = document.getElementById("modal"),
    submit = document.getElementById("submit"),
	input = document.getElementById("nballs");
circle_add.addEventListener("click", () => {
	overlay.style.display = "block";
	modal.style.display = "block";
	input.focus();
}, false);
overlay.addEventListener("click", () => {
	overlay.style.display = "none";
	modal.style.display = "none";
	input.value = "";
}, false);
function do_submit(e) {
	if(e.type == "click" || e.keyCode == 13) {
		let q = parseInt(input.value);
		input.value = "";
		if(!isNaN(q) && q > 0) {
			n_balls += q;
			for(let i = 0; i < q; i++)
				scene.push(new Ball);
			render();
			overlay.style.display = "none";
			modal.style.display = "none";
		}
	}
}
submit.addEventListener("click", do_submit, false);
input.addEventListener("keydown", do_submit, false);

// pointer
pointer.addEventListener("click", () => {
	if(current_mode == modes.pointer) {
		current_mode = modes.none;
		pointer.removeAttribute("data-selected");
	} else {
		reset_buttons();
		current_mode = modes.pointer;
		pointer.setAttribute("data-selected", "");
	}
}, false);

// draw_lines
draw_lines.addEventListener("click", () => {
	if(current_mode == modes.line) {
		current_mode = modes.none;
		draw_lines.removeAttribute("data-selected");
	} else {
		reset_buttons();
		current_mode = modes.line;
		draw_lines.setAttribute("data-selected", "");
	}
}, false);

// draw_walls
draw_walls.addEventListener("click", () => {
	if(current_mode == modes.wall) {
		current_mode = modes.none;
		draw_walls.removeAttribute("data-selected");
	} else {
		reset_buttons();
		current_mode = modes.wall;
		draw_walls.setAttribute("data-selected", "");
	}
}, false);

canvas.addEventListener("click", e => {
	if(current_mode == modes.pointer) {
		// check for ball collision
		let least_distance = undefined, // really r^2
			least_distance_index = undefined;
		let c = screen_to_coord(e.x, e.y);
		mouse_x = c[0];
		mouse_y = c[1];
		for(let i = 0; i < scene.length; i++) {
			if(scene[i] instanceof Ball) {
				let distance = (mouse_x - scene[i].x) * (mouse_x - scene[i].x) + (mouse_y - scene[i].y) * (mouse_y - scene[i].y);
				if(least_distance == undefined || distance < least_distance) {
					least_distance = distance;
					least_distance_index = i;
				}
			}
		}
		if(least_distance != undefined && least_distance <= scene[least_distance_index].r * scene[least_distance_index].r) { // make sure we actually found something
			if(scene[least_distance_index].state == states.infected) {
				scene[least_distance_index].state = states.vulnerable;
			} else {
				scene[least_distance_index].state = states.infected;
				scene[least_distance_index].infected_time = current_tick;
			}
			render_needed = true;
		} else {
			for(let i = 0; i < scene.length; i++) {
				if(scene[i] instanceof Wall) {
					if(between(mouse_x, scene[i].left,  scene[i].right) && between(mouse_y, scene[i].top,  scene[i].bottom)) {
						scene[i].open();
					}
				}
			}
		}
	} else if(current_mode == modes.line) {
		if(line_p1 == undefined) {
			line_p1 = screen_to_coord(e.x, e.y);
		} else {
			scene.push(new Line(line_p1, screen_to_coord(e.x, e.y)));
			render_needed = true;
			line_p1 = undefined;
		}
	} else if(current_mode == modes.wall) {
		let c = screen_to_coord(e.x, e.y);
		scene.push(new Wall(c[0], 0));
		render_needed = true;
	}
}, false);
canvas.addEventListener("mousemove", e => {
	let c = screen_to_coord(e.x, e.y);
	mouse_x = c[0];
	mouse_y = c[1];
	render_needed = true;
}, false);
document.addEventListener("mouseout", () => {
	mouse_x = null;
	mouse_y = null;
	render_needed = true;
}, false);
