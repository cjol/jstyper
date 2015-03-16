// if given an object with foo<10, returns bool->bool, else returns a number
// directly
var weird = function(arg) {
	if (arg.foo < 10) {
		return function(b) {
			if (b) return false;	
		};
	} else {
		return 0;
	}
};

// jstyper start 
// jstyper import weird

var fun = weird({foo:5});

// Note that it is NOT type-safe to use the result of weird as defined above.
// fun(true) will return false, on which + is not defined

// without jstyper, x would have the value 2
// with type checking, executing the next line will throw an error
var x = fun(true) + 1;

// jstyper end

console.log(x);