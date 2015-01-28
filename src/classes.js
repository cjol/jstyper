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


Type.id = 0;
function Type(type, options, node) {
	options = options || {};


	this.type = type;
	this.isConcrete = (options.concrete === true);
	this.isDynamic = (options.dynamic === true);
	this.id = Type.id++;
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

Type.prototype.applySubstitution = function(sub, donotrecurse) {

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
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this);

	// need to apply substitution to child types too if they exist
	if (this.type === "object") {
		memberloop: for (var k in this.memberTypes) {
			// TODO: is this actually sound?
			// we don't want to infinitely recurse - if we've already substituted this type somewhere, don't do it again
			for (var m =0; m<donotrecurse.length; m++) {
				if (this.memberTypes[k].id === donotrecurse[m].id) continue memberloop;
			}
			// nb I don't want subcalls to modify my donotrecurse so I'm cloning with slice(0)
			this.memberTypes[k].applySubstitution(sub, donotrecurse.slice(0));
		}
	} else if (this.type === "function") {

		argloop: for (var l in this.argTypes) {
		
			// TODO: is this actually sound?
			// we don't want to infinitely recurse - if we've already substituted this type somewhere, don't do it again
			for (var n =0; n<donotrecurse.length; n++) {
				if (this.argTypes[l].id === donotrecurse[n].id) continue argloop;
			}
			// nb I don't want subcalls to modify my donotrecurse so I'm cloning with slice(0)
			this.argTypes[l].applySubstitution(sub, donotrecurse.slice(0));
		}
		// TODO: is this actually sound?
		// we don't want to infinitely recurse - if we've already substituted this type somewhere, don't do it again
		for (var o =0; o<donotrecurse.length; o++) {
			if (this.returnType.id === donotrecurse[o].id) return;
		}
		// nb I don't want subcalls to modify my donotrecurse so I'm cloning with slice(0)
		this.returnType.applySubstitution(sub, donotrecurse.slice(0));
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

Type.prototype.toString = function(donotrecurse) {
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this);
	if (this.type === "object") {
		var types = [];
		memberloop: for (var lab in this.memberTypes) {
			for (var i=0; i<donotrecurse.length; i++) {
				if (donotrecurse[i].id === this.memberTypes[lab].id) {
					types.push(lab + ": ... ");
					continue memberloop;
				}
			}
			types.push(lab + ":" + this.memberTypes[lab].toString(donotrecurse));
		}
		
		return "{" + types.join(", ") + "}";
	} else if (this.type === "function") {
		var args = [];
		argloop: for (var j = 0; j<this.argTypes.length; j++) {
			
			for (var k=0; k<donotrecurse.length; k++) {
				if (donotrecurse[k].id === this.argTypes[j]) {
					args.push("...");
					continue argloop;
				}
			}
			args.push(this.argTypes[j].toString(donotrecurse));
		}
		var ret;
		var safe = true;
		for (var l=0; l<donotrecurse.length; l++) {
			if (donotrecurse[l].id === this.returnType) {
				ret = "...";
				break;
			}
		}
		if (safe) ret = this.returnType.toString(donotrecurse);
		return "fn(" + args.join(", ") + " -> " + ret + ")";
	} else {
		return this.type;
	}
};




function Substitution(from, to) {
	this.from = new Type(from.type);

	//  {
	// 	type: from.type,
	// 	// isConcrete will always be false (we only substitute non-concrete types)
	// 	// isConcrete: from.isConcrete,
	// 	// I don't think we care if the from type was dynamic or not
	// 	// isDynamic: from.isDynamic
	// };
	var opts = {
		concrete: to.isConcrete
	};
	if (to.type === "object") {
		opts.members = {};

		// Again not sure it's strictly necessary to copy one by one 
		for (var i in to.memberTypes) {
			opts.members[i] = to.memberTypes[i];
		}
	} else if (to.type === "function") {
		opts.argTypes = [];

		// It's probably not necessary to copy one-by-one EVERYWHERE...
		for (var j in to.argTypes) {
			opts.argTypes[j] = to.argTypes[j];
		}
		opts.returnType = to.returnType;
	}

	this.to = new Type(to.type, opts);
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
	return new Type("T" + (TypeEnv.nextType++), opts, node);
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