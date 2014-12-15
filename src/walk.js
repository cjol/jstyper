/*
	Functions to traverse the AST, modifying as necessary to
		- typecheck dynamic variables
	In future, guard and mimic wrappers will likely go here too
*/
var Classes = require("./classes.js");

function guardLiteral(assertions, node) {
	// literals won't ever need a check
	
}

function guardIdentifier(assertions, node) {

}

function guardAssignmentExpression(assertions, node) {

	switch (node.operator) {
		case ("="):
			guardIdentifier(node.left);
			guardExpression(node.right);
			break;
		default:
			throw new Error("Unhandled assignment operator " + node.operator);
	}
}

function guardExpression(assertions, node) {
	switch (node.type) {
		case ("AssignmentExpression"):
			return guardAssignmentExpression(assertions, node);
		case ("Identifier"):
			return guardIdentifier(assertions, node);
		case ("Literal"):
			return guardLiteral(assertions, node);
		default:
			throw new Error("Unhandled Expression type " + node.type);
	}

}

function guardEmptyStatement(assertions, node) {
	// empty statement doesn't need a check
}

function guardVariableDeclarator(assertions, node) {
	if (node.init) {
		guardExpression(node.init);
	}
}

function guardVariableDeclaration(assertions, node) {
	for (var i = 0; i<node.declarations.length; i++) {
		guardVariableDeclarator(assertions, node.declarations[i]);
	}
}

function guardStatement(assertions, node) {
	switch (node.type) {
		case "EmptyStatement":
			return guardEmptyStatement(assertions, node);
		case "ExpressionStatement":
			node.expression.statementNum = node.statementNum;
			return guardExpression(assertions, node.expression);
		case "VariableDeclaration":
			// TODO: Check if this is the best way of handling this: VariableDeclaration <: Declaration <: Statement
			return guardVariableDeclaration(assertions, node);
		default:
			throw new Error("Unhandled statement type " + node.type);
	}
}

function guardProgram(assertions, node) {
	for (var i = 0; i<node.body.length; i++) {
		guardStatement(assertions, node.body[i]); 
	}
}