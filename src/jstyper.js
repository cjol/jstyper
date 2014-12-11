/*jshint unused:true, bitwise:true, eqeqeq:true, undef:true, latedef:true, eqnull:true */
/* global require, module, console */
var acorn = require("acorn");
var escodegen = require("escodegen");
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

	var c = typecheck(ast);
	for (var i in c) {
		var substitutions = solveConstraints(c[i].C);
		// apply the substitution to the type environment
		for (var j in c[i].gamma) {
			// NB first sub should be applied first
			for (var k in substitutions) {
				if (c[i].gamma[j].type.type === substitutions[k].from.type) {
					c[i].gamma[j].type.type = substitutions[k].to.type;
					c[i].gamma[j].type.isConcrete = substitutions[k].to.isConcrete;
					c[i].gamma[j].type.isDynamic = substitutions[k].to.isDynamic;
				}
			}
		}
		// Prepare a helpful message for each typed chunk
		var typeComment = " jstyper types: ";
		var sep = "";
		for (j in c[i].gamma) {
			typeComment += sep + c[i].gamma[j].name + " (" + c[i].gamma[j].program_point.line + "): " + c[i].gamma[j].type.type + (c[i].gamma[j].type.isDynamic?"?":"");
			sep = ", ";
		}

		c[i].startNode.leadingComments.push({
			"type": "Line",
			"value": typeComment
		});

		if (c[i].endNode) {
			if (c[i].fromTrailing) {
				// TODO: workaround to try to get the final comment on a newline
				c[i].endNode.trailingComments.push({
					"type": "Line",
					"value": " end jstyper typed region "
				});
			} else {
				c[i].endNode.leadingComments.push({
					"type": "Line",
					"value": " end jstyper typed region "
				});
			}
		}

		// Insert type checks if the types are concrete
		for (j in c[i].assertions) {
			// only insert type checks for non-dynamic assertions
			if (!c[i].assertions[j].type.isDynamic) {
				var node = createTypeAssertion(c[i].assertions[j].variable, c[i].assertions[j].type.type);
				insertBefore(node, c[i].assertions[j].beforeNode);
			}
		}

	}
	var checkRes = c;

	return {
		src: get_src(ast)//,
		// check: checkRes
	};
	// return src;
};

function makeSubstitution(from, to) {
	return {
		from: {
			type:from.type,
			isConcrete: from.isConcrete,
			isDynamic: from.isDynamic
		},
		to: {
			type:to.type,
			isConcrete: to.isConcrete,
			isDynamic: to.isDynamic
		},
	};
}
function insertBefore(newNode, treeNode) {
	switch (treeNode.parent.type) {
		case "Program":
			var i = treeNode.parent.body.indexOf(treeNode);
			newNode.leadingComments = treeNode.parent.body[i].leadingComments;
			treeNode.parent.body[i].leadingComments = [];
			treeNode.parent.body.splice(i, 0, newNode);
		break;
		default:
			throw new Error("Unhandled parent node type in node insertion");
	}
}
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
	var L = constraints[0].left;
	var R = constraints[0].right;
	var C = constraints.slice(1);
	if (L.type === R.type)
		return solveConstraints(C);

	var sub;

	if (!L.isConcrete) {
		sub = makeSubstitution(L, R);
		// if left is dynamic, ensure result is tagged dynamic
		if (L.isDynamic) {
			sub.to.isDynamic = true;
		}
	} else if (!R.isConcrete) {
		sub = makeSubstitution(R, L);

	} // so both are different concrete types
	else if (L.isDynamic) {
		// if the write type is dynamic, we allow
		return solveConstraints(C);
	} else {
		// if either type is not dynamic, and they're different types, we have an error
		throw new Error(" Failed Unification: " + L.type + " != " + R.type + " at line " + constraints[0].description.start.line + ", character " + constraints[0].description.start.column);
	}

	// apply this substitution to the remaining constraints
	for (var i = 0; i < C.length; i++) {
		if (C[i].left.type === sub.from.type) {
			C[i].left.type = sub.to.type;
			C[i].left.isConcrete = sub.to.isConcrete;
			C[i].left.isDynamic = sub.to.isDynamic;
		}
		if (C[i].right.type === sub.from.type) {
			C[i].right.type = sub.to.type;
			C[i].right.isConcrete = sub.to.isConcrete;
			C[i].right.isDynamic = sub.to.isDynamic;
		}
	}

	// it's quite important that substitutions are applied in the right order
	// here first item should be applied first
	return [sub].concat(solveConstraints(C));

}

