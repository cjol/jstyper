/*jshint unused:true, bitwise:true, eqeqeq:true, undef:true, latedef:true, eqnull:true */
/* global require, module, console */

// for constructing and deconstructing the AST respectively
var acorn = require("acorn");
var escodegen = require("escodegen");

// for our jstyper objects
var Classes = require("./classes.js");

var Enum = {
	Type: {
		number: "number",
		boolean: "boolean",
		string: "string",
		undefined: "undefined",
		null: "null"
	}
};

var nextType = 1;
module.exports = function(src) {
	nextType = 1;

	// obtain AST
	var ast;
	try {
		ast = get_ast(src);
	} catch (e) {
		e.message = "Parse Error: " + e.message;
		throw e;
	}

	// generate a judgement for (each annotated section of) the entire tree
	var c = typecheck(ast);

	// 
	for (var i in c) {
		var substitutions = solveConstraints(c[i].C);
		// apply the substitution to the type environment
		// NB first sub should be applied first
		for (var k in substitutions) {
			c[i].gamma.applySubstitution(substitutions[k]);
		}
		// Prepare a helpful message for each typed chunk
		var typeComment = " jstyper types: ";
		var sep = "";
		for (var j = 0; j < c[i].gamma.length; j++) {
			typeComment += sep + c[i].gamma[j].name + " (" + c[i].gamma[j].program_point + "): " + c[i].gamma[j].type.type;
			sep = ", ";
		}

		if (typeof c[i].nodes[0].leadingComments === "undefined") 
			c[i].nodes[0].leadingComments = [];

		c[i].nodes[0].leadingComments.push({
			"type": "Line",
			"value": typeComment
		});
		
		if (c[i].nodes[c[i].nodes.length - 1].trailingComments === undefined)
			c[i].nodes[c[i].nodes.length - 1].trailingComments = [];

		c[i].nodes[c[i].nodes.length - 1].trailingComments.push({
			"type": "Line",
			"value": " end jstyper typed region "
		});

		// Insert type checks if the types are concrete
		// for (j in c[i].assertions) {
		// 	// only insert type checks for non-dynamic assertions
		// 	if (!c[i].assertions[j].type.isDynamic) {
		// 		var node = createTypeAssertion(c[i].assertions[j].variable, c[i].assertions[j].type.type);
		// 		// insertBefore(node, c[i].assertions[j].beforeNode);
		// 	}
		// }

	}
	var checkRes = c;

	return {
		src: get_src(ast),
		check: checkRes
	};
	// return src;
};

