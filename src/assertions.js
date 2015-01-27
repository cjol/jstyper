/* This module generates AST nodes representing run-time checks for 
	a given expression node, and a given target type */

var UglifyJS = require("uglify-js2");

function primCheck(expression, name, primType) {
	// TODO: Assign parents to everything in here
	return new UglifyJS.AST_If({
		condition: new UglifyJS.AST_Binary({
			left: new UglifyJS.AST_UnaryPrefix({
				operator: 'typeof',
				expression: this // TODO: Is it dangerous to whack this straight in?
			}),
			operator: '!==',
			right: new UglifyJS.AST_String({
				value: primType
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
								value: name + ' should have type ' + primType
							})
						]
					})
				})
			]
		})
	});
}

UglifyJS.AST_SymbolRef.prototype.getTypeChecks = function(type) {
	// TODO: Could probably generate nothing...
	if (!type.isConcrete) return [];
	if (type !== "object") return [primCheck(this, this.name, type.type)];

	// need to generate more checks for each of the object member types...
	for (var label in type.memberTypes) {
		// we can't generate a check directly because the member type may
		// still be nonprimitive. Instead construct an expression and recurse

		var expression = new UglifyJS.AST_Dot({
			expression: this,
			property: label
		});

		expression.getTypeChecks(type.memberTypes[label]);
	}

	return [];
};

UglifyJS.AST_Dot.prototype.getTypeChecks = function(type) {
	if (!type.isConcrete) return [];
	if (type !== "object") return [primCheck()];
};

UglifyJS.AST_Assign.prototype.getTypeChecks = function(type) {
	// to ascertain the value of an assignment, just check the RHS type
	return this.right.getTypeChecks(type);	
};

// Might want to split this into pre/postfix?
UglifyJS.AST_Unary.prototype.getTypeChecks = function(type) {
	switch (this.operator) {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators
		// arithmetic (should be number)
		case ("++"):
		case ("--"):
		case ("-"):
		// boolean operators (should be boolean)
		case ("!"):
			// only one expression to type check
			return this.expression.getTypeChecks(type);
		default:
			throw new Error("Not yet implemented!");
	}
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
		// boolean operators (should both be boolean)
		case ("||"):
		case("&&"):
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