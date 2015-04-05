/* 	This module generates judgements according to the logic set out in the
	formal specification. Ideally it should be as close to the induction
	rules as possible.
	It also adds the parent() method to all nodes. This method could be a property
	except that it would introduce circular structures and then JSON won't print */

var Classes = require("./classes.js");
var UglifyJS = require("uglify-js2");
var solveConstraints = require("./solveConstraints");

UglifyJS.AST_Node.prototype.check = function() {
	throw new Error("Unhandled node type");
};
UglifyJS.AST_Node.prototype.parent = function() {
	throw new Error("Parent has not been defined yet!");
};

function parent(par) {
	return function() {
		return par;
	};
}

/***********************************************************************************
 * Checking typability, and also creating type judgements
 ***********************************************************************************/

UglifyJS.AST_Constant.prototype.check = function(gamma) {
	throw new Error("Unhandled constant type " + this);
};
UglifyJS.AST_Number.prototype.check = function(gamma) {
	var j = new Classes.Judgement(Classes.Type.numType, [], gamma);
	j.nodes.push(this);
	return j;
};
UglifyJS.AST_Boolean.prototype.check = function(gamma) {
	var j = new Classes.Judgement(Classes.Type.boolType, [], gamma);
	j.nodes.push(this);
	return j;
};
UglifyJS.AST_String.prototype.check = function(gamma) {
	var j = new Classes.Judgement(Classes.Type.stringType, [], gamma);
	j.nodes.push(this);
	return j;
};
UglifyJS.AST_Undefined.prototype.check = function(gamma) {
	var j = new Classes.Judgement(Classes.Type.undefinedType, [], gamma);
	j.nodes.push(this);
	return j;
};
UglifyJS.AST_Null.prototype.check = function(gamma) {
	var j = new Classes.Judgement(Classes.Type.nullType, [], gamma);
	j.nodes.push(this);
	return j;
};

// Rule V_Skip (special case of expression when e is skip)
UglifyJS.AST_EmptyStatement.prototype.check = function(gamma, dynamics) {
	var j = new Classes.Judgement(Classes.Type.undefinedType, [], gamma, []);
	j.nodes.push(this);
	return j;
};

// Rule V_Obj
UglifyJS.AST_Object.prototype.check = function(gamma, dynamics) {

	// An object literal will generate a fresh type which we will bind properties to
	var memberType = {};
	var C = [];
	var W = [];
	// an object's type can be derived as long as each of its members has a valid type
	for (var i = 0; i < this.properties.length; i++) {
		this.properties[i].parent = parent(this);
		this.properties[i].value.parent = parent(this.properties[i]);

		var judgement = this.properties[i].value.check(gamma, dynamics);
		C = C.concat(judgement.C);
		W = W.concat(judgement.W);

		// generate a new Type for this property, which will be constrained by the value type
		var propType = gamma.getFreshType(undefined, {
			detail: 'prop ' + i + 'type of ',
			node: this
		});

		// TODO: Check the direction of this constraint
		C.push(new Classes.Constraint(propType.id, judgement.T.id));
		memberType[this.properties[i].key] = propType.id;
		memberType[this.properties[i].key].node = this.properties[i];

		// thread gamma through to the next property
		gamma = judgement.gamma;
	}

	var T = new Classes.ObjectType({
		memberTypes: memberType
	});

	return new Classes.Judgement(T, C, gamma, W);
};

// Add function definitions names to the type environments
// TODO: Represent this in the spec
// TODO: What if this is dynamic?
UglifyJS.AST_Defun.prototype.check = function(gamma, dynamics) {
	var j = UglifyJS.AST_Lambda.prototype.check.call(this, gamma, dynamics);
	if (this.name !== null && this.name.name !== null && this.name.name.length > 0) {
		var tee = new Classes.TypeEnvEntry(this.name.name, this, j.T.id);
		this.name.tee = tee;
		j.gamma.push(tee);

	}
	return new Classes.Judgement(null, j.C, j.gamma, j.W);
};

