// expected: fail, giving boolean instead of number
// jstyper start
(function(x) {
	return x + 1;
})(true);
// jstyper end