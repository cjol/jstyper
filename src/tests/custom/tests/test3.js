// expected result: failure, x is both string and number
/* jstyper start */
var x, y=5; true; z=x="hello"; x=y;
/* jstyper end */
function untyped() {return x + true;}