// TODO: V_Fun1 / V_Fun2
UglifyJS.AST_Lambda.prototype.check = function(gamma, dynamics) {


	var Ts = [];
	var retType = gamma.getFreshType(undefined, {
		detail: 'return type of fun ',
		node: this
	});

	var funType = new Classes.FunctionType({
		argTypes: [],
		returnType: retType.id
	});
	var argumentTypeEnvEntries = [];

	// generate a fresh type for each of the arguments (including 'this')
	// Also create a new Gamma to check the function body
	var gamma1 = new Classes.TypeEnv(gamma);

	for (var i = 0; i < this.argnames.length + 1; i++) {
		if (i > 0) this.argnames[i - 1].parent = parent(this);

		Ts[i] = gamma.getFreshType(undefined, {
			detail: 'arg' + i + ' type of fun ',
			node: this
		});
		var name = (i === 0) ? 'this' : this.argnames[i - 1].name;

		Ts[i].shouldInfer = true;
		var tee = new Classes.TypeEnvEntry(name, null, Ts[i].id);
		argumentTypeEnvEntries.push(tee);
		funType.argTypes.push(argumentTypeEnvEntries[i].type);
		gamma1.push(tee);
	}

	// add a placeholder type for return
	var placeholderReturn = new Classes.TypeEnvEntry('return', null, Classes.Type.undefinedReturnType.id);
	placeholderReturn.somePathsNoReturn = true;
	gamma1.push(placeholderReturn);

	// V_Fun2
	if (this.name !== undefined && this.name !== null) {
		var funtee = new Classes.TypeEnvEntry(this.name.name, this, funType.id);
		gamma1.push(funtee);
		this.name.tee = funtee;
	}

	// gamma1 contains funType (and this is necessary for recursion to work)
	// so we needed to initialise funType with abstract parameter types
	// BUT
	// the substitutions to funType's argument types (contained here in argumentTypeEnvEntries)
	// will not be reflected here (they're only made within gamma1).
	// So we'll need to overwrite funType's argument types after we type the body
	// type the body using the new gamma (treat it as a block statement)
	var j1 = UglifyJS.AST_Block.prototype.check.call(this, gamma1, dynamics);
	funType.argTypes = [];
	for (i = 0; i < argumentTypeEnvEntries.length; i++) {
		funType.argTypes.push(argumentTypeEnvEntries[i].type);
	}



	var C;
	var W = j1.W;
	var finalReturn = j1.gamma.getTypeEnvEntry('return');
	if (finalReturn.somePathsNoReturn) {
		if (finalReturn.type === Classes.Type.undefinedReturnType.id) {
			// some paths don't return, but there were never any returns anyway
			C = j1.C.concat(new Classes.Constraint(Classes.Type.undefinedType.id, retType.id));
		} else {
			// some paths don't return, but there was at least one return somewhere
			throw new Error("At least one function path does not return");
		}
	} else {
		// all paths return, and I trust they are coherent
		C = j1.C.concat(new Classes.Constraint(finalReturn.type, retType.id));
	}
	// if (finalReturn === Classes.Type.undefinedReturnType) {
	// 	// there are no return statements in the block (I know this because the placeholder val came back)
	// 	C = j1.C.concat(new Classes.Constraint(Classes.Type.undefinedType.id, retType.id));
	// } else {
	// 	// TODO: potentially don't want this to be null...
	// 	C = j1.C.concat(new Classes.Constraint(finalReturn.id, retType.id));
	// }

	// return the original gamma
	var j = new Classes.Judgement(funType, C, gamma, W);
	j.nodes.push(this);
	return j;
};

// Rule IdType / IdTypeUndef
UglifyJS.AST_Symbol.prototype.check = function(gamma, dynamics, doNotWrap) {
	var T, W = [];
	var dynamic = false;
	if (dynamics.indexOf(this.name) >= 0) {
		// this is a dynamic variable, so we will be wrapping with a mimic
		dynamic = true;
	}

	T = gamma.get(this.name);
	if (T === null || T === undefined) {
		// need to select a new type, but create a new env for it
		T = gamma.getFreshType(undefined, {
			detail: 'symbol type for ' + this.name,
			node: this
		});
		gamma = new Classes.TypeEnv(gamma);

		if (!dynamic) {
			var tee = new Classes.TypeEnvEntry(this.name, this, T.id);
			this.tee = tee;
			gamma.push(tee);
		}
	} else {
		// we already have a type env entry for this type
		this.tee = gamma.getTypeEnvEntry(this.name);
	}

	if (dynamic) {
		if (doNotWrap) {
			// this was an assignment to a dynamic var

			this.tee = new Classes.TypeEnvEntry(this.name, this, (new Classes.AbstractType()).id);
		} else {
			this.tee = {
				type: "wrapped" // will be replaced once the wrapper is generated
			};
			W.push(new Classes.Wrapper(this, this.parent(), T.id));
		}
	}

	var j = new Classes.Judgement(T, [], gamma, W);
	j.nodes.push(this);
	return j;
};

