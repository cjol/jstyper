/*jshint unused:true, bitwise:true, eqeqeq:true, undef:true, latedef:true, eqnull:true */
/* global require, module, console */

// for constructing and deconstructing the AST respectively
var acorn = require("acorn");
var escodegen = require("escodegen");

// for our jstyper objects
var Classes = require("./classes.js");
var Judgements = require("./judgements.js");

String.prototype.format = function() {
	var newStr = this,
		i = 0;
	while (/%s/.test(newStr))
		newStr = newStr.replace("%s", arguments[i++]);
	return newStr;
};

function createTypeAssertionNode(variable, type) {
	return {
		"type": "IfStatement",
		"test": {
			"type": "BinaryExpression",
			"operator": "!==",
			"left": {
				"type": "UnaryExpression",
				"operator": "typeof",
				"argument": {
					"type": "Identifier",
					"name": variable
				},
				"prefix": true
			},
			"right": {
				"type": "Literal",
				"value": type
			}
		},
		"consequent": {
			"type": "BlockStatement",
			"body": [{
				"type": "ThrowStatement",
				"argument": {
					"type": "NewExpression",
					"callee": {
						"type": "Identifier",
						"name": "TypeError"
					},
					"arguments": [{
						"type": "Literal",
						"value": variable + " must be " + type + " at this point"
					}]
				}
			}]
		},
		"alternate": null
	};
}

function solveConstraints(constraints) {
	// originally from Pierce p. 327
	if (constraints.length < 1)
		return [];
	var left = constraints[0].left;
	var right = constraints[0].right;
	var remainder = constraints.slice(1);

	// types are equal => constraint satisfied
	if (left.type === right.type)
		return solveConstraints(remainder);

	var sub;

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
	return [sub].concat(solveConstraints(remainder));
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
		var substitutions = solveConstraints(chunks[i].C);

		// apply the solution substitutions to the type environment
		for (var k in substitutions) {
			chunks[i].gamma.applySubstitution(substitutions[k]);
		}

		// Prepare a helpful message for each typed chunk
		var typeComment = " jstyper types: ";
		var sep = "";
		for (var j = 0; j < chunks[i].gamma.length; j++) {
			var location = (chunks[i].gamma[j].program_point === null)?"imported":
				"l%s c%s".format(
					chunks[i].gamma[j].program_point.loc.start.line,
					chunks[i].gamma[j].program_point.loc.start.column);

			typeComment += sep;
			typeComment += "%s (%s): %s".format(
				chunks[i].gamma[j].name,
				location,
				chunks[i].gamma[j].type.type);
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