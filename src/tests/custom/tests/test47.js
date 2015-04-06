// jstyper start
function f(y) {
	while (y.condition) {
		y.condition = false;
		y.foo = 1;
		y.infer++;
	}
	y.bar = 0;
	y.infer2++;
	return y;
}
// jstyper end