// Rule PropType
// NB This is not called for assigning to a dotexpression. (see AssignType for that)
UglifyJS.AST_Dot.prototype.check = function(gamma, dynamics) {
	this.expression.parent = parent(this);
	this.property.parent = parent(this);

	// get the type of the containing object
	var j1 = this.expression.check(gamma, dynamics);
	var C = j1.C;
	var W = j1.W;

	var T = gamma.getFreshType(undefined, {
		detail: 'required property type for obj.' + this.property,
		node: this
	});

	// add a new constraint stating the containing object much have this as a property
	var memberType = {};
	memberType[this.property] = T.id;

	var containerType = new Classes.ObjectType({
		memberTypes: memberType
	});

	// using LEqCheck rejects access to undefined members
	// using LEq infers the required members for an object
	if (j1.T.shouldInfer === true) {
		C.push(new Classes.LEqConstraint(containerType.id, j1.T.id));
		T.shouldInfer = true;
	} else {
		var nc = new Classes.LEqCheckConstraint(containerType.id, j1.T.id);
		nc.interesting = true;
		C.push(nc);
	}

	var judgement = new Classes.Judgement(T, C, j1.gamma, W);
	judgement.nodes.push(this);
	return judgement;
};

UglifyJS.AST_Call.prototype.check = function(gamma, dynamics) {
	this.expression.parent = parent(this);

	// Type-check function expression
	var j0 = this.expression.check(gamma, dynamics);
	var C = j0.C;
	var W = j0.W;

	// prepare new constraints
	var argTypes = [gamma.getFreshType(undefined, {
		detail: 'inferred \'this\' type of call ',
		node: this
	}).id];
	if (this.expression instanceof UglifyJS.AST_Dot) {
		// this is an instance call
		// PropCallType

		// annoyingly we have to check e and e.l separately (this is probably avoidable)
		// I don't care about je.C or je.gamma - they will come through when we check this.expression (j0)
		var je = this.expression.expression.check(gamma, dynamics);

		C.push(new Classes.LEqCheckConstraint(argTypes[0], je.T.id));
	} else {
		// normal function call (no this)
		C.push(new Classes.Constraint(argTypes[0], Classes.Type.undefinedType.id));
	}
	gamma = j0.gamma;

	// typecheck each parameter
	for (var i = 0; i < this.args.length; i++) {
		this.args[i].parent = parent(this);

		var ji = this.args[i].check(gamma, dynamics);
		C = C.concat(ji.C);
		W = W.concat(ji.W);

		var T = gamma.getFreshType(undefined, {
			detail: 'inferred arg' + i + ' type of call',
			node: this
		});
		argTypes.push(T.id);

		C.push(new Classes.LEqCheckConstraint(T.id, ji.T.id));

		gamma = ji.gamma;
	}

	var funcType = new Classes.FunctionType({
		argTypes: argTypes,
		returnType: gamma.getFreshType(undefined, {
			detail: 'inferred return type of call',
			node: this
		}).id
	});
	C.push(new Classes.Constraint(j0.T.id, funcType.id));

	var useType = gamma.getFreshType(undefined, {
		detail: 'use type of call',
		node: this
	});
	C.push(new Classes.LEqCheckConstraint(useType.id, funcType.returnType));

	var judgement = new Classes.Judgement(useType, C, gamma, W);
	judgement.nodes.push(this);
	return judgement;
};

