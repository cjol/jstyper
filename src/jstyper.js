/*jshint unused:true, bitwise:true, eqeqeq:true, undef:true, latedef:true, eqnull:true */
/* global require, module, console */
// var UglifyJS = require("uglify-js2");
var acorn = require("acorn");
// var acornwalker = require("./node_modules/acorn/util/walk.js")
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
	// pre-process source 
	// read all jstyper annotations
	var jstyperComments = /(?:\/\*\s*jstyper\s+((?:[^*]|[\r\n]|(?:\*+(?:[^*\/]|[\r\n])))*)\*+\/)|(?:\/\/\s*jstyper\s+(.*))/g;
	var annotations = [];
	var match;
	var i;
	while (match = jstyperComments.exec(src)) {
		annotations.push({
			content: match[1] || match[2],
			startIndex: match.index,
			endIndex: match.index + match[0].length
		});
	}
	var srcChunks = [];
	var prevIndex = 0;
	var nestingLevel = 0;
	for (i = 0; i < annotations.length; i++) {
		if (annotations[i].content.match(/^start\s*/)) {
			if (nestingLevel > 0) {
				// we are already in a section to be typed, so no need to add the next chunk separately
			} else {
				// we were previously in an untyped section, so add the current chunk
				srcChunks.push(src.substring(prevIndex, annotations[i].startIndex));
				prevIndex = annotations[i].endIndex;
			}
			nestingLevel ++;
		}
		if (annotations[i].content.match(/^end\s.*/)) {
			nestingLevel--;
			if (nestingLevel > 0) {
				// we only want to end a chunk when we reach the top nesting level
			} else if (nestingLevel<0) {
				// we have an unmatched number of starts and ends)
				throw new Error("Unexpected end jstyper annotation");
			} else {
				// we are about to leave a typed region, so add the current chunk
				srcChunks.push(src.substring(prevIndex, annotations[i].startIndex));
				prevIndex = annotations[i].endIndex;
			}
				
		}
	}

	if (nestingLevel > 0) {
		// we have an unmatched number of starts and ends)
		throw new Error("Expected " + nestingLevel + " more end jstyper annotation" + (nestingLevel===1)?"":"s");
	} else  {
		// the end of the file needs accounting for
		srcChunks.push(src.substring(prevIndex, src.length));
	}

	// because typed and untyped chunks are contiguous, we now have chunks to be typed at odd indices
	// console.log(srcChunks);
	var outSrc = "";
	var checkRes = [];
	for (i=0; i<srcChunks.length; i++) {
		if (i%2 === 0) {
			// output as-is
			outSrc += srcChunks[i];
		} else {
			// type then output
			
			// obtain AST
			var ast;
			try {
				ast = get_ast(srcChunks[i]);
			} catch (e) {
				e.message = "Parse Error: " + e.message;
				throw e;
			}
			
			var c = typecheck(ast);

			var substitutions = solveConstraints(c.C);
			// apply the substOitution to the type environment
			for (var j in c.gamma) {
				// NB first sub should be applied first
				for (var k in substitutions) {
					if (c.gamma[j].type.type === substitutions[k].from.type) {
						c.gamma[j].type = substitutions[k].to;
					}
				}
			}

			//TODO: Maybe need to rethink chunking?
			checkRes.push({
				types: c.gamma
			});

			// Gamma needs to be functionally defined environment (not gonna muck things around if we change another one),
			// with some sort of scope. Probably looking after itself, rather than having to choose which scope we want to use.

			ast.body.push(
				{
		            "type": "IfStatement",
		            "test": {
		                "type": "BinaryExpression",
		                "operator": "!==",
		                "left": {
		                    "type": "UnaryExpression",
		                    "operator": "typeof",
		                    "argument": {
		                        "type": "Identifier",
		                        "name": "y"
		                    },
		                    "prefix": true
		                },
		                "right": {
		                    "type": "Literal",
		                    "value": "string",
		                    "raw": "\"string\""
		                }
		            },
		            "consequent": {
		                "type": "BlockStatement",
		                "body": [
		                    {
		                        "type": "ThrowStatement",
		                        "argument": {
		                            "type": "NewExpression",
		                            "callee": {
		                                "type": "Identifier",
		                                "name": "Error"
		                            },
		                            "arguments": [
		                                {
		                                    "type": "Literal",
		                                    "value": "y should be string",
		                                    "raw": "\"y should be string\""
		                                }
		                            ]
		                        }
		                    }
		                ]
		            },
		            "alternate": null
		        }
			}
			);
			var typeComment = " ";
			var sep = "";
			for (var j in c.gamma) {
				typeComment += sep + c.gamma[j].name + " (" + c.gamma[j].program_point + "): " + c.gamma[j].type.type;
				sep = ", ";
			}
			ast.body[0].leadingComments =  [
				{
					"type": "Line",
					"value": typeComment
				}
			];
			console.log(ast);

			// type check
			// var walker = new UglifyJS.TreeWalker(function(node, descend) {
			// 	console.log(node);
			// });
			// ast.walk(walker);
			// modify AST as appropriate
			
			// regenerate src
			try {
				outSrc += "/* jstyper typed */\n";
				outSrc += get_src(ast);
				outSrc += "\n/* jstyper end typed */\n";
			} catch (e) {
				e.message = "Generation error: " + e.message;
				throw e;
			}
			
		}
	}

	// var croppedSrc;
	// var mostRecentAnnotation;
	// for (var i = 0; i < annotations.length; i++) {
	// 	if (annotations[i].content.match(/^start\s*/)) {
	// 		mostRecentAnnotation = mostRecentAnnotation || annotations[i].endIndex;
	// 	}
	// 	if (annotations[i].content.match(/^end\s.*/)) {
	// 		if (mostRecentAnnotation) {
	// 			croppedSrc += src.substr(mostRecentAnnotation, annotations[i].startIndex - mostRecentAnnotation) + "\n";
	// 			mostRecentAnnotation = undefined;
	// 		}

	// 	}
	// }
	// console.log(croppedSrc);
	return {
		src: outSrc,
		check: checkRes
	};
};

