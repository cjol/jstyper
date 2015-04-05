/* jstyper start */

function getArea(circle)  {
	return circle.radius * circle.radius;
}

var shape = {height:4};
var area = getArea(shape);

if (area<5) {
	console.log("Small area");	
} else if (area >=5) {
	console.log("Large area");	
} else {
	console.log("This shouldn't ever happen");
}
// jstyper end;