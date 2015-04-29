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

// Rule V_Array
UglifyJS.AST_Array.prototype.check = function(gamma, dynamics) {

	var innerType = gamma.getFreshType();
	var T = new Classes.ArrayType({
		innerType: innerType.id
	});
	var C = [];
	var W = [];
	// an array's type is constrained by the elements within it
	for (var i = 0; i < this.elements.length; i++) {
		this.elements[i].parent = parent(this);

		var judgement = this.elements[i].check(gamma, dynamics);
		C = C.concat(judgement.C);
		W = W.concat(judgement.W);

		// can read an element with less structure than the array's type, (but must write elms with more)
		// this is one of those places where I'd like to use straight LEq, to be able to grow array type as I see more elements
		// unfortunately this is equivalent to growing by assignment of an object, which JSTyper doesn't support as per WWTp1
		// instead the type of an array is defined by the first element
		C.push(new Classes.LEqCheckConstraint(innerType.id, judgement.T.id));

		// thread gamma through to the next element
		gamma = judgement.gamma;
	}

	return new Classes.Judgement(T, C, gamma, W);
};

// V_Fun1 / V_Fun2 / V_Fun3 / V_Fun4
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
	var placeholderReturn = Classes.Type.pendingType;
	// placeholderReturn.illDefined = true;
	gamma1.push(new Classes.TypeEnvEntry('return', null, placeholderReturn.id));

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
	funType.gamma = j1.gamma;


	var C;
	var W = j1.W;
	var finalReturn = j1.gamma.get('return');
	if (finalReturn.type === 'pending') {
		// some paths don't return, but there were never any returns anyway
		C = j1.C.concat(new Classes.Constraint(Classes.Type.undefinedType.id, retType.id));
	} else if (finalReturn.illDefined) {
		// some paths don't return, but there was at least one return somewhere
		throw new Error("At least one function path does not return");
	} else {
		// all paths return, and I trust they are coherent
		C = j1.C.concat(new Classes.Constraint(finalReturn.id, retType.id));
	}

	// return the original gamma
	var j = new Classes.Judgement(funType, C, gamma, W);
	j.nodes.push(this);
	return j;
};

