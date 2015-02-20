/* 	This module generates judgements according to the logic set out in the
	formal specification. Ideally it should be as close to the induction
	rules as possible.
	It also adds the parent() method to all nodes. This method could be a property
	except that it would introduce circular structures and then JSON won't print */

var Classes = require("./classes.js");
var UglifyJS = require("uglify-js2");

UglifyJS.AST_Node.prototype.check = function() {
	throw new Error("Unhandled node type");
};
UglifyJS.AST_Node.prototype.parent = function() {
	throw new Error("Parent has not been defined yet!");
};

function parent(par) {
	return function() { return par; };
}

/***********************************************************************************
 * Checking typability, and also creating type judgements
 ***********************************************************************************/

<<<<<<< HEAD
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
	for (var i =0; i<this.properties.length; i++) {
		this.properties[i].parent = parent(this);
		this.properties[i].value.parent = parent(this.properties[i]);

		var judgement = this.properties[i].value.check(gamma, dynamics);
		C = C.concat(judgement.C);
		W = W.concat(judgement.W);

		// generate a new Type for this property, which will be constrained by the value type
		var propType = gamma.getFreshType(undefined, {detail:'prop ' + i + 'type of ', node: this});

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

// TODO: V_Fun1 / V_Fun2
UglifyJS.AST_Lambda.prototype.check = function(gamma, dynamics) {

	
	var Ts = [];
	var retType = gamma.getFreshType(undefined, {detail:'return type of fun ', node: this});

	var funType = new Classes.FunctionType({
		argTypes: [],
		returnType: retType.id
	});

	// generate a fresh type for each of the arguments (including 'this')
	// Also create a new Gamma to check the function body
	var gamma1 = new Classes.TypeEnv(gamma);

	for (var i=0; i<this.argnames.length+1; i++) {
		if (i>0) this.argnames[i-1].parent = parent(this);

		Ts[i] = gamma.getFreshType(undefined, {detail:'arg' + i + ' type of fun ', node: this});
		var name = (i===0)?'this':this.argnames[i-1].name ;
		
		gamma1.push(new Classes.TypeEnvEntry(name, null, Ts[i].id));
		funType.argTypes.push(Ts[i].id);
	}

	// V_Fun2
	if (this.name !== undefined && this.name !== null) {
		gamma1.push(new Classes.TypeEnvEntry(this.name.name, this, funType.id));
	}

	// type the body using the new gamma (treat it as a block statement)
	var j1 = UglifyJS.AST_Block.prototype.check.call(this, gamma1);

	var C;
	var W = j1.W;
	if (j1.gamma.get('return') === null) {
		// there are no return statements in the block
		C = j1.C.concat(new Classes.Constraint(Classes.Type.undefinedType.id, retType.id));
	} else {
		// TODO: potentially don't want this to be null...
		C = j1.C.concat(new Classes.Constraint(j1.gamma.get('return').id, retType.id));
	}

	// return the original gamma
	var j = new Classes.Judgement(funType, C, gamma, W);
	j.nodes.push(this);
	return j;
};

// Rule IdType / IdTypeUndef
UglifyJS.AST_Symbol.prototype.check = function(gamma, dynamics, doNotWrap) {
	var T, C = [], W = [];
	var dynamic = false;
	if (dynamics.indexOf(this.name) >= 0 && !doNotWrap) {
		// this is a dynamic variable, so we will be wrapping with a mimic
		dynamic = true;
	}

	T = gamma.get(this.name);
	if (T === null || T === undefined) {
		// need to select a new type, but create a new env for it
		T = gamma.getFreshType(undefined, {detail:'symbol type for ' + this.name, node: this});
		gamma = new Classes.TypeEnv(gamma);
		if (!dynamic) gamma.push(new Classes.TypeEnvEntry(this.name, this, T.id));
	}

	if (dynamic) {
		W.push(new Classes.Wrapper(this, this.parent(), T.id));
	}

	var j = new Classes.Judgement(T, C, gamma, W);
	j.nodes.push(this);
	return j;
};

// Rule PropType

UglifyJS.AST_Dot.prototype.check = function(gamma, dynamics) {
	this.expression.parent = parent(this);
	this.property.parent = parent(this);

	// get the type of the containing object
	var j1 = this.expression.check(gamma, dynamics);
	var C = j1.C;
	var W = j1.W;

	var T = gamma.getFreshType(undefined, {detail:'required property type for obj.' + this.property, node: this});

	// add a new constraint stating the containing object much have this as a property
	var memberType = {};
	memberType[this.property] = T.id;

	var containerType = new Classes.ObjectType({
		memberTypes: memberType
	});
	C.push(new Classes.LEqConstraint(containerType.id, j1.T.id));
	var judgement = new Classes.Judgement(T, C, j1.gamma, W);
	judgement.nodes.push(this);
	return judgement;
};

// TODO: Rule CallType / PropCallType

UglifyJS.AST_Call.prototype.check = function(gamma, dynamics) {
	this.expression.parent = parent(this);

	// Type-check function expression
	var j0 = this.expression.check(gamma, dynamics);
	var C = j0.C;
	var W = j0.W;

	// prepare new constraints
	var argTypes = [gamma.getFreshType(undefined, {detail:'inferred \'this\' type of call ', node: this}).id];
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
	for (var i=0; i<this.args.length; i++) {
		this.args[i].parent = parent(this);
		
		var ji = this.args[i].check(gamma, dynamics);
		C = C.concat(ji.C);
		W = W.concat(ji.W);

		var T = gamma.getFreshType(undefined, {detail: 'inferred arg' + i + ' type of call', node: this});
		argTypes.push(T.id);
		
		C.push(new Classes.LEqCheckConstraint(T.id, ji.T.id));

		gamma = ji.gamma;
	}

	var funcType = new Classes.FunctionType({
		argTypes:argTypes,
		returnType: gamma.getFreshType(undefined, {detail: 'inferred return type of call', node: this}).id
	});
	C.push(new Classes.Constraint(j0.T.id, funcType.id));

	var useType = gamma.getFreshType(undefined, {detail: 'use type of call', node:this});
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

	// if this is an assignment to a dynamic variable, we shouldn't wrap with a mimic
	var j2 = this.left.check(j1.gamma, dynamics, dynamicWrite);
	
	var C = j1.C.concat(j2.C);
	var W = j1.W.concat(j2.W);
	var returnType, j;
	switch(this.operator) {
		case ("="):

			if (! (this.left instanceof UglifyJS.AST_Dot)) {
				// AssignType (if it's not a dot, it must be a variable)
				
				if (!dynamicWrite) C.push(new Classes.LEqConstraint(j2.T.id, j1.T.id));
				// if (!dynamicWrite) C.push(new Classes.LEqCheckConstraint(j2.T, j1.T, this.right));

				returnType = j1.T;
				break;
			} else {
				// PropAssignType

				j2 = this.left.expression.check(j1.gamma, dynamics);

				var T3 = gamma.getFreshType();
				var memberType = {};
				memberType[this.left.property] = T3.id;

				var T = new Classes.ObjectType({
					memberTypes: memberType
				});

				C = j1.C.concat(j2.C);
				var constraint = new Classes.LEqConstraint(T.id, j2.T.id);
				C.push(constraint);
				C.push(new Classes.LEqConstraint(T3.id, j1.T.id));
				// C.push(new Classes.LEqCheckConstraint(T3, j1.T, this.left.expression));
			}
		break;
		case ("+="):
		case ("-="):
		case ("*="):
		case ("/="):
		case ("%="):
			// these operators have the added constraint that both left and right must be numbers
			// since we're about to say the two types are equal, can just say left must be number

			if (! (this.left instanceof UglifyJS.AST_Dot)) {
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
	switch(this.operator) {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators
		// NumOpType
		case ("+"): // TODO?: allow string
		case ("-"):
		case ("*"):
		case ("/"):
		case ("%"):
			// TODO: Check order of constraint
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(Classes.Type.numType.id, j1.T.id), 
											new Classes.Constraint(Classes.Type.numType.id, j2.T.id)]));
			returnType = Classes.Type.numType;
			break;
		// boolean operators (should both be boolean)
		case ("||"):
		case("&&"):
			// TODO: Check order of constraint
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(Classes.Type.boolType.id, j1.T.id), 
											new Classes.Constraint(Classes.Type.boolType.id, j2.T.id)]));
			returnType = Classes.Type.boolType;
			break;
		
		// misc comparison (should both be equal of any type)
		case ("=="):
		case ("!="):
		case ("==="):
		case ("!=="):
			// TODO: Check order of constraint
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(j2.T.id, j1.T.id), 
											new Classes.Constraint(j1.T.id, j2.T.id)]));
			returnType = Classes.Type.boolType;
			break;
		
		// numeric comparison (should both be number)
		case ("<"):
		case ("<="):
		case (">"):
		case (">="):
			// TODO: Check order of constraint
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(Classes.Type.numType.id, j1.T.id), 
											new Classes.Constraint(Classes.Type.numType.id, j2.T.id)]));
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

	// check if 'return' has already been defined in this scope
	// RetTypable 1/3
	if (gamma.get('return') === null) {
		newGamma.push(new Classes.TypeEnvEntry('return', this, T.id));
	} else
	// RetTypable 2/4
	{
		C.push(new Classes.Constraint(T.id, gamma.get('return').id));
	}

	var judgement = new Classes.Judgement(null, C, newGamma, W);
	judgement.nodes.push(this);
	return judgement;
};
// Rule SeqTypable
UglifyJS.AST_Block.prototype.check = function(gamma, dynamics) {
	var judgement = new Classes.Judgement(null, [], gamma, []);
	for (var i=0; i<this.body.length; i++) {

		this.body[i].parent = parent(this);
		var j = this.body[i].check(gamma, dynamics);
		judgement.C = judgement.C.concat(j.C);
		judgement.W = judgement.W.concat(j.W);
		judgement.gamma = gamma = j.gamma;
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

	// TODO: Check order of constraint
	C.push(new Classes.Constraint(Classes.Type.boolType.id, j1.T.id));
	
	this.body.parent = parent(this);
	var j2 = this.body.check(j1.gamma, dynamics);
	C = C.concat(j2.C);
	W = W.concat(j2.W);

	// IfTypable2
	if (this.alternative !== undefined && this.alternative !== null) {
		this.alternative.parent = parent(this);
		var j3 = this.alternative.check(j1.gamma, dynamics);
		C = C.concat(j3.C);
		W = W.concat(j3.W);
	}	

	var j = new Classes.Judgement(null, C, j1.gamma, W);
	j.nodes.push(this);
	return j;
};

// Rule DecTypable / DefTypable
UglifyJS.AST_VarDef.prototype.check = function(gamma, dynamics) {
	this.name.parent = parent(this);
	
	var C = [], W =[];
	// need to select a new type (we are redefining the type from here on)
	var T = gamma.getFreshType(undefined, {detail:'var type of ' + this.name.name});
	
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
	gamma.push(new Classes.TypeEnvEntry(this.name.name, this.name, T.id));
	var j = new Classes.Judgement(null, C, gamma, W);
	j.nodes.push(this);

	return j;
};

// Rule MultiDecTypable
UglifyJS.AST_Var.prototype.check = function(gamma, dynamics) {

	// VariableDeclaration.declarations is a list of VariableDeclarators
	var C = [], W=[];
	for (var i=0; i<this.definitions.length; i++) {

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
		UglifyJS.AST_Lambda.prototype.check.call(this,gamma);
	} else if (this instanceof UglifyJS.AST_TopLevel) {
		UglifyJS.AST_TopLevel.prototype.check.call(this,gamma);
	}

	this.gamma = judgement.gamma;
	return judgement;
};