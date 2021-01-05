class SimProperties {
	/* SimProperties hold the default properties for a specific simulation
	*/
	constructor(sim_id, parent, simulation_default_properties) {
		this.id = sim_id;
		this.parent = parent;
		// setToDefault will set the master default values
		this.setToDefault();
		// apply the default properties default to the simulation
		this.simulation_default_properties = simulation_default_properties;
		this.apply_simulation_defaults();
		// lastly, check if simulation properties were saved locally
		if (localStorage.getItem(`default_sim_props_${sim_id}`) != null) {
			try {
				let props = JSON.parse(localStorage.getItem(`default_sim_props_${this.id}`));
				for (let prop in props) {
					this[prop] = props[prop];
				}
			} catch { }
		}
		// setup gui
		this.init_gui();
	}
	save_props() {
		// sadly we can't just JSON.stringify(this) because this is cyclic.
		let properties_to_save = ["days_per_second", "infectious_days", "presymptomatic_days",
			"reinfectable_rate", "transmission_rate", "ball_radius", "ball_velocity", "wall_openings",
			"n_balls"];
		let copy = {};
		for (let prop of properties_to_save)
			copy[prop] = this[prop];
		localStorage.setItem(`default_sim_props_${this.id}`, JSON.stringify(copy));
	}
	setToDefault() {
		// defaults about the virus and its transmission
		this.days_per_second = 2;
		this.infectious_days = 16;
		this.presymptomatic_days = 4;
		this.reinfectable_rate = 0.0;
		this.presymptomatic_transmission_rate = .2;
		this.transmission_rate = 1.0;

		// defaults about the balls
		this.ball_radius = 2;
		this.ball_velocity = 7.0;

		// defaults about the board
		this.wall_openings = 0;
		this.n_balls = 0;
	}
	apply_simulation_defaults() {
		for (let property in this.simulation_default_properties) {
			this[property] = this.simulation_default_properties[property];
		}
	}
	apply_board_defaults() {
		/* Hack to allow for calling some functions _after_ the parent Sim
		has appropriately set its default_sim_props to this.
		This is necessary so that the Ball constructor can grab the default radius from
		this.
		*/
		// TODO MAL: Broken for now. I first need to check to see how many balls are there,
		// and then either add more or remove them.  Or I can remove all the balls and
		// add them all back in (which might be better if we go towards having a default
		// state for some balls, e.g., start with 1 infected ball).
		this.parent.do_add_balls(this.n_balls);
	}
	reset_to_default() {
		this.setToDefault();
		this.apply_simulation_defaults();
		this.apply_board_defaults();
		this.update_dat();

		// TODO MAL: I'm still not seeing the update to radius, velocity, etc reflected when I press this button....
	}
	init_gui() {
		// setup dat gui
		var dat_gui = new dat.GUI({ autoPlace: false });
		this.parent.container.appendChild(dat_gui.domElement);
		// radius
		let dat_radius = dat_gui.add(this, "ball_radius", 0.1, 5);
		dat_radius.onChange(function (v) {
			for (let e of this.parent.scene) {
				if (e instanceof Ball) {
					e.r = v;
				}
			}
			this.parent.render_needed = true;
			this.save_props();
		}.bind(this));
		// velocity
		let dat_velocity = dat_gui.add(this, "ball_velocity", 0.1, 20, 0.01);
		dat_velocity.onChange(function (v) {
			for (let e of this.parent.scene) {
				if (e instanceof Ball) {
					let m = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
					e.vx *= v / m;
					e.vy *= v / m;
				}
			}
			this.parent.render_needed = true;
			this.save_props();
		}.bind(this));
		// wall openings
		let dat_wall = dat_gui.add(this, "wall_openings", 0, 40);
		dat_wall.onChange(function (v) {
			for (let e of this.parent.scene) {
				if (e instanceof Wall) {
					e.opening = v;
					e.update_opening();
				}
			}
			this.parent.render_needed = true;
			this.save_props();
		}.bind(this));
		// transmission rate
		let dat_transmission = dat_gui.add(this, "transmission_rate", 0, 1, 0.01);
		dat_transmission.onChange(function (v) {
			this.save_props();
		}.bind(this));
		// infectious days
		let dat_recovery = dat_gui.add(this, "infectious_days", 0, 20, 0.1);
		dat_recovery.onChange(function (v) {
			//this.infectious_days
			this.recovery_time = v * 1000;
			this.save_props();
		}.bind(this));
		// reset properties
		let dat_reset_to_default = dat_gui.add(this, "reset_to_default").name("reset properties");
		// this is hacky and bad -- MAL Why is this hacky and bad?
		this.update_dat = function () {
			dat_radius.updateDisplay();
			dat_velocity.updateDisplay();
			dat_wall.updateDisplay();
			dat_transmission.updateDisplay();
			dat_recovery.updateDisplay();
			this.save_props();
		}.bind(this);
	}
	update_dat() { } // this will be redefined in init_gui
	timeDiffToDays(time_diff) {
		/* Takes in a time difference (in ms) and returns the number of days represented

		parameters :
			time_diff (DOMHighResTimeStamp) : difference between two timestamps in milliseconds
		returns :
			days (int)
		*/
		// performance.now() returns a timestamp in milliseconds
		// interesting; why this instead of Date.now()?
		this.days_per_second * time_diff / 1000;
	}
}
