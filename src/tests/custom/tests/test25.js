// testing variable shadowing
// expected result: PASS, typing the x on line 3 as number, and the x on line 6 as boolean
// jstyper start
var x = 5;
function myFun(x) {
	if (x) {
		return 0;
	} else {
		return 1;
	}
}

// jstyper end