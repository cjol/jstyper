/*
	This module contains a bunch of classes representing structures in our program.
	Some of the classes (those without prototype stuff) could almost be done away
	with if we had a reasonable type checker... 
*/

module.exports = {
	Type: Type,
	PrimitiveType: PrimitiveType,
	AbstractType: AbstractType,
	ObjectType: ObjectType,
	FunctionType: FunctionType,
	Substitution: Substitution,
	Constraint: Constraint,
	LEqConstraint: LEqConstraint,
	TypeEnvEntry: TypeEnvEntry,
	TypeEnv: TypeEnv,
	Judgement: Judgement,
};

var tmp = function() {};

Type.id = 1;
function Type(type, options, node) {
	options = options || {};

	this.type = type;
	this.isConcrete = (options.isConcrete === true);
	this.isDynamic = (options.isDynamic === true);
	this.id = Type.id++;
	if (node !== undefined) this.node = node;
}
Type.prototype.cloneTo = function(obj) {
	obj.type = this.type;
	obj.isConcrete = this.isConcrete;
	obj.isDynamic = this.isDynamic;
	// I think I won't redefine id or node
};
Type.prototype.toString = function() {
	return this.type;
};

function PrimitiveType(type, options, node) {
	Type.call(this, type, {
		isConcrete: true,
		isDynamic: options !== undefined && options.isDynamic === true
	}, node);
}
tmp.prototype = Type.prototype;
PrimitiveType.prototype = new tmp();
PrimitiveType.prototype.constructor = PrimitiveType;

PrimitiveType.prototype.applySubstitution = function() {
	// primitive types can't be substituted
	return;
};

function AbstractType(type, options, node) {
	Type.call(this, type, {
		isConcrete: false,
		isDynamic: options !== undefined && options.isDynamic === true
	}, node);
}
tmp.prototype = Type.prototype;
AbstractType.prototype = new tmp();
AbstractType.prototype.constructor = AbstractType;

AbstractType.prototype.applySubstitution = function(sub) {
	if (sub.from.type === this.type) {
		sub.to.cloneTo(this);
	}
};

function ObjectType(options, node) {
	PrimitiveType.call(this, "object", options, node);

	this.memberTypes = {};

	for (var i in options.memberTypes) {
		this.memberTypes[i] = options.memberTypes[i];
	}
}
tmp.prototype = PrimitiveType.prototype;
ObjectType.prototype = new tmp();
ObjectType.prototype.constructor = ObjectType;

ObjectType.prototype.cloneTo = function(obj) {
	PrimitiveType.prototype.cloneTo.call(this, obj);
	obj.memberTypes = {};

	for (var i in this.memberTypes) {
		obj.memberTypes[i] = this.memberTypes[i];
	}
	obj.applySubstitution = ObjectType.prototype.applySubstitution;
	obj.toString = ObjectType.prototype.toString;
	obj.cloneTo = ObjectType.prototype.cloneTo;
};
ObjectType.prototype.applySubstitution = function(sub, donotrecurse) {
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this);

	// An object itself cannot be substituted, but members might be abstract

	outerLoop: for (var j in this.memberTypes) {
		for (var i =0; i<donotrecurse.length; i++) {
			if (this.memberTypes[j].id === donotrecurse[i].id) continue outerLoop;
		}

		// nb I don't want subcalls to modify my donotrecurse so I'm cloning with slice(0)
		this.memberTypes[j].applySubstitution(sub, donotrecurse.slice(0));
	}
};
ObjectType.prototype.toString = function(donotrecurse) {

	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this);

	var types = [];
	outerLoop: for (var lab in this.memberTypes) {
		for (var i=0; i<donotrecurse.length; i++) {
			if (donotrecurse[i].id === this.memberTypes[lab].id) {
				types.push(lab + ": ..[" + this.memberTypes[lab].type + "]..");
				continue outerLoop;
			}
		}
		types.push(lab + ":" + this.memberTypes[lab].toString(donotrecurse.slice(0)) );
	}
	return "{" + types.join(", ") + "}";
};

function FunctionType(options, node) {
	PrimitiveType.call(this, "function", options, node);

	this.argTypes = [];

	for (var i =0; i<options.argTypes.length; i++) {
		this.argTypes[i] = options.argTypes[i];
	}
	this.returnType = options.returnType;
}
tmp.prototype = PrimitiveType.prototype;
FunctionType.prototype = new tmp();
FunctionType.prototype.constructor = FunctionType;

FunctionType.prototype.cloneTo = function(obj) {
	PrimitiveType.prototype.cloneTo.call(this, obj);
	obj.argTypes = [];

	for (var i =0; i<this.argTypes.length; i++) {
		obj.argTypes[i] = this.argTypes[i];
	}
	obj.returnType = this.returnType;
	obj.applySubstitution = FunctionType.prototype.applySubstitution;
	obj.toString = FunctionType.prototype.toString;
	obj.cloneTo = FunctionType.prototype.cloneTo;
};

