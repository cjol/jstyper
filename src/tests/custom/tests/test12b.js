// expected result: PASS, with the final y: {foobar:{member: number}}
// jstyper start

// NB This has type {foo:boolean} because of JSTyper approximation on line 15
// To solve the abs <= {foo:boolean}, we approximate the solution by substitution.
var y;
if (true) {
	y = {};
	y.foobar = {
		member: 4
	};
	y;
} else {
	y = {
		foo: false 
	};
	y.foo = true;
	y.foobar = {
		mymem: 5
	};
	y.foobar.member = 6;
	y;
}
y;
// jstyper end