// testing 'inference mode'
// jstyper start

function applyToBigCircle(f,x) {
	if (x.radius> 5) {
		return f(x);
	}
	return x;
}

var y = {};
// function f(a,b){}
if (y.radius> 5) {
	// f(x)
}

// jstyper end