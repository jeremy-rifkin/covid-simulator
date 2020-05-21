let sim = new Sim(document.getElementById("sim"));
//for(let i = 0; i < 50; i++) {
//	sim.scene.push(new Ball(sim));
//}
//sim.scene[sim.scene.length - 1].state = states.infected;
//sim.n_balls = 50;
//sim.play();

/*
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
