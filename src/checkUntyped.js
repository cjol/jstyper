/* 	

	node.checkUntyped should be called when in the UNTYPED world. It will
 	return an array of judgements generated for each typed chunk within it.

    If checkUntyped is called on a node, it's because we're not in the typed
	world right now. If that's the case, then we don't have to do anything fancy
	with the current node - just recursively check any possible subnodes (in case
	there's a chunk hiding there which should be type).

*/

var Classes = require("./classes.js");
var UglifyJS = require("uglify-js2");

UglifyJS.AST_Node.prototype.checkUntyped = function() {
	return [];
};
UglifyJS.AST_Node.prototype.parent = function() {
	throw new Error("Parent has not been defined yet!");
};

function parent(par) {
	return function() { return par; };
}

/***********************************************************************************
 * helper functions - could be refactored somewhere else if there were any more
 ***********************************************************************************/

function getAnnotations(comments) {
	var annotations = [];
	
	if (comments === undefined || comments === null)
		return annotations;

	var keyword = " jstyper ";
	var toRemove = [];
	for (var i = 0; i < comments.length; i++) {
		if (comments[i].value.search(keyword) === 0) {
			var directive = comments[i].value.substr(keyword.length);
			annotations.push(directive);

			// remove the annotation from the AST
			toRemove.push(i);
		}
	}
	for (var j=0; j<toRemove.length; j++) {
		comments.splice(toRemove[j], 1);
	}
	return annotations;
}

function initFromDirectives(node, judgements, currentlyTyping, dynamics) {

	// get any new directives for this statement
	var directives = getAnnotations(node.start.comments_before);
	var keywords = {
		import: "import ",
		start: "start",
		end: "end"
	};

	// determine if we should be type-checking the next chunk or not
	for (var j = 0; j < directives.length; j++) {
		var directive = directives[j];
		if (directive.search(keywords.start) === 0) {

			if (currentlyTyping)
				throw new Error("Unexpected start directive");
			currentlyTyping = true;
			dynamics = [];

			// initialise a new judgement with imported variables
			judgements.push(Classes.Judgement.InitEmpty());

		} else if (directive.search(keywords.end) === 0) {

			if (!currentlyTyping)
				throw new Error("Unexpected end directive");
			currentlyTyping = false;

		} else if (directive.search(keywords.import) === 0) {
			directive = directive.substr(keywords.import.length);

			var imported = directive.split(/,\s*/);

			for (var i = 0; i < imported.length; i++) {
				var name = imported[i].trim();
				if (name.length === 0)
					continue;
				dynamics.push(name);
			}
		} else {
			throw new Error("Unexpected directive " + directives[j]);
		}
	}

	return {
		currentlyTyping: currentlyTyping,
		dynamics: dynamics
	};
}

// seq takes an array of statements, and iterates through finding judgements in subnodes
function seq(statements, par) {
	var judgements = [];
	var currentlyTyping = false;
	var dynamics = [];

	for (var i=0; i<statements.length; i++){
		var r = initFromDirectives(statements[i], judgements, currentlyTyping, dynamics);
		currentlyTyping = r.currentlyTyping;
		dynamics = r.dynamics;

		statements[i].parent = parent(par);
		if (!currentlyTyping) {
			
			// even if we're not typing here, we may receive judgement from inner chunks
			judgements = judgements.concat(statements[i].checkUntyped());

		} else {

			// the next judgement is based on the current judgement
			var judgement = judgements[judgements.length - 1];
			judgement.nodes.push(statements[i]);
			var newJudgement = statements[i].check(judgement.gamma, dynamics);
			
			// carry the new judgement into the next statement
			judgement.gamma = newJudgement.gamma;
			judgement.C = judgement.C.concat(newJudgement.C);
			judgement.W = judgement.W.concat(newJudgement.W);
		}
	}

	return judgements;
}

UglifyJS.AST_Block.prototype.checkUntyped = function() {
	var judgements = seq(this.body, this);

	// Implementation detail: Attach gamma to new scopes so we can retrieve
	// them when annotating/gradual typing
	if (this instanceof UglifyJS.AST_Scope) {
		// TODO: this assumes at most a single chunk
		if (judgements.length > 0)
			this.gamma = judgements[0].gamma;
	}

	return judgements;
};

UglifyJS.AST_If.prototype.checkUntyped = function() {
	// body is a single statement (but it could be a Block statement)
	var judgements = this.body.checkUntyped();
	if (this.alternative !== undefined && this.alternative !== null)
		judgements = judgements.concat(this.alternative.checkUntyped());
	return judgements;
};

UglifyJS.AST_Constant.prototype.checkUntyped = function() {
	return [];
};

UglifyJS.AST_SymbolRef.prototype.checkUntyped = function() {
	return [];
};

UglifyJS.AST_Unary.prototype.checkUntyped = function() {

	this.expression.parent = parent(this);
	return this.expression.checkUntyped();
};

// AST_Assign inherits
UglifyJS.AST_Binary.prototype.checkUntyped = function() {
	this.left.parent = parent(this);
	this.right.parent = parent(this);

	var judgements = this.left.checkUntyped();
	judgements = judgements.concat(this.right.checkUntyped());
	return judgements;
};

UglifyJS.AST_SimpleStatement.prototype.checkUntyped = function() {
	this.body.parent = parent(this);
	return this.body.checkUntyped();
};

UglifyJS.AST_EmptyStatement.prototype.checkUntyped = function() {
	return [];
};

UglifyJS.AST_VarDef.prototype.checkUntyped = function() {
	var judgements = [];

	this.name.parent = parent(this);
	if (this.value !== undefined && this.value !== null) {
		this.value.parent = parent(this);
		judgements = judgements.concat(this.value.checkUntyped());
	}

	return judgements;
};

UglifyJS.AST_Var.prototype.checkUntyped = function() {

	var judgements = [];
	for (var i=0; i<this.definitions.length; i++) {
		this.definitions[i].parent = parent(this);
		judgements = judgements.concat(this.definitions[i].checkUntyped());
	}
	return judgements;
};