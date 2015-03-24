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
	for (var i = 0; i< chunks.length; i++) {

		// solve the generated constraints, or throw an error if this isn't possible
		var result = solveConstraints(chunks[i].C);
		var substitutions = result.substitutions;
		// var constraints = result.constraints;
		// // if (constraints.length > 0) {
		// // 	// we have no further opportunities to solve the constraints which is a problem...
		// // 	throw new Error("Couldn't solve all constraints");
		// // }
		// // for (var ci = 0; ci<constraints.length; ci++) {
		// // 	if (  !Classes.Type.store[constraints[ci].type1].isConcrete &&
		// // 		!Classes.Type.store[constraints[ci].type2].isConcrete) {
		// // 		// it's fine to have abstract types at the end
		// // 		continue;
		// // 	}
		// // }

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


		var attachSubtypes = function (tee, k, source) {
			if (source instanceof Classes.ObjectType) {
				tee[k] = {
					type: "object",
					memberTypes: {}
				};
				for (var key in source.memberTypes) {
					attachSubtypes(tee[k].memberTypes, key, Classes.Type.store[source.memberTypes[key]]);
				}
			} else if (source instanceof Classes.PrimitiveType) {
				tee[k] = source.type;
			} else if (source instanceof Classes.AbstractType) {
				tee[k] = "abstract";
			}
		};

		var typeSymbols = function(node) {
			if (node instanceof UglifyJS.AST_Symbol) {
				if (node.tee !== undefined) {
					if (types[node.start.line] === undefined) 
						types[node.start.line] = {};

					attachSubtypes(types[node.start.line], node.start.col, Classes.Type.store[node.tee.type]);
				
				}
			}
		};
		walker = new UglifyJS.TreeWalker(typeSymbols);
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

				types[wrapper.expression.start.line][wrapper.expression.start.col] = {
					type: "wrapper"
				};

				attachSubtypes(types[wrapper.expression.start.line][wrapper.expression.start.col], "innerType",
					Classes.Type.store[wrapper.type]);

				// node is the parent of something which needs wrapping
				// TODO: assign parents correctly within here
				var mimic = new UglifyJS.AST_Call({
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