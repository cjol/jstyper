// Expected result: pass, with str being type-checked as boolean
var str = "hey";
// jstyper start 
// jstyper import str
var x = true;
var y = x;
y = str;
// jstyper end