// Rule AssignType / PropAssignType / NumAssignType / PropNumAssignType
UglifyJS.AST_Assign.prototype.check = function(gamma, dynamics) {

	// if we are writing to a dynamic type, then do not generate the constraint
	var dynamicWrite = false;
	if (this.left instanceof UglifyJS.AST_Symbol) {
		if (dynamics.indexOf(this.left.name) >= 0) {
			// this is an assignment to a variable declared dynamic
			dynamicWrite = true;
		}
	}

	this.right.parent = parent(this);
	this.left.parent = parent(this);
	var j1 = this.right.check(gamma, dynamics);
	var C = j1.C;
	var W = j1.W;

	// if this is an assignment to a dynamic variable, we shouldn't wrap with a mimic
	var returnType, j, j2;
	switch (this.operator) {
		case ("="):

			if (this.left instanceof UglifyJS.AST_Symbol) {
				// AssignType (must be a straight variable)

				j2 = this.left.check(j1.gamma, dynamics, dynamicWrite);

				C = C.concat(j2.C);
				W = W.concat(j2.W);

				// important justification of LEqCheck v. LEq in WWT pad, bottom of page 1.
				if (!dynamicWrite) C.push(new Classes.LEqCheckConstraint(j2.T.id, j1.T.id));
				
				// update gamma
				// TODO: Update formal spec to show this
				j2.gamma.push(
					new Classes.TypeEnvEntry(
						this.left.name,
						this,
						j1.T.id
					)
				);

				returnType = j1.T;
				break;
			} else if (this.left instanceof UglifyJS.AST_Dot) {
				// PropAssignType

				// T is initially a placeholder for the type of a.b.c - it will be constrained against T_e
				var T = gamma.getFreshType();

				// (important justification of LEqCheck v. LEq in WWT pad, bottom of page 1.)
				C = C.concat([new Classes.LEqCheckConstraint(T.id, j1.T.id)]);

				// T is initially a placeholder type for a.b (i.e. its only member is T3 above)
				// We will travel up the dot string, reassigning T until we get to the root (i.e. a)
				var expNode = this.left;
				var path = [];

				// create a minimal type definition for the object and its new property
				// JSTyper assumes everything until the symbol is a dot expression
				while (expNode instanceof UglifyJS.AST_Dot) {
					if (expNode !== this.left)
						path.unshift(expNode.property);

					var memberTypes = {};
					memberTypes[expNode.property] = T.id;
					T = new Classes.ObjectType({
						memberTypes: memberTypes
					});
					expNode = expNode.expression;
				}

				// T is now the placeholder (minimal) type of the leftmost symbol (i.e. a)
				// expNode is now the leftmost expression - and for JSTyper,
				// must be an AST_Symbol
				if (!expNode instanceof UglifyJS.AST_Symbol) {
					throw new Error("JSTyper only supports assignment to straight dot chains");
				}

				// obtain the original base type, so we can attach originalObjs to our defn
				j2 = expNode.check(j1.gamma, dynamics);
				var expType = j2.T;
				W = W.concat(j2.W);

				function attachOriginalObjs(baseType, newType, path) {
					newType.originalObj = baseType.id;
					if (baseType.shouldInfer) {
						newType.shouldInfer = true;
					}

					if (path.length < 1) {
						C.push(new Classes.OptionalConstraint(baseType.id, newType.id));
						return;
					}
					var nextBase;
					if (baseType.memberTypes !== undefined && path[0] in baseType.memberTypes) {
						nextBase = Classes.Type.store[baseType.memberTypes[path[0]]];

					} else {
						// baseType hasn't been identified as an object yet
						// make a constraint with a fresh obj and we'll use that
						nextBase = new Classes.ObjectType({
							memberTypes: {}
						});
						nextBase.memberTypes[path[0]] = gamma.getFreshType().id;
						C.push(new Classes.Constraint(nextBase.id, baseType.id));
						nextBase = Classes.Type.store[nextBase.memberTypes[path[0]]];
					}
					attachOriginalObjs(
						nextBase,
						Classes.Type.store[newType.memberTypes[path[0]]],
						path.slice(1)
					);
				}
				attachOriginalObjs(expType, T, path);

				// make sure there are no conflicting members between these types
				// C.push(new Classes.OptionalConstraint(expType.id, T.id));


				j2.gamma = new Classes.TypeEnv(j2.gamma);
				j2.gamma.push(new Classes.TypeEnvEntry(expNode.name, this, T.id));

				// var constraint = new Classes.LEqConstraint(T.id, objType.id);
				// C.push(constraint);

			} else {
				throw new Error("Unexpected assignment target");
			}
			break;
		case ("+="):
		case ("-="):
		case ("*="):
		case ("/="):
		case ("%="):
			// these operators have the added constraint that both left and right must be numbers
			// since we're about to say the two types are equal, can just say left must be number

			if (!(this.left instanceof UglifyJS.AST_Dot)) {
				C.push(new Classes.Constraint(Classes.Type.numType.id, j1.T.id));
				C.push(new Classes.Constraint(Classes.Type.numType.id, j2.T.id));
				returnType = j1.T;
			} else {
				// PropNumAssignType

				j2 = this.left.expression.check(j1.gamma, dynamics);

				var memberTypeNum = {};
				memberTypeNum[this.left.property] = Classes.Type.numType.id;

				var numT = new Classes.ObjectType({
					memberTypes: memberTypeNum
				});

				C = j1.C.concat(j2.C);
				W = j1.W.concat(j2.W);
				var constraintNum = new Classes.LEqConstraint(numT.id, j2.T.id);
				C.push(constraintNum);
				C.push(new Classes.Constraint(Classes.Type.numType.id, j1.T.id));
			}
			break;
		default:
			throw new Error("Unhandled assignment operator " + this.operator);
	}
	j = new Classes.Judgement(returnType, C, j2.gamma, W);
	j.nodes.push(this);

	return j;
};

