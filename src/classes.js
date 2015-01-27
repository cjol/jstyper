/*
	This module contains a bunch of classes representing structures in our program.
	Some of the classes (those without prototype stuff) could almost be done away
	with if we had a reasonable type checker... 
*/

module.exports = {
	Type: Type,
	Substitution: Substitution,
	Constraint: Constraint,
	LEqConstraint: LEqConstraint,
	TypeEnvEntry: TypeEnvEntry,
	TypeEnv: TypeEnv,
	Judgement: Judgement,
};

function Type(type, options, node) {
	options = options || {};

	this.type = type;
	this.isConcrete = (options.concrete === true);
	this.isDynamic = (options.dynamic === true);
	if (this.type === "object") {
		this.memberTypes = {};

		// Not sure it's strictly necessary to copy one by one but there we go
		for (var i in options.members) {
			this.memberTypes[i] = options.members[i];
		}
	} else if (this.type === "function") {
		this.argTypes = [];

		// It's probably not necessary to copy one-by-one EVERYWHERE...
		for (var j in options.argTypes) {
			this.argTypes[j] = options.argTypes[j];
		}
		this.returnType = options.returnType;
	}

	if (node !== undefined) this.node = node;
}

Type.prototype.applySubstitution = function(sub) {

	if (sub.from.type === this.type) {
		this.type = sub.to.type;
		this.isConcrete = sub.to.isConcrete;

		if (this.type === "object") {
			this.memberTypes = {};

			// It's probably not necessary to copy one-by-one EVERYWHERE...
			for (var i in sub.to.memberTypes) {
				this.memberTypes[i] = sub.to.memberTypes[i];
			}
		} else if (this.type === "function") {
			this.argTypes = [];

			// It's probably not necessary to copy one-by-one EVERYWHERE...
			for (var j in sub.to.argTypes) {
				this.argTypes[j] = sub.to.argTypes[j];
			}
			this.returnType = sub.to.returnType;

		}
	}

	// need to apply substitution to child types too if they exist
	if (this.type === "object") {
		for (var k in this.memberTypes) {
			this.memberTypes[k].applySubstitution(sub);
		}
	} else if (this.type === "function") {
		for (var l in this.argTypes) {
			this.argTypes[l].applySubstitution(sub);
		}
		this.returnType.applySubstitution(sub);
	}
};

// TODO: Rename this - we're only here checking "structure", not actual (sub)types
Type.prototype.equals = function(type) {
	if (this.type !== type.type) return false;
	
	if (this.type === "object") {

		// return true;

		// Deliberately only check that 'type' has at least the same fields as this
		for (var i in this.memberTypes) {
			if (type.memberTypes[i] === undefined) return false;
		}
	} else if (this.type === "function") {

		// check arity
		// TODO: can we have "extra" structure here (e.g. unused arguments?)
		return type.argTypes.length === this.argTypes.length;
	}
	
	return true;
};

Type.prototype.toString = function() {
	if (this.type === "object") {
		var types = [];
		for (var lab in this.memberTypes) {
			types.push(lab + ":" + this.memberTypes[lab].toString());
		}
		
		return "{" + types.join(", ") + "}";
	} else if (this.type === "function") {
		var args = [];
		for (var i = 0; i<this.argTypes.length; i++) {
			args.push(this.argTypes[i].toString());
		}
		return "fn(" + args.join(", ") + " -> " + this.returnType.toString() + ")";
	} else {
		return this.type;
	}
};




function Substitution(from, to) {
	this.from = {
		type: from.type,
		// isConcrete will always be false (we only substitute non-concrete types)
		// isConcrete: from.isConcrete,
		// I don't think we care if the from type was dynamic or not
		// isDynamic: from.isDynamic
	};
	this.to = {
		type: to.type,
		isConcrete: to.isConcrete
	};
	if (to.type === "object") {
		this.to.memberTypes = {};

		// Again not sure it's strictly necessary to copy one by one 
		for (var i in to.memberTypes) {
			this.to.memberTypes[i] = to.memberTypes[i];
		}
	} else if (to.type === "function") {
		this.to.argTypes = [];

		// It's probably not necessary to copy one-by-one EVERYWHERE...
		for (var j in to.argTypes) {
			this.to.argTypes[j] = to.argTypes[j];
		}
		this.to.returnType = to.returnType;

	}
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
			if (this.type1.memberTypes[i] === undefined) return false;
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
	this.description = this.type1.toString() + " must be " + this.type2.toString();
};
Constraint.prototype.applySubstitution = function(sub) {
	this.type1.applySubstitution(sub);
	this.type2.applySubstitution(sub);
	this.regenDesc();
};
function LEqConstraint(smallType, bigType, checkNode) {
	Constraint.call(this, smallType, bigType, checkNode);
}
var tmp = function() {};
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
	this.desc = this.type2.toString() + " must have more structure than " + this.type1.toString();
};

// LEqConstraint.prototype.getSubConstraints = function() {
	
// 	// NB: We know that type1 is included in type2

// 	var newConstraints = [];
// 	if (this.type1.type === "object")	{

// 		for (var label in this.type1.memberTypes) {
// 			newConstraints.push(new LEqConstraint(this.type1.memberTypes[label], this.type2.memberTypes[label], null));
// 		}

// 		return newConstraints;	
// 	}
// 	return newConstraints;	
// };



function TypeEnvEntry(varName, node, type) {
	this.name = varName;
	this.node = node;
	this.type = type;
}
TypeEnvEntry.prototype.applySubstitution = function(sub) {
	this.type.applySubstitution(sub);
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
	// TODO: does this model scope suitably?
	// search backwards through entries to find the most recent defn
	for (var i = this.length - 1; i >= 0; i--) {
		if (this[i].name === varName) {
			return this[i].type;
		}
	}
	return null;
};
TypeEnv.getFreshType = function(opts, node) {
	return new Type("T" + (TypeEnv.nextType++), opts, node);
};
TypeEnv.prototype.getFreshType = TypeEnv.getFreshType;
TypeEnv.prototype.applySubstitution = function(sub) {
	for (var i = 0; i < this.length; i++) {
		this[i].applySubstitution(sub);
	}
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