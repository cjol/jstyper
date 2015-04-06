/*
	This module contains a bunch of classes representing structures in our program.
	Some of the classes (those without prototype stuff) could almost be done away
	with if we had a reasonable type checker... 
*/
var UglifyJS = require("uglify-js2");

module.exports = {
	Type: Type,
	PrimitiveType: PrimitiveType,
	AbstractType: AbstractType,
	ObjectType: ObjectType,
	FunctionType: FunctionType,
	ArrayType: ArrayType,
	IllDefinedType: IllDefinedType,
	Substitution: Substitution,
	Constraint: Constraint,
	LEqConstraint: LEqConstraint,
	LEqCheckConstraint: LEqCheckConstraint,
	OptionalConstraint: OptionalConstraint,
	TypeEnvEntry: TypeEnvEntry,
	TypeEnv: TypeEnv,
	Wrapper: Wrapper,
	Judgement: Judgement,
	Exceptions: undefined
};



module.exports.Exceptions = {
	TwoAbstractsException: function TwoAbstractsException(msg) {
		this.name = "TwoAbstractsException";
		this.message = (msg || "Tried to solve a constraint between two abstract types");
	}
};
module.exports.Exceptions.TwoAbstractsException.prototype = new Error();

var tmp = function() {};
Type.resetStore = function() {
	Type.store = [];
	Type.id = 0;
	
	// Type.boolType = new PrimitiveType('boolean');
	// Type.stringType = new PrimitiveType('string');
	// Type.undefinedReturnType = new PrimitiveType('undefined');
	// Type.undefinedType = new PrimitiveType('undefined');
	// Type.nullType = new PrimitiveType('null');
};

function Type(type, options, node) {
	options = options || {};

	this.type = type;
	this.isConcrete = (options.isConcrete === true);
	this.isDynamic = (options.isDynamic === true);
	this.id = Type.id++;
	Type.store[this.id] = this;
	this.containers = [];
	if (node !== undefined) this.node = node;
}

Object.defineProperty(Type, 'numType', {
	get: function() { return new PrimitiveType('number'); }
});
Object.defineProperty(Type, 'boolType', {
	get: function() { return new PrimitiveType('boolean'); }
});
Object.defineProperty(Type, 'stringType', {
	get: function() { return new PrimitiveType('string'); }
});
Object.defineProperty(Type, 'undefinedReturnType', {
	get: function() { return new PrimitiveType('undefinedReturn'); }
});
Object.defineProperty(Type, 'undefinedType', {
	get: function() { return new PrimitiveType('undefined'); }
});
Object.defineProperty(Type, 'nullType', {
	get: function() { return new PrimitiveType('null'); }
});
// Type.prototype.cloneTo = function(obj) {
// 	obj.type = this.type;
// 	obj.isConcrete = this.isConcrete;
// 	obj.isDynamic = this.isDynamic;
// 	// I think I won't redefine id or node
// };
Type.prototype.toString = function() {
	return this.type;
};
Type.prototype.addContainers = function(container) {
	this.containers.push(container);
};
Type.prototype.isContainedBy = function(container) {
	return this.containers.indexOf(container) >= 0;
};

function PrimitiveType(type, options, node) {
	Type.call(this, type, {
		isConcrete: true,
		isDynamic: options !== undefined && options.isDynamic === true
	}, node);
}
tmp.prototype = Type.prototype;
PrimitiveType.prototype = new tmp();
PrimitiveType.prototype.constructor = PrimitiveType;

PrimitiveType.prototype.applySubstitution = function() {
	// primitive types can't be substituted
	return;
};
PrimitiveType.prototype.toAST = function() {
	return new UglifyJS.AST_Object({
		properties: [
			new UglifyJS.AST_ObjectKeyVal({
				key: "kind",
				value: new UglifyJS.AST_String({
					value: "primitive"
				})
			}),
			new UglifyJS.AST_ObjectKeyVal({
				key: "type",
				value: new UglifyJS.AST_String({
					value: this.type
				})
			})
		]
	});
};

function AbstractType(type, options, node) {
	Type.call(this, type, {
		isConcrete: false,
		isDynamic: options !== undefined && options.isDynamic === true
	}, node);
	this.type = "T" + this.id;
}
tmp.prototype = Type.prototype;
AbstractType.prototype = new tmp();
AbstractType.prototype.constructor = AbstractType;

