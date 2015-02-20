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
	LEqCheckConstraint: LEqCheckConstraint,
	TypeEnvEntry: TypeEnvEntry,
	TypeEnv: TypeEnv,
	Judgement: Judgement,
};

var tmp = function() {};
Type.resetStore = function() {
	Type.store = [];
	Type.id = 0;

	Type.numType = new PrimitiveType('number');
	Type.boolType = new PrimitiveType('boolean');
	Type.stringType = new PrimitiveType('string');
	Type.undefinedType = new PrimitiveType('undefined');
	Type.nullType = new PrimitiveType('null');
};

function Type(type, options, node) {
	options = options || {};

	this.type = type;
	this.isConcrete = (options.isConcrete === true);
	this.isDynamic = (options.isDynamic === true);
	this.id = Type.id++;
	Type.store[this.id] = this;
	this.containers = [];
	if (node !== undefined) this.node = node;
}
// Type.prototype.cloneTo = function(obj) {
// 	obj.type = this.type;
// 	obj.isConcrete = this.isConcrete;
// 	obj.isDynamic = this.isDynamic;
// 	// I think I won't redefine id or node
// };
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
	// if (sub.from.type === this.type) {
	// 	sub.to.cloneTo(this);
	// }
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

// ObjectType.prototype.cloneTo = function(obj) {
// 	PrimitiveType.prototype.cloneTo.call(this, obj);
// 	obj.memberTypes = {};

// 	for (var i in this.memberTypes) {
// 		obj.memberTypes[i] = this.memberTypes[i];
// 	}
// 	obj.applySubstitution = ObjectType.prototype.applySubstitution;
// 	obj.toString = ObjectType.prototype.toString;
// 	obj.cloneTo = ObjectType.prototype.cloneTo;
// };
ObjectType.prototype.applySubstitution = function(sub, donotrecurse) {
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this.id);

	outerLoop: for (var j in this.memberTypes) {
		// if one of my membertypes is the substitution target, then we will replace it
		if (this.memberTypes[j] === sub.from) {
			this.memberTypes[j] = sub.to;
		}

		// now recursively apply substitution to children
		for (var i =0; i<donotrecurse.length; i++) {
			if (this.memberTypes[j] === donotrecurse[i]) continue outerLoop;
		}

		// nb I don't want subcalls to modify my donotrecurse so I'm cloning with slice(0)
		Type.store[this.memberTypes[j]].applySubstitution(sub, donotrecurse.slice(0));
	}
};
ObjectType.prototype.toString = function(donotrecurse) {

	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this.id);

	var types = [];
	outerLoop: for (var lab in this.memberTypes) {
		for (var i=0; i<donotrecurse.length; i++) {
			if (donotrecurse[i] === this.memberTypes[lab]) {
				types.push(lab + ": [" + Type.store[this.memberTypes[lab]].type + "]");
				continue outerLoop;
			}
		}
		types.push(lab + ":" + Type.store[this.memberTypes[lab]].toString(donotrecurse.slice(0)) );
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

// FunctionType.prototype.cloneTo = function(obj) {
// 	PrimitiveType.prototype.cloneTo.call(this, obj);
// 	obj.argTypes = [];

// 	for (var i =0; i<this.argTypes.length; i++) {
// 		obj.argTypes[i] = this.argTypes[i];
// 	}
// 	obj.returnType = this.returnType;
// 	obj.applySubstitution = FunctionType.prototype.applySubstitution;
// 	obj.toString = FunctionType.prototype.toString;
// 	obj.cloneTo = FunctionType.prototype.cloneTo;
// };

FunctionType.prototype.applySubstitution = function(sub, donotrecurse) {
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this.id);

	// A function itself cannot be substituted, but arg or return types might be abstract
	var i;
	outerLoop: for (var j=0; j<this.argTypes.length; j++) {
		if (this.argTypes[j] === sub.from) this.argTypes[j] = sub.to;

		for (i =0; i<donotrecurse.length; i++) {
			if (this.argTypes[j] === donotrecurse[i]) continue outerLoop;
		}

		// nb I don't want subcalls to modify my donotrecurse so I'm cloning with slice(0)
		Type.store[this.argTypes[j]].applySubstitution(sub, donotrecurse.slice(0));
	}

	if (this.returnType === sub.from) this.returnType = sub.to;
	for (i =0; i<donotrecurse.length; i++) {
		if (this.returnType === donotrecurse[i]) return;
	}
	Type.store[this.returnType].applySubstitution(sub, donotrecurse.slice(0));
};
FunctionType.prototype.toString = function(donotrecurse) {

	var j;
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this.id);
	
	// argument types
	var args = [];
	outerLoop: for (var i = 0; i<this.argTypes.length; i++) {
		
		for (j=0; j<donotrecurse.length; j++) {
			if (donotrecurse[j] === this.argTypes[i]) {
				args.push("[" + Type.store[this.argTypes[i]].type + "]");
				continue outerLoop;
			}
		}
		args.push(Type.store[this.argTypes[i]].toString(donotrecurse.slice(0)));
	}

	// return type
	var ret;
	var safe = true;
	for (j=0; j<donotrecurse.length; j++) {
		if (donotrecurse[j] === this.returnType) {
			ret = "[" + Type.store[this.returnType].type + "]";
			safe = false;
			break;
		}
	}
	if (safe) ret = Type.store[this.returnType].toString(donotrecurse);

	return "fn(" + args.join(", ") + " -> " + ret + ")";
};


