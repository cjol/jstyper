var counts;

function CastError(message) {
  this.name = 'CastError';
  this.message = 'CastError: ' + message || '';
}

CastError.prototype = new Error();
CastError.prototype.constructor = CastError;
function resetCounters() {
	counts = {
		mimic:0,
		guard:0,
		mimicReadProp:0,
		mimicWriteProp:0,
		mimicFunCall:0,
		guardReadProp:0,
		guardWriteProp:0,
		guardFunCall:0
	};
}

resetCounters();

// TODO: How can I deal with infinite recursion here?
function mimic(t, obj) {
	if (doCount) counts.mimic++;
	// console.log("Made mimic for ", obj);
	// obj is untrusted, but the context is safe
	if (t.kind === "function") {
		if (typeof obj !== "function") throw new CastError(typeof obj + " is not a function");

		// f is a type-safe version of obj, which can be used in the typed world
		var f = function() {

			if (doCount) counts.mimicFunCall++;
			// +1 is because of 'this'
			if (arguments.length + 1 !== t.argTypes.length) {
				throw new CastError("function has the wrong number of parameters");
			}
			var args = [];

			for (var i = 0; i < arguments.length; i++) {
				args[i] = guard(t.argTypes[i + 1], arguments[i]);
			}

			// TODO: bind 'this' correctly? alert doesn't work, apparently because it needs this===window
			// potentially it's abstract types I need to be careful with.
			var thisType;
			if (t.argTypes[0].kind === 'abstract' || (t.argTypes[0].kind === 'primitive' && t.argTypes[0].type === 'undefined')) {
				thisType = null;
			} else {
				thisType = guard(t.argTypes[0], f);
			}

			var result = obj.apply(thisType, args);
			return mimic(t.returnType, result);
		};
		return f;

	} else if (t.kind === "object") {
		if (typeof obj !== "object") throw new CastError(typeof obj + " is not an object");

		var x = {};

		// Probably not strictly necessary to yank this function out of 
		// the loop (I assume defineProperty is synchronous), but old habits
		// die hard + JSHint was complaining.
		var definer = function(propName) {

			var prop = getPropertyDescriptor(obj, propName);
			Object.defineProperty(x, propName, {
				enumerable: prop.enumerable,
				get: function() {
					if (doCount) counts.mimicReadProp++;
					return mimic(t.memberTypes[propName], obj[propName]);
				},
				set: function(y) {
					if (doCount) counts.mimicWriteProp++;
					obj[propName] = guard(t.memberTypes[propName], y);
				}
			});
		};

		// Note that we tolerate (and don't protect) extra properties
		for (var i in t.memberTypes) {
			if (!(i in obj)) throw new CastError("object is lacking property " + i);
			definer(i);
		}

		return x;
	} else if (t.kind === "primitive") {
		if (typeof obj !== t.type) throw new CastError(typeof obj + " is not a " + t.type);
		return obj;
	} else if (t.kind === "abstract") {
		// maybe dynamic?
		return obj;
	} else {
		console.error(t);
		throw new CastError("Unexpected kind");
	}
}







function guard(t, obj) {
	// console.log("Made guard for ", obj);
	// obj is safe and needs protecting from the context around it
	if (doCount) counts.guard++;

	if (t.kind === "function") {

		var f = function() {
			if (doCount) counts.guardFunCall++;
			// +1 is because of 'this'
			if (arguments.length + 1 !== t.argTypes.length) {
				throw new CastError("function has the wrong number of parameters");
			}

			// obj's code is safe, so it needs to intereact with safe mimics rather than the dirty data from outside
			var args = [];

			for (var i = 0; i < arguments.length; i++) {
				args[i] = mimic(t.argTypes[i + 1], arguments[i]);
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

			var prop = getPropertyDescriptor(obj, propName);
			Object.defineProperty(x, propName, {
				enumerable: prop.enumerable,
				get: function() {
					if (doCount) counts.guardReadProp++;
					return guard(t.memberTypes[propName], obj[propName]);
				},
				set: function(y) {
					if (doCount) counts.guardWriteProp++;
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
		// again maybe dynamic (which I can know at compiletime)
		return obj;
	} else {
		console.error(t);
		throw new CastError("Unexpected kind");
	}
}



// courtesy of https://gist.github.com/WebReflection/3373484
function getPropertyDescriptor(o, name) {
	var proto = o, descriptor = Object.getOwnPropertyDescriptor(proto, name);
	while (proto && descriptor === undefined) {
		descriptor = Object.getOwnPropertyDescriptor(proto, name);
	 	proto = proto.__proto__;
	 }
	return descriptor;
}