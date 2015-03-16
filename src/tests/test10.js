// expected result: pass - the extra data doesn't make a difference
// jstyper start
var x = {
	"hello": "world",
	myValue: {
		i:true
	}
	// NB Putting extra: 5 here instead of in y causes fail
	// also causes a failure to put extra: true here
};
var y = {
	"hello": "jupiter",
	myValue: {
		i:false	
	},
	extra:5
};

// e.g. function call with actual parameter y, formal parameter x
x = y;
// jstyper end


