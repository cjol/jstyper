// expected result: pass, with x: {foo: ({x}, boolean->boolean)}
// jstyper start
var x = {};
x.foo = function(x) {
	return x || true;
};
x.foo(false);
// jstyper end