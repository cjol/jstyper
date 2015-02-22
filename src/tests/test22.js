// if given an object with foo<10, returns bool->number, else returns a number directly
var weird = function(arg) {
	if (arg.foo < 10) {
		return function(b) {
			if (b) return 0;	
		}
	} else {
		return 0;
	}
}

// jstyper start 
// jstyper import weird

var fun = weird({foo:5});

var x = fun(true) + 1;