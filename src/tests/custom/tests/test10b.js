// expected result: fail - {} does not have bar on line 8
// jstyper start
var x = {
	foo :{bar: 5}
};
x.foo = {};
x;
// jstyper end