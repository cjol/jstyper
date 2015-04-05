// expected result: pass, with x.foo wrapped at both use points
// NB Currently over-wraps, with the inner parameter x wrapped unnecessarily
// jstyper start
// jstyper import x
var x = {};
x.foo = function(x) {
	return x || true;
};
x.foo(false);
// jstyper end