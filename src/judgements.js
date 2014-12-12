/*jshint unused:true, bitwise:true, eqeqeq:true, undef:true, latedef:true, eqnull:true */
/* global module, require */

/* This module generates judgements according to the logic set out in the
	formal specification. Ideally it should be as close to the induction
	rules as possible */

var Classes = require("./classes.js");

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

function checkLiteral(judgement, node) {
	var type;
	// TODO: is this a useful switch? Probably not, just assign...
	switch (typeof(node.value)) {
		case "number":
			type = "number";
			break;
		case "boolean":
			type = "boolean";
			break;
		case "string":
			type = "string";
			break;
		case "undefined":
			type = "undefined";
			break;
		case "null":
			type = "null";
			break;
		default:
			throw new Error("Unhandled literal type " + typeof(node.value) + " (value = " + node.value + ")");
	}

	var T = new Classes.Type(type, {
		concrete: true
	});
	var j = new Classes.Judgement(T, judgement.gamma, [], []);
	j.nodes.push(node);
	return j;
}

function checkIdentifier(judgement, node) {
	var T, X = [],
		C = [],
		gamma = judgement.gamma;

	T = gamma.get(node.name);

	if (T === null) {
		// need to select a new type
		T = gamma.getFreshType();
		X.push(T);
		gamma.push(new Classes.TypeEnvEntry(node.name, node, T));
	}

	var j = new Classes.Judgement(T, gamma, X, C);
	j.nodes.push(node);
	return j;
}

function checkAssignmentExpression(judgement, node) {
	switch (node.operator) {
		case ("="):
			node.left.statementNum = node.statementNum;
			node.right.statementNum = node.statementNum;
			var j2 = checkExpression(judgement, node.right);
			var j1 = checkIdentifier(judgement, node.left);
			var X = j1.X.concat(j2.X);
			var C = j1.C.concat(j2.C.concat([new Classes.Constraint(j1.T, node.left, j2.T, node.right, node.statementNum)]));
			var j = new Classes.Judgement(j2.T, judgement.gamma, X, C);
			j.nodes.push(node);
			return j;
		default:
			throw new Error("Unhandled assignment operator " + node.operator);
	}
}

function checkExpression(judgement, node) {
	switch (node.type) {
		case ("AssignmentExpression"):
			return checkAssignmentExpression(judgement, node);
		case ("Identifier"):
			return checkIdentifier(judgement, node);
		case ("Literal"):
			return checkLiteral(judgement, node);
		default:
			throw new Error("Unhandled Expression type " + node.type);
	}
}


/***********************************************************************************
 * Creating typability judgements 
 ***********************************************************************************/


function checkEmptyStatement(judgement, node) {
	var j = new Classes.Judgement(null, judgement.gamma, [], []);
	j.nodes.push(node);
	return j;
}

function checkVariableDeclarator(judgement, node) {
	var X = [],
		C = [];
	// need to select a new type (we are redefining the type from here on)
	var T = judgement.gamma.getFreshType();

	if (node.init) {
		// TODO: the type system defines this in terms of separate var + assignment, which doesn't mirror the AST format.
		// I'm getting round this by constructing an artificial assignment node. Problem?
		node.init.statementNum = node.statementNum;
		var j1 = checkExpression(judgement, node.init);
		if (j1 !== null) {
			X = j1.X.concat([T]);
			C = j1.C.concat([new Classes.Constraint(T, node.id, j1.T, node.init, node.statementNum)]);
		}
	}

	judgement.gamma.push(new Classes.TypeEnvEntry(node.id.name, node.id, T));
	var j = new Classes.Judgement(null, judgement.gamma, X, C);
	j.nodes.push(node);
	return j;
}

function checkVariableDeclaration(judgement, node) {

	// VariableDeclaration.declarations is a list of VariableDeclarators
	var X = [],
		C = [];
	for (var i=0; i<node.declarations.length; i++) {

		node.declarations[i].statementNum = node.statementNum;
		var j1 = checkVariableDeclarator(judgement, node.declarations[i]);

		// Pass on judgement to subsequent declarators
		// TODO: assert X1 n X2 is empty
		X = X.concat(j1.X);
		C = C.concat(j1.C);
		judgement.gamma = j1.gamma;
	}

	var j = new Classes.Judgement(null, judgement.gamma, X, C);
	j.nodes.push(node);
	return j;
}

function checkStatement(judgement, node) {
	switch (node.type) {
		case "EmptyStatement":
			return checkEmptyStatement(judgement, node);
		case "ExpressionStatement":
			node.expression.statementNum = node.statementNum;
			return checkExpression(judgement, node.expression);
		case "VariableDeclaration":
			// TODO: Check if this is the best way of handling this: VariableDeclaration <: Declaration <: Statement
			return checkVariableDeclaration(judgement, node);
		default:
			if (judgement != null)
				throw new Error("Unhandled statement type " + node.type);
	}
}

function checkProgram(node) {

	// we will only store judgements for the typed sections of program
	var judgements = [];

	// I only consider this level when looking for annotations (is this limiting?)
	var directives = getAnnotations(node.leadingComments);
	var currentlyTyping = false;

	for (var i = 0; i < node.body.length; i++) {
		// get any new directives for this statement
		directives = directives.concat(getAnnotations(node.body[i].leadingComments));

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
			judgement.nodes.push(node.body[i]);

			// TODO: This is broken, see jstyper.js line 50
			node.body[i].statementNum = i;

			// carry the new judgement into the next statement
			var newJudgement = checkStatement(judgement, node.body[i]);
			judgement.gamma = newJudgement.gamma;
			judgement.X = judgement.X.concat(newJudgement.X);
			judgement.C = judgement.C.concat(newJudgement.C);
		}

		// reset directives for the next statement
		directives = getAnnotations(node.body[i].trailingComments);
	}

	return judgements;
}

module.exports = {
	checkProgram: checkProgram,
	checkEmptyStatement: checkEmptyStatement,
	checkStatement: checkStatement,
	checkVariableDeclarator: checkVariableDeclarator,
	checkVariableDeclaration: checkVariableDeclaration,
	
	checkExpression: checkExpression,
	checkIdentifier: checkIdentifier,
	checkAssignmentExpression: checkAssignmentExpression,
	checkLiteral: checkLiteral,
};