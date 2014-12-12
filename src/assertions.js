/*jshint unused:true, bitwise:true, eqeqeq:true, undef:true, latedef:true, eqnull:true */
/* global module */

/* This module generates AST nodes representing run-time checks for 
	a given expression node, and a given target type */

function getIdentifier(expression, type) {
	if (!type.isConcrete) return [];
	return [{
		"type": "IfStatement",
		"test": {
			"type": "BinaryExpression",
			"operator": "!==",
			"left": {
				"type": "UnaryExpression",
				"operator": "typeof",
				"argument": {
					"type": "Identifier",
					"name": expression.name
				},
				"prefix": true
			},
			"right": {
				"type": "Literal",
				"value": type.type
			}
		},
		"consequent": {
			"type": "BlockStatement",
			"body": [{
				"type": "ThrowStatement",
				"argument": {
					"type": "NewExpression",
					"callee": {
						"type": "Identifier",
						"name": "TypeError"
					},
					"arguments": [{
						"type": "Literal",
						"value": expression.name + " must be " + type.type + " at this point."
					}]
				}
			}]
		},
		"alternate": null
	}];
}

function getAssignment(expression, type) {
	// to ascertain the value of an assignment, just check the RHS type
	return getExpression(expression.right, type);
}

function getExpression(expression, type) {
	switch (expression.type) {
		case ("AssignmentExpression"):
			return getAssignment(expression, type);
		case ("Identifier"):
			return getIdentifier(expression, type);
		default:
			throw new Error("Unhandled Expression type " + expression.type);
	}
}

module.exports = {
	getExpression: getExpression
};