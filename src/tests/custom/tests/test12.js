// expected result: fail, y.result is used as bool and number
// jstyper start
var y = {
	one:1,
	two:2
};
y.result = y.one + y.two;
y.result = true;
// jstyper end