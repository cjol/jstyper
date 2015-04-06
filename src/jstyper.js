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
var solveConstraints = require("./solveConstraints");
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
	Classes.Type.resetStore();

	// generate a judgement for (each annotated section of) the entire tree
	// it's checkUntyped because, at the time of calling, we're not in the typed world yet
	var chunks = ast.checkUntyped();
	// ast.figure_out_scope();
	var types = {};

	// check the judgement is valid and do gradual typing for each chunk
	for (var i = 0; i < chunks.length; i++) {

		// solve the generated constraints, or throw an error if this isn't possible
		var result = solveConstraints(chunks[i].C);
		var substitutions = result.substitutions;

		// apply the solution substitutions to the type environment
		for (var j = 0; j < substitutions.length; j++) {

			chunks[i].gamma.applySubstitution(substitutions[j]);

			for (var k = 0; k < chunks[i].W.length; k++) {
				chunks[i].W[k].applySubstitution(substitutions[j]);
			}
		}

		var attachSubtypes = function(tee, k, sourceId, donotrecurse) {

			if (donotrecurse.indexOf(sourceId) >= 0) {
				tee[k] = {
					"type": "recursive"
				};
				return;
			}
			var source = Classes.Type.store[sourceId];
			var key;
			if (source instanceof Classes.ObjectType) {
				tee[k] = {
					type: "object",
					memberTypes: {}
				};

				// attach original object members first, then these will be
				// overwritten by the direct object. No conflict because an
				// OptionalConstraint will have already shown that
				// 		origObj[member] <= source[member]
				if (source.originalObj !== null) {
					// var originalObject = Classes.Type.store[source.originalObj];
					// for (key in originalObject.memberTypes) {
					// 	attachSubtypes(tee[k].memberTypes, key, originalObject.memberTypes[key], donotrecurse.concat([sourceId]));
					// }
					attachSubtypes(tee, k, source.originalObj, donotrecurse.concat([sourceId]));
				}
				for (key in source.memberTypes) {
					attachSubtypes(tee[k].memberTypes, key, source.memberTypes[key], donotrecurse.concat([sourceId]));
				}
			} else if (source instanceof Classes.FunctionType) {
				tee[k] = {
					type: "function",
					argTypes: []
				};
				for (key = 0; key < source.argTypes.length; key++) {
					attachSubtypes(tee[k].argTypes, key, source.argTypes[key], donotrecurse.concat([sourceId]));
				}
				attachSubtypes(tee[k], "returnType", source.returnType, donotrecurse.concat([sourceId]));
			} else if (source instanceof Classes.ArrayType) {
				tee[k] = {
					type: "array",
				};
				attachSubtypes(tee[k], "innerType", source.innerType, donotrecurse.concat([sourceId]));
			} else if (source instanceof Classes.PrimitiveType) {
				tee[k] = source.type;
			} else if (source instanceof Classes.AbstractType) {
				tee[k] = "abstract";
			}
		};

		var currentStatementNode = ast.start;
		var typeSymbols = function(node) {
			if (node instanceof UglifyJS.AST_Statement) {
				currentStatementNode = node.start;
			}
			if (node instanceof UglifyJS.AST_Symbol) {
				if (node.tee !== undefined) {
					if (types[node.start.line] === undefined)
						types[node.start.line] = {};

					attachSubtypes(types[node.start.line], node.start.col, node.tee.type, []);
					if (typeof types[node.start.line][node.start.col] === "object") {
						types[node.start.line][node.start.col].name = node.name;
						if (Classes.Type.store[node.tee.type].shouldInfer)
							types[node.start.line][node.start.col].shouldInfer = true;
					}

					// add a comment
					if (currentStatementNode.comments_before === undefined) 
						currentStatementNode.comments_before = [];
					currentStatementNode.comments_before.push(
						new UglifyJS.AST_Token({
							type:"comment1",
							nlb: true,
							value: " " + node.name + ": " + Classes.Type.store[node.tee.type]
						})
					);
				}
			}
		};
		var walker = new UglifyJS.TreeWalker(typeSymbols);
		ast.walk(walker);


		function getWrapper(wrappers) {
			return function(node) {
				var wrapper;
				for (var j = 0; j < wrappers.length; j++) {
					if (node === wrappers[j].parent) {
						wrapper = wrappers[j];
						break;
					}
				}
				if (wrapper === undefined) return;

				types[wrapper.expression.start.line][wrapper.expression.start.col] = {
					type: "wrapper"
				};

				attachSubtypes(types[wrapper.expression.start.line][wrapper.expression.start.col], "innerType", wrapper.type, []);

				var mimic;
				if (node instanceof UglifyJS.AST_Unary) {
					
					// node is the parent of something which needs wrapping
					// TODO: assign parents correctly within here
					mimic = new UglifyJS.AST_Call({
						expression: new UglifyJS.AST_Symbol({
							name: 'mimic'
						}),
						args: [
							Classes.Type.store[wrapper.type].toAST(),
							node
						]
					});
					node.parent().insertBefore(mimic, node, true);
					return;
				} else if (node instanceof UglifyJS.AST_Assign) {
					if (["+=","-=", "/=", "*=", "%="].indexOf(node.operator) >= 0) {
						mimic = new UglifyJS.AST_Assign({
							left: wrapper.expression,
							right: new UglifyJS.AST_Binary({
								left: wrapper.expression,
								right: node.right,
								operator: node.operator[0]
							}),
							operator: "="
						});
						node.parent().insertBefore(mimic, node, true);
						return;
					}
				}
						
				// node is the parent of something which needs wrapping
				// TODO: assign parents correctly within here
				mimic = new UglifyJS.AST_Call({
					expression: new UglifyJS.AST_Symbol({
						name: 'mimic'
					}),
					args: [
						Classes.Type.store[wrapper.type].toAST(),
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

	var stream = UglifyJS.OutputStream({
		beautify: true,
		comments: true,
		width: 60
	});
	ast.print(stream);

	return {
		src: stream.toString(),
		judgements: types
	};
};