function createTypeAssertion(variable, type) {
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

function typecheck(ast) {
	function getAnnotations(comments) {
		var annotations = [];
		
		if (typeof comments === "undefined")
			return annotations;

		var keyword = " jstyper ";
		for (var i = 0; i < comments.length; i++) {
			if (comments[i].value.search(keyword) === 0) {
				var directive = comments[i].value.substr(keyword.length);
				annotations.push(directive);

				// remove the annotation from the AST
				comments.splice(i, 1);
			}
		}
		return annotations;
	}

	function checkProgram(node) {

		// we will only store judgements for the typed sections of program
		var judgements = [];

		// I only consider this level when looking for annotations (is this limiting?)
		var directives = getAnnotations(node.leadingComments);
		var currentlyTyping = false;

		for (var i = 0; i < node.body.length; i++) {
			// get any new directives for this statement
			directives = directives.concat(getAnnotations(node.body[i].leadingComments));

			for (var j = 0; j < directives.length; j++) {
				if (directives[j].search("start") === 0) {

					if (currentlyTyping)
						throw new Error("Unexpected start directive (already in typed world at program statement " + i + ")");
					currentlyTyping = true;
					var directive = directives[j].substr("start".length);
					// initialise a new judgement with imported variables
					judgements.push(Classes.Judgement.InitFromDirective(directive));

				} else if (directives[j].search("end") === 0) {

					if (!currentlyTyping)
						throw new Error("Unexpected end directive (not in typed world at program statement " + i + ")");
					currentlyTyping = false;


				} else {
					throw new Error("Unexpected directive " + directives[j]);
				}
			}

			if (!currentlyTyping) {
				// TODO: check subexpressions for annotations

			} else {
				var judgement = judgements[judgements.length - 1];
				judgement.nodes.push(node.body[i]);

				// carry the new judgement into the next statement
				var newJudgement = checkStatement(judgement, node.body[i]);
				judgement.gamma = newJudgement.gamma;
				judgement.X = judgement.X.concat(newJudgement.X);
				judgement.C = judgement.C.concat(newJudgement.C);
			}

			// reset directives for the next statement
			directives = getAnnotations(node.body[i].trailingComments);
		}

		return judgements;
	}

	function checkStatement(judgement, node) {
		switch (node.type) {
			case "EmptyStatement":
				return checkEmptyStatement(judgement, node);
			case "ExpressionStatement":
				return checkExpression(judgement, node.expression);
			case "VariableDeclaration":
				// TODO: Check if this is the best way of handling this: VariableDeclaration <: Declaration <: Statement
				return checkVariableDeclaration(judgement, node);
			default:
				if (judgement != null)
					throw new Error("Unhandled statement type " + node.type);
		}
	}

	function checkEmptyStatement(judgement, node) {
		var j = new Classes.Judgement(null, judgement.gamma, [], []);
		j.nodes.push(node);
		return j;
	}

	function checkVariableDeclarator(judgement, node) {
		var X = [],
			C = [];
		// need to select a new type (we are redefining the type from here on)
		var T = judgement.gamma.getFreshType();

		if (node.init) {
			// TODO: the type system defines this in terms of separate var + assignment, which doesn't mirror the AST format.
			// I'm getting round this by constructing an artificial assignment node. Problem?
			var j1 = checkExpression(judgement, node.init);
			if (j1 !== null) {
				X = j1.X.concat([T]);
				C = j1.C.concat([new Classes.Constraint(T, j1.T)]);
			}
		}

		judgement.gamma.push(new Classes.TypeEnvEntry(node.id.name, node.id, T));
		var j = new Classes.Judgement(null, judgement.gamma, X, C);
		j.nodes.push(node);
		return j;
	}

	function checkVariableDeclaration(judgement, node) {

		// VariableDeclaration.declarations is a list of VariableDeclarators
		var X = [],
			C = [];
		for (var i in node.declarations) {
			var j1 = checkVariableDeclarator(judgement, node.declarations[i]);

			// Pass on judgement to subsequent declarators
			// TODO: assert X1 n X2 is empty
			X = X.concat(j1.X);
			C = C.concat(j1.C);
			judgement.gamma = j1.gamma;
		}

		var j = new Classes.Judgement(null, judgement.gamma, X, C);
		j.nodes.push(node);
		return j;
	}

	/***********************************************************************************
	 * below we are not only checking typability, but also creating type judgements
	 ***********************************************************************************/

	function checkExpression(judgement, node) {
		switch (node.type) {
			case ("AssignmentExpression"):
				return checkAssignmentExpression(judgement, node);
			case ("Identifier"):
				return checkIdentifier(judgement, node);
			case ("Literal"):
				return checkLiteral(judgement, node);
			default:
				throw new Error("Unhandled Expression type " + node.type);
		}
	}

	function checkIdentifier(judgement, node) {
		var T, X = [],
			C = [],
			gamma = judgement.gamma;

		T = gamma.get(node.name);

		if (T === null) {
			// need to select a new type
			T = gamma.getFreshType();
			X.push(T);
			gamma.push(new Classes.TypeEnvEntry(node.name, node.loc.start, T));
		}

		var j = new Classes.Judgement(T, gamma, X, C);
		j.nodes.push(node);
		return j;
	}

	function checkAssignmentExpression(judgement, node) {
		switch (node.operator) {
			case ("="):
				// node.right.parent = node;
				// node.left.parent = node;
				var j2 = checkExpression(judgement, node.right);
				var j1 = checkIdentifier(judgement, node.left);
				var X = j1.X.concat(j2.X);
				var C = j1.C.concat(j2.C.concat([new Classes.Constraint(j1.T, j2.T)]));
				var j = new Classes.Judgement(j2.T, judgement.gamma, X, C);
				j.nodes.push(node);
				return j;
			default:
				throw new Error("Unhandled assignment operator " + node.operator);
		}
	}


	function checkLiteral(judgement, node) {
		var type;
		switch (typeof(node.value)) {
			case "number":
				type = Enum.Type.number;
				break;
			case "boolean":
				type = Enum.Type.boolean;
				break;
			case "string":
				type = Enum.Type.string;
				break;
			case "undefined":
				type = Enum.Type.undefined;
				break;
			case "null":
				type = Enum.Type.null;
				break;
			default:
				throw new Error("Unhandled literal type " + typeof(node.value) + " (value = " + node.value + ")");
		}

		var T = new Classes.Type(type, {
			concrete: true
		});
		var j = new Classes.Judgement(T, judgement.gamma, [], []);
		j.nodes.push(node);
		return j;
	}

	// actually do the type checking, now we have defined all checkers
	// root node is a Program node
	return checkProgram(ast);
	// return chunkJudgements;
}

// Use Acorn + Escodegen
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

function get_src(ast) {
	return escodegen.generate(ast, {
		comment: true

	});
}