function makeJudgement(type, gamma, defVars, constraints, assertions) {
	return {
		T: type,
		gamma: gamma,
		X: defVars,
		C: constraints,
		assertions: assertions || []
	};
}

function makeConstraint(T1, T2, desc) {
	// Note V1 and V2 may well be undefined. They're only defined if it's an identifier being constrained	
	// TODO: I am implicitly assuming all constraints will be equality. Is this the case?
	return {
		left: T1,
		right: T2,
		description: desc ? desc : T1.type + " must be " + T2.type
	};
}

function makeType(T, opt) {
	opt = opt || {};
	return {
		type: T,
		isConcrete: (opt.concrete === true),
		isDynamic: (opt.dynamic === true)
	};
}

function makeTypeEnvEntry(name, program_point, type) {
	return {
		name: name,
		program_point: program_point,
		type: type
	};
}

function getTypeEnvEntry(varName, gamma) {
	// TODO: does this model scope suitably?
	// search backwards through gamma to find the most recent defn
	for (var i = gamma.length - 1; i >= 0; i--) {
		if (gamma[i].name === varName) {
			return gamma[i].type;
		}
	}
	return null;
}

function typecheck(ast) {
	var currentChunk = 0;
	var chunkJudgements = [];
	var chunkStartNode = null;
	var inTypedWorld = false;

	function initTypeJudgement(directive, judgement, startNode) {
		chunkStartNode = startNode;
		directive = directive.substr("start ".length);
		var gamma = [];
		var loc = {
			line: startNode.loc.start.line - 1,
			column: 0
		};
		var assertions = [];
		if (directive.search("import ") === 0) {
			directive = directive.substr("import ".length);

			var imported = directive.split(/,\s*/);

			for (var i in imported) {
				var name = imported[i].trim();
				if (name.length === 0)
					continue;
				var T = makeType("T" + (nextType++), {
					dynamic: true
				});
				var entry = makeTypeEnvEntry(name, loc, T);
				gamma.push(entry);

				assertions.push({
					variable: imported[i],
					type: T,
					beforeNode: startNode
				});
			}
		}
		return makeJudgement(null, gamma, [], [], assertions);
	}

	function endJudgement(judgement, endNode, trailing) {
		// if we have left a newly typed area, save the previous judgement and move on to the next chunk
		chunkJudgements[currentChunk] = judgement;
		chunkJudgements[currentChunk].startNode = chunkStartNode;
		chunkJudgements[currentChunk].endNode = endNode;
		chunkJudgements[currentChunk].fromTrailing = trailing;
		currentChunk += 1;
	}

	function annotationsJudgement(node, judgement, trailing) {
		var preComments = node.leadingComments;
		if (trailing) {
			preComments = node.trailingComments;
		}
		var keyword = " jstyper ";
		if (preComments) {
			for (var j = preComments.length - 1; j >= 0; j--) {
				if (preComments[j].value.search(keyword) === 0) {
					var directive = preComments[j].value.substr(keyword.length);
					if (directive.search("start") === 0) {
						if (inTypedWorld)
							throw new Error("Unexpected jstyper start directive");
						console.log("Entering typed world " + currentChunk);
						// if we have just started a new typed area, we want an appropriately new judgement
						inTypedWorld = true;
						judgement = initTypeJudgement(directive, judgement, node);
						preComments.splice(j, 1);
					} else if (directive.search("end") === 0) {
						if (!inTypedWorld)
							throw new Error("Unexpected jstyper end directive");
						console.log("Leaving typed world " + currentChunk);
						inTypedWorld = false;
						endJudgement(judgement, node, trailing);
						judgement = null;
						preComments.splice(j, 1);
					} else {
						console.log(directive);
					}
				}
			}
		}
		return judgement;
	}

	function checkProgram(node) {
		node.parent = null;
		// program node body is a list of statements
		var judgement = null;
		judgement = annotationsJudgement(node, judgement);

		for (var i in node.body) {
			node.body[i].parent = node;
			if (judgement === null) {
				// if the next statement takes us into the typed world, we should stay there for the statement after that
				judgement = checkStatement(null, node.body[i]);
			} else {
				var j = checkStatement(judgement, node.body[i]);

				if (j !== null) {
					judgement.gamma = j.gamma;
					judgement.X = judgement.X.concat(j.X);
					judgement.C = judgement.C.concat(j.C);
				} else {
					// if the prev statement is null, we're not in the typed world (so don't try to type the next statement)
					judgement = null;
				}
			}
		}
		return judgement;
	}

	function checkStatement(judgement, node) {
		switch (node.type) {
			case "EmptyStatement":
				return checkEmptyStatement(judgement, node);
			case "ExpressionStatement":
				// we only check for annotations when we are splitting the node in further calls (e.g. here we are looking at node.expression)
				judgement = annotationsJudgement(node, judgement);
				node.expression.parent = node;
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
		judgement = annotationsJudgement(node, judgement);
		if (judgement !== null)
			return makeJudgement(null, judgement.gamma, [], [], judgement.assertions);
	}

	function checkVariableDeclarator(judgement, node) {
		judgement = annotationsJudgement(node, judgement);

		var X = [],
			C = [];
		// need to select a new type (we are redefining the type from here on)
		var T = makeType("T" + (nextType++));
		if (node.init) {
			node.init.parent = node;
			if (judgement === null) {
				return checkExpression(null, node.init);
			}

			// TODO: the type system defines this in terms of separate var + assignment, which doesn't mirror the AST format.
			// I'm getting round this by constructing an artificial assignment node. Problem?
			var j1 = checkExpression(judgement, node.init);
			if (j1 !== null) {
				X = j1.X.concat([T]);
				C = j1.C.concat([makeConstraint(T, j1.T, "Type of '" + node.id.name +
					"' at line " + node.id.loc.start.line + ", col " +
					node.id.loc.start.column + " must be " + T.type, node.id.name)]);
			}
		}

		if (judgement === null)
			return null;

		judgement.gamma.push(makeTypeEnvEntry(node.id.name, node.loc.start, T));
		return makeJudgement(null, judgement.gamma, X, C, judgement.assertions);
	}

	function checkVariableDeclaration(judgement, node) {
		judgement = annotationsJudgement(node, judgement);
		// VariableDeclaration declarations is a list of variabledeclarators
		var X = [],
			C = [];
		for (var i in node.declarations) {
			node.declarations[i].parent = node;
			var j1 = checkVariableDeclarator(judgement, node.declarations[i]);
			// TODO: assert X1 n X2 is empty
			if (judgement !== null) {
				X = X.concat(j1.X);
				C = C.concat(j1.C);
				judgement.gamma = j1.gamma;
			}
		}
		if (judgement != null) {
			return makeJudgement(null, judgement.gamma, X, C, judgement.assertions);
		} else {
			// if we're not in the typed world, the constraints generated here are irrelevant
			return null;
		}
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
				if (judgement != null)
					throw new Error("Unhandled Expression type " + node.type);
		}
	}

	function checkIdentifier(judgement, node) {
		judgement = annotationsJudgement(node, judgement);
		if (judgement === null)
			return null;

		var T, X = [],
			C = [],
			gamma = judgement.gamma;

		T = getTypeEnvEntry(node.name, gamma);

		if (T === null) {
			// need to select a new type
			T = makeType("T" + (nextType++));
			X.push(T);
			gamma.push(makeTypeEnvEntry(node.name, node.loc.start, T));
		}

		return makeJudgement(T, gamma, X, C, judgement.assertions);
	}

	function checkLiteral(judgement, node) {
		judgement = annotationsJudgement(node, judgement);
		if (judgement === null)
			return null;

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

		return makeJudgement(makeType(type, {
			concrete: true
		}), judgement.gamma, [], [], judgement.assertions);
	}

	function checkAssignmentExpression(judgement, node) {
		judgement = annotationsJudgement(node, judgement);

		switch (node.operator) {
			case ("="):
				node.right.parent = node;
				node.left.parent = node;
				var j2 = checkExpression(judgement, node.right);
				var j1 = checkIdentifier(judgement, node.left);

				if (judgement !== null && j1 !== null && j2 !== null) {
					var X = j1.X.concat(j2.X);
					// TODO maybe: Should I record the name of the left identifier here?
					var C = j1.C.concat(j2.C.concat([makeConstraint(j1.T, j2.T, node.loc)]));
					return makeJudgement(j2.T, judgement.gamma, X, C, judgement.assertions);
				}
				return null;
			default:
				if (judgement !== null)
					throw new Error("Unhandled assignment operator " + node.operator);
				return null;
		}
	}

	// actually do the type checking, now we have defined all checkers
	// root node is a Program node
	var judgement = checkProgram(ast);
	// implicitly add jstyper end at this point (because if it appears at the end of the program, it won't be a leadingComment)
	annotationsJudgement(ast.body[ast.body.length - 1], judgement, true);
	return chunkJudgements;
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