FunctionType.prototype.applySubstitution = function(sub, donotrecurse) {
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this);

	// A function itself cannot be substituted, but arg or return types might be abstract
	var i;
	outerLoop: for (var j=0; j<this.argTypes.length; j++) {
		for (i =0; i<donotrecurse.length; i++) {
			if (this.argTypes[j].id === donotrecurse[i].id) continue outerLoop;
		}

		// nb I don't want subcalls to modify my donotrecurse so I'm cloning with slice(0)
		this.argTypes[j].applySubstitution(sub, donotrecurse.slice(0));
	}
	for (i =0; i<donotrecurse.length; i++) {
		if (this.returnType.id === donotrecurse[i].id) return;
	}
	this.returnType.applySubstitution(sub, donotrecurse.slice(0));
};
FunctionType.prototype.toString = function(donotrecurse) {

	var j;
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this);
	
	// argument types
	var args = [];
	outerLoop: for (var i = 0; i<this.argTypes.length; i++) {
		
		for (j=0; j<donotrecurse.length; j++) {
			if (donotrecurse[j].id === this.argTypes[i]) {
				args.push("..[" + this.argTypes[i].type + "]..");
				continue outerLoop;
			}
		}
		args.push(this.argTypes[i].toString(donotrecurse.slice(0)));
	}

	// return type
	var ret;
	var safe = true;
	for (j=0; j<donotrecurse.length; j++) {
		if (donotrecurse[j].id === this.returnType) {
			ret = "...";
			safe = false;
			break;
		}
	}
	if (safe) ret = this.returnType.toString(donotrecurse);

	return "fn(" + args.join(", ") + " -> " + ret + ")";
};


function Substitution(from, to) {
	this.from = new Type();
	this.to = new Type();
	from.cloneTo(this.from);
	to.cloneTo(this.to);
}
// shortcut method
Substitution.prototype.apply = function(element) {
	element.applySubstitution(this);
};


function Constraint(leftType, rightType, rightNode) {
	this.type1 = leftType;
	this.type2 = rightType;
	
	this.checkNode = rightNode;
	this.regenDesc();
}
Constraint.prototype.checkStructure = function() {

	if (this.type2.type !== this.type1.type) return false;
	
	// NB Since all types are created fresh, we only get this far if both types are concrete

	if (this.type1.type === "object") {

		// check inclusion in both directions
		// NB: Not recursive (ok because we recurse in caller)
		for (var i in this.type1.memberTypes) {
			if (this.type2.memberTypes[i] === undefined) return false;
		}
		for (var j in this.type2.memberTypes) {
			if (this.type1.memberTypes[j] === undefined) return false;
		}
		return true;
	} else if (this.type1.type === "function") {

		// check arity
		return this.type1.argTypes.length === this.type2.argTypes.length;
	} else {
		// these are primitive types so they're fine
		return true;
	}
};
Constraint.prototype.getSubConstraints = function() {
	
	// NB: We know that type1 and type2 have identical structure

	var newConstraints = [];
	if (this.type1.type === "object")	{

		for (var label in this.type1.memberTypes) {
			newConstraints.push(new Constraint(this.type1.memberTypes[label], this.type2.memberTypes[label], null));
		}

		return newConstraints;	
	} else if (this.type1.type === "function") {

		// generate new constraints asserting that the arguments and
		// return type of type1 and of type2 have the same type
		// TODO: Contravariance and covariance?..
		for (var i=0; i<this.type1.argTypes.length; i++) {
			newConstraints.push(new Constraint(this.type1.argTypes[i], this.type2.argTypes[i], null));
		}
		newConstraints.push(new Constraint(this.type1.returnType, this.type2.returnType, null));
		return newConstraints;	
		
	} else {
		return newConstraints;	
	}
};
Constraint.prototype.regenDesc = function() {
	this.description = this.type1.toString() + " = " + this.type2.toString();
};
Constraint.prototype.applySubstitution = function(sub) {
	this.type1.applySubstitution(sub);
	this.type2.applySubstitution(sub);
	this.regenDesc();
};
Constraint.compare = function(a, b) {
	// Anything which might generate subconstraints should be solved first
	// Also regular constraints should be solved before LEqConstraints
	if (a.type1.type === "object" || a.type1.type === "function") {
		if (b.type1.type === "object" || b.type1.type === "function") {

			// both subconstraint generating - compare by Constraint/LEqConstraint
			if (a instanceof LEqConstraint) {
				if (b instanceof LEqConstraint) {
					return 0; // LEqConstraint a = LEqConstraint b
				}
				return 1; // LEqConstraint a > Constraint b
			}

			if (b instanceof LEqConstraint) {
				return -1; // Constraint a < LEqConstraint b
			}
			return 0; // Constraint a = Constraint b
		}
		return -1; // subgen a < not subgen b
	}
	if (b.type1.type === "object" || b.type1.type === "function") {
		return 1; // not subgen a > subgen b
	}
	// both not subgen - compare by Constraint/LEqConstraint

	if (a instanceof LEqConstraint) {
		if (b instanceof LEqConstraint) {
			return 0; // LEqConstraint a = LEqConstraint b
		}
		return 1; // LEqConstraint a > Constraint b
	}

	if (b instanceof LEqConstraint) {
		return -1; // Constraint a < LEqConstraint b
	}
	return 0; // Constraint a = Constraint b
};
function LEqConstraint(smallType, bigType, checkNode) {
	Constraint.call(this, smallType, bigType, checkNode);
}
tmp = function() {};
tmp.prototype = Constraint.prototype;
LEqConstraint.prototype = new tmp();
LEqConstraint.prototype.constructor = LEqConstraint;
LEqConstraint.prototype.checkStructure = function() {
	// NB This only differs from Constraint for objects
	if (this.type1.type !== this.type2.type) return false;
	if (this.type1.type === "object") {
		// only check that everything in smallType (type1) is included in bigType (type2)
		// NB Still not recursive 
		for (var i in this.type1.memberTypes) {
			if (this.type2.memberTypes[i] === undefined) return false;
		}
	} else if (this.type1.type === "function") {

		// check arity
		return this.type1.argTypes.length === this.type2.argTypes.length;
	}
	return true;
};
LEqConstraint.prototype.satisfy = function() {
	if (this.type1.type !== "object") return [];

	var C = [];
	// we can add smallType's properties to bigType to satisfy the constraint
	for (var l in this.type1.memberTypes) {
		if (this.type2.memberTypes[l] === undefined) {

			// TODO: Can I avoid generating fresh types during solution?
			var T = TypeEnv.getFreshType();
			this.type2.memberTypes[l] = T;
			C.push(new LEqConstraint(this.type1.memberTypes[l], T));
		}
	}
	return C;
};
LEqConstraint.prototype.regenDesc = function() {
	this.desc = this.type1.toString() + " <= " + this.type2.toString();
};


