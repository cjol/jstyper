/*
	Define node methods to insert a given statement so that it is executed
	immediately before some subnode.

	Usage example:
		For the code
			// jstyper start import z
			var x = 5;
			var y = z = true, x = z;
		We must check that z is a number immediately before "x = z". Say this is 
		represented by an AST_VarDef 'vd', and the AST_Var representing 
		"var y = z = true, x = z" node 'v'. Generate a new statement 's' 
		representing the type check. We would then do:
			v.insertBefore(s, vd);
		resulting in:
			var x = 5;
			var y = z = true;
			{{s}};
			var x = z;

		The optional 3rd parameter is a boolean - if it is true, the node 'target'
		will also be deleted from the parent. For example, in the situation above,
		we would need to delete the original node 'v' from the body and replace it
		by the two separate halves.

	Note, I'm suddenly not sure if this is required, or if it would be easier
	just to wrap everything in an IIFE without worrying about what kind of
	node it is. In some cases it wouldn't be as tidy, but I'm not sure safety
	is affected either way. Pro of IIFE-everywhere is less compiler logic. Pro
	of smart insertion is that the compiled JS is potentially faster.

*/

var UglifyJS = require("uglify-js2");

UglifyJS.AST_Node.prototype.insertBefore = function() {
	throw new Error("insertBefore not implemented yet...");			
};

UglifyJS.AST_Lambda.prototype.insertBefore = noSubchildren;
UglifyJS.AST_Constant.prototype.insertBefore = noSubchildren;

UglifyJS.AST_Object.prototype.insertBefore = function(newNode, target, del) {

	// I need to insert newNode immediately before target, which will be a
	// property. I could potentially try and put newNode at the end of the
	// previous property, but that seems messy so I'm inserting just before
	// the property value instead

	for (var i =0; i<this.properties.length; i++) {
		if (target === this.properties[i].value) {
			if (del) {
				var deleted = [this.properties[i]];
				newNode.parent = parent(this);
				transferComments(this.properties[i], newNode);
				this.properties[i] = newNode;
				return deleted;
			}
			return this.properties[i].insertBefore(newNode, target, del);
		}
	}

	throw new Error("target is not a subnode");
};
UglifyJS.AST_ObjectProperty.prototype.insertBefore = function(newNode, target, del) {
	
	// target must be this.value
	
	var deleted;
	if (!del) {
		// if I'm not replacing, there's nowhere to put newNode except in an iife
		newNode = getIIFE(newNode, this.value);
		deleted = [];
	} else {
		deleted = [this.value];
	}
	
	transferComments(this.value, newNode);
	newNode.parent = parent(this);
	this.value = newNode;
	return deleted;
};

UglifyJS.AST_SymbolRef.prototype.insertBefore = noSubchildren;

// Might want to split this into pre/postfix?
UglifyJS.AST_Unary.prototype.insertBefore = function(newNode, target, del) {
	switch (this.operator) {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_Operators
		// arithmetic (should be number)
		case ("++"):
		case ("--"):
		case ("-"):
		// boolean operators (should be boolean)
		case ("!"):

			if (del) {
				var deleted = [this.expression];
				newNode.parent = parent(this);
				transferComments(this.expression, newNode);
				this.expression = newNode;
				return deleted;
			}
			// the single expression will be next to evaluate so just insert before this statement
			return this.parent().insertBefore(newNode, this);
		default:
			throw new Error("Unhandled unary operator!");
	}
};

UglifyJS.AST_Binary.prototype.insertBefore = function(newNode, target, del) {

	// assuming left-to-right evaluation
	var deleted;
	if (target === this.left) {
		// left is evaluated first, so we can insert before this whole expression
		if (del) {
			deleted = [this.left];
			newNode.parent = parent(this);
			transferComments(this.left, newNode);
			this.left = newNode;
			return deleted;
		}
		return this.parent().insertBefore(newNode, this);
	} else if (target === this.right) {
		// wrap the RHS in an IIFE which runs newNode before returning the value of RHS

		if (del) {
			deleted = [this.right];
			newNode.parent = parent(this);
			transferComments(this.right, newNode);
			this.right = newNode;
			return deleted;
		}
		var iife = getIIFE(newNode, this.right);
		transferComments(this.right, iife);
		iife.parent = parent(this);
		this.right = iife;
		return [];
	} else {
		throw new Error("target is not a subnode");
	}
};

