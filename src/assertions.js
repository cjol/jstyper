/* This module generates AST nodes representing run-time checks for 
	a given expression node, and a given target type */

var UglifyJS = require("uglify-js2");

// TODO: Assign parents to everything in here
UglifyJS.AST_SymbolRef.prototype.getTypeCheck = function(type) {
	// TODO: Could probably generate nothing...
	if (!type.isConcrete) return;
	return new UglifyJS.AST_If({
		condition: new UglifyJS.AST_Binary({
			left: new UglifyJS.AST_UnaryPrefix({
				operator: 'typeof',
				expression: new UglifyJS.AST_SymbolRef({
					name: this.name
				})
			}),
			operator: '!==',
			right: new UglifyJS.AST_String({
				value: type.type
			})
		}),
		body: new UglifyJS.AST_BlockStatement({
			body: [
				new UglifyJS.AST_Throw({
					value: new UglifyJS.AST_New({
						expression: new UglifyJS.AST_SymbolRef({
							name: 'Error'
						}),
						args: [
							new UglifyJS.AST_String({
								value: this.name + ' should have type ' + type.type
							})
						]
					})
				})
			]
		})
	});
};

function assertIdentifier(expression, type) {
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

UglifyJS.AST_Assign.prototype.getTypeCheck = function(type) {
	// to ascertain the value of an assignment, just check the RHS type
	return this.right.getTypeCheck(type);	
};

UglifyJS.AST_Node.prototype.getTypeCheck = function() {
	throw new Error("Unhandled Expression type ");
};