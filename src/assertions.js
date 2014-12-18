/* This module generates AST nodes representing run-time checks for 
	a given expression node, and a given target type */

var UglifyJS = require("uglify-js2");

// TODO: Assign parents to everything in here
UglifyJS.AST_SymbolRef.prototype.getTypeChecks = function(type) {
	// TODO: Could probably generate nothing...
	if (!type.isConcrete) return [];
	return [new UglifyJS.AST_If({
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
	})];
};

UglifyJS.AST_Assign.prototype.getTypeChecks = function(type) {
	// to ascertain the value of an assignment, just check the RHS type
	return this.right.getTypeChecks(type);	
};

UglifyJS.AST_Binary.prototype.getTypeChecks = function(type) {
	switch (this.operator) {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators
		// arithmetic (should both be number)
		case ("+"):
		case ("-"):
		case ("*"):
		case ("/"):
		case ("%"):
		// numeric comparison (should both be number)
		case ("<"):
		case (">"):
		case ("<="):
		case (">="):
		// misc comparison (should both be equal of any type)
		case ("=="):
		case ("==="):
		case ("!="):
		case ("!=="):
			// for these operators, we need to assert both left and right 
			// have the desired type
			return this.right.getTypeChecks(type).concat(this.left.getTypeChecks(type));
		default:
			throw new Error("Not yet implemented!");
	}
};

UglifyJS.AST_Node.prototype.getTypeChecks = function() {
	throw new Error("Unhandled Expression type ");
};