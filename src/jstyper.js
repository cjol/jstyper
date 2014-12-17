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

	var left = constraints[0].left;
	var right = constraints[0].right;
	var remainder = constraints.slice(1);

	// types are equal => constraint satisfied
	if (left.type === right.type)
		return solveConstraints(remainder);

	var sub;

	// constraints involving dynamic types are trivially satisfied
	// if the left (write) type is dynamic, we always allow
	if (left.isDynamic)
		return solveConstraints(remainder);

	// if the right (read) type is dynamic, we allow but must typecheck
	if (right.isDynamic) {
		var solution1 = solveConstraints(remainder);
		solution1.checks.push({node:constraints[0].rightNode, type:left});
		return solution1;
	}


	// if one type is not concrete, it can be substituted by the other
	if (!left.isConcrete) {
		sub = new Classes.Substitution(left, right);
	} else if (!right.isConcrete) {
		sub = new Classes.Substitution(right, left);

	} // both are different concrete types
	else {
		throw new Error(" Failed Unification: " + left.type + " != " + right.type);
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

	// generate a judgement for (each annotated section of) the entire tree
	var chunks = ast.check();

	// check the judgement is valid and do gradual typing for each chunk
	for (var i = 0; i< chunks.length; i++) {

		// solve the generated constraints, or throw an error if this isn't possible
		var solution = solveConstraints(chunks[i].C);

		// apply the solution substitutions to the type environment
		for (var j=0; j<solution.substitutions.length; j++) {
			chunks[i].gamma.applySubstitution(solution.substitutions[j]);
			for (var k = 0; k<solution.checks.length; k++) {
				solution.checks[k].type.applySubstitution(solution.substitutions[j]);
			}
		}

		for (var l = 0; l<solution.checks.length; l++) {
			// insert the checks as appropriate
			// unfortunately we're replacing nodes as we go, so we'll need to substitute nodes as we go along
			var typeCheck = solution.checks[l].node.getTypeCheck( solution.checks[l].type );
			if (typeCheck) {
				var subs = solution.checks[l].node.parent().insertBefore(typeCheck, solution.checks[l].node);
				for (var m = 0; m<subs.length; m++) {
					for (var n=l; n<solution.checks.length; n++) {
						if (solution.checks[n].node === subs[m].from) {
							solution.checks[n].node = subs[m].to;
						}
					}
				}
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
				chunks[i].gamma[o].type.type);
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
		

		// // finally insert checks before the necessary statements
		// // loop backwards to avoid invalidating location numbers
		// // TODO: if you haven't got the memo yet, this is broken: see line 50
		// for (var l = ast.body.length - 1; l>=0; l--) {
		// 	for (var m = 0; m<assertions.length; m++) {
		// 		if (assertions[m].location === l) {
		// 			// I'm using function.apply to avoid unpacking assertions
		// 			var args = [l, 0].concat(assertions[m].assertion);
		// 			ast.body.splice.apply(ast.body, args);
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