// Rule IdType / IdTypeUndef
UglifyJS.AST_Symbol.prototype.check = function(gamma, dynamics) {
	var T, W = [];
	var dynamic = false;
	if (dynamics.indexOf(this.name) >= 0) {
		// this is a dynamic variable, so we will be wrapping with a mimic
		dynamic = true;
	}

	if (dynamic) {
		// if (isAssignment) {
		// 	// this was an assignment to a dynamic var

		// 	this.tee = new Classes.TypeEnvEntry(this.name, this, (new Classes.AbstractType()).id);
		// } else {
		T = gamma.getFreshType();
		this.tee = {
			type: "wrapped" // will be replaced once the wrapper is generated
		};
		T.shouldInfer = true; // maybe?
		W.push(new Classes.Wrapper(this, this.parent(), T.id));
		// }
	} else {

		T = gamma.get(this.name);
		this.tee = gamma.getTypeEnvEntry(this.name);

		if (T===null || T === undefined || T.illDefined === true) {
			// we are reading this variable but it is ill-defined
			throw new Error("Reading from '" + this.name + "' but it is ill-defined");
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


	// HAAAAAAAAAAACK :( I'm doing this to get around the fact that
	// shouldInfer will automatically propagate on the newly created type,
	// when in fact a previously assigned object should potentially not have shouldInfer
	var existingType = objectGetProperty(j1.T, this.property);
	if (existingType !== null) {
		return new Classes.Judgement(existingType, C, j1.gamma, W);
	}

	// add a new constraint stating the containing object much have this as a property
	var T = gamma.getFreshType(undefined, {
		detail: 'required property type for obj.' + this.property,
		node: this
	});
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

	// after solving constraints, I know that j1.T must have the property in question
	var r = partSolve(C, gamma, W);
	C = r.C;
	W = r.W;
	gamma = r.gamma;
	for (var i = 0; i<r.substitutions.length; i++) {
		if (r.substitutions[i].from === j1.T.id) {
			j1.T = Classes.Type.store[r.substitutions[i].to];
		}
		Classes.Type.store[j1.T.id].applySubstitution(r.substitutions[i]);
	}

	// @deref may not be in the root, however
	var o=j1.T;
	while (! (this.property in o.memberTypes)) o = Classes.Type.store[o.originalObj];
	
	var itemType = o.memberTypes[this.property];

	var judgement = new Classes.Judgement(Classes.Type.store[itemType], C, j1.gamma, W);
	judgement.nodes.push(this);
	return judgement;
};

// Rule ArrayType
// NB This is not called for assigning to an array. (see AssignType for that)
UglifyJS.AST_Sub.prototype.check = function(gamma, dynamics) {
	this.expression.parent = parent(this);
	this.property.parent = parent(this);

	// get the type of the containing object
	var j1 = this.expression.check(gamma, dynamics);
	var C = j1.C;
	var W = j1.W;

	// check that the index property was a number (we don't support string accesses)
	var j2 = this.property.check(j1.gamma, dynamics);
	C = C.concat(j2.C);
	W = W.concat(j2.W);
	C.push(new Classes.Constraint(Classes.Type.numType.id, j2.T.id));

	var innerType = gamma.getFreshType();
	var T = new Classes.ArrayType({
		innerType: innerType.id
	});

	// If we should infer the array's type, then we should infer the contents' type
	if (j1.T.shouldInfer) innerType.shouldInfer = true;

	// TODO: This possibly should be LEqCheck. I'm being lenient...
	// the array type must have more structure than the type being read
	C.push(new Classes.LEqConstraint(T.id, j1.T.id));

	// after solving constraints, I know that j1.T must have an @deref property
	var r = partSolve(C, gamma, W);
	C = r.C;
	W = r.W;
	gamma = r.gamma;
	for (var i = 0; i<r.substitutions.length; i++) {
		if (r.substitutions[i].from === j1.T.id) {
			j1.T = Classes.Type.store[r.substitutions[i].to];
		}
		Classes.Type.store[j1.T.id].applySubstitution(r.substitutions[i]);
	}

	// @deref may not be in the root, however
	var o=j1.T;
	while (! ("@deref" in o.memberTypes)) o = Classes.Type.store[o.originalObj];
	
	var itemType = o.memberTypes["@deref"];

	var judgement = new Classes.Judgement(Classes.Type.store[itemType], C, j1.gamma, W);
	judgement.nodes.push(this);
	return judgement;
};

// Rule CallType / PropCallType
UglifyJS.AST_Call.prototype.check = function(gamma, dynamics) {
	this.expression.parent = parent(this);

	// Type-check function expression
	var j0 = this.expression.check(gamma, dynamics);
	var C = j0.C;
	var W = j0.W;
	gamma = j0.gamma;

	// prepare new constraints
	// firstly the constraint on 'this' - the 0th argument type
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

		if (je.T.shouldInfer) {
			C.push(new Classes.LEqConstraint(argTypes[0], je.T.id));
		} else {
			C.push(new Classes.LEqCheckConstraint(argTypes[0], je.T.id));
		}
	} else {
		// normal function call (no this)
		C.push(new Classes.Constraint(argTypes[0], Classes.Type.undefinedType.id));
	}

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
		if (ji.T.shouldInfer) {
			C.push(new Classes.LEqConstraint(T.id, ji.T.id));
		} else {
			C.push(new Classes.LEqCheckConstraint(T.id, ji.T.id));
		}

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

	if (j0.T.shouldInfer) {
		C.push(new Classes.LEqConstraint(useType.id, funcType.returnType));
	} else {
		C.push(new Classes.LEqCheckConstraint(useType.id, funcType.returnType));
	}
	if (j0.T.shouldInfer) useType.shouldInfer = true;

	var judgement = new Classes.Judgement(useType, C, gamma, W);
	judgement.nodes.push(this);
	return judgement;
};

// Rule AssignType / PropAssignType / SunAssignType / NumAssignType / PropNumAssignType
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

	// all assignments involve checking RHS
	// FIXME: technically RHS should be checked last apparently
	var j1 = this.right.check(gamma, dynamics);
	var C = j1.C;
	var W = j1.W;


	// try to fix things by solving constraints before we attempt assignment (which is complicated!)
	var r = partSolve(C, j1.gamma, W);

	C = r.C;
	W = r.W;
	j1.gamma = r.gamma;
	// we also need to apply substitutions to j1.T itself, which may not be represented in gamma
	for (var i = 0; i<r.substitutions.length; i++) {
		if (r.substitutions[i].from === j1.T.id) {
			j1.T = Classes.Type.store[r.substitutions[i].to];
		}
		Classes.Type.store[j1.T.id].applySubstitution(r.substitutions[i]);
	}


	// if this is an assignment to a dynamic variable, we shouldn't wrap with a mimic
	var returnType, j, j2, j3;
	var nextGamma;
	switch (this.operator) {
		case ("="):
			if (this.left instanceof UglifyJS.AST_Symbol) {

				if (!dynamicWrite) {

					var currentType = j1.gamma.get(this.left.name);
					var constrainType;
					if (currentType === null || currentType === undefined) {
						// AssignTypeUndef

						// need to select a new type, but create a new env for it
						// currentType = j1.gamma.getFreshType();

						nextGamma = new Classes.TypeEnv(j1.gamma);

						var tee = new Classes.TypeEnvEntry(this.left.name, this.left, j1.T.id);
						this.left.tee = tee;
						nextGamma.push(tee);
						constrainType = j1.T;
					} else {
						// AssignType

						nextGamma = j1.gamma;
						// we already have a type env entry for this type
						this.left.tee = nextGamma.getTypeEnvEntry(this.left.name);

						// haaaaack ad-hoc solution for preventing ill-
						// definedness to be lost in the old gamma (mainly for test52)
						if (currentType.illDefined && j1.T instanceof Classes.PrimitiveType) {
							constrainType = new Classes.PrimitiveType(j1.T.type);
							constrainType.illDefined = true;
						} else {
							constrainType = j1.T;
						}

						// update gamma
						// Shouldn't need to update gamma , but discarding constraints means we do. Example:
						/*
							function foo(x, y) {
								x.foo;
								x = y;
								x.bar;
							}
						*/
						nextGamma.push(
							new Classes.TypeEnvEntry(
								this.left.name,
								this,
								j1.T.id
							)
						);
						// important justification of LEqCheck v. LEq in WWT pad, bottom of page 1.
						C.push(new Classes.LEqCheckConstraint(currentType.id, constrainType.id));
					}


				} else {
					// ignore assignments to dynamic variables, and just use j1.gamma next
					nextGamma = j1.gamma;
				}

				returnType = j1.T;
				break;
			} else if (this.left instanceof UglifyJS.AST_Dot) {
				// PropAssignType

				var T = j1.T;

				// We will travel up the dot string, reassigning T until we get to the root
				this.left.parent = parent(this);
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
					expNode.expression.parent = parent(expNode);
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

					// Slight hack / deviation from the spec
					var nextBase;
					// TODO: Should really check all orig objects too
					// example failing test (should compile but doesn't) var x = {a:{}}; x.b = 4; x.a.c = 3;
					var myTypeWithAName = objectGetProperty(baseType, path[0]);
					if (myTypeWithAName !== null) {
						nextBase = myTypeWithAName;

					} else {
						// baseType hasn't been identified as an object yet. 
						// make a constraint with a fresh obj and we'll use that

						// I think this is legit because it's very similar to the enforce() stage of
						// solving a LEqConstraint. We don't just use LEqConstraints because we don't
						// want a random freshtype used for the member. Also it seems to work okay...
						nextBase = new Classes.ObjectType({
							memberTypes: {}
						});
						nextBase.memberTypes[path[0]] = gamma.getFreshType().id;
						if (baseType.shouldInfer) {
							nextBase.shouldInfer = true;
							Classes.Type.store[nextBase.memberTypes[path[0]]].shouldInfer = true;
						}
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

				nextGamma = new Classes.TypeEnv(j2.gamma);
				nextGamma.push(new Classes.TypeEnvEntry(expNode.name, this, T.id));

				returnType = j1.T;

			} else if (this.left instanceof UglifyJS.AST_Sub) {
				// ArrayAssignType

				j2 = this.left.expression.check(j1.gamma, dynamics);
				C = C.concat(j2.C);
				W = W.concat(j2.W);

				// check that the index property was a number (we don't support string accesses)
				j3 = this.left.property.check(j1.gamma, dynamics);
				C = C.concat(j3.C);
				W = W.concat(j3.W);
				C.push(new Classes.Constraint(Classes.Type.numType.id, j3.T.id));

				var arrayType = new Classes.ArrayType({
					innerType: j1.T.id
				});
				C.push(new Classes.LEqCheckConstraint(j2.T.id, arrayType.id));

				nextGamma = j3.gamma;

				returnType = j1.T;
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

			if (this.left instanceof UglifyJS.AST_Dot) {
				// PropNumAssignType

				j2 = this.left.expression.check(j1.gamma, dynamics);
				C = j1.C.concat(j2.C);
				W = j1.W.concat(j2.W);

				var memberTypeNum = {};
				memberTypeNum[this.left.property] = Classes.Type.numType.id;

				var numT = new Classes.ObjectType({
					memberTypes: memberTypeNum
				});

				var constraintNum = new Classes.LEqConstraint(numT.id, j2.T.id);
				C.push(constraintNum);
				C.push(new Classes.Constraint(Classes.Type.numType.id, j1.T.id));
			} else if (this.left instanceof UglifyJS.AST_Symbol) {
				// NumAssignType

				j2 = this.left.check(j1.gamma, dynamics);

				C = C.concat(j2.C);
				W = W.concat(j2.W);

				C.push(new Classes.Constraint(Classes.Type.numType.id, j1.T.id));
				C.push(new Classes.Constraint(Classes.Type.numType.id, j2.T.id));
				returnType = j1.T;
			} else if (this.left instanceof UglifyJS.AST_Sub) {
				// ArrayNumAssignType	
				// TODO: test? This may not work at all..

				j2 = this.left.expression.check(j1.gamma, dynamics);
				C = C.concat(j2.C);
				W = W.concat(j2.W);

				// check that the index property was a number (we don't support string accesses)
				j3 = this.left.property.check(j1.gamma, dynamics);
				C = C.concat(j3.C);
				W = W.concat(j3.W);
				C.push(new Classes.Constraint(Classes.Type.numType.id, j3.T.id));

				var numArrayType = new Classes.ArrayType({
					innerType: Classes.Type.numType.id
				});
				C.push(new Classes.Constraint(j2.T.id, numArrayType.id));
				C.push(new Classes.Constraint(j1.T.id, Classes.Type.numType.id));

				nextGamma = j3.gamma;

				returnType = j1.T;
			} else {
				throw new Error("'Unexpected assignment target");
			}
			nextGamma = j2.gamma;
			break;
		default:
			throw new Error("Unhandled assignment operator " + this.operator);
	}
	j = new Classes.Judgement(returnType, C, nextGamma, W);
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
		case ("+"):
		case ("-"):
		case ("*"):
		case ("/"):
		case ("%"):
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(Classes.Type.numType.id, j1.T.id),
				new Classes.Constraint(Classes.Type.numType.id, j2.T.id)
			]));
			returnType = Classes.Type.numType;
			break;
			// boolean operators (should both be boolean)
		case ("||"):
		case ("&&"):
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

			C = j1.C.concat([new Classes.Constraint(Classes.Type.boolType.id, j1.T.id)]);
			returnType = Classes.Type.boolType;
			break;
		case ("-"):
		case ("++"):
		case ("--"):
			// PreNumType / PostOpType

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

