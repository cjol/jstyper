/*
	This module contains a bunch of classes representing structures in our program.
	Some of the classes (those without prototype stuff) could almost be done away
	with if we had a reasonable type checker... 
*/

function Type(type, options) {
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
	}
}

Type.prototype.applySubstitution = function(sub) {
	// NB I don't think this will ever be called for a dynamic type

	if (sub.from.type === this.type) {
		this.type = sub.to.type;
		this.isConcrete = sub.to.isConcrete;

		if (this.type === "object") {
			this.memberTypes = {};

			// It's probably not necessary to copy one-by-one EVERYWHERE...
			for (var i in sub.to.memberTypes) {
				this.memberTypes[i] = sub.to.memberTypes[i];
			}
		}
	}

	// need to apply substitution to child types too if they exist
	if (this.type === "object") {
		for (var j in this.memberTypes) {
			this.memberTypes[j].applySubstitution(sub);
		}
	}
};

Type.prototype.equals = function(type) {
	if (this.type !== type.type) return false;
	
	if (this.type !== "object") return true;

	// Deliberately only check that type has at least the same fields as this
	for (var i in this.memberTypes) {
		if (type.memberTypes[i] === undefined) return false;
	}
	
	return true;
};

Type.prototype.toString = function() {
	if (this.type !== "object") return this.type;
	var types = [];
	for (var lab in this.memberTypes) {
		types.push(lab + ":" + this.memberTypes[lab].toString());
	}
	
	return "{" + types.join(", ") + "}";
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
	}
}
// shortcut method
Substitution.prototype.apply = function(element) {
	element.applySubstitution(this);
};





function Constraint(writeType, readType, readNode) {
	this.writeType = writeType;
	this.readType = readType;
	
	this.readNode = readNode;

	this.description = writeType.type + " must be " + readType.type;
}
Constraint.prototype.applySubstitution = function(sub) {
	this.writeType.applySubstitution(sub);
	this.readType.applySubstitution(sub);
};





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
TypeEnv.prototype.getFreshType = function(opts) {
	return new Type("T" + (TypeEnv.nextType++), opts);
};
TypeEnv.prototype.applySubstitution = function(sub) {
	for (var i = 0; i < this.length; i++) {
		this[i].applySubstitution(sub);
	}
};




function Judgement(type, gamma, defVars, constraints) {
	this.T = type;
	this.gamma = gamma;
	this.X = defVars || [];
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

	return new Judgement(null, gamma, [], []);
};





// // debugger aids, toString getters:
// Object.defineProperty(Type.prototype, "toString", {
// 	get: function() {
// 		return this.type + (this.isDynamic?"?":"");
// 	}
// });





module.exports = {
	Substitution: Substitution,
	Judgement: Judgement,
	Constraint: Constraint,
	Type: Type,
	TypeEnv: TypeEnv,
	TypeEnvEntry: TypeEnvEntry,
};