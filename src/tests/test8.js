// expected result: fail
// jstyper start
var scopeTest;
if (true) {
	// try initialising the scopeTest var outside the if
	scopeTest = true;
} else {
	scopeTest = 5;
}

// jstyper end