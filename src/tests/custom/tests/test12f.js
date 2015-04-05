// expected result: FAIL, because after the if, y won't have bar
// jstyper start
function f(y) {
	if (true) {
		y = {
			foo: true
		};
	} else {
		y = {
			foo: false
		};
	}
	return y.bar || false;
}
// jstyper end