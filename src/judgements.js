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

var numType = new Classes.PrimitiveType('number');
var boolType = new Classes.PrimitiveType('boolean');
var stringType = new Classes.PrimitiveType('string');
var undefinedType = new Classes.PrimitiveType('undefined');
var nullType = new Classes.PrimitiveType('null');
UglifyJS.AST_Constant.prototype.check = function(gamma) {
	if (this.constType === undefined) throw new Error("Unhandled constant type " + this);
	var j = new Classes.Judgement(this.constType, [], gamma);
	j.nodes.push(this);
	return j;
};
UglifyJS.AST_Number.prototype.constType = numType;
UglifyJS.AST_Boolean.prototype.constType = boolType;
UglifyJS.AST_String.prototype.constType = stringType;
UglifyJS.AST_Undefined.prototype.constType = undefinedType;
UglifyJS.AST_Null.prototype.constType = nullType;

// Rule V_Skip (special case of expression when e is skip)
UglifyJS.AST_EmptyStatement.prototype.check = function(gamma) {
	var j = new Classes.Judgement(undefinedType, [], gamma);
	j.nodes.push(this);
	return j;
};

// Rule V_Obj
UglifyJS.AST_Object.prototype.check = function(gamma) {
	
	// An object literal will generate a fresh type which we will bind properties to
	var memberType = {};
	var C = [];
	// an object's type can be derived as long as each of its members has a valid type
	for (var i =0; i<this.properties.length; i++) {
		this.properties[i].parent = parent(this);
		this.properties[i].value.parent = parent(this.properties[i]);

		var judgement = this.properties[i].value.check(gamma);
		C = C.concat(judgement.C);

		// generate a new Type for this property, which will be constrained by the value type
		var propType = gamma.getFreshType(undefined, {detail:'prop ' + i + 'type of ', node: this});

		// TODO: Check the direction of this constraint
		C.push(new Classes.Constraint(propType, judgement.T, this.properties[i].value));
		memberType[this.properties[i].key] = propType;
		memberType[this.properties[i].key].node = this.properties[i];

		// thread gamma through to the next property
		gamma = judgement.gamma;
	}

	var T = new Classes.ObjectType({
		memberTypes: memberType
	});

	return new Classes.Judgement(T, C, gamma);
};

// TODO: V_Fun1 / V_Fun2
UglifyJS.AST_Lambda.prototype.check = function(gamma) {

	
	var Ts = [];
	var retType = gamma.getFreshType(undefined, {detail:'return type of fun ', node: this});

	var funType = new Classes.FunctionType({
		argTypes: [],
		returnType: retType
	});

	// generate a fresh type for each of the arguments (including 'this')
	// Also create a new Gamma to check the function body
	var gamma1 = new Classes.TypeEnv(gamma);

	for (var i=0; i<this.argnames.length+1; i++) {
		if (i>0) this.argnames[i-1].parent = parent(this);

		Ts[i] = gamma.getFreshType(undefined, {detail:'arg' + i + ' type of fun ', node: this});
		var name = (i===0)?'this':this.argnames[i-1].name ;
		
		gamma1.push(new Classes.TypeEnvEntry(name, null, Ts[i]));
		funType.argTypes.push(Ts[i]);
	}

	// V_Fun2
	if (this.name !== undefined && this.name !== null) {
		gamma1.push(new Classes.TypeEnvEntry(this.name.name, this, funType));
	}

	// type the body using the new gamma (treat it as a block statement)
	var j1 = UglifyJS.AST_Block.prototype.check.call(this, gamma1);

	var C;
	if (j1.gamma.get('return') === null) {
		// there are no return statements in the block
		C = j1.C.concat(new Classes.Constraint(undefinedType, retType, null));
	} else {
		// TODO: potentially don't want this to be null...
		C = j1.C.concat(new Classes.Constraint(j1.gamma.get('return'), retType, null));
	}

	// return the original gamma
	var j = new Classes.Judgement(funType, C, gamma);
	j.nodes.push(this);
	return j;
};