// Rule NumOpType / BoolOpType / CmpOpType / NumCmpOpType
UglifyJS.AST_Binary.prototype.check = function(gamma, dynamics) {
	this.left.parent = parent(this);
	this.right.parent = parent(this);

	var j1 = this.left.check(gamma, dynamics);
	var j2 = this.right.check(j1.gamma, dynamics);
	var C, returnType, W;
	W = j1.W.concat(j2.W);

	// NB both expressions are being READ so they must be second parameter to constraint 
	// (this is important in case they're dynamic)
	switch (this.operator) {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators
		// NumOpType
		case ("+"): // TODO?: allow string
		case ("-"):
		case ("*"):
		case ("/"):
		case ("%"):
			// TODO: Check order of constraint
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(Classes.Type.numType.id, j1.T.id),
				new Classes.Constraint(Classes.Type.numType.id, j2.T.id)
			]));
			returnType = Classes.Type.numType;
			break;
			// boolean operators (should both be boolean)
		case ("||"):
		case ("&&"):
			// TODO: Check order of constraint
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(Classes.Type.boolType.id, j1.T.id),
				new Classes.Constraint(Classes.Type.boolType.id, j2.T.id)
			]));
			returnType = Classes.Type.boolType;
			break;

			// misc comparison (should both be equal of any type)
		case ("=="):
		case ("!="):
		case ("==="):
		case ("!=="):
			// TODO: Check order of constraint
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(j2.T.id, j1.T.id),
				new Classes.Constraint(j1.T.id, j2.T.id)
			]));
			returnType = Classes.Type.boolType;
			break;

			// numeric comparison (should both be number)
		case ("<"):
		case ("<="):
		case (">"):
		case (">="):
			// TODO: Check order of constraint
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(Classes.Type.numType.id, j1.T.id),
				new Classes.Constraint(Classes.Type.numType.id, j2.T.id)
			]));
			returnType = Classes.Type.boolType;
			break;

		default:
			throw new Error("Unhandled binary operator " + this.operator);
	}

	var j = new Classes.Judgement(returnType, C, j2.gamma, W);
	j.nodes.push(this);

	return j;
};

// Rule NegType / PreClasses.Type.numType / PostOpType
// NB We're combining prefix and postfix operators here because I don't need to distinguish so far
UglifyJS.AST_Unary.prototype.check = function(gamma, dynamics) {

	this.expression.parent = parent(this);
	var j1 = this.expression.check(gamma, dynamics);
	var C, returnType;
	var W = j1.W;

	switch (this.operator) {
		// NegType
		case ("!"):

			// TODO: Check order of constraint
			C = j1.C.concat([new Classes.Constraint(Classes.Type.boolType.id, j1.T.id)]);
			returnType = Classes.Type.boolType;
			break;
			// PreClasses.Type.numType / PostOpType
		case ("-"):
		case ("++"):
		case ("--"):

			// TODO: Check order of constraint
			C = j1.C.concat([new Classes.Constraint(Classes.Type.numType.id, j1.T.id)]);
			returnType = Classes.Type.numType;
			break;

		default:
			throw new Error("Unhandled unary operator!");
	}
	var j = new Classes.Judgement(returnType, C, j1.gamma, W);
	j.nodes.push(this);

	return j;
};

/***********************************************************************************
 * Creating typability judgements
 ***********************************************************************************/

// Rule ExpTypable
UglifyJS.AST_SimpleStatement.prototype.check = function(gamma, dynamics) {
	this.body.parent = parent(this);
	return this.body.check(gamma, dynamics);
};