function Substitution(from, to) {
	this.from = from;
	this.to = to;
}
// shortcut method
Substitution.prototype.apply = function(element) {
	element.applySubstitution(this);
};


function Constraint(leftType, rightType) {
	this.type1 = leftType;
	this.type2 = rightType;
	
	this.regenDesc();
}
Constraint.prototype.check = function() {
	var type1 = Type.store[this.type1];
	var type2 = Type.store[this.type2];

	// NB Since all types are created fresh, we only get this far if both types are concrete
	if (type2.type !== type1.type) return false;
	
	if (type1.type === "object") {

		// check inclusion in both directions
		// NB: Not recursive (ok because we recurse in caller)
		for (var i in type1.memberTypes) {
			if (type2.memberTypes[i] === undefined) return false;
		}
		for (var j in type2.memberTypes) {
			if (type1.memberTypes[j] === undefined) return false;
		}
		return true;
	} else if (type1.type === "function") {

		// check arity
		return type1.argTypes.length === type2.argTypes.length;
	} else {
		// these are primitive types so they're fine
		return true;
	}
};
Constraint.prototype.getSubConstraints = function() {

	var type1 = Type.store[this.type1];
	var type2 = Type.store[this.type2];
	
	// NB: We know by now that type1 and type2 have identical structure

	var newConstraints = [];
	if (type1.type === "object")	{

		for (var label in type1.memberTypes) {
			newConstraints.push(new this.constructor(type1.memberTypes[label], type2.memberTypes[label]));
		}

		return newConstraints;	
	} else if (type1.type === "function") {

		// generate new constraints asserting that the arguments and
		// return type of type1 and of type2 have the same type
		for (var i=0; i<type1.argTypes.length; i++) {
			newConstraints.push(new Constraint(type1.argTypes[i], type2.argTypes[i]));
		}
		newConstraints.push(new Constraint(type1.returnType, type2.returnType));
		return newConstraints;	
		
	} else {
		return newConstraints;	
	}
};
Constraint.prototype.regenDesc = function() {
	this.description = Type.store[this.type1].toString() + " = " + Type.store[this.type2].toString();
};
Constraint.prototype.applySubstitution = function(sub) {
	if (this.type1 === sub.from) this.type1 = sub.to;
	if (this.type2 === sub.from) this.type2 = sub.to;
	Type.store[this.type1].applySubstitution(sub);
	Type.store[this.type2].applySubstitution(sub);
	this.regenDesc();
};

