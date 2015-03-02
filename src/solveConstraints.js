module.exports = solveConstraints;
var Classes = require("./classes.js");

// obtain a set of substitutions which will make the constraints unifiable
function solveConstraints(constraints) {
	var substitutions = [];

	while (constraints.length > 0) {
		constraints.sort(Classes.Constraint.compare);
		
		var constraint = constraints[0];
		constraints = constraints.slice(1);

		var r = constraint.solve();
		var subs = r.substitutions;

		constraints = constraints.concat(r.constraints);
		// apply the substitution to the remaining constraints
		for (var j=0; j<subs.length; j++) {
			for (var i = 0; i < constraints.length; i++) {
				subs[j].apply(constraints[i]);
			}
		}
		// it's quite important that substitutions are applied in the right order
		// here first item should be applied first
		substitutions = substitutions.concat(subs);
		continue;
	}
	return substitutions;
}