AbstractType.prototype.applySubstitution = function(sub) {
	// if (sub.from.type === this.type) {
	// 	sub.to.cloneTo(this);
	// }
};
AbstractType.prototype.toAST = function() {
	return new UglifyJS.AST_Object({
		properties: [
			new UglifyJS.AST_ObjectKeyVal({
				key: "kind",
				value: new UglifyJS.AST_String({
					value: "abstract"
				})
			})
		]
	});
};


function ObjectType(options, node) {
	PrimitiveType.call(this, "object", options, node);

	this.memberTypes = {};

	for (var i in options.memberTypes) {
		this.memberTypes[i] = options.memberTypes[i];
		Type.store[this.memberTypes[i]].addContainers(this.id);
	}
	this.originalObj = options.originalObj === undefined ? null : options.originalObj;
	this.proto = null;
}
tmp.prototype = PrimitiveType.prototype;
ObjectType.prototype = new tmp();
ObjectType.prototype.constructor = ObjectType;

ObjectType.prototype.applySubstitution = function(sub, donotrecurse) {
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this.id);

	outerLoop: for (var j in this.memberTypes) {
		// if one of my membertypes is the substitution target, then we will replace it
		if (this.memberTypes[j] === sub.from) {
			this.memberTypes[j] = sub.to;
			Type.store[sub.to].addContainers(this.id);
		}

		// now recursively apply substitution to children
		for (var i = 0; i < donotrecurse.length; i++) {
			if (this.memberTypes[j] === donotrecurse[i]) continue outerLoop;
		}

		// nb I don't want subcalls to modify my donotrecurse so I'm cloning with slice(0)
		Type.store[this.memberTypes[j]].applySubstitution(sub, donotrecurse.slice(0));
	}
	if (this.originalObj !== null) {
		if (this.originalObj === sub.from) {
			this.originalObj = sub.to;
		}
		Type.store[this.originalObj].applySubstitution(sub, donotrecurse.slice(0));
	}
	// if (this.protoObj !== null) Type.store[this.protoObj].applySubstitution(sub, donotrecurse.slice(0));
};
ObjectType.prototype.toString = function(donotrecurse) {

	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this.id);

	var types = [];
	var i;
	outerLoop: for (var lab in this.memberTypes) {
		for (i = 0; i < donotrecurse.length; i++) {
			if (donotrecurse[i] === this.memberTypes[lab]) {
				types.push(lab + ": <" + Type.store[this.memberTypes[lab]].type + ">");
				continue outerLoop;
			}
		}
		types.push(lab + ":" + Type.store[this.memberTypes[lab]].toString(donotrecurse.slice(0)));
	}
	var origString = "";
	var safe = true;
	if (this.originalObj !== null) {
		for (i = 0; i < donotrecurse.length; i++) {
			if (donotrecurse[i] === this.originalObj) {
				// origString = "[" + Type.store[this.originalObj].type + "]";
				// safe = false;
				break;
			}
		}
		if (safe) {
			origString = Type.store[this.originalObj].toString(donotrecurse.slice(0));
			origString = origString.slice(1, -1);
			origString = "[, " + origString + "]";
		}
	}
	// TODO: Add proto and originalObj members
	return "{" + types.join(", ") + origString + "}";
};
ObjectType.prototype.toAST = function(donotrecurse) {
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this.id);

	var types = [];
	outerLoop: for (var lab in this.memberTypes) {
		for (var i = 0; i < donotrecurse.length; i++) {
			if (donotrecurse[i] === this.memberTypes[lab]) {
				// TODO: Relative link to parent?
				types.push(new UglifyJS.AST_ObjectKeyVal({
					key: lab,
					value: new UglifyJS.AST_String({
						value: "<" + Type.store[this.memberTypes[lab]].type + ">"
					})
				}));
				continue outerLoop;
			}
		}
		// TODO: Add proto and originalObj members
		types.push(new UglifyJS.AST_ObjectKeyVal({
			key: lab,
			value: Type.store[this.memberTypes[lab]].toAST(donotrecurse.slice(0))
		}));
	}

	return new UglifyJS.AST_Object({
		properties: [
			new UglifyJS.AST_ObjectKeyVal({
				key: "kind",
				value: new UglifyJS.AST_String({
					value: "object"
				})
			}),
			new UglifyJS.AST_ObjectKeyVal({
				key: "memberTypes",
				value: new UglifyJS.AST_Object({
					properties: types
				})
			})
		]
	});
};
ObjectType.prototype.addContainers = function(container) {
	if (this.isContainedBy(container)) return;
	Type.prototype.addContainers.call(this, container);

	for (var member in this.memberTypes) {
		Type.store[this.memberTypes[member]].addContainers(container);
	}

	// TODO?: Add proto and originalObj members
};

