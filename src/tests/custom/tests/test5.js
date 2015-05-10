// Expected result: pass, with str being type-checked as boolean (will fail in evaluation)
var str = "hey";
// jstyper start 
// jstyper import str
var x = false;
var y = x;
y = str;
// jstyper end