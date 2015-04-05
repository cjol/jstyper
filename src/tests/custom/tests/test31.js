// NB This types f as requiring foo, due to approximations
// If f is called without foo, it will fail (even if it might have been safe)

// jstyper start
function f(y) {
	if (true) {
		y = {};
	} else {
		y = {foo:5};
	}
	y;
}
// jstyper end