UglifyJS.AST_Assign.prototype.insertBefore = function(newNode, target, del) {

	if (target === this.left) {
		if (del) {
			transferComments(this.left, newNode);
			newNode.parent = parent(this);
			var deleted = [this.left];
			this.left = newNode;
			return deleted;
		}
		// wrap the value with an IIFE which runs the new node before returning the expression value
		var iife = getIIFE(newNode, this.left);
		transferComments(this.left, iife);
		iife = parent(this);
		this.left = iife;
		return [];
	} else if (target === this.right) {

		if (del) {
			transferComments(this.right, newNode);
			newNode.parent = parent(this);
			var deleted = [this.right];
			this.right = newNode;
			return deleted;
		}

		// RHS is executed first, so can safely execute before the whole assignment
		return this.parent().insertBefore(newNode, this);
	} else {
		throw new Error("target is not a subnode");
	}
};

UglifyJS.AST_If.prototype.insertBefore = function(newNode, target, del) {
	var deleted;
	if (target === this.condition) {

		if (del) {
			deleted = [this.condition];
			newNode.parent = parent(this);
			transferComments(this.condition, newNode);
			this.condition = newNode;
			return deleted;
		}
		// condition is the first code executed, so can just insert before the if
		return this.parent().insertBefore(newNode, this, del);
	}

	// body and alternative are single statements, so if we want to prepend we
	// will need to wrap the whole in a BlockStatement (or we can just replace)
	if (del) {
		deleted = [];
		if (target === this.body) {
			deleted = [{
				from:this.body,
				to: newNode
			}];
			this.body = newNode;
			transferComments(this.body, newNode);
			newNode.parent = parent(this);

		} else if (target === this.alternative) {
			deleted = [{
				from:this.alternative,
				to: newNode
			}];
			this.alternative = newNode;
			transferComments(this.alternative, newNode);
			newNode.parent = parent(this);

		} else {
			throw new Error("target is not a subnode");
		}
		return deleted;
	} else {
		var block = new UglifyJS.AST_BlockStatement({
			body: [
				newNode
			]
		});
		block.parent = parent(this);
		newNode.parent = parent(block);
		if (target === this.body) {
			block.body.push(this.body);
			this.body.parent = parent(block);
			this.body = block;
			transferComments(this.body, newNode);

		} else if (target === this.alternative) {
			block.body.push(this.alternative);
			this.alternative.parent = parent(block);
			this.alternative = block;
			transferComments(this.alternative, newNode);

		} else {
			throw new Error("target is not a subnode");
		}
		return [];
	}
};

UglifyJS.AST_SimpleStatement.prototype.insertBefore = function(newNode, target, del) {
	if (target === this.body) {
		return this.parent().insertBefore(newNode, this, del);
	} else {
		throw new Error("target is not a subnode");
	}
};

UglifyJS.AST_EmptyStatement.prototype.insertBefore = noSubchildren;

// e.g. var ___x=y+z___;
UglifyJS.AST_VarDef.prototype.insertBefore = function(newNode, target, del) {

	var deleted;
	if (target === this.name) {
		// wrap the value with an IIFE which check's the identifier's type before returning

		if (del) {
			deleted = [this.name];
			newNode.parent = parent(this);
			transferComments(this.name, newNode);
			this.name = newNode;
			return deleted;
		}
		var iife = getIIFE(newNode, this.value);
		iife.parent = parent(this); 
		transferComments(this.value, iife);
		this.value = iife;
		return [];

	} else if (target === this.value) {
		
		if (del) {
			deleted = [this.value];
			newNode.parent = parent(this);
			transferComments(this.value, newNode);
			this.value = newNode;
			return deleted;
		}

		return this.parent().insertBefore(newNode, this);
	} else {
		throw new Error("target is not a subnode");
	}
};

// e.g ___var x, y=z+1, p=true___;
UglifyJS.AST_Var.prototype.insertBefore = function(newStatement, target, del) {
	// we need to split the list of vardefs into two, and insert in between them
	
	var pos = this.definitions.indexOf(target);
	if (pos < 0) throw new Error("target is not a subnode");
	
	var preVarDefs = this.definitions.slice(0, pos);
	var preVar = new UglifyJS.AST_Var({
		definitions: preVarDefs
	});
	var deleted = [];
	if (del) {
		deleted.push({
			from:this.definitions[pos],
			to: newStatement
		});
		pos += 1; // skip the VarDef we want to delete
	}
	transferComments(this.definitions[pos], newStatement);
	var postVarDefs = this.definitions.slice(pos);
	var postVar = new UglifyJS.AST_Var({
		definitions: postVarDefs
	});

	// reallocate parents
	preVar.parent = parent(this);
	postVar.parent = parent(this);
	for (var i =0; i<preVarDefs.length; i++) {
		preVarDefs[i].parent = parent(preVar);
	}
	for (var j =0; j<postVarDefs.length; j++) {
		postVarDefs[j].parent = parent(postVar);
	}
	
	if (preVar.definitions.length > 0)
		deleted = deleted.concat(this.parent().insertBefore(preVar, this));

	deleted = deleted.concat(this.parent().insertBefore(newStatement, this));

	if (postVar.definitions.length > 0)
		deleted = deleted.concat(this.parent().insertBefore(postVar, this, true));

	return deleted;
};