// RetTypable1/2/3/4
UglifyJS.AST_Return.prototype.check = function(gamma, dynamics) {
	// type the return value if present
	var C, T, newGamma, W;

	// RetTypable 1/2
	if (this.value !== undefined && this.value !== null) {
		var j = this.value.check(gamma, dynamics);
		C = j.C;
		W = j.W;
		newGamma = j.gamma;
		T = j.T;
	} else
	// RetTypable 3/4
	{
		newGamma = gamma;
		C = [];
		W = [];
		T = Classes.Type.undefinedType;
	}

	
	// check if 'return' is coherent with what has been defined in this scope
	var previousReturn = gamma.getTypeEnvEntry('return');
	previousReturn.somePathsNoReturn = false;
	if (previousReturn.type === Classes.Type.undefinedReturnType.id) {
		// no constraint needed - this is the first return
		newGamma.push(new Classes.TypeEnvEntry('return', this, T.id));
	} else
	{
		C.push(new Classes.Constraint(T.id, previousReturn.type));
	}

	var judgement = new Classes.Judgement(null, C, newGamma, W);
	judgement.nodes.push(this);
	return judgement;
};

// Rule SeqTypable
UglifyJS.AST_Block.prototype.check = function(gamma, dynamics) {
	var judgement = new Classes.Judgement(null, [], new Classes.TypeEnv(gamma), []);

	for (var i = 0; i < this.body.length; i++) {
		this.body[i].parent = parent(this);
		var j = this.body[i].check(gamma, dynamics);
		judgement.W = judgement.W.concat(j.W);
		judgement.C = judgement.C.concat(j.C);
		judgement.gamma = gamma = j.gamma;

		// solve the generated constraints, or throw an error if this isn't possible
		// NB Type.store will be modified by this, and NOT all constraints are used up
		var result = solveConstraints(judgement.C);
		var substitutions = result.substitutions;

		// reset the constraints for the next statement
		judgement.C = result.constraints;

		// apply the solution substitutions to the type environment
		for (var l = 0; l < substitutions.length; l++) {

			judgement.gamma.applySubstitution(substitutions[l]);

			for (var k = 0; k < judgement.W.length; k++) {
				judgement.W[k].applySubstitution(substitutions[l]);
			}
		}

	}

	// Implementation detail: Attach gamma to new scopes so we can retrieve
	// them when annotating/gradual typing
	if (this instanceof UglifyJS.AST_Scope) {
		this.gamma = judgement.gamma;
	}

	judgement.nodes.push(this);
	return judgement;
};

