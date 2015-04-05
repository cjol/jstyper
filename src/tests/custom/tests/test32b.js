// jstyper start
function f(x) {
	if (true) {
		x.foo = 1;
		x.foobar = {
			foo: 3,
			inner: true
		};
		x.extra1 = true;
		x.infer++;
	} else {
		x.bar = 1;
		x.foobar = {
			bar: 2
		};
		x.foobar.inner = false;
		x.extra2 = "hello";
		x.infer2++;
	}
	x.comp++;
	return x;
}