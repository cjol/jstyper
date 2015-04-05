// expected result: success

// jstyper start
function circleArea() {
	return this.radius * this.radius;
}

var circle = {radius:3, area: circleArea};
var x = circle.area() + circle.area();
// jstyper end