// V_FunDef
// Add function definitions names to the type environments
UglifyJS.AST_Defun.prototype.check = function(gamma, dynamics) {
	var j = UglifyJS.AST_Lambda.prototype.check.call(this, gamma, dynamics);
	if (this.name !== null && this.name.name !== null && this.name.name.length > 0) {
		var tee = new Classes.TypeEnvEntry(this.name.name, this, j.T.id);
		this.name.tee = tee;
		j.gamma.push(tee);

	}
	return new Classes.Judgement(null, j.C, j.gamma, j.W);
};

// RetTypable1/2/3/4
UglifyJS.AST_Return.prototype.check = function(gamma, dynamics) {
	// type the return value if present
	var C, T, newGamma, W;

	if (this.value !== undefined && this.value !== null) {
		// RetTypable 2/3/4 
		var j = this.value.check(gamma, dynamics);
		C = j.C;
		W = j.W;
		newGamma = j.gamma;
		T = j.T;
	} else {
		// RetTypable 1
		newGamma = gamma;
		C = [];
		W = [];
		T = Classes.Type.undefinedType;
	}


	// check if 'return' is coherent with what has been defined in this scope
	var previousReturn = gamma.get('return');

	if (previousReturn.type === 'pending') {
		// RetTypable 2
		// no constraint needed - this is the first return
		newGamma.push(new Classes.TypeEnvEntry('return', this, T.id));

	} else if (previousReturn.illDefined) {
		// RetTypable 3 
		previousReturn.illDefined = false;
		C.push(new Classes.Constraint(T.id, previousReturn.id));

	} else {
		// RetTypable 4
		C.push(new Classes.Constraint(T.id, previousReturn.id));
	}

	var judgement = new Classes.Judgement(null, C, newGamma, W);
	judgement.nodes.push(this);
	return judgement;
};

