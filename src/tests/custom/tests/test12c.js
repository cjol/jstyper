// expected result: fail
// jstyper start
// jstyper import p
var y = {};
if (p) {
	y.foo = 3;
} else {
	y.foo = true;
}

// jstyper end