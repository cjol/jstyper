/*jshint unused:true, bitwise:true, eqeqeq:true, undef:true, latedef:true, eqnull:true */
/* global module, require */

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
UglifyJS.AST_Constant.prototype.check = function(judgement) {
	if (this.constType === undefined) throw new Error("Unhandled constant type " + this);
	var T = new Classes.Type(this.constType, {
		concrete: true
	});
	var j = new Classes.Judgement(T, judgement.gamma, [], []);
	j.nodes.push(this);
	return j;
};

UglifyJS.AST_String.prototype.constType = "string";
UglifyJS.AST_Number.prototype.constType = "number";
UglifyJS.AST_Boolean.prototype.constType = "boolean";
UglifyJS.AST_Undefined.prototype.constType = "undefined";
UglifyJS.AST_Null.prototype.constType = "null";

UglifyJS.AST_SymbolRef.prototype.check = function(judgement) {
	var T, X = [],
		C = [],
		gamma = judgement.gamma;

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

UglifyJS.AST_Assign.prototype.check = function(judgement) {
	switch(this.operator) {
		case ("="):
			this.right.parent = parent(this);
			this.left.parent = parent(this);

			var j2 = this.right.check(judgement);
			var j1 = this.left.check(judgement);
			var X = j1.X.concat(j2.X);
			var C = j1.C.concat(j2.C.concat([new Classes.Constraint(j1.T, this.left, j2.T, this.right)]));
			var j = new Classes.Judgement(j2.T, judgement.gamma, X, C);
			j.nodes.push(this);

			return j;
		default:
			throw new Error("Unhandled assignment operator " + this.operator);
	}
};

/***********************************************************************************
 * Creating typability judgements 
 ***********************************************************************************/

UglifyJS.AST_SimpleStatement.prototype.check = function(judgement) {
	this.body.parent = parent(this);
	return this.body.check(judgement);
};

UglifyJS.AST_EmptyStatement.prototype.check = function(judgement) {
	var j = new Classes.Judgement(null, judgement.gamma, [], []);
	j.nodes.push(this);
	return j;
};

UglifyJS.AST_VarDef.prototype.check = function(judgement) {
	var X = [],
		C = [];
	// need to select a new type (we are redefining the type from here on)
	var T = judgement.gamma.getFreshType();
	
	this.name.parent = parent(this);

	if (this.value) {
		// TODO: the type system defines this in terms of separate var + assignment, which doesn't mirror the AST format.
		this.value.parent = parent(this);
		var j1 = this.value.check(judgement);
		if (j1 !== null) {
			X = j1.X.concat([T]);
			C = j1.C.concat([new Classes.Constraint(T, this.name, j1.T, this.value)]);
		}

	}

	judgement.gamma.push(new Classes.TypeEnvEntry(this.name.name, this.name, T));
	var j = new Classes.Judgement(null, judgement.gamma, X, C);
	j.nodes.push(this);

	return j;
};

UglifyJS.AST_Var.prototype.check = function(judgement) {

	// VariableDeclaration.declarations is a list of VariableDeclarators
	var X = [],
		C = [];
	for (var i=0; i<this.definitions.length; i++) {

		this.definitions[i].parent = parent(this);
		var j1 = this.definitions[i].check(judgement);

		// Pass on judgement to subsequent declarators
		// TODO: assert X1 n X2 is empty
		X = X.concat(j1.X);
		C = C.concat(j1.C);
		judgement.gamma = j1.gamma;
	}

	var j = new Classes.Judgement(null, judgement.gamma, X, C);
	j.nodes.push(this);


	return j;
};

UglifyJS.AST_Toplevel.prototype.check = function() {

	// we will only store judgements for the typed sections of program
	var judgements = [];

	// I only consider this level when looking for annotations (is this limiting?)
	var directives;
	var currentlyTyping = false;

	for (var i = 0; i < this.body.length; i++) {
		// get any new directives for this statement
		directives = getAnnotations(this.body[i].start.comments_before);

		// determine if we should be type-checking the next chunk or not
		for (var j = 0; j < directives.length; j++) {
			if (directives[j].search("start") === 0) {

				if (currentlyTyping)
					throw new Error("Unexpected start directive (already in typed world at program statement " + i + ")");
				currentlyTyping = true;
				var directive = directives[j].substr("start".length);
				// initialise a new judgement with imported variables
				judgements.push(Classes.Judgement.InitFromDirective(directive));

			} else if (directives[j].search("end") === 0) {

				if (!currentlyTyping)
					throw new Error("Unexpected end directive (not in typed world at program statement " + i + ")");
				currentlyTyping = false;


			} else {
				throw new Error("Unexpected directive " + directives[j]);
			}
		}


		if (!currentlyTyping) {
			// TODO: check subexpressions for annotations

		} else {
			var judgement = judgements[judgements.length - 1];
			judgement.nodes.push(this.body[i]);

			// carry the new judgement into the next statement

			this.body[i].parent = parent(this);
			var newJudgement = this.body[i].check(judgement);
			judgement.gamma = newJudgement.gamma;
			judgement.X = judgement.X.concat(newJudgement.X);
			judgement.C = judgement.C.concat(newJudgement.C);
		}
	}

	return judgements;
};
