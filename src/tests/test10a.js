// expected result: fail - {} does not have foo 
// jstyper start
var x = {};

// NB Setting x = {} here would work.
x.foo = 5;
x = {};
// jstyper end