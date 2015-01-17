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

var numType = new Classes.Type('number', {
	concrete: true
});
var boolType = new Classes.Type('boolean', {
	concrete: true
});
var stringType = new Classes.Type('string', {
	concrete: true
});
var undefinedType = new Classes.Type('undefined', {
	concrete: true
});
var nullType = new Classes.Type('null', {
	concrete: true
});
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
		var propType = gamma.getFreshType();

		// TODO: Check the direction of this constraint
		C.push(new Classes.Constraint(propType, judgement.T, this.properties[i].value));
		memberType[this.properties[i].key] = propType;
		memberType[this.properties[i].key].node = this.properties[i];

		// thread gamma through to the next property
		gamma = judgement.gamma;
	}

	var T = new Classes.Type('object', {
		concrete: true,
		members: memberType
	});

	return new Classes.Judgement(T, C, gamma);
};

// TODO: V_Fun1 / V_Fun2
UglifyJS.AST_Lambda.prototype.check = function(gamma) {
	
	var Ts = [];
	var retType = gamma.getFreshType();

	var funType = new Classes.Type('function', {
		concrete: true,
		argTypes: [],
		returnType: retType
	});

	// generate a fresh type for each of the arguments (including 'this')
	// Also create a new Gamma to check the function body
	var gamma1 = new Classes.TypeEnv(gamma);

	for (var i=0; i<this.argnames.length+1; i++) {
		
		Ts[i] = gamma.getFreshType();
		var name = (i===0)?'this':this.argnames[i-1].name;
		
		gamma1.push(new Classes.TypeEnvEntry(name, null, Ts[i]));
		funType.argTypes.push(Ts[i]);
	}

	// V_Fun2
	if (this.name !== undefined && this.name !== null) {
		gamma1.push(new Classes.TypeEnvEntry(this.name, this, funType));
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
		T = gamma.getFreshType();
		gamma = new Classes.TypeEnv(gamma);
		gamma.push(new Classes.TypeEnvEntry(this.name, this, T));
	}

	var j = new Classes.Judgement(T, C, gamma);
	j.nodes.push(this);
	return j;
};

// Tule PropType

UglifyJS.AST_Dot.prototype.check = function(gamma) {
	// get the type of the containing object
	var j1 = this.expression.check(gamma);
	var C = j1.C;

	var T = gamma.getFreshType();

	// add a new constraint stating the containing object much have this as a property
	var memberType = {};
	memberType[this.property] = T;
	var containerType = new Classes.Type('object', {
		concrete: true,
		members: memberType
	});
	C.push(new Classes.Constraint(containerType, j1.T, this.expression));
	return new Classes.Judgement(T, C, j1.gamma);
};

// TODO: Rule CallType / PropCallType

// Rule AssignType / PropAssignType / NumAssignType
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
			if (! this.left instanceof UglifyJS.AST_Dot) {
			
				C.push(new Classes.Constraint(j2.T, j1.T, this.right));
				returnType = j1.T;
				break;
			} else {

				// this is a property assignment, so all we require is that the property expression be an object
				j2 = this.left.expression.check(j1.gamma);
				C = j1.C.concat(j2.C);

				var memberType = {};

				memberType[this.left.property] = j1.T;

				var T = new Classes.Type('object',{
					concrete: true,
					members: memberType
				});

				var constraint = new Classes.Constraint(T, j2.T, this.left.expression);
				constraint.enforce = true;
				C.push(constraint);

				j = new Classes.Judgement(returnType, C, j2.gamma);
				j.nodes.push(this);
				return j;
			}
		break;
		case ("+="):
		case ("-="):
		case ("*="):
		case ("/="):
		case ("%="):
			// these operators have the added constraint that both left and right must be numbers
			// since we're about to say the two types are equal, can just say left must be number
			// TODO: Check order of this constraint
			C.push(new Classes.Constraint(numType, j1.T, this.left));
			C.push(new Classes.Constraint(j2.T, j1.T, this.right));
			returnType = j1.T;
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
	var T = gamma.getFreshType();
	
	// DefTypable
	if (this.value) {
		this.value.parent = parent(this);
		var judgement = this.value.check(gamma);
		C = judgement.C.concat([new Classes.Constraint(T, judgement.T, this.value)]);
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