function makeSubstitution(from, to) {
	return {
		from: from,
		to: to
	};
}
function solveConstraints(constraints) {
	// Hindley-Milner straight from Pierce p. 327
	if (constraints.length < 1)
		return [];
	var L = constraints[0].left;
	var R = constraints[0].right;
	var C = constraints.slice(1);
	if (L.type === R.type) 
		return solveConstraints(C);
	// TODO: add a case for function types, and ensure to add occurs check below
	var sub;

	if ( !L.isConcrete ) {
		sub = makeSubstitution(L, R);
	} else if ( !R.isConcrete ) {
		sub = makeSubstitution(R, L);
	} else {
		throw new Error(" Failed Unification: " + L.type + " != " + R.type);
	}
	
	// apply this substitution to the remaining constraints
	for (var i = 0; i < C.length; i++) {
		if (C[i].left.type === sub.from.type)
			C[i].left = sub.to;
		if (C[i].right.type === sub.from.type)
			C[i].right = sub.to;
	}

	// it's quite important that substitutions are applied in the right order
	// here first item should be applied first
	return [sub].concat(solveConstraints(C));
	
}
function makeJudgement(type, gamma, defVars, constraints) {
	return {
		T:type,
		gamma: gamma,
		X: defVars,
		C: constraints
	};
}
function makeConstraint(T1, T2) {
	// TODO: I am implicitly assuming all constraints will be equality. Is this the case?
	return {
		left: T1,
		right: T2
	};
}
function makeRef(T) {
	return {
		type: "ref",
		refers: T
	};
}
function makeType(T, conc) {
	return {
		type: T,
		isConcrete: (conc === true)
	};
}
function makeTypeEnvEntry(name, program_point, type) {
	return {
		name: name,
		program_point: program_point,
		type: type
	};
}

