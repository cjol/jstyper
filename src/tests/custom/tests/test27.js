// testing 'inference mode' within a function
// expect success
// jstyper start

function applyToBigCircle(f,x) {
	if (x.radius> 5) {
		return f(x);
	}
	return x;
}

// jstyper end