/*jshint unused:true, bitwise:true, eqeqeq:true, undef:true, latedef:true, eqnull:true */
/* global module */

var Substitution = function(from, to) {
	this.from = {
		type       : from.type,
		isConcrete : from.isConcrete,
		isDynamic  : from.isDynamic
	};
	this.to = {
		type       : to.type,
		isConcrete : to.isConcrete,
		isDynamic  : to.isDynamic
	};
};

var Judgement = function(type, gamma, defVars, constraints, assertions) {
	this.T           = type;
	this.gamma       = gamma;
	this.X           = defVars;
	this.C           = constraints;
	this.assertions  = assertions || [];
};

var Constraint = function (type1, type2) {
	this.left        = type1;
	this.right       = type2;
	this.description = type1.type + " must be " + type2.type;
};

var Type = function(type, options) {
	options          = options || {};

	this.type        = type;
	this.isConcrete  = (options.concrete === true);
};

var TypeEnvEntry = function(varName, program_point, type) {
	this.name          = varName;
	this.program_point = program_point;
	this.type          = type;
};

module.exports = {
	Substitution : Substitution,
	Judgement    : Judgement,
	Constraint   : Constraint,
	Type         : Type,
	TypeEnvEntry : TypeEnvEntry
};