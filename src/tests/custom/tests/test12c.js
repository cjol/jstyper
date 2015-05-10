// expected result: fail
p = true;
// jstyper start
// jstyper import p
var y = {};
if (p) {
	y.foo = 3;
} else {
	y.foo = true;
}

// jstyper end