// expected result: PASS, with y: {}
// jstyper start
var y;
if (true) {
	y = {};
} else {
	y = {foo:0};
}
y;
// jstyper end