function partSolve(C, gamma, W) {
	var result = solveConstraints(C);
	var subs = result.substitutions;

	for (var i=0; i<subs.length; i++) {
		gamma.applySubstitution(subs[i]);

		for (var j=0; j<W.length; j++) {
			W[j].applySubstitution(subs[i]);
		}
	}

	return {
		C: result.constraints,
		W: W,
		gamma: gamma,
		substitutions: subs
	};

}

// Rule SeqTypable
UglifyJS.AST_Block.prototype.check = function(gamma, dynamics) {
	var judgement = new Classes.Judgement(null, [], new Classes.TypeEnv(gamma), []);

	for (var i = 0; i < this.body.length; i++) {
		this.body[i].parent = parent(this);
		var j = this.body[i].check(gamma, dynamics);
		judgement.W = judgement.W.concat(j.W);
		judgement.C = judgement.C.concat(j.C);
		judgement.gamma = j.gamma;

		var r = partSolve(judgement.C, j.gamma, judgement.W);

		judgement.C = r.C;
		judgement.W = r.W;
		judgement.gamma = r.gamma;
		gamma = judgement.gamma;

	}

	// Implementation detail: Attach gamma to new scopes so we can retrieve
	// them when annotating/gradual typing
	if (this instanceof UglifyJS.AST_Scope) {
		this.gamma = judgement.gamma;
	}

	judgement.nodes.push(this);

	return judgement;
};

