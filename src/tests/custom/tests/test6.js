// Expected result: pass, with only z being type-checked as number (y (and i) are ignored)
var y, z, i;
// jstyper start 
// jstyper import y, z, i
var x = 5;
x = y = z;
// jstyper end