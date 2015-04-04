// jstyper start
function f(x) {
	x.init = 'yes';
	if (true) {
		x.foo = 1;
		x.foo1++;
		x.foobar = true;
	} else {
		x.bar = 1;
		x.bar1++;
		x.foobar = false;
	}

	x.count++;
	return x;
}