// expected result: PASS, with the final y: {foobar:{member: number}}
// jstyper start
function f(y) {
	y;
	y.member = '6';	
	y.foo += 6;	
	return y;
}
// jstyper end