Constraint.compare = function(a, b) {
	var score = function(c) {
		// A LEqConstraint between any types other than object are effectively just constraints
		if (c instanceof LEqCheckConstraint && (Type.store[c.type1].type === "object" || Type.store[c.type2].type === "object")) {
			return 4;
		} else if (c instanceof LEqConstraint && (Type.store[c.type1].type === "object" || Type.store[c.type2].type === "object")) {
			return 3;
		} else if (c instanceof LEqCheckConstraint) {
			return 2;
		} else if (c instanceof LEqConstraint) {
			return 1;
		} else {
			return 0;
		}
	};

	a.regenDesc();
	b.regenDesc();
	return score(a) - score(b);
};

function LEqConstraint(smallType, bigType) {
	Constraint.call(this, smallType, bigType);
}
tmp = function() {};
tmp.prototype = Constraint.prototype;
LEqConstraint.prototype = new tmp();
LEqConstraint.prototype.constructor = LEqConstraint;

// NB should only be called for two concrete object types
LEqConstraint.prototype.enforce = function() {
	// we can add smallType's properties to bigType to satisfy the constraint
	for (var l in Type.store[this.type1].memberTypes) {
		if (Type.store[this.type2].memberTypes[l] === undefined) {

			// TODO: Can I avoid generating fresh types during solution?
			var T = TypeEnv.getFreshType();
			Type.store[this.type2].memberTypes[l] = T.id;
		}
	}
	this.regenDesc();
};
LEqConstraint.prototype.checkStructure = function() {
	var type1 = Type.store[this.type1];
	var type2 = Type.store[this.type2];
	// NB This only differs from Constraint for objects
	if (type1.type !== type2.type) return false;
	if (type1.type === "object") {
		// only check that everything in smallType (type1) is included in bigType (type2)
		// NB Still not recursive 
		for (var i in type1.memberTypes) {
			if (type2.memberTypes[i] === undefined) return false;
		}
	} else if (type1.type === "function") {

		// check arity
		return type1.argTypes.length === type2.argTypes.length;
	}
	return true;
};
LEqConstraint.prototype.check = function() {
	// if rightType has a field missing, we add it here. Adding these
	// will make the equals check below return true, and then
	// constraints will be generated to assert that each of rightType's
	// members are the same type as leftType's members
	// we only want to enforce for concrete types
	if (Type.store[this.type1].type === "object" && Type.store[this.type2].type === "object") {
		this.enforce();
		
	}
	return this.checkStructure();
};
LEqConstraint.prototype.regenDesc = function() {
	this.desc = Type.store[this.type1].toString() + " <= " + Type.store[this.type2].toString();
};




function LEqCheckConstraint(smallType, bigType) {
	LEqConstraint.call(this, smallType, bigType);
}
tmp = function() {};
tmp.prototype = LEqConstraint.prototype;
LEqCheckConstraint.prototype = new tmp();
LEqCheckConstraint.prototype.constructor = LEqCheckConstraint;
LEqCheckConstraint.prototype.check = function() {
	// NB No enforce
	return this.checkStructure();
};
LEqCheckConstraint.prototype.regenDesc = function() {
	this.desc = Type.store[this.type1].toString() + " <=c " + Type.store[this.type2].toString();
};






function TypeEnvEntry(varName, node, type) {
	this.name = varName;
	this.node = node;
	this.type = type;
}
TypeEnvEntry.prototype.applySubstitution = function(sub) {
	if (sub.from === this.type) {
		this.type = sub.to;
	}
	Type.store[this.type].applySubstitution(sub);
};
TypeEnvEntry.prototype.toString = function() {
	return this.name + ": " + Type.store[this.type].toString();
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
			return Type.store[this[i].type];
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
			gamma.push(new TypeEnvEntry(name, null, T.id));
		}
	}

	return new Judgement(null, [], gamma);
};