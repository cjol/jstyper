
/*****PRIIMITIVE********/

// jstyper import p
function f(p) {
	if (p) {
		return p;
	}
	return false;
}
// -->
function f(p) {
	if ((p = mimic(p, {
		kind: "primitive",
		type: "boolean"
	}))) {
		return p;
	}
	return false;
}
f(true); // true
f(false); // false
f(5); // error


/******** FUNCTION ********/

// jstyper import p
function f(p) {
	var x = {
		foo: true
	};
	if (p(x, true).bar) {
		return p;
	}
	return function() {
		return {
			bar: true
		};
	};
}

function f(p) {
	var x = {
		foo: true
	};
	var b = (p = mimic(p, {
			kind: "function",
			argTypes: [{
				kind: "primitive",
				type: "undefined"
			}, {
				kind: "object",
				memberTypes: {
					foo: {
						kind: "primitive",
						type: "boolean"
					}
				}
			}, {
				kind: "primitive",
				type: "boolean"
			}, ],
			returnType: {
				kind: "function",
				argTypes: [{
					kind: "primitive",
					type: "undefined"
				}],
				returnType: {
					kind: "object",
					memberTypes: {
						bar: {
							kind: "primitive",
							type: "boolean"
						}
					}
				}
			}
		}))
		(x, true)().bar;
	return p(x, 5);
}

f(function(o, b) {
	return function() {
		return {
			bar: o.foo
		};
	};
}); // function(o, b) {return {bar:b};}
f(function(o, b) {
	return {
		bar: 5
	};
}); // error
f("hello"); // error