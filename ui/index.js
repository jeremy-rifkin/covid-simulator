let sim = new Sim(document.getElementById("sim"));
for(let i = 0; i < 50; i++) {
	sim.scene.push(new Ball(sim));
}
sim.scene[sim.scene.length - 1].state = states.infected;
sim.n_balls = 50;
sim.play();

/*
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
}, false);*/
