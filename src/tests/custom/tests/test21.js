// jstyper start

// I think this should fail, but it currently doesn't because 
// the definition of x on line 8 hasn't been seen when foo is typed
function foo() {
	x = 5;
}
var x = true;
foo();
// jstyper end