// Rule IdType / IdTypeUndef
UglifyJS.AST_Symbol.prototype.check = function(gamma) {
	var T, C = [];

	T = gamma.get(this.name);

	if (T === null) {
		// need to select a new type, but create a new env for it
		T = gamma.getFreshType(undefined, {detail:'symbol type for ' + this.name, node: this});
		gamma = new Classes.TypeEnv(gamma);
		gamma.push(new Classes.TypeEnvEntry(this.name, this, T));
	}

	var j = new Classes.Judgement(T, C, gamma);
	j.nodes.push(this);
	return j;
};

// Rule PropType

UglifyJS.AST_Dot.prototype.check = function(gamma) {
	this.expression.parent = parent(this);
	this.property.parent = parent(this);

	// get the type of the containing object
	var j1 = this.expression.check(gamma);
	var C = j1.C;

	var T = gamma.getFreshType(undefined, {detail:'required property type for obj.' + this.property, node: this});

	// add a new constraint stating the containing object much have this as a property
	var memberType = {};
	memberType[this.property] = T;

	var containerType = new Classes.ObjectType({
		memberTypes: memberType
	});
	C.push(new Classes.LEqConstraint(containerType, j1.T, this.expression));
	var judgement = new Classes.Judgement(T, C, j1.gamma);
	judgement.nodes.push(this);
	return judgement;
};

// TODO: Rule CallType / PropCallType

UglifyJS.AST_Call.prototype.check = function(gamma) {
	this.expression.parent = parent(this);

	// Type-check function expression
	var j0 = this.expression.check(gamma);
	var C = j0.C;

	// prepare new constraints
	var argTypes = [gamma.getFreshType(undefined, {detail:'inferred \'this\' type of call ', node: this})];
	if (this.expression instanceof UglifyJS.AST_Dot) {
		// this is an instance call
		// PropCallType

		// annoyingly we have to check e and e.l separately (this is probably avoidable)
		var je = this.expression.expression.check(gamma);
		// I don't care about je.C or je.gamma - they will come through when we check this.expression 

		// commented out for now because it causes this problem:

		// PROBLEM:
		/*
			
			Every object method has an implicit 'this' parameter, which must
			form part of the function type else we'll get problems with:

				function doubleHeight() { return this.height * 2; }
				var x = {height:3, doubleHeight: doubleHeight};
				var y = {doubleHeight: doubleHeight};
				var totalHeight = x.doubleHeight() + 
									y.doubleHeight();
			
			So the method type includes the object type, and obviously the
			object type contains the function type too. Infinite arrows!

			I guess the problem might be that we're creating a function that's
			polymorphic in 'this', which is a higher-order construct.

		*/
		C.push(new Classes.LEqConstraint(argTypes[0], je.T, this.expression));
	} else {
		// normal function call (no this)
		C.push(new Classes.Constraint(argTypes[0], undefinedType, this.expression));
	}
	gamma = j0.gamma;
	
	// typecheck each parameter
	for (var i=0; i<this.args.length; i++) {
		this.args[i].parent = parent(this);
		
		var ji = this.args[i].check(gamma);
		C = C.concat(ji.C);

		var T = gamma.getFreshType(undefined, {detail: 'inferred arg' + i + ' type of call', node: this});
		argTypes.push(T);
		
		C.push(new Classes.LEqConstraint(T, ji.T, this.args[i]));

		gamma = ji.gamma;
	}

	var funcType = new Classes.FunctionType({
		argTypes:argTypes,
		returnType: gamma.getFreshType(undefined, {detail: 'inferred return type of call', node: this})
	});
	C.push(new Classes.Constraint(j0.T, funcType, this));

	var judgement = new Classes.Judgement(funcType.returnType, C, gamma);
	judgement.nodes.push(this);
	return judgement;
};

