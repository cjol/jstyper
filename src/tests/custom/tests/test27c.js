// testing 'inference mode' within a function
// jstyper start

function f() {
	if (true) {
		return false;
	} 
	// no return if branch not taken
}

// jstyper end