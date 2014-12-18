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
 * helper function - could be refactored somewhere else if there were any more
 ***********************************************************************************/

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
	var j = new Classes.Judgement(this.constType, gamma, [], []);
	j.nodes.push(this);
	return j;
};
UglifyJS.AST_String.prototype.constType = stringType;
UglifyJS.AST_Number.prototype.constType = numType;
UglifyJS.AST_Boolean.prototype.constType = boolType;
UglifyJS.AST_Undefined.prototype.constType = undefinedType;
UglifyJS.AST_Null.prototype.constType = nullType;

// Rule IdType / IdTypeUndef
UglifyJS.AST_SymbolRef.prototype.check = function(gamma) {
	var T, X = [],
		C = [];

	T = gamma.get(this.name);

	if (T === null) {
		// need to select a new type
		T = gamma.getFreshType();
		X.push(T);
		gamma.push(new Classes.TypeEnvEntry(this.name, this, T));
	}

	var j = new Classes.Judgement(T, gamma, X, C);
	j.nodes.push(this);
	return j;
};

UglifyJS.AST_Assign.prototype.check = function(gamma) {
	this.right.parent = parent(this);
	this.left.parent = parent(this);

	var j2 = this.right.check(gamma);
	var j1 = this.left.check(j2.gamma);
	var X = j1.X.concat(j2.X);
	var C = j1.C.concat(j2.C);
	var returnType;
	switch(this.operator) {
		case ("+="):
		case ("*="):
		case ("/="):
		case ("-="):
			// these operators have the added constraint that both left and right must be numbers
			// since we're about to say the two types are equal, can just say left must be number
			C.push(new Classes.Constraint(numType, null, j1.T, this.left));
		/* falls through */
		case ("="):
			C.push(new Classes.Constraint(j1.T, this.left, j2.T, this.right));
			returnType = j2.T;
		break;
		default:
			throw new Error("Unhandled assignment operator " + this.operator);
	}
	var j = new Classes.Judgement(returnType, j1.gamma, X, C);
	j.nodes.push(this);

	return j;
};

UglifyJS.AST_Unary.prototype.check = function(gamma) {

	this.expression.parent = parent(this);
	var j1 = this.expression.check(gamma);
	var C, returnType;
	
	switch (this.operator) {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators
		// arithmetic (should be number)
		case ("++"):
		case ("--"):
		case ("-"):
			C = j1.C.concat([new Classes.Constraint(numType, null, j1.T, this.expression)]);
			returnType = numType;
			break;
		// boolean operators (should be boolean)
		case ("!"):
			C = j1.C.concat([new Classes.Constraint(boolType, null, j1.T, this.expression)]);
			returnType = boolType;
			break;
		default:
			throw new Error("Unhandled unary operator!");
	}
	var j = new Classes.Judgement(returnType, j1.gamma, j1.X, C);
	j.nodes.push(this);

	return j;
};

UglifyJS.AST_Binary.prototype.check = function(gamma) {
	this.left.parent = parent(this);
	this.right.parent = parent(this);

	// NB Assuming left-to-right evaluation
	var j1 = this.left.check(gamma);
	var j2 = this.right.check(j1.gamma);
	var X = j1.X.concat(j2.X);
	var C, returnType;

	// NB both expressions are being READ so they must be second parameter to constraint 
	// (this is important in case they're dynamic)
	switch(this.operator) {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators
		// arithmetic (should both be number)
		case ("+"): // TODO?: allow string
		case ("-"):
		case ("*"):
		case ("/"):
		case ("%"):
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(numType, null, j1.T, this.left), 
											new Classes.Constraint(numType, null, j2.T, this.right)]));
			returnType = numType;
			break;
		// numeric comparison (should both be number)
		case ("<"):
		case (">"):
		case ("<="):
		case (">="):
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(numType, null, j1.T, this.left), 
											new Classes.Constraint(numType, null, j2.T, this.right)]));
			returnType = boolType;
			break;
	
		// boolean operators (should both be boolean)
		case ("||"):
		case("&&"):
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(boolType, null, j1.T, this.left), 
											new Classes.Constraint(boolType, null, j2.T, this.right)]));
			returnType = boolType;
			break;
	
		// misc comparison (should both be equal of any type)
		case ("=="):
		case ("==="):
		case ("!="):
		case ("!=="):
			// TODO: is this a hacky solution? Create two symmetrical constraints to assert equality
			C = j1.C.concat(j2.C.concat([new Classes.Constraint(j2.T, this.right, j1.T, this.left), 
											new Classes.Constraint(j1.T, this.left, j2.T, this.right)]));
			returnType = boolType;
			break;

		default:
			throw new Error("Unhandled binary operator " + this.operator);
	}

	var j = new Classes.Judgement(returnType, j2.gamma, X, C);
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

// Rule V_Skip / ExpTypable (special case of expression when e is skip)
UglifyJS.AST_EmptyStatement.prototype.check = function(gamma) {
	var j = new Classes.Judgement(null, gamma, [], []);
	j.nodes.push(this);
	return j;
};

// Rule DecTypable / DefTypable
UglifyJS.AST_VarDef.prototype.check = function(gamma) {
	var X = [],
		C = [];
	// need to select a new type (we are redefining the type from here on)
	var T = gamma.getFreshType();
	
	this.name.parent = parent(this);

	if (this.value) {
		this.value.parent = parent(this);
		var judgement = this.value.check(gamma);
		X = judgement.X.concat([T]);
		C = judgement.C.concat([new Classes.Constraint(T, this.name, judgement.T, this.value)]);
	}

	gamma.push(new Classes.TypeEnvEntry(this.name.name, this.name, T));
	var j = new Classes.Judgement(null, gamma, X, C);
	j.nodes.push(this);

	return j;
};

// Rule MultiDecTypable
UglifyJS.AST_Var.prototype.check = function(gamma) {

	// VariableDeclaration.declarations is a list of VariableDeclarators
	var X = [],
		C = [];
	for (var i=0; i<this.definitions.length; i++) {

		this.definitions[i].parent = parent(this);
		var judgement = this.definitions[i].check(gamma);

		// Pass on judgement to subsequent declarators
		// TODO: assert X1 n X2 is empty
		X = X.concat(judgement.X);
		C = C.concat(judgement.C);
		gamma = judgement.gamma;
	}

	var j = new Classes.Judgement(null, gamma, X, C);
	j.nodes.push(this);


	return j;
};

// NB Rule SeqTypable is effectively contained in checkUntyped