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

// obtain a set of substitutions which will make the constraints unifiable
// also generate checks for dynamic types
function solveConstraints(constraints) {
	// originally from Pierce p. 327

	// sort constraints before attacking them
	/*

		By inspection of solveConstraints, we see that there are two outcomes
		to this function:

			 - More constraints are generated or
			 - A substitution occurs.

		No single constraint will ever cause both generation of sub-
		constraints, and a substitution. Ideally, we want to generate all
		possible constraints before carrying out any substitutions (why?).

		If any constraints involve two objects or two functions, they will
		immediately generate more constraints - they must be first.
	
		Equality constraints between one object/function and one abstract type
		can be safely substituted, because ???

		 If some
		constraint involves one object/function and one abstract type, it may
		become a constraint of the form above after a single substitution, so
		it should come next. If a constraint involves two abstract variables,
		a single iteration will not generate any new subconstraints, so it can
		go next. If a constraint involves a concrete primitive type, it will
		never generate subconstraints, so it should go last.

	*/

	var substitutions = [];

	while (constraints.length > 0) {
		constraints.sort(Classes.Constraint.compare);
		
		var constraint = constraints[0];
		constraints = constraints.slice(1);

		var leftType = constraint.type1;
		var rightType = constraint.type2;

		// type structures are equal => constraint satisfied
		if (constraint.check()) {

			// if this is a complex structure, there may be sub-constraints to solve
			constraints = constraints.concat(constraint.getSubConstraints());
			continue;
		}

		// TODO: Gradual Typing
		// // constraints involving dynamic types are trivially satisfied
		// // if the leftType (write) type is dynamic, we always allow
		// // TODO: left != write nowadays...
		// if (leftType.isDynamic) continue;

		// // if the rightType (read) type is dynamic, we allow but must typecheck
		// // TODO: object types don't get type-checks, they should get guarded
		// if (rightType.isDynamic && rightType !== "object") {
		// 	result.checks.push({node:constraint.checkNode, type:leftType});
		// 	continue;
		// }

		var sub;
		// if one type is not concrete, it can be substituted by the other
		// if (constraint instanceof Classes.LEqConstraint && (leftType.type === "object" || rightType.type === "object")) {
		// 	// we can't just do a straight substitution for LEqConstraints between objects
		// 	// here we have a constraint of the form leftType <= rightType

		// 	if (!leftType.isConcrete) {
		// 		// the minimal solution is for the leftType to be instantiated with {}
		// 		// var emptyObj = new Classes.ObjectType({memberTypes:{}});
		// 		sub = new Classes.Substitution(leftType, rightType);
		// 	} else if (!rightType.isConcrete) {
		// 		// the minimal solution is for the rightType to be instantiated with the leftType
		// 		sub = new Classes.Substitution(rightType, leftType);
		// 	} else {

		// 		// for two concrete types we can try adding members to the
		// 		// smaller type and checking subconstraints
		// 		var newleqConstraints = constraint.satisfy();
		// 		if (newleqConstraints.length > 0) {
		// 			constraints = constraints.concat(newleqConstraints);
		// 			continue;
		// 		}
		// 	}
		// } else {
			if (!leftType.isConcrete) {
				sub = new Classes.Substitution(leftType, rightType);
			} else if (!rightType.isConcrete) {
				sub = new Classes.Substitution(rightType, leftType);

			} // both are different concrete types
			else {
				throw new Error(" Failed Unification: " + leftType.toString() + " != " + rightType.toString());
			}
		// }

		// apply the substitution to the remaining constraints
		for (var i = 0; i < constraints.length; i++) {
			sub.apply(constraints[i]);
		}

		// it's quite important that substitutions are applied in the right order
		// here first item should be applied first
		substitutions.push(sub);
		continue;
	}
	return substitutions;
	
	// // base case
	// if (constraints.length < 1)
	// 	return {substitutions:[], checks:[]};

	// var constraint = constraints[0];
	// var remainder = constraints.slice(1);

	// var leftType = constraint.type1;
	// var rightType = constraint.type2;

	// // type structures are equal => constraint satisfied
	// if (constraint.checkStructure()) {

	// 	// if this is a complex structure, there may be sub-constraints to solve
	// 	var newConstraints = constraint.getSubConstraints();
	// 	return solveConstraints(remainder.concat(newConstraints));
	// }


	// // constraints involving dynamic types are trivially satisfied
	// // if the leftType (write) type is dynamic, we always allow
	// // TODO: left != write nowadays...
	// if (leftType.isDynamic)
	// 	return solveConstraints(remainder);

	// // if the rightType (read) type is dynamic, we allow but must typecheck
	// // TODO: object types don't get type-checks, they should get guarded
	// if (rightType.isDynamic && rightType !== "object") {
	// 	var solution1 = solveConstraints(remainder);
	// 	solution1.checks.push({node:constraint.checkNode, type:leftType});
	// 	return solution1;
	// }


	// // if one type is not concrete, it can be substituted by the other
	// var sub;
	// if (!leftType.isConcrete) {
	// 	sub = new Classes.Substitution(leftType, rightType);
	// } else if (!rightType.isConcrete) {
	// 	sub = new Classes.Substitution(rightType, leftType);

	// } // both are different concrete types
	// else {
	// 	// Last opportunity for redemption - if this is a LEqConstraint we can add members to the smaller type
	// 	if (constraint instanceof Classes.LEqConstraint) {
	// 		var newleqConstraints = constraint.satisfy();
	// 		if (newleqConstraints.length > 0) {
	// 			return solveConstraints(remainder.concat(newleqConstraints));
	// 		}
	// 	}
	// 	throw new Error(" Failed Unification: " + leftType.toString() + " != " + rightType.toString());
	// }

	// // apply the substitution to the remaining constraints
	// for (var i = 0; i < remainder.length; i++) {
	// 	sub.apply(remainder[i]);
	// }

	// // it's quite important that substitutions are applied in the right order
	// // here first item should be applied first
	// var solution = solveConstraints(remainder);
	// solution.substitutions = [sub].concat(solution.substitutions);
	// return solution;
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
	Classes.Type.id = 1;

	// generate a judgement for (each annotated section of) the entire tree
	// it's checkUntyped because, at the time of calling, we're not in the typed world yet
	var chunks = ast.checkUntyped();

	// check the judgement is valid and do gradual typing for each chunk
	for (var i = 0; i< chunks.length; i++) {

		// solve the generated constraints, or throw an error if this isn't possible
		var substitutions = solveConstraints(chunks[i].C, chunks[i].gamma);


		// apply the solution substitutions to the type environment
		for (var j=0; j<substitutions.length; j++) {

			chunks[i].gamma.applySubstitution(substitutions[j]);

			for (var k = 0; k<chunks[i].W.length; k++) {
				chunks[i].W[k].applySubstitution(substitutions[j]);
			}
		}

		// Prepare a helpful message for each typed chunk
		var annotate = function(node) {
			if (node instanceof UglifyJS.AST_Scope) {
				if (node.gamma !== undefined) {
					for (var j=0; j<substitutions.length; j++) {
						node.gamma.applySubstitution(substitutions[j]);
					}
					var typeComment = "\n\tjstyper types: \n" + node.gamma.toString(2);
					if (node.body.length > 0) {
						node.body[0].start.comments_before.push(
							new UglifyJS.AST_Token({
								type: 'comment2',
								value: typeComment
							})
						);
					}
				}
			}
		};
		var walker = new UglifyJS.TreeWalker(annotate);
		ast.walk(walker);
		function getWrapper(wrappers) {
			return function(node) {
				var wrapper;
				for (var j=0; j<wrappers.length; j++) {
					if (node === wrappers[j].parent) {
						wrapper = wrappers[j];
						break;
					}
				}
				if (wrapper === undefined) return;

				// node is the parent of something which needs wrapping
				// TODO: assign parents correctly within here
				var mimic = new UglifyJS.AST_Call({
					expression: new UglifyJS.AST_Symbol({
						name: 'mimic'
					}),
					args: [
						wrapper.type.toAST(),
						wrapper.expression
					]
				});
				node.insertBefore(mimic, wrapper.expression, true);
			};
		}
		walker = new UglifyJS.TreeWalker(getWrapper(chunks[i].W));
		ast.walk(walker);


		// TODO: append a notice indicating the end of the typed section (not easy without a trailing comments property!)
		
		// for (var l = 0; l<solution.checks.length; l++) {
		// 	// insert the checks as appropriate
		// 	// unfortunately we're replacing nodes as we go, so we'll also need to substitute nodes as we go along
		// 	var typeChecks = solution.checks[l].node.getTypeChecks( solution.checks[l].type );
		// 	if (typeChecks) {
		// 		for (var p = 0; p < typeChecks.length; p++) {
		// 			var subs = solution.checks[l].node.parent().insertBefore(typeChecks[p], solution.checks[l].node);
		// 			for (var m = 0; m<subs.length; m++) {
		// 				for (var n=l; n<solution.checks.length; n++) {
		// 					if (solution.checks[n].node === subs[m].from) {
		// 						solution.checks[n].node = subs[m].to;
		// 					}
		// 				}
		// 			}
					
		// 		}
		// 	}
		// }
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