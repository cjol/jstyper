// expected result: fail - {} does not have foo 
// jstyper start
var x = {
	foo :{}
};

x.foo.foo = 5;
x.foo = {};
// jstyper end