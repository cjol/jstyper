// expected result: fail - {} does not have foo 
// jstyper start
var x = {
	foo :{}
};
function getXFoo() {
	return x.foo;
}
getXFoo().bar = 5;

// jstyper end