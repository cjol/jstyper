// expected result: FAIL, because after the if, y won't have bar
// jstyper start
function f(y) {
	y = {foo:true}
	return y.bar || false;
}
// jstyper end