function typecheck(ast) {
	function checkProgram(gamma, node) {
		// program node body is a list of statements
		var X=[], C=[];
		for (var i in node.body) {
			var judgements = checkStatement(gamma, node.body[i]);
			// TODO: assert X1 n X2 is empty
			X = X.concat(judgements.X);
			C = C.concat(judgements.C);
			gamma = judgements.gamma;
		}
		return makeJudgement(null, gamma, X, C);
	}
	function checkStatement(gamma, node) {
		switch(node.type) {
			case "EmptyStatement":
				return checkEmptyStatement(gamma, node);
			case "ExpressionStatement":
				return checkExpression(gamma, node.expression);
			case "VariableDeclaration": 
				// TODO: Check if this is the best way of handling this: VariableDeclaration <: Declaration <: Statement
				return checkVariableDeclaration(gamma, node);
			default:
				throw new Error("Unhandled statement type " + node.type);
		}
	}
	function checkEmptyStatement(gamma, node) {
		return makeJudgement(null, gamma, [], []);
	}


	function checkVariableDeclarator(gamma, node) {
		var X = [], C = [];
		// need to select a new type (we are redefining the type from here on)
		var T = makeType("T" + (nextType++));
		if (node.init) {
			// TODO: the type system defines this in terms of separate var + assignment, which doesn't mirror the AST format.
			// I'm getting roung this by constructing an artificial assignment node. Problem?
			var j1 = checkExpression(gamma, node.init);

			X = j1.X.concat([T]);
			C = j1.C.concat([ makeConstraint(j1.T, T) ]);
		} 
		gamma.push(makeTypeEnvEntry(node.id.name, node.start, T));
		return makeJudgement(null, gamma, X, C);

	}

	function checkVariableDeclaration(gamma, node) {
		// VariableDeclaration declarations is a list of variabledeclarators
		var X = [], C = [];
		for (var i in node.declarations) {
			var judgements = checkVariableDeclarator(gamma, node.declarations[i]);
			// TODO: assert X1 n X2 is empty
			X = X.concat(judgements.X);
			C = C.concat(judgements.C);
			gamma = judgements.gamma;
		}
		return makeJudgement(null, gamma, X, C);
	}

	/***********************************************************************************
	 * below we are not only checking typability, but also creating type judgements
	 ***********************************************************************************/

	function checkExpression(gamma, node) {
		switch (node.type) {
			case ("AssignmentExpression"):
				return checkAssignmentExpression(gamma, node);
			case ("Identifier"):
				return  checkIdentifier(gamma, node);
			case ("Literal"):
				return checkLiteral(gamma, node);
			default:
				throw new Error("Unhandled Expression type " + node.type);
		}
	}

	function checkAssignmentExpression(gamma, node) {
		//node.operator .left .right
		if ("=" === node.operator) {
			var j2 = checkExpression(gamma, node.right);
			var j1 = checkIdentifier(gamma, node.left);

			var X = j1.X.concat(j2.X);
			var C = j1.C.concat(j2.C.concat([ makeConstraint(j1.T, j2.T) ]));
			// var C = j1.C.concat(j2.C.concat([ makeConstraint(j1.T, makeRef(j2.T)) ]));
			return makeJudgement(j2.T, gamma, X, C);
		} else {
			throw new Error("Unhandled assignment operator " + node.operator);
		}
	}
	function checkIdentifier(gamma, node) {
		var T, X = [], C = [];

		var foundDef = false;
		// search backwards through gamma to find the most recent defn
		for (var i = gamma.length - 1; i >= 0; i--) {
			if (gamma[i].name === node.name) {
				T = gamma[i].type;
				foundDef = true;
				break;
			}
		}
		if (!foundDef) {
			// need to select a new type
			T = makeType("T" + (nextType++));
			X.push(T);
			gamma.push(makeTypeEnvEntry(node.name, node.start, T));
		}

		return makeJudgement(T, gamma, X, C);
	}
	function checkLiteral(gamma, node) {
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
		return makeJudgement(makeType(type, true), gamma, [], []);
	}

	// actually do the type checking, now we have defined all checkers
	// root node is a Program node
	var j = checkProgram([], ast);
	return {X:j.X,C:j.C,gamma:j.gamma};
}

// Use Acorn + Escodegen
function get_ast(src) {
	var comments = [], tokens = [];

	var ast = acorn.parse(src, {
	    // collect ranges for each node
	    ranges: true,
	    // collect comments in Esprima's format
	    onComment: comments,
	    // collect token ranges
	    onToken: tokens
	});

	// attach comments using collected information
	escodegen.attachComments(ast, comments, tokens);
	return ast;
}

function get_src(ast) {
	return (escodegen.generate(ast, {comment: true}));
}