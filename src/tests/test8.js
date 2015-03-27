// expected result: fail -- NB Is this contentious? Discussions of scope.
// jstyper start
	
if (true) {
	// try initialising the scopeTest var outside the if
	scopeTest = true;
} else {
	scopeTest = 5;
}

// jstyper end