// Rule IfTypable1 / IfTypable2
UglifyJS.AST_If.prototype.check = function(gamma, dynamics) {
	this.condition.parent = parent(this);

	var j1 = this.condition.check(gamma, dynamics);
	var C = j1.C;
	var W = j1.W;

	C.push(new Classes.Constraint(Classes.Type.boolType.id, j1.T.id));

	// create a cloned (SEPARATE!) environment for the two branches
	// we will then have to merge changes back into the original
	function getClone(original) {
		var clone = [];
		var map = {};
		for (var i = 0; i < original.length; i++) {
			clone[i] = new Classes.TypeEnvEntry(
				original[i].name,
				original[i].node,
				original[i].type
			);
			if (original[i].somePathsNoReturn) clone[i].somePathsNoReturn = true;
			map[i] = clone[i];
		}
		return {
			gamma: new Classes.TypeEnv(clone),
			map: map
		};
	}

	function prune(T1, T2, limit1, limit2, base) {
		var T;
		if (T1 instanceof Classes.ObjectType && T2 instanceof Classes.ObjectType) {
			// var debug = true;
			// if (debug) console.log();
			// if (debug) console.log(T1.toString());
			// if (debug) console.log(T2.toString());
			var memberTypes = {};

			var nextT2 = T2;

			do {
				// if (debug) console.log(nextT2.toString());
				for (var member in nextT2.memberTypes) {
					if (member in T1.memberTypes &&
						// we want to keep only the uppermost member
						!(member in memberTypes)
					) {
						memberTypes[member] = prune(
							Classes.Type.store[T1.memberTypes[member]],
							Classes.Type.store[nextT2.memberTypes[member]]
							// No limits because we want to continue until null
						).id;
					}
				}

				nextT2 = Classes.Type.store[nextT2.originalObj];
			} while (nextT2 !== undefined && nextT2 !== null && nextT2.id !== limit2);

			var originalObj;
			if (T1.originalObj !== null && T1.originalObj !== limit1) {
				originalObj = prune(Classes.Type.store[T1.originalObj], T2, limit1, limit2, base).id;
			} else if (T1.originalObj === limit1) {
				// this code was added to attach the bottom element of some
				// chain to the original type (before the if) - so that
				// inference can pass through the if
				// I didn't think very long OR hard about this and I am very dubious.

				originalObj = limit1;
				// I'm pretty confident that any element of an originalObj
				// chain must be a legit object, so I think this is safe.
				// TODO: I didn't think very long about this. (but it seemed to work...)
				if (base !== undefined && base !== limit1) {
					Classes.Type.store[limit1].originalObj = base;
				}

			} else {
				originalObj = null;
			}

			T = new Classes.ObjectType({
				memberTypes: memberTypes,
				originalObj: originalObj
			});
		} else if (T1 instanceof Classes.ObjectType || T2 instanceof Classes.ObjectType) {
			// if one but not both are concrete objects, the other must be abstract
			// treat it like an empty object, so the intersection will be empty
			T = new Classes.ObjectType({
				memberTypes: {}
			});
		} else {
			// if these aren't two conrete objects, just add a constraint
			// between them to ensure they're of the same type
			// TODO: I think abs with obj should give {}
			C.push(new Classes.Constraint(T1.id, T2.id));
			T = T1;
		}
		if (T1.shouldInfer || T2.shouldInfer) T.shouldInfer = true;
		return T;
	}

	function mergeEnv(original, map1, map2, gamma1, gamma2) {
		var initLen = original.length;
		for (var i = 0; i < initLen; i++) {

			// we deal with return separately
			if (original[i].name === 'return') continue;

			// T1 and T2 represent the final types at the end of each branch
			// map1[i] and map2[i] are the original types (at the start of each branch)
			var T1 = gamma1.get(original[i].name);
			var T2 = gamma2.get(original[i].name);

			// optimisation - don't make constraints if the types are the same!
			if (original[i].type !== T1.type || original[i].type !== T2.type) {
				var newType = prune(T1, T2, map1[i].type, map2[i].type, original[i].type);
				original.push(new Classes.TypeEnvEntry(
					original[i].name,
					original[i].node,
					newType.id
				));
			}

			// Now add constraints on the original type (to allow inference propagation)
			if (original[i].type !== map1[i].type) {
				C.push(new Classes.LEqConstraint(map1[i].type, original[i].type));
			}

			if (original[i].type !== map2[i].type) {
				C.push(new Classes.LEqConstraint(map2[i].type, original[i].type));
			}
		}
		return original; 
	}

	function mergeReturns(tee1, tee2, reversed) {
		var lack, type;
		if (tee1.somePathsNoReturn) {
			if (tee1.type === Classes.Type.undefinedReturnType.id) {
				// tee1 is LACK_BLANK

				if (tee2.somePathsNoReturn) {
					if (tee2.type === Classes.Type.undefinedReturnType.id) {
						// tee2 is LACK_BLANK

						lack = true;
						type = tee1.type;
					} else {
						// tee2 is LACK_T for T = tee2.type

						lack = true;
						type = tee2.type; 
					}
				} else {
					// tee2 is T for T = tee2.type

					lack = true;
					type = tee2.type; 
				}
			} else {
				// tee1 is LACK_T for T = tee1.type

				if (tee2.somePathsNoReturn) {
					if (tee2.type === Classes.Type.undefinedReturnType.id) {
						// tee2 is LACK_BLANK

						lack = true;
						type = tee1.type;
					} else {
						// tee2 is LACK_T for T = tee2.type

						C.push(new Classes.Constraint(tee1.type, tee2.type));
						lack = true;
						type = tee1.type; // or tee2 would be fine
					}
				} else {
					// tee2 is T for T = tee2.type

					C.push(new Classes.Constraint(tee1.type, tee2.type));
					lack = true;
					type = tee1.type; // or tee2 would be fine
				}
			}
		} else {
			// tee1 is T for T = tee1.type

			if (tee2.somePathsNoReturn) {
				if (tee2.type === Classes.Type.undefinedReturnType.id) {
					// tee2 is LACK_BLANK

					lack = true;
					type = tee1.type;
				} else {
					// tee2 is LACK_T for T = tee2.type

					C.push(new Classes.Constraint(tee1.type, tee2.type));
					lack = true;
					type = tee1.type; // or tee2 would be fine
				}
			} else {
				// tee2 is T for T = tee2.type

				C.push(new Classes.Constraint(tee1.type, tee2.type));
				lack = false;
				type = tee1.type; // or tee2 would be fine
			}
		}
		if (lack === undefined || type === undefined) {
			throw new Error("Found an unexpected combination of return types (JSTyper error)");
		} else {
			var newTee = new Classes.TypeEnvEntry('return', null, type);
			if (lack) newTee.somePathsNoReturn = true;
			return newTee;
		} 

	}

	this.body.parent = parent(this);
	var clone1 = getClone(j1.gamma);
	var j2 = this.body.check(clone1.gamma, dynamics);
	C = C.concat(j2.C);
	W = W.concat(j2.W);

	var outGamma, newReturn;
	// IfTypable2
	if (this.alternative !== undefined && this.alternative !== null) {
		this.alternative.parent = parent(this);
		var clone2 = getClone(j1.gamma);
		var j3 = this.alternative.check(clone2.gamma, dynamics);
		C = C.concat(j3.C);
		W = W.concat(j3.W);

		outGamma = mergeEnv(j1.gamma, clone1.map, clone2.map, j2.gamma, j3.gamma);
		
		if (j1.gamma.get('return') !== null) {
			newReturn = mergeReturns(j2.gamma.getTypeEnvEntry('return'),j3.gamma.getTypeEnvEntry('return'));
			outGamma.push(newReturn);
		}
	} else {
		var initLen = j1.gamma.length;
		for (var i = 0; i < initLen; i++) {
			// normally we would look at the intersection of both branches to
			// determine what goes in outgamma. Here one branch is empty, so
			// we just use the prior gamma

			// optimisation - don't make constraints if the types are the same!
			if (j1.gamma[i].type !== clone1.map[i].type) {

				C.push(new Classes.LEqConstraint(clone1.map[i].type, j1.gamma[i].type));
			}
		}
		outGamma = j1.gamma;

		if (j1.gamma.get('return') !== null) {
			newReturn = mergeReturns(j2.gamma.getTypeEnvEntry('return'),j1.gamma.getTypeEnvEntry('return'));
			outGamma.push(newReturn);
		}
	}

	var j = new Classes.Judgement(null, C, outGamma, W);
	j.nodes.push(this);
	return j;
};

