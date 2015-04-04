// expected result: PASS, with the final y: {foobar:{member: number}}
// jstyper start
var y;
if (true) {
	y = {foo:true};
	y.foobar = 5;
	y;
} else {
	y = {
		foo: false 
	};
}
y;
// jstyper end