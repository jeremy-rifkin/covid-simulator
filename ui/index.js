let sim = new Sim("sim1", document.getElementById("sim"), {
	ball_radius: 2,
	ball_velocity: 7,
	days_per_second: 2,
	infectious_days: 16,
	presymptomatic_days: 4,
	reinfectable_rate: 0,
	transmission_rate: 1
});
let sim2 = new Sim("sim2", document.getElementById("sim2"), {
	ball_radius: 3,
	ball_velocity: 5,
	days_per_second: 2,
	infectious_days: 16,
	presymptomatic_days: 4,
	reinfectable_rate: 0,
	transmission_rate: 0.5
});
