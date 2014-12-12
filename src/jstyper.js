/*jshint unused:true, bitwise:true, eqeqeq:true, undef:true, latedef:true, eqnull:true */
/* global require, module, console */

/* this module is the central point for type-checking provided
	code, and for generating gradual-typing-compiled source code */


// for constructing and deconstructing the AST respectively
var acorn = require("acorn");
var escodegen = require("escodegen");

// for our jstyper objects
var Classes = require("./classes.js");
var Judgements = require("./judgements.js");
var TypeAssertions = require("./assertions.js");

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
		return {subs: [], assertions: []};

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
		// TODO: this only works if the left is concrete 
		var solution = solveConstraints(remainder);
		// TODO: referring to a statement number within the body seems hacky
		/* 
			worse, this won't work for a program like the following
			// jstyper start import z
			var x = 5;
			// typecheck z as a number will be inserted here
			var y = z = true, x = z;
			// jstyper end
		*/
		solution.assertions.push({
			location: constraints[0].statementNum,
			assertion: TypeAssertions.getExpression(constraints[0].rightNode, left)
		});
		return solution;
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

	// solve the remainder, then join with the previous result
	var solution = solveConstraints(remainder);
	// it's quite important that substitutions are applied in the right order
	// here first item should be applied first
	solution.subs = [sub].concat(solution.subs);
	return solution;
}

function get_ast(src) {
	var comments = [],
		tokens = [];

	var ast = acorn.parse(src, {
		// collect ranges for each node
		ranges: true,
		// collect comments in Esprima's format
		onComment: comments,
		// collect token ranges
		onToken: tokens,
		locations: true
	});

	// attach comments using collected information
	escodegen.attachComments(ast, comments, tokens);
	return ast;
}

module.exports = function(src) {

	// obtain AST
	var ast;
	try {
		ast = get_ast(src);
	} catch (e) {
		e.message = "Parse Error: " + e.message;
		throw e;
	}

	// generate a judgement for (each annotated section of) the entire tree
	var chunks = Judgements.checkProgram(ast);

	// check the judgement is valid and do gradual typing for each chunk
	for (var i = 0; i< chunks.length; i++) {

		// solve the generated constraints, or throw an error if this isn't possible
		var solution = solveConstraints(chunks[i].C);
		var substitutions = solution.subs;
		var assertions = solution.assertions;

		// apply the solution substitutions to the type environment
		for (var j=0; j<substitutions.length; j++) {
			chunks[i].gamma.applySubstitution(substitutions[j]);
		}

		// Prepare a helpful message for each typed chunk
		var typeComment = " jstyper types: ";
		var sep = "";
		for (var k = 0; k < chunks[i].gamma.length; k++) {
			var location = (chunks[i].gamma[k].node === null)?"imported":
				"l%s c%s".format(
					chunks[i].gamma[k].node.loc.start.line,
					chunks[i].gamma[k].node.loc.start.column);

			typeComment += sep;
			typeComment += "%s (%s): %s".format(
				chunks[i].gamma[k].name,
				location,
				chunks[i].gamma[k].type.type);
			sep = "; ";
		}

		// prepend the types in a comment at the start of the chunk
		if (typeof chunks[i].nodes[0].leadingComments === "undefined")
			chunks[i].nodes[0].leadingComments = [];
		chunks[i].nodes[0].leadingComments.push({
			"type": "Line",
			"value": typeComment
		});

		// append a notice indicating the end of the typed section
		if (chunks[i].nodes[chunks[i].nodes.length - 1].trailingComments === undefined)
			chunks[i].nodes[chunks[i].nodes.length - 1].trailingComments = [];
		chunks[i].nodes[chunks[i].nodes.length - 1].trailingComments.push({
			"type": "Line",
			"value": " end jstyper typed region "
		});


		// finally insert checks before the necessary statements
		// loop backwards to avoid invalidating location numbers
		// TODO: if you haven't got the memo yet, this is broken: see line 50
		for (var l = ast.body.length - 1; l>=0; l--) {
			for (var m = 0; m<assertions.length; m++) {
				if (assertions[m].location === l) {
					// I'm using function.apply to avoid unpacking assertions
					var args = [l, 0].concat(assertions[m].assertion);
					ast.body.splice.apply(ast.body, args);
				}
			}
		}
	}

	var checkRes = chunks;
	var outSrc = escodegen.generate(ast, {
		comment: true
	});

	return {
		src: outSrc,
		check: checkRes
	};
};