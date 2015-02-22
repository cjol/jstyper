// expected result: pass - the extra data doesn't make a difference
// NB should this work if x has extra, but not y? Probably not...
// jstyper start
var x = {
	"hello": "world",
	myValue: {
		i:true
	}
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


