// expected result: true, requiring y to have bar
// jstyper start
function f(y) {
	if (true) {
		y.foo = true;
	} else {
		y.foo = false;
	}
	return y.bar || false;
}
// jstyper end