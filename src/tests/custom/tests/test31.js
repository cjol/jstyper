// NB The first assignment to y seen sets the type for y. Here it is {}, so
// the second branch foo is treated as giving extra info. If we inverted the
// branches, this would conservatively fail.

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