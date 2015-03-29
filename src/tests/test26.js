// testing polymorphism
// expected result: Success, because we have no requirements on x
// jstyper start
function foo(x) {
	x.bar = 5;	
}

foo({});
foo({foo:3});
// jstyper end

