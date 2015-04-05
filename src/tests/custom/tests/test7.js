// expected result: fail, z is treated as a bool at the end of line 5 because of bool x, and so p is a bool and a number
var z;
// jstyper start import z
var x = true;
var y = z = 'hello', p = x = z;
p = 6;
// jstyper end