function FunctionType(options, node) {
	PrimitiveType.call(this, "function", options, node);

	this.argTypes = [];

	for (var i = 0; i < options.argTypes.length; i++) {
		this.argTypes[i] = options.argTypes[i];
		Type.store[this.argTypes[i]].addContainers(this.id);
	}

	this.returnType = options.returnType;
	Type.store[this.returnType].addContainers(this.id);
}
tmp.prototype = PrimitiveType.prototype;
FunctionType.prototype = new tmp();
FunctionType.prototype.constructor = FunctionType;

FunctionType.prototype.applySubstitution = function(sub, donotrecurse) {
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this.id);

	// A function itself cannot be substituted, but arg or return types might be abstract
	var i;
	outerLoop: for (var j = 0; j < this.argTypes.length; j++) {
		if (this.argTypes[j] === sub.from) {
			this.argTypes[j] = sub.to;
			Type.store[sub.to].addContainers(this.id);
		}

		for (i = 0; i < donotrecurse.length; i++) {
			if (this.argTypes[j] === donotrecurse[i]) continue outerLoop;
		}

		// nb I don't want subcalls to modify my donotrecurse so I'm cloning with slice(0)
		Type.store[this.argTypes[j]].applySubstitution(sub, donotrecurse.slice(0));
	}

	if (this.returnType === sub.from) {
		this.returnType = sub.to;
		Type.store[sub.to].addContainers(this.id);
	}
	for (i = 0; i < donotrecurse.length; i++) {
		if (this.returnType === donotrecurse[i]) return;
	}
	Type.store[this.returnType].applySubstitution(sub, donotrecurse.slice(0));
};
FunctionType.prototype.toString = function(donotrecurse) {

	var j;
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this.id);

	// argument types
	var args = [];
	outerLoop: for (var i = 0; i < this.argTypes.length; i++) {

		for (j = 0; j < donotrecurse.length; j++) {
			if (donotrecurse[j] === this.argTypes[i]) {
				args.push("<" + Type.store[this.argTypes[i]].type + ">");
				continue outerLoop;
			}
		}
		args.push(Type.store[this.argTypes[i]].toString(donotrecurse.slice(0)));
	}

	// return type
	var ret;
	var safe = true;
	for (j = 0; j < donotrecurse.length; j++) {
		if (donotrecurse[j] === this.returnType) {
			ret = "<" + Type.store[this.returnType].type + ">";
			safe = false;
			break;
		}
	}
	if (safe) ret = Type.store[this.returnType].toString(donotrecurse);

	return "fn(" + args.join(", ") + " -> " + ret + ")";
};


FunctionType.prototype.toAST = function(donotrecurse) {


	var j;
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this.id);

	// argument types
	var args = [];
	outerLoop: for (var i = 0; i < this.argTypes.length; i++) {

		for (j = 0; j < donotrecurse.length; j++) {
			if (donotrecurse[j] === this.argTypes[i]) {
				args.push(new UglifyJS.AST_String({
					value: "<" + Type.store[this.argTypes[i]].type + ">"
				}));
				continue outerLoop;
			}
		}
		args.push(Type.store[this.argTypes[i]].toAST(donotrecurse.slice(0)));
	}

	// return type
	var ret;
	var safe = true;
	for (j = 0; j < donotrecurse.length; j++) {
		if (donotrecurse[j] === this.returnType) {
			ret = new UglifyJS.AST_String({
				value: "<" + Type.store[this.returnType].type + ">"
			});
			safe = false;
			break;
		}
	}
	if (safe) {
		ret = Type.store[this.returnType].toAST(donotrecurse);
	}

	return new UglifyJS.AST_Object({
		properties: [
			new UglifyJS.AST_ObjectKeyVal({
				key: "kind",
				value: new UglifyJS.AST_String({
					value: "function"
				})
			}),
			new UglifyJS.AST_ObjectKeyVal({
				key: "argTypes",
				value: new UglifyJS.AST_Array({
					elements: args
				})
			}),
			new UglifyJS.AST_ObjectKeyVal({
				key: "returnType",
				value: ret
			})
		]
	});
};
FunctionType.prototype.addContainers = function(container) {

	if (this.isContainedBy(container)) return;
	Type.prototype.addContainers.call(this, container);

	for (var i = 0; i < this.argTypes.length; i++) {
		Type.store[this.argTypes[i]].addContainers(container);
	}
	Type.store[this.returnType].addContainers(container);
};


