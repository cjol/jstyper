// Expected result: pass, with only z being type-checked as number (y is ignored)
var i = 10;
// jstyper start 
// jstyper import y, z, i
x = 5;
x = y = z;
// jstyper end