// handy functions for if, while and for (which have isolated branches)
// we will then have to merge changes back into the original
function getCommonAncestor(T1, T2) {
	// trace both paths up to the root, and then go back up both, finding the
	// first element which is different. O(n) in the max. length of the paths
	if (!(T1 instanceof Classes.ObjectType)) throw new Error("T1 is not object");
	if (!(T2 instanceof Classes.ObjectType)) throw new Error("T2 is not object");
	if (T1.id === T2.id) return T1;

	var p1 = [T1.id],
		p2 = [T2.id];
	while (T2.originalObj !== null && T2.originalObj !== undefined) {
		p2.push(T2.originalObj);
		T2 = Classes.Type.store[T2.originalObj];
	}
	while (T1.originalObj !== null && T1.originalObj !== undefined) {
		p1.push(T1.originalObj);
		T1 = Classes.Type.store[T1.originalObj];
	}
	p1.reverse();
	p2.reverse();

	var i = 0;
	while (p1[i] === p2[i]) {
		i++;
	}
	i--;
	if (i < 0) {
		throw Error("T1 and T2 do not share an ancestor");
	}
	return Classes.Type.store[p1[i]];
}

function flattenObj(o1, o2, limit, C) {

	var o = o1;
	var memberTypes = {};
	var l;

	// first flatten o1
	while (o !== undefined && o.memberTypes !== undefined && o.id !== limit.id) {

		for (l in o.memberTypes) {
			var t2 = objectGetProperty(o2, l);
			if (l in memberTypes) continue;
			if (t2 === null) {
				// memberTypes[l] = o.memberTypes[l];
				// Classes.Type.store[memberTypes[l]].illDefined = true;
			} else {
				memberTypes[l] = m(Classes.Type.store[o.memberTypes[l]], t2, C).id;
			}
		}
		o = Classes.Type.store[o.originalObj];
	}

	var flat = new Classes.ObjectType({
		memberTypes: memberTypes
	});
	flat.originalObj = limit.id;
	if (limit.shouldInfer) flat.shouldInfer = true;
	if (o1.illDefined || o2.illDefined) flat.illDefined = true;
	return flat;
}