// Rule AssignType / PropAssignType / NumAssignType / PropNumAssignType
UglifyJS.AST_Assign.prototype.check = function(gamma) {
	this.right.parent = parent(this);
	this.left.parent = parent(this);
	var j1 = this.right.check(gamma);
	var j2 = this.left.check(j1.gamma);
	
	var C = j1.C.concat(j2.C);
	var returnType, j;
	switch(this.operator) {
		case ("="):
			// TODO: This remains unproven and potentially dubious
			if (! (this.left instanceof UglifyJS.AST_Dot)) {
			
				C.push(new Classes.LEqConstraint(j2.T, j1.T, this.right));
				returnType = j1.T;
				break;
			} else {
				// PropAssignType

				j2 = this.left.expression.check(j1.gamma);

				var T3 = gamma.getFreshType();
				var memberType = {};
				memberType[this.left.property] = T3;

				var T = new Classes.ObjectType({
					memberTypes: memberType
				});

				C = j1.C.concat(j2.C);
				var constraint = new Classes.LEqConstraint(T, j2.T, this.left.expression);
				C.push(constraint);
				C.push(new Classes.LEqConstraint(T3, j1.T, this.left.expression));
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
				C.push(new Classes.Constraint(numType, j1.T, this.right));
				C.push(new Classes.Constraint(numType, j2.T, this.left));
				returnType = j1.T;
			} else {
				// PropNumAssignType

				j2 = this.left.expression.check(j1.gamma);

				var memberTypeNum = {};
				memberTypeNum[this.left.property] = numType;

				var numT = new Classes.ObjectType({
					memberTypes: memberTypeNum
				});

				C = j1.C.concat(j2.C);
				var constraintNum = new Classes.LEqConstraint(numT, j2.T, this.left.expression);
				C.push(constraintNum);
				C.push(new Classes.Constraint(numType, j1.T, this.left));
			}
		break;
		default:
			throw new Error("Unhandled assignment operator " + this.operator);
	}
	j = new Classes.Judgement(returnType, C, j2.gamma);
	j.nodes.push(this);

	return j;
};

// Rule NumOpType / BoolOpType / CmpOpType / NumCmpOpType
UglifyJS.AST_Binary.prototype.check = function(gamma) {
	this.left.parent = parent(this);
	this.right.parent = parent(this);

	var j1 = this.left.check(gamma);
	var j2 = this.right.check(j1.gamma);
	var C, returnType;

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
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(numType, j1.T, this.left), 
											new Classes.Constraint(numType, j2.T, this.right)]));
			returnType = numType;
			break;
		// boolean operators (should both be boolean)
		case ("||"):
		case("&&"):
			// TODO: Check order of constraint
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(boolType, j1.T, this.left), 
											new Classes.Constraint(boolType, j2.T, this.right)]));
			returnType = boolType;
			break;
		
		// misc comparison (should both be equal of any type)
		case ("=="):
		case ("!="):
		case ("==="):
		case ("!=="):
			// TODO: Check order of constraint
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(j2.T, j1.T, this.left), 
											new Classes.Constraint(j1.T, j2.T, this.right)]));
			returnType = boolType;
			break;
		
		// numeric comparison (should both be number)
		case ("<"):
		case ("<="):
		case (">"):
		case (">="):
			// TODO: Check order of constraint
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(numType, j1.T, this.left), 
											new Classes.Constraint(numType, j2.T, this.right)]));
			returnType = boolType;
			break;
	
		default:
			throw new Error("Unhandled binary operator " + this.operator);
	}

	var j = new Classes.Judgement(returnType, C, j2.gamma);
	j.nodes.push(this);

	return j;
};

// Rule NegType / PreNumType / PostOpType
// NB We're combining prefix and postfix operators here because I don't need to distinguish so far
UglifyJS.AST_Unary.prototype.check = function(gamma) {

	this.expression.parent = parent(this);
	var j1 = this.expression.check(gamma);
	var C, returnType;
	
	switch (this.operator) {
		// NegType
		case ("!"):
			
			// TODO: Check order of constraint
			C = j1.C.concat([new Classes.Constraint(boolType, j1.T, this.expression)]);
			returnType = boolType;
			break;
		// PreNumType / PostOpType
		case ("-"):
		case ("++"):
		case ("--"):

			// TODO: Check order of constraint
			C = j1.C.concat([new Classes.Constraint(numType, j1.T, this.expression)]);
			returnType = numType;
			break;
		
		default:
			throw new Error("Unhandled unary operator!");
	}
	var j = new Classes.Judgement(returnType, C, j1.gamma);
	j.nodes.push(this);

	return j;
};

