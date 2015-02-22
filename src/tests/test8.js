// expected result: pass, but fail if you add "var scopeTest" before the if
// jstyper start
	
if (true) {
	// try initialising the scopeTest var outside the if
	scopeTest = true;
} else {
	scopeTest = 5;
}

// jstyper end