// Rule DecTypable / DefTypable
UglifyJS.AST_VarDef.prototype.check = function(gamma, dynamics) {
	this.name.parent = parent(this);

	var C = [],
		W = [];
	// need to select a new type (we are redefining the type from here on)
	var T = gamma.getFreshType(undefined, {
		detail: 'var type of ' + this.name.name
	});

	// DefTypable
	if (this.value) {
		this.value.parent = parent(this);
		var judgement = this.value.check(gamma, dynamics);
		// Contention: Should this be LEqCheck or not?
		// Straight LEq is required to be able to later expand the object, but
		// LEqCheck is required for the constraint to actually have any effect

		// C = judgement.C.concat([new Classes.LEqCheckConstraint(T, judgement.T, this.value)]);
		C = judgement.C.concat([new Classes.LEqConstraint(T.id, judgement.T.id)]);
		W = judgement.W;
	}

	gamma = new Classes.TypeEnv(gamma);
	var tee = new Classes.TypeEnvEntry(this.name.name, this.name, T.id);
	gamma.push(tee);
	this.name.tee = tee;
	var j = new Classes.Judgement(null, C, gamma, W);
	j.nodes.push(this);

	return j;
};

// Rule MultiDecTypable
UglifyJS.AST_Var.prototype.check = function(gamma, dynamics) {

	// VariableDeclaration.declarations is a list of VariableDeclarators
	var C = [],
		W = [];
	for (var i = 0; i < this.definitions.length; i++) {

		this.definitions[i].parent = parent(this);
		var judgement = this.definitions[i].check(gamma, dynamics);

		// Pass on judgement to subsequent declarators
		// TODO: assert X1 n X2 is empty
		C = C.concat(judgement.C);
		W = W.concat(judgement.W);
		gamma = judgement.gamma;
	}

	var j = new Classes.Judgement(null, C, gamma, W);
	j.nodes.push(this);


	return j;
};


// Implementation detail: attach gamma to all lexical scopes:
UglifyJS.AST_Scope.prototype.check = function(gamma, dynamics) {
	var judgement;

	// actually obtain a judgement
	if (this instanceof UglifyJS.AST_Lambda) {
		UglifyJS.AST_Lambda.prototype.check.call(this, gamma, dynamics);
	} else if (this instanceof UglifyJS.AST_TopLevel) {
		UglifyJS.AST_TopLevel.prototype.check.call(this, gamma, dynamics);
	}

	this.gamma = judgement.gamma;
	return judgement;
};