/***********************************************************************************
 * Creating typability judgements 
 ***********************************************************************************/

// Rule ExpTypable
UglifyJS.AST_SimpleStatement.prototype.check = function(gamma) {
	this.body.parent = parent(this);
	return this.body.check(gamma);
};

// RetTypable1/2/3/4
UglifyJS.AST_Return.prototype.check = function(gamma) {
	// type the return value if present
	var C, T, newGamma;

	// RetTypable 1/2
	if (this.value !== undefined && this.value !== null) {
		var j = this.value.check(gamma);
		C = j.C;
		newGamma = j.gamma;
		T = j.T;
	} else 
	// RetTypable 3/4
	{
		newGamma = gamma;
		C = [];
		T = undefinedType;
	}

	// check if 'return' has already been defined in this scope
	// RetTypable 1/3
	if (gamma.get('return') === null) {
		newGamma.push(new Classes.TypeEnvEntry('return', this, T));
	} else
	// RetTypable 2/4
	{
		C.push(new Classes.Constraint(T, gamma.get('return'), this));
	}

	var judgement = new Classes.Judgement(null, C, newGamma);
	judgement.nodes.push(this);
	return judgement;
};
// Rule SeqTypable
UglifyJS.AST_Block.prototype.check = function(gamma) {
	var judgement = new Classes.Judgement(null, [], gamma);
	for (var i=0; i<this.body.length; i++) {

		this.body[i].parent = parent(this);
		var j = this.body[i].check(gamma);
		judgement.C = judgement.C.concat(j.C);
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
UglifyJS.AST_If.prototype.check = function(gamma) {
	this.condition.parent = parent(this);
	
	var j1 = this.condition.check(gamma);
	var C = j1.C;

	// TODO: Check order of constraint
	C.push(new Classes.Constraint(boolType, j1.T, this.condition));
	
	this.body.parent = parent(this);
	var j2 = this.body.check(j1.gamma);
	C = C.concat(j2.C);

	// IfTypable2
	if (this.alternative !== undefined && this.alternative !== null) {
		this.alternative.parent = parent(this);
		var j3 = this.alternative.check(j1.gamma);
		C = C.concat(j3.C);
	}	

	var j = new Classes.Judgement(null, C, j1.gamma);
	j.nodes.push(this);
	return j;
};

// Rule DecTypable / DefTypable
UglifyJS.AST_VarDef.prototype.check = function(gamma) {
	this.name.parent = parent(this);
	
	var C = [];
	// need to select a new type (we are redefining the type from here on)
	var T = gamma.getFreshType(undefined, {detail:'var type of ' + this.name.name});
	
	// DefTypable
	if (this.value) {
		this.value.parent = parent(this);
		var judgement = this.value.check(gamma);
		C = judgement.C.concat([new Classes.LEqConstraint(T, judgement.T, this.value)]);
	}

	gamma = new Classes.TypeEnv(gamma);
	gamma.push(new Classes.TypeEnvEntry(this.name.name, this.name, T));
	var j = new Classes.Judgement(null, C, gamma);
	j.nodes.push(this);

	return j;
};

// Rule MultiDecTypable
UglifyJS.AST_Var.prototype.check = function(gamma) {

	// VariableDeclaration.declarations is a list of VariableDeclarators
	var C = [];
	for (var i=0; i<this.definitions.length; i++) {

		this.definitions[i].parent = parent(this);
		var judgement = this.definitions[i].check(gamma);

		// Pass on judgement to subsequent declarators
		// TODO: assert X1 n X2 is empty
		C = C.concat(judgement.C);
		gamma = judgement.gamma;
	}

	var j = new Classes.Judgement(null, C, gamma);
	j.nodes.push(this);


	return j;
};


// Implementation detail: attach gamma to all lexical scopes:
UglifyJS.AST_Scope.prototype.check = function(gamma) {
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