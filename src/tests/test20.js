// jstyper start
var f = function fac(x) {
	if (x > 0) return x * fac(x-1);
	return 1;
}

var a = function apply(foo, x) {
	return foo(x);	
}

a(f, 6);
// jstyper end