function ArrayType(options, node) {
	PrimitiveType.call(this, "array", options, node);

	this.innerType = options.innerType;
	Type.store[this.innerType].addContainers(this.id);
}
tmp.prototype = PrimitiveType.prototype;
ArrayType.prototype = new tmp();
ArrayType.prototype.constructor = ArrayType;

ArrayType.prototype.applySubstitution = function(sub, donotrecurse) {
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this.id);

	if (this.innerType === sub.from) {
		this.innerType = sub.to;
		Type.store[sub.to].addContainers(this.id);
	}
	for (i = 0; i < donotrecurse.length; i++) {
		if (this.innerType === donotrecurse[i]) return;
	}
	Type.store[this.innerType].applySubstitution(sub, donotrecurse.slice(0));
};
ArrayType.prototype.toString = function(donotrecurse) {

	var j;
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this.id);

	var innerType;
	if (donotrecurse.indexOf(this.innerType) < 0) {
		innerType = Type.store[this.innerType].toString(donotrecurse);
	} else {
		innerType = "<" + Type.store[this.innerType].type + ">";
	}

	return "[" + innerType + "]";
};


ArrayType.prototype.toAST = function(donotrecurse) {

	var j;
	if (donotrecurse === undefined) donotrecurse = [];
	donotrecurse.push(this.id);

	// return type

	var innerType;
	if (donotrecurse.indexOf(this.innerType) < 0) {
		innerType = Type.store[this.innerType].toAST(donotrecurse);
	} else {
		innerType = "<" + Type.store[this.innerType].type + ">";
	}

	return new UglifyJS.AST_Object({
		properties: [
			new UglifyJS.AST_ObjectKeyVal({
				key: "kind",
				value: new UglifyJS.AST_String({
					value: "array"
				})
			}),
			new UglifyJS.AST_ObjectKeyVal({
				key: "innerType",
				value: innerType
			})
		]
	});
};
ArrayType.prototype.addContainers = function(container) {

	if (this.isContainedBy(container)) return;
	Type.prototype.addContainers.call(this, container);

	Type.store[this.innerType].addContainers(container);
};




function IllDefinedType(innerType) {
	Type.call(this, "illdefn", {
		isConcrete: innerType.isConcrete,
		isDynamic: innerType.isDynamic
	});

	this.id = innerType.id;
	this.innerType = innerType.id;
	this.constructor = innerType.constructor;
	this.applySubstitution = function(sub, donotrecurse) {
			
		if (donotrecurse === undefined) donotrecurse = [];
		donotrecurse.push(this.id);

		if (this.id === sub.from) {
			innerType.id = sub.to;
		}
		for (i = 0; i < donotrecurse.length; i++) {
			if (this.innerType === donotrecurse[i]) return;
		}
		Type.store[innerType.id].applySubstitution(sub, donotrecurse.slice(0));
	};
	this.toString = function() {
		return Type.store[innerType.id].toString.apply(innerType, arguments) + "?";
	};
}



function Substitution(from, to) {
	this.from = from;
	this.to = to;
}
// shortcut method
Substitution.prototype.apply = function(element) {
	element.applySubstitution(this);
};


function Constraint(leftType, rightType) {
	this.type1 = leftType;
	this.type2 = rightType;

	this.regenDesc();
}
Constraint.prototype.solve = function() {

	if (this.type1 === this.type2) return {
		constraints: [],
		substitutions: []
	};
	// straight equality - easy
	var subs = [],
		constraints = [];

	// if one is concrete and the other abstract, sub from abs to conc
	if (!Type.store[this.type1].isConcrete) {
		subs.push(new Substitution(this.type1, this.type2));
	} else if (!Type.store[this.type2].isConcrete) {
		subs.push(new Substitution(this.type2, this.type1));

	} // both are concrete types
	else {
		// if they're the same type, we're okay, else we have a type error
		// check the structure of the types (not sufficient for complex types)
		// if this is a complex structure, there may also be sub-constraints to solve
		try {
			constraints = this.check();
		} catch (e) {
			throw new Error(" Failed Unification: " + Type.store[this.type1].toString() + " != " + Type.store[this.type2].toString());
		}
	}

	return {
		constraints: constraints,
		substitutions: subs
	};
};

