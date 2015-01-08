/*jshint unused:true, bitwise:true, eqeqeq:true, undef:true, latedef:true, eqnull:true */
/* global require, module, console */

/* this module is the central point for type-checking provided
	code, and for generating gradual-typing-compiled source code */


// for constructing and deconstructing the AST respectively
// var acorn = require("acorn");
// var escodegen = require("escodegen");
var UglifyJS = require("uglify-js2");

// for our jstyper objects
var Classes = require("./classes.js");
require("./judgements.js");
require("./checkUntyped.js");
require("./assertions.js");
require("./insertBefore.js");

String.prototype.format = function() {
	var newStr = this,
		i = 0;
	while (/%s/.test(newStr))
		newStr = newStr.replace("%s", arguments[i++]);
	return newStr;
};

function solveConstraints(constraints) {
	// originally from Pierce p. 327
	
	// base case
	if (constraints.length < 1)
		return {substitutions:[], checks:[]};

	var leftType = constraints[0].leftType;
	var rightType = constraints[0].rightType;
	var remainder = constraints.slice(1);
	var label;

	// if this is an 'enforcing' constraint, then we generate extra members
	if (constraints[0].enforce) {
		for (label in leftType.memberTypes) {

			// if rightType has a field missing, we add it here. Adding these
			// will make the equals check below return true, and then
			// constraints will be generated to assert that each of rightType's
			// members are the same type as leftType's members
			if (rightType.memberTypes[label] === undefined) {
				rightType.memberTypes[label] = Classes.TypeEnv.getFreshType();
			}
		}
	}

	// types are equal => constraint satisfied
	// for objects, rightType has at least the structure of leftType
	if (leftType.equals(rightType)) {

		if (leftType.type !== "object")	
			return solveConstraints(remainder);

		// generate new constraints asserting that the members of leftType
		// and of rightType have the same type
		var newConstraints = [];
		for (label in leftType.memberTypes) {
			newConstraints.push(new Classes.Constraint(leftType.memberTypes[label], rightType.memberTypes[label], null));
		}

		return solveConstraints(remainder.concat(newConstraints));
	}

	var sub;

	// constraints involving dynamic types are trivially satisfied
	// if the leftType (write) type is dynamic, we always allow
	if (leftType.isDynamic)
		return solveConstraints(remainder);

	// if the rightType (read) type is dynamic, we allow but must typecheck
	// TODO: object types don't get type-checks, they get guarded
	if (rightType.isDynamic && rightType !== "object") {
		var solution1 = solveConstraints(remainder);
		solution1.checks.push({node:constraints[0].rightNode, type:leftType});
		return solution1;
	}


	// if one type is not concrete, it can be substituted by the other
	if (!leftType.isConcrete) {
		sub = new Classes.Substitution(leftType, rightType);
	} else if (!rightType.isConcrete) {
		sub = new Classes.Substitution(rightType, leftType);

	} // both are different concrete types
	else {
		throw new Error(" Failed Unification: " + leftType.toString() + " != " + rightType.toString());
	}

	// apply the substitution to the remaining constraints
	for (var i = 0; i < remainder.length; i++) {
		sub.apply(remainder[i]);
	}

	// it's quite important that substitutions are applied in the right order
	// here first item should be applied first
	var solution = solveConstraints(remainder);
	solution.substitutions = [sub].concat(solution.substitutions);
	return solution;
}

module.exports = function(src) {

	// obtain AST
	var ast;
	try {
		ast = UglifyJS.parse(src);
	} catch (e) {
		e.message = "Parse Error: " + e.message;
		throw e;
	}

	// reset the fresh type counter for consistency
	Classes.TypeEnv.nextType = 1;

	// generate a judgement for (each annotated section of) the entire tree
	// it's checkUntyped because, at the time of calling, we're not in the typed world yet
	var chunks = ast.checkUntyped();

	// check the judgement is valid and do gradual typing for each chunk
	for (var i = 0; i< chunks.length; i++) {

		// solve the generated constraints, or throw an error if this isn't possible
		var solution = solveConstraints(chunks[i].C, chunks[i].gamma);

		// apply the solution substitutions to the type environment
		for (var j=0; j<solution.substitutions.length; j++) {
			chunks[i].gamma.applySubstitution(solution.substitutions[j]);
			for (var k = 0; k<solution.checks.length; k++) {
				solution.checks[k].type.applySubstitution(solution.substitutions[j]);
			}
		}

		// Prepare a helpful message for each typed chunk
		var typeComment = " jstyper types: ";
		var sep = "";
		for (var o = 0; o < chunks[i].gamma.length; o++) {
			var location = (chunks[i].gamma[o].node)?
				"l%s c%s".format(
					chunks[i].gamma[o].node.start.line,
					chunks[i].gamma[o].node.start.col)
				:"imported";

			typeComment += sep;
			typeComment += "%s (%s): %s".format(
				chunks[i].gamma[o].name,
				location,
				chunks[i].gamma[o].type.toString());
			sep = "; ";
		}

		// prepend the types in a comment at the start of the chunk
		chunks[i].nodes[0].start.comments_before.push(
			new UglifyJS.AST_Token({
				type: 'comment1',
				value: typeComment
			})
		);

		// TODO: append a notice indicating the end of the typed section (not easy without a trailing comments property!)
		
		for (var l = 0; l<solution.checks.length; l++) {
			// insert the checks as appropriate
			// unfortunately we're replacing nodes as we go, so we'll need to substitute nodes as we go along
			var typeChecks = solution.checks[l].node.getTypeChecks( solution.checks[l].type );
			if (typeChecks) {
				for (var p = 0; p < typeChecks.length; p++) {
					var subs = solution.checks[l].node.parent().insertBefore(typeChecks[p], solution.checks[l].node);
					for (var m = 0; m<subs.length; m++) {
						for (var n=l; n<solution.checks.length; n++) {
							if (solution.checks[n].node === subs[m].from) {
								solution.checks[n].node = subs[m].to;
							}
						}
					}
					
				}
			}
		}
	}

	var checkRes = chunks;
	var stream = UglifyJS.OutputStream({
		beautify: true,
		comments: true,
		width: 60
	});
	ast.print(stream);

	return {
		src: stream.toString(),
		check: checkRes
	};
};