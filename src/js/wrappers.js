// TODO: How can I deal with infinite recursion here?
function mimic(t, obj) {
	// console.log("Made mimic for ", obj);
	// obj is untrusted, but the context is safe
	if (t.kind === "function") {
		if (typeof obj !== "function") throw new Error("obj is not function");

		// f is a type-safe version of obj, which can be used in the typed world
		var f = function() {

			// +1 is because of 'this'
			if (arguments.length + 1 !== t.argTypes.length) {
				throw new Error("obj has the wrong number of parameters");
			}
			var args = [];

			for (var i = 0; i < arguments.length; i++) {
				args[i] = guard(t.argTypes[i + 1], arguments[i]);
				args[i] = arguments[i];
			}

			var result = obj.apply(guard(t.argTypes[0], f), args);
			return mimic(t.returnType, result);
		};
		return f;

	} else if (t.kind === "object") {
		if (typeof obj !== "object") throw new Error("obj is not an object");

		var x = {};

		// Probably not strictly necessary to yank this function out of 
		// the loop (I assume defineProperty is synchronous), but old habits
		// die hard + JSHint was complaining.
		var definer = function(propName) {

			// TODO: is it problematic that we're using getOwnProperty rather than getProperty?
			var prop = Object.getOwnPropertyDescriptor(obj, propName);
			Object.defineProperty(x, propName, {
				enumerable: prop.enumerable,
				get: function() {
					return mimic(t.memberTypes[propName], obj[propName]);
				},
				set: function(y) {
					obj[propName] = guard(t.memberTypes[propName], y);
				}
			});
		};

		// Note that we tolerate (and don't protect) extra properties
		for (var i in t.memberTypes) {
			if (!(i in obj)) throw new Error("obj is lacking property " + i);
			definer(i);
		}

		return x;
	} else if (t.kind === "primitive") {
		if (typeof obj !== t.type) throw new Error("obj is not " + t.type);
		return obj;
	} else if (t.kind === "abstract") {
		return obj;
	} else {
		console.error(t);
		throw new Error("Unexpected kind");
	}
}







function guard(t, obj) {
	// console.log("Made guard for ", obj);
	// obj is safe and needs protecting from the context around it

	if (t.kind === "function") {

		var f = function() {
			// +1 is because of 'this'
			if (arguments.length + 1 !== t.argTypes.length) {
				throw new Error("obj has the wrong number of parameters");
			}

			// obj's code is safe, so it needs to intereact with safe mimics rather than the dirty data from outside
			var args = [];

			for (var i = 0; i < arguments.length; i++) {
				args[i] = mimic(t.argTypes[i + 1], arguments[i]);
				args[i] = arguments[i];
			}

			// obj is already safe so I don't need to wrap it with a mimic
			var result = obj.apply(obj, args);

			// The result is type-safe but heading into the great unknown - needs a guard
			return guard(t.returnType, result);
		};
		return f;

	} else if (t.kind === "object") {

		var x = {};

		// Probably not strictly necessary to yank this function out of 
		// the loop (I assume defineProperty is synchronous), but old habits
		// die hard + JSHint was complaining.
		var definer = function(propName) {

			// TODO: is it problematic that we're using getOwnProperty rather than getProperty?
			var prop = Object.getOwnPropertyDescriptor(obj, propName);
			Object.defineProperty(x, propName, {
				enumerable: prop.enumerable,
				get: function() {
					return guard(t.memberTypes[propName], obj[propName]);
				},
				set: function(y) {
					obj[propName] = mimic(t.memberTypes, y);
				}
			});
		};

		// Obj is safe, so we know (i in obj) will be true
		for (var i in t.memberTypes) {
			definer(i);
		}
		return x;
	} else if (t.kind === "primitive") {
		return obj;
	} else if (t.kind === "abstract") {
		return obj;
	} else {
		console.error(t);
		throw new Error("Unexpected kind");
	}
}
