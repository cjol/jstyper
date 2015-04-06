// expected: fail (some paths have no return)
// jstyper start
var f = function() {
	if (true) return true;
	return 0;
};
// jstyper end

