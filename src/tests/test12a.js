// expected result: success, but the y defined on line 3 has a different type to the one on line 8
// jstyper start
var y = {
	one:1,
	two:2
};
y.result = y.one + y.two;
var x = y;

// jstyper end