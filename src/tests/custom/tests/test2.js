// EXPECTED RESULT: failure because y is number and string, or x is boolean and string
/* jstyper start */
var x, y = 2;
x = true;
5;
z = y = x = "hello";
/* jstyper end */