function m(T1, T2, C) {
	if (T1.type === "pending") {
		T2.illDefined = true;
		return T2;
	} else if (T2.type === "pending") {
		T1.illDefined = true;
		return T1;
	}
	if (T1 instanceof Classes.ObjectType || T2 instanceof Classes.ObjectType) {
		var an;
		try {
			an = getCommonAncestor(T1, T2);
		} catch (e) {
			an = {
				id: null
			};
		}
		return flattenObj(T1, T2, an, C);
	} else {

		C.push(new Classes.Constraint(T1.id, T2.id));
		if (T2.illDefined) T1.illDefined = true;
		return T1;
	}
}

function objectGetProperty(o, p) {
	if (o instanceof Classes.ObjectType) {
		if (p in o.memberTypes) return Classes.Type.store[o.memberTypes[p]];
		if (o.originalObj) return objectGetProperty(Classes.Type.store[o.originalObj], p);
	}
	return null;
}

// Rule IfTypable1 / IfTypable2
UglifyJS.AST_If.prototype.check = function(gamma, dynamics) {
	
	this.condition.parent = parent(this);

	var j = this.condition.check(gamma, dynamics);
	var C = j.C;
	var W = j.W;

	C.push(new Classes.Constraint(Classes.Type.boolType.id, j.T.id));

	// apply any substitutions before we clone
	var result = solveConstraints(C);
	var substitutions = result.substitutions;
	C = result.constraints;
	for (var l = 0; l < substitutions.length; l++) {

		j.gamma.applySubstitution(substitutions[l]);
		
		for (var k = 0; k < j.W.length; k++) {
			j.W[k].applySubstitution(substitutions[l]);
		}
	}

	var g1 = new Classes.TypeEnv(j.gamma);
	var g2 = new Classes.TypeEnv(j.gamma);

	var j1 = this.body.check(g1, dynamics);
	this.body.parent = parent(this);
	C = C.concat(j1.C);
	W = W.concat(j1.W);
	var g1p = j1.gamma;

	var g2p;
	if (this.alternative !== null) {
		var j2 = this.alternative.check(g2 , dynamics);
		this.alternative.parent = parent(this);
		C = C.concat(j2.C);
		W = W.concat(j2.W);
		g2p = j2.gamma;
	} else {
		g2p = g2;
	}

	// construct a new type environment g3
	var g3 = new Classes.TypeEnv();
	for (var i = 0; i < j.gamma.length; i++) {
		var mergedType = m(g1p.get(j.gamma[i].name), g2p.get(j.gamma[i].name), C);
		g3.push(new Classes.TypeEnvEntry(
			j.gamma[i].name,
			j.gamma[i].node,
			mergedType.id
		));
	}

	var judgement = new Classes.Judgement(null, C, g3, W);
	judgement.nodes.push(this);
	return judgement;
};

