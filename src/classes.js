/*jshint unused:true, bitwise:true, eqeqeq:true, undef:true, latedef:true, eqnull:true */
/* global module */

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
}
Type.prototype.applySubstitution = function(sub) {
	// NB I don't think this will ever be called for a dynamic type

	if (sub.from.type === this.type) {
		this.type = sub.to.type;
		this.isConcrete = sub.to.isConcrete;
	}
};
Type.prototype.equals = function(type) {
	return (this.type === type.type);
};




function Substitution(from, to) {
	this.from = {
		type: from.type,
		isConcrete: from.isConcrete,
		isDynamic: from.isDynamic
	};
	this.to = {
		type: to.type,
		isConcrete: to.isConcrete,
	};
}
// shortcut method
Substitution.prototype.apply = function(element) {
	element.applySubstitution(this);
};





function Constraint(type1, node1, type2, node2, statementNum) {
	this.left = type1;
	this.right = type2;
	
	this.leftNode = node1;
	this.rightNode = node2;
	// TODO: this is broken, see jstyper.js ~line 50
	this.statementNum = statementNum;

	this.description = type1.type + " must be " + type2.type;
}
Constraint.prototype.applySubstitution = function(sub) {
	this.left.applySubstitution(sub);
	this.right.applySubstitution(sub);
};





function TypeEnvEntry(varName, node, type) {
	this.name = varName;
	this.node = node;
	this.type = type;
}
TypeEnvEntry.prototype.applySubstitution = function(sub) {
	this.type.applySubstitution(sub);
};





function TypeEnv() {
	this.nextType = 1;
}
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
	return new Type("T" + (this.nextType++), opts);
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