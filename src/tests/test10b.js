// expected result: fail - {} does not have foo on line 8
// jstyper start
var x = {
	foo :{}
};

x.foo.bar = 5;
x.foo = {};
x;
// jstyper end