// Rule WhileTypable
UglifyJS.AST_While.prototype.check = function(gamma, dynamics) {
	
	this.condition.parent = parent(this);

	var j = this.condition.check(gamma, dynamics);
	var C = j.C;
	var W = j.W;

	C.push(new Classes.Constraint(Classes.Type.boolType.id, j.T.id));

	// apply any substitutions before we clone
	var result = solveConstraints(C);
	var substitutions = result.substitutions;
	C = result.constraints;
	for (var l = 0; l < substitutions.length; l++) {

		j.gamma.applySubstitution(substitutions[l]);
		
		for (var k = 0; k < j.W.length; k++) {
			j.W[k].applySubstitution(substitutions[l]);
		}
	}

	var g1 = new Classes.TypeEnv(j.gamma);

	var j1 = this.body.check(g1, dynamics);
	this.body.parent = parent(this);
	C = C.concat(j1.C);
	W = W.concat(j1.W);
	var g1p = j1.gamma;

	// construct a new type environment g2
	var g2 = new Classes.TypeEnv();
	for (var i = 0; i < j.gamma.length; i++) {
		var mergedType = m(g1p.get(j.gamma[i].name), j.gamma.get(j.gamma[i].name), C);
		g2.push(new Classes.TypeEnvEntry(
			j.gamma[i].name,
			j.gamma[i].node,
			mergedType.id
		));
	}

	var judgement = new Classes.Judgement(null, C, g2, W);
	judgement.nodes.push(this);
	return judgement;
};

// Rule ForTypable
UglifyJS.AST_For.prototype.check = function(gamma, dynamics) {
	var C = [],
		W = [],
		j;

	if (this.init !== null) {
		this.init.parent = parent(this);
		j = this.init.check(gamma, dynamics);
		C = C.concat(j.C);
		W = W.concat(j.W);
		gamma = j.gamma;
	}

	if (this.condition !== null) {
		this.condition.parent = parent(this);
		j = this.condition.check(gamma, dynamics);
		C = C.concat(j.C);
		C.push(new Classes.Constraint(Classes.Type.boolType.id, j.T.id));
		W = W.concat(j.W);
		gamma = j.gamma;
	}

	// apply any substitutions before we clone
	var result = solveConstraints(C);
	var substitutions = result.substitutions;
	C = result.constraints;
	for (var l = 0; l < substitutions.length; l++) {

		gamma.applySubstitution(substitutions[l]);
		
		for (var k = 0; k < j.W.length; k++) {
			j.W[k].applySubstitution(substitutions[l]);
		}
	}

	var g1 = new Classes.TypeEnv(gamma);

	var j1 = this.body.check(g1, dynamics);
	this.body.parent = parent(this);
	C = C.concat(j1.C);
	W = W.concat(j1.W);

	if (this.step !== null) {
		this.step.parent = parent(this);
		j1 = this.step.check(j1.gamma, dynamics);
		C = C.concat(j1.C);
		W = W.concat(j1.W);
	}
	var g1p = j1.gamma;

	// construct a new type environment g2
	var g2 = new Classes.TypeEnv();
	for (var i = 0; i < j.gamma.length; i++) {
		var mergedType = m(g1p.get(gamma[i].name), gamma.get(gamma[i].name), C);
		g2.push(new Classes.TypeEnvEntry(
			gamma[i].name,
			gamma[i].node,
			mergedType.id
		));
	}

	var judgement = new Classes.Judgement(null, C, g2, W);
	judgement.nodes.push(this);
	return judgement;
};

// Rule DecTypable / DefTypable
UglifyJS.AST_VarDef.prototype.check = function(gamma, dynamics) {
	this.name.parent = parent(this);

	var C = [],
		W = [];
	// need to select a new type (we are redefining the type from here on)
	var T = gamma.getFreshType();

	// DefTypable
	if (this.value) {
		this.value.parent = parent(this);
		var judgement = this.value.check(gamma, dynamics);

		// C = judgement.C.concat([new Classes.LEqCheckConstraint(T, judgement.T, this.value)]);
		C = judgement.C;//.concat([new Classes.LEqConstraint(T.id, judgement.T.id)]);
		// if (judgement.T.shouldInfer) T.shouldInfer = true;

		T = judgement.T;
		W = judgement.W;
	} else {
		T.illDefined = true;
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

UglifyJS.AST_Continue.prototype.check = function(gamma, dynamic) {
	var j = new Classes.Judgement(null, [], gamma, []);
	j.nodes.push(this);
	return j;
};
UglifyJS.AST_Break.prototype.check = function(gamma, dynamic) {
	var j = new Classes.Judgement(null, [], gamma, []);
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