UglifyJS.AST_Block.prototype.insertBefore = function(newStatement, target, del) {
	var pos = this.body.indexOf(target);
	if (pos < 0) throw new Error("target is not a subnode");
	
	transferComments(this.body[pos], newStatement);
	var deleted = this.body.splice(pos, del?1:0, newStatement);
	newStatement.parent = parent(this);
	
	if (del) {
		return [{from: deleted[0], to: newStatement}];
	} else {
		return [];
	}
};


UglifyJS.AST_Return.prototype.insertBefore = function(newNode, target, del) {
	if (this.value === target) {

		if (del) {
			var deleted = [this.value];
			newNode.parent = parent(this);
			transferComments(this.value, newNode);
			this.value = newNode;
			return deleted;
		} else {
			return this.parent().insertBefore(newNode, this);
		}
	} else {
		throw new Error("target is not a subnode");
	}
};
UglifyJS.AST_Dot.prototype.insertBefore = function(newNode, target, del) {
	if (this.expression === target) {
		if (del) {
			var deleted = [this.expression];
			newNode.parent = parent(this);
			transferComments(this.expression, newNode);
			this.expression = newNode;
			return deleted;
		} else {
			return this.parent().insertBefore(newNode, this);
		}
	} else {
		throw new Error("target is not a subnode");
	}
};
UglifyJS.AST_Call.prototype.insertBefore = function(newNode, target, del) {
	var deleted;
	if (this.expression === target) {
		if (del) {
			deleted = [this.expression];
			newNode.parent = parent(this);
			transferComments(this.expression, newNode);
			this.expression = newNode;
			return deleted;
		} else {
			return this.parent().insertBefore(newNode, this);
		}
	} else {
		for (var i=0; i<this.args.length; i++) {
			if (target === this.args[i]) {
				if (!del) {
					newNode = getIIFE(newNode, this.args[i]);
					deleted = [];
				} else {
					deleted = [this.expression];
				}
				newNode.parent = parent(this);
				transferComments(this.args[i], newNode);
				this.args[i] = newNode;
				return deleted;
			}
		}
	}
	throw new Error("target is not a subnode");
};

/*************** HELPER FUNCTIONS ***************/


function noSubchildren() {
	throw new Error("Cannot insert before this node type");
}

function parent(par) {
	return function() { return par; };
}

function getIIFE(newStatement, expression) {
	var iife = new UglifyJS.AST_Call({
		expression: new UglifyJS.AST_Function({
			argnames:[
				new UglifyJS.AST_SymbolFunarg({
					name: 't'
				})
			],
			body: [
				newStatement,
				new UglifyJS.AST_Return({
					value: new UglifyJS.AST_SymbolRef({
						name: 't'
					})
				})
			]
		}),
		args:[
			expression
		]
	});

	iife.expression.parent = parent(iife);
	iife.expression.argnames.parent = parent(iife.expression);
	iife.expression.argnames[0].parent = parent(iife.expression.argnames);
	iife.expression.body.parent = parent(iife.expression);
	iife.expression.body[0].parent = parent(iife.expression.body);
	iife.expression.body[1].parent = parent(iife.expression.body);
	iife.expression.body[1].value.parent = parent(iife.expression.body[1]);
	iife.args.parent = parent(iife);
	iife.args[0].parent = parent(iife.args);

	return iife;
}

function transferComments(from, to) {
	if (from.start !== undefined && from.start.comments_before !== undefined &&
		 from.start !== null && from.start.comments_before !== null) {
		if (to.start === undefined || to.start === null) {
			to.start = {
				comments_before: []
			};
			for (var i=0; i<from.start.comments_before.length; i++){
				to.start.comments_before.push(from.start.comments_before[i]);
			}
		} else {
			to.start.comments_before = to.start.comments_before.concat(from.start.comments_before);	
		}
		from.start.comments_before = [];
	}
}