function TypeEnvEntry(varName, node, type) {
	this.name = varName;
	this.node = node;
	this.type = type;
}
TypeEnvEntry.prototype.applySubstitution = function(sub) {
	this.type.applySubstitution(sub);
};
TypeEnvEntry.prototype.toString = function() {
	return this.name + ": " + this.type.toString();
};


function TypeEnv(cloneFrom) {
	if (cloneFrom !== undefined) {
		for (var i=0; i<cloneFrom.length; i++) {
			this.push(cloneFrom[i]);
		}
	}
}
TypeEnv.nextType = 1;
TypeEnv.prototype = new Array();
TypeEnv.prototype.get = function(varName) {

	// search backwards through entries to find the most recent defn
	for (var i = this.length - 1; i >= 0; i--) {
		if (this[i].name === varName) {
			return this[i].type;
		}
	}
	// if (this.parentScope !== undefined) {
	// 	return this.parentScope.get(varName);
	// }
	return null;
};
TypeEnv.getFreshType = function(opts, node) {
	return new AbstractType("T" + (TypeEnv.nextType++), opts, node);
};
TypeEnv.prototype.getFreshType = TypeEnv.getFreshType;
TypeEnv.prototype.applySubstitution = function(sub) {
	for (var i = 0; i < this.length; i++) {
		this[i].applySubstitution(sub);
	}
};
TypeEnv.prototype.toString = function(indentation) {
	var ind = "";
	if (indentation !== undefined) {
		for (var j=0; j<indentation; j++) {
			ind += "\t";
		}
	}
	var res = "";
	// if (this.parentScope !== undefined) {
	// 	res += this.parentScope.toString(indentation);
	// }
	for (var i = this.length - 1; i >= 0; i--) {
		res += ind + this[i].toString() + "\n";
	}
	return res;
};


function Judgement(type, constraints, gamma) {
	this.T = type;
	this.gamma = gamma;
	this.C = constraints || [];
	this.nodes = [];
}
Judgement.InitFromDirective = function(directive) {
	var gamma = new TypeEnv();

	directive = directive.trim();
	var importKeyword = "import ";
	if (directive.search(importKeyword) === 0) {
		directive = directive.substr(importKeyword.length);

		var imported = directive.split(/,\s*/);

		for (var i = 0; i < imported.length; i++) {
			var name = imported[i].trim();
			if (name.length === 0)
				continue;

			// select a fresh type for this imported variable
			var T = gamma.getFreshType({
				dynamic: true
			});

			// TODO: replace "null" with an actual program point
			gamma.push(new TypeEnvEntry(name, null, T));
		}
	}

	return new Judgement(null, [], gamma);
};