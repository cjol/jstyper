// overcautious fail - because JSTyper doesn't allow growing by assignment

// jstyper start
function f(x, y) {
	y.pre++;
	x.prex++;
	x = y;	
}