/*jshint unused:true, bitwise:true, eqeqeq:true, undef:true, latedef:true, eqnull:true */
/* global module */

function Substitution(from, to) {
	this.from = {
		type       : from.type,
		isConcrete : from.isConcrete,
		isDynamic  : from.isDynamic
	};
	this.to = {
		type       : to.type,
		isConcrete : to.isConcrete,
	};
}
// shortcut method
Substitution.prototype.apply = function(element) {
	element.applySubstitution(this);
};




// TODO: Do we actually need a TypeEnv class rather than a plain array?
// Currently the only benefit is a few shortcut methods
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
TypeEnv.prototype.getFreshType = function() {
	return new Type("T" + (this.nextType++));
};
TypeEnv.prototype.applySubstitution = function(sub) {
	for (var i = 0; i<this.length; i++) {
		this[i].applySubstitution(sub);
	}
};



function Judgement(type, gamma, defVars, constraints) {
	this.T           = type;
	this.gamma       = gamma;
	this.X           = defVars || [];
	this.C           = constraints || [];
	this.nodes       = [];
}
Judgement.InitFromDirective = function(directive) {
	var gamma = new TypeEnv();

	directive = directive.trim();
	var importKeyword = "import ";
	if (directive.search(importKeyword) === 0) {
		directive = directive.substr(importKeyword.length);

		var imported = directive.split(/,\s*/);

		for (var i = 0; i<imported.length; i++) {
			var name = imported[i].trim();
			if (name.length === 0)
				continue;

			// select a fresh type for this imported variable
			var T = gamma.getFreshType();

			// TODO: replace "null" with an actual program point
			gamma.push( new TypeEnvEntry(name, null, T) );
		}
	}

	return new Judgement(null, gamma, [], []);
};



function Constraint(type1, type2) {
	this.left        = type1;
	this.right       = type2;
	this.description = type1.type + " must be " + type2.type;
}
Constraint.prototype.applySubstitution = function(sub) {
	this.left.applySubstitution(sub);
	this.right.applySubstitution(sub);
};




function Type(type, options) {
	options          = options || {};

	this.type        = type;
	this.isConcrete  = (options.concrete === true);
}
Type.prototype.applySubstitution = function(sub) {
	if (sub.from.type === this.type) {
		this.type = sub.to.type;
		this.isConcrete = sub.to.isConcrete;
	}
};




function TypeEnvEntry(varName, program_point, type) {
	this.name          = varName;
	// TODO: what is a program point?
	this.program_point = program_point;
	this.type          = type;
}
TypeEnvEntry.prototype.applySubstitution = function(sub) {
	this.type.applySubstitution(sub);
};



function TypeError() {

}
TypeError.prototype = new Error();

module.exports = {
	Substitution : Substitution,
	Judgement    : Judgement,
	Constraint   : Constraint,
	Type         : Type,
	TypeEnv      : TypeEnv,
	TypeEnvEntry : TypeEnvEntry,
};