Constraint.prototype.check = function() {
	var type1 = Type.store[this.type1];
	var type2 = Type.store[this.type2];

	// NB Since all types are created fresh, we only get this far if both types are concrete
	if (type2.type !== type1.type) throw new Error();

	if (type1.type === "object") {

		return this.getObjectConstraints();
	} else if (type1.type === "function") {

		// check arity
		if (type1.argTypes.length === type2.argTypes.length) {
			return this.getFunctionConstraints();
		} else {
			throw new Error();
		}
	} else if (type2.type === "array") {

		var nc = new this.constructor(type1.innerType, type2.innerType);
		if (this.interesting) nc.interesting = true;
		return [nc];

	} else {
		// these are primitive types so they're fine
		return [];
	}
};
Constraint.prototype.getObjectConstraints = function() {
	// called when one of the objects is a derived object
	var type1 = Type.store[this.type1];
	var type2 = Type.store[this.type2];
	var C = [];

	// tick off as many elements here as possible before going deeper

	// Type2 direct is contained in either Type1 direct, or Type1 original (so t2.d<t1)
	var typesMissingFrom1 = {};
	var nc;
	var keepLooking = false;
	for (var j in type2.memberTypes) {
		if (type1.memberTypes[j] === undefined) {
			keepLooking = true;
			typesMissingFrom1[j] = type2.memberTypes[j];
		} else {
			nc = new Constraint(type1.memberTypes[j], type2.memberTypes[j]);
			C.push(nc);
		}
	}
	if (keepLooking) {
		if (type1.originalObj !== undefined && type1.originalObj !== null) {
			C.push(new LEqCheckConstraint(new ObjectType({
				memberTypes: typesMissingFrom1
			}).id, type1.originalObj));
		} else {
			// TODO: better error message
			throw new Error("derived objects not equal 1");
		}
	}

	// Type1 direct is contained in either Type2 direct, or Type2 original (so t1.d<t2)
	var typesMissingFrom2 = {};
	keepLooking = false;
	for (var i in type1.memberTypes) {
		if (type2.memberTypes[i] === undefined) {
			keepLooking = true;
			typesMissingFrom2[i] = type1.memberTypes[i];
		} else {
			nc = new Constraint(type1.memberTypes[i], type2.memberTypes[i]);
			C.push(nc);
		}
	}

	if (keepLooking) {
		if (type2.originalObj !== undefined && type2.originalObj !== null) {
			C.push(new LEqCheckConstraint(new ObjectType({
				memberTypes: typesMissingFrom2
			}).id, type2.originalObj));
		} else {
			// TODO: better error message
			throw new Error("derived objects not equal 2");
		}
	}

	// now show t1.o<t2 and t2.o<t1
	if (type1.originalObj !== undefined && type1.originalObj !== null)
		C.push(new LEqCheckConstraint(type1.originalObj, this.type2));
	if (type2.originalObj !== undefined && type2.originalObj !== null)
		C.push(new LEqCheckConstraint(type2.originalObj, this.type1));

	// hence, since t1.o U t1.d = t1, t1<t2 (and t2<t1 similarly) => t1=t2

	return C;
};
Constraint.prototype.getFunctionConstraints = function() {

	var type1 = Type.store[this.type1];
	var type2 = Type.store[this.type2];

	var newConstraints = [];
	var nc;
	// generate new constraints asserting that the arguments and
	// return type of type1 and of type2 have the same type
	for (var i = 0; i < type1.argTypes.length; i++) {
		nc = new Constraint(type1.argTypes[i], type2.argTypes[i]);
		if (this.interesting) nc.interesting = true;
		newConstraints.push(nc);
	}

	nc = new Constraint(type1.returnType, type2.returnType);
	if (this.interesting) nc.interesting = true;
	newConstraints.push(nc);
	return newConstraints;
};
Constraint.prototype.regenDesc = function() {
	this.description = Type.store[this.type1].toString() + " = " + Type.store[this.type2].toString();
};
Constraint.prototype.applySubstitution = function(sub) {
	if (this.type1 === sub.from) this.type1 = sub.to;
	if (this.type2 === sub.from) this.type2 = sub.to;
	Type.store[this.type1].applySubstitution(sub);
	Type.store[this.type2].applySubstitution(sub);
	this.regenDesc();
};

Constraint.compare = function(a, b) {
	var score = function(c) {
		var score;

		// LEq between two abstracts should be last
		// LEq involving one abstract should be almost last (involves a potentially info-losing substitution)
		// LEq involving functions should be first (will immediately give straight constraints)
		if (!(Type.store[c.type1].isConcrete || Type.store[c.type2].isConcrete)) {
			score = 4;
		} else if (!Type.store[c.type1].isConcrete || !Type.store[c.type2].isConcrete) {
			score = 3;
		} else if (Type.store[c.type1] instanceof FunctionType || Type.store[c.type2] instanceof FunctionType) {
			score = 1;
		} else {
			score = 2;
		}

		if (c instanceof LEqCheckConstraint) {
			score = score * 2;
		} else if (c instanceof LEqConstraint) {
			score = score * 2 - 1;
		} else {
			score = 0;
		}

		return score;
	};
	Constraint.compare.score = score;

	a.regenDesc();
	b.regenDesc();
	return score(a) - score(b);
};

function LEqConstraint(smallType, bigType) {
	Constraint.call(this, smallType, bigType);
}
tmp = function() {};
tmp.prototype = Constraint.prototype;
LEqConstraint.prototype = new tmp();
LEqConstraint.prototype.constructor = LEqConstraint;

// NB should only be called for two concrete object types
LEqConstraint.prototype.enforce = function() {
	// we can add smallType's properties to bigType to satisfy the constraint
	for (var l in Type.store[this.type1].memberTypes) {
		if (Type.store[this.type2].memberTypes[l] === undefined) {

			var T = TypeEnv.getFreshType();
			Type.store[this.type2].memberTypes[l] = T.id;
		}
	}
	this.regenDesc();
};
LEqConstraint.prototype.getObjectConstraints = function() {
	// called when one of the objects is a derived object
	var type1 = Type.store[this.type1];
	var type2 = Type.store[this.type2];
	var C = [];

	// tick off as many elements here as possible before going deeper

	// Type1 direct is contained in either Type2 direct, or Type2 original (so t1.d<t2)
	var typesMissingFrom2 = {};
	var nc, keepLooking = false;
	for (var i in type1.memberTypes) {
		if (type2.memberTypes[i] === undefined) {
			keepLooking = true;
			typesMissingFrom2[i] = type1.memberTypes[i];
		} else {
			nc = new this.constructor(type1.memberTypes[i], type2.memberTypes[i]);
			C.push(nc);
		}
	}

	if (keepLooking) {
		if (type2.originalObj !== undefined && type2.originalObj !== null) {
			C.push(new this.constructor(new ObjectType({
				memberTypes: typesMissingFrom2
			}).id, type2.originalObj));
		} else {
			// TODO: better error message
			throw new Error("derived objects not equal 2");
		}
	}

	// now show t1.o<t2
	if (type1.originalObj !== undefined && type1.originalObj !== null)
		C.push(new this.constructor(type1.originalObj, this.type2));

	// hence, since t1.o U t1.d = t1, t1<t2

	return C;
};
LEqConstraint.prototype.regenDesc = function() {
	this.desc = Type.store[this.type1].toString() + " has less structure than " + Type.store[this.type2].toString();
};
LEqConstraint.prototype.solve = function() {

	// shortcut
	if (this.type1 === this.type2) return {
		constraints: [],
		substitutions: []
	};

	// straight equality - easy
	var subs = [],
		constraints = [];
	var objType, label, retType, funType, i;
	if (!Type.store[this.type1].isConcrete) {
		if (!Type.store[this.type2].isConcrete) {
			// abs <= abs
			throw new module.exports.Exceptions.TwoAbstractsException("I don't know how to deal with this");
		}

		if (Type.store[this.type2].type === "object") {
			// abs <= object
			// without knowing what type1 is yet, I do know it must be an object
			// AND I assume it will have the same members
			objType = new ObjectType({
				memberTypes: {}
			});

			// for an optionalconstraint, an abstract effectively = emptyobj
			if (!(this instanceof OptionalConstraint)) {
				for (label in Type.store[this.type2].memberTypes) {
					objType.memberTypes[label] = TypeEnv.getFreshType().id;
				}
			}

			if (Type.store[this.type1].shouldInfer) objType.shouldInfer = true;
			subs.push(new Substitution(this.type1, objType.id));

			// I have contributed some information, but the constraint isn't solved yet
			constraints.push(this);

		} else if (Type.store[this.type2].type === "function") {
			// abs <= function
			// without knowing what type1 really is yet - I do at least know it must be a function with the same number of parameters

			retType = TypeEnv.getFreshType();

			funType = new FunctionType({
				argTypes: [],
				returnType: retType.id
			});
			for (i = 0; i < Type.store[this.type2].argTypes.length; i++) {
				funType.argTypes[i] = TypeEnv.getFreshType().id;
			}

			if (Type.store[this.type1].shouldInfer) funType.shouldInfer = true;
			subs.push(new Substitution(this.type1, funType.id));

			// I have contributed some information, but the constraint isn't solved yet
			constraints.push(this);


		} else {
			// abs <= primitive
			// no possibilitiy of substructure, so treat this as for regular constraints
			return Constraint.prototype.solve.call(this);
		}
	} else if (!Type.store[this.type2].isConcrete) {
		if (Type.store[this.type1].type === "object") {
			// abs => object
			// without knowing what type1 is yet, I do know it must be an object with these members
			objType = new ObjectType({
				memberTypes: {}
			});
			if (!(this instanceof OptionalConstraint)) {
				for (label in Type.store[this.type1].memberTypes) {
					objType.memberTypes[label] = TypeEnv.getFreshType().id;
				}
			}

			if (Type.store[this.type2].shouldInfer) objType.shouldInfer = true;
			subs.push(new Substitution(this.type2, objType.id));

			// I have contributed some information, but the constraint isn't solved yet
			constraints.push(this);

		} else if (Type.store[this.type1].type === "function") {
			// abs => function
			// without knowing what type1 really is yet - I do at least know it must be a function with the same number of parameters

			retType = TypeEnv.getFreshType();

			funType = new FunctionType({
				argTypes: [],
				returnType: retType.id
			});
			for (i = 0; i < Type.store[this.type1].argTypes.length; i++) {
				funType.argTypes[i] = TypeEnv.getFreshType().id;
			}

			if (Type.store[this.type2].shouldInfer) funType.shouldInfer = true;
			subs.push(new Substitution(this.type2, funType.id));

			// I have contributed some information, but the constraint isn't solved yet
			constraints.push(this);


		} else {
			// abs => primitive
			// no possibilitiy of substructure, so treat this as for regular constraints
			return Constraint.prototype.solve.call(this);
		}
		return {
			substitutions: subs,
			constraints: constraints
		};
	} // both are concrete types
	else {
		// if they're the same type, we're okay, else we have a type error
		// check the structure of the types (not sufficient for complex types)
		try {
			if (Type.store[this.type1].type === "object" && Type.store[this.type2].type === "object" &&
				Type.store[this.type1].originalObj === null && Type.store[this.type2].originalObj === null) {
				if (!(this instanceof LEqCheckConstraint)) {
					this.enforce();
				}
			}
			constraints = this.check();
		} catch (e) {
			throw new Error(" Failed Unification: " + Type.store[this.type1].toString() + " != " + Type.store[this.type2].toString());
		}
	}

	return {
		constraints: constraints,
		substitutions: subs
	};
};



function LEqCheckConstraint(smallType, bigType) {
	LEqConstraint.call(this, smallType, bigType);
}
tmp = function() {};
tmp.prototype = LEqConstraint.prototype;
LEqCheckConstraint.prototype = new tmp();
LEqCheckConstraint.prototype.constructor = LEqCheckConstraint;
// LEqCheckConstraint.prototype.check = function() {
// 	// NB No enforce
// 	return this.checkStructure();
// };
LEqCheckConstraint.prototype.regenDesc = function() {
	this.desc = Type.store[this.type1].toString() + " <=c " + Type.store[this.type2].toString();
};



// if a member of smallType is included in bigType, the two member types must be the same
function OptionalConstraint(smallType, bigType) {
	LEqCheckConstraint.call(this, smallType, bigType);
}
tmp = function() {};
tmp.prototype = LEqCheckConstraint.prototype;
OptionalConstraint.prototype = new tmp();
OptionalConstraint.prototype.constructor = OptionalConstraint;
OptionalConstraint.prototype.regenDesc = function() {
	this.desc = Type.store[this.type1].toString() + " <=o " + Type.store[this.type2].toString();
};

OptionalConstraint.prototype.getObjectConstraints = function() {
	var type1 = Type.store[this.type1];
	var type2 = Type.store[this.type2];
	var C = [];

	if (type1 === type2) return C;

	// tick off as many elements here as possible before going deeper

	// Type1 direct is contained in either Type2 direct, or Type2 original (so t1.d<t2)
	var typesMissingFrom2 = {};
	var nc, keepLooking = false;
	for (var i in type1.memberTypes) {
		if (type2.memberTypes[i] === undefined) {
			keepLooking = true;
			typesMissingFrom2[i] = type1.memberTypes[i];
		} else {
			nc = new LEqCheckConstraint(type1.memberTypes[i], type2.memberTypes[i]);
			C.push(nc);
		}
	}

	if (keepLooking) {
		if (type2.originalObj !== undefined && type2.originalObj !== null) {
			C.push(new this.constructor(new ObjectType({
				memberTypes: typesMissingFrom2
			}).id, type2.originalObj));
		} else {
			// can't find the member, but not a problem here
		}
	}

	// now show t1.o<t2
	if (type1.originalObj !== undefined && type1.originalObj !== null)
		C.push(new this.constructor(type1.originalObj, this.type2));

	// hence, since t1.o U t1.d = t1, t1<t2

	return C;
};






function TypeEnvEntry(varName, node, type) {
	this.name = varName;
	this.node = node;
	this.type = type;
}
TypeEnvEntry.prototype.applySubstitution = function(sub) {
	if (sub.from === this.type) {
		this.type = sub.to;
	}
	Type.store[this.type].applySubstitution(sub);
};
TypeEnvEntry.prototype.toString = function() {
	return this.name + ": " + Type.store[this.type].toString();
};


function TypeEnv(cloneFrom) {
	if (cloneFrom !== undefined) {
		for (var i = 0; i < cloneFrom.length; i++) {
			this.push(cloneFrom[i]);
		}
	}
}
TypeEnv.nextType = 1;
TypeEnv.prototype = new Array();
TypeEnv.prototype.get = function(varName) {

	// search backwards through entries to find the most recent defn
	for (var i = this.length - 1; i >= 0; i--) {
		if (this[i].name === varName) {
			return Type.store[this[i].type];
		}
	}

	return null;
};
TypeEnv.prototype.getTypeEnvEntry = function(varName) {

	// search backwards through entries to find the most recent defn
	for (var i = this.length - 1; i >= 0; i--) {
		if (this[i].name === varName) {
			return this[i];
		}
	}

	return null;
};
TypeEnv.getFreshType = function(opts, node) {
	return new AbstractType("", opts, node);
};
TypeEnv.prototype.getFreshType = TypeEnv.getFreshType;
TypeEnv.prototype.applySubstitution = function(sub) {
	for (var i = 0; i < this.length; i++) {
		this[i].applySubstitution(sub);
	}
	if (this.derivedGammas !== undefined) {
		for (var j=0; j<this.derivedGammas.length; j++) {
			this.derivedGammas[j].applySubstitution(sub);
		}
	}
};
TypeEnv.prototype.toString = function(indentation) {
	var ind = "";
	if (indentation !== undefined) {
		for (var j = 0; j < indentation; j++) {
			ind += "\t";
		}
	}
	var res = "";
	// if (this.parentScope !== undefined) {
	// 	res += this.parentScope.toString(indentation);
	// }
	for (var i = this.length - 1; i >= 0; i--) {
		res += ind + this[i].toString() + "\n";
	}
	return res;
};


function Wrapper(expression, parent, type) {
	this.expression = expression;
	this.parent = parent;
	this.type = type;
}
Wrapper.prototype.applySubstitution = function(sub) {
	if (sub.from === this.type) {
		this.type = sub.to;
	}
	Type.store[this.type].applySubstitution(sub);
};


function Judgement(type, constraints, gamma, wrappers) {
	this.T = type;
	this.gamma = gamma;
	this.C = constraints || [];
	this.nodes = [];
	this.W = wrappers || [];
}
Judgement.InitEmpty = function() {
	return new Judgement(null, [], new TypeEnv(), []);
};
Judgement.InitFromDirective = function(directive) {
	var gamma = new TypeEnv();

	directive = directive.trim();
	var importKeyword = "dynamic ";
	if (directive.search(importKeyword) === 0) {
		directive = directive.substr(importKeyword.length);

		var imported = directive.split(/,\s*/);

		for (var i = 0; i < imported.length; i++) {
			var name = imported[i].trim();
			if (name.length === 0)
				continue;

			// select a fresh type for this imported variable
			var T = gamma.getFreshType({
				dynamic: true
			});

			// TODO: replace "null" with an actual program point
			gamma.push(new TypeEnvEntry(name, null, T.id));
		}
	}

	return new Judgement(null, [], gamma, []);
};