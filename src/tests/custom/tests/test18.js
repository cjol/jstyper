// expected result: failure, can fix by removing the parameter from
// rectangleArea, and replacing circleArea with rectangleArea in the rectangle
// definition (test18a)

// jstyper start
function rectangleArea(rectangle) {
	return this.height * this.width;
}
function circleArea() {
	return this.radius * this.radius;
}

var circle = {radius:3, area: circleArea};

var rectangle = {height:2, width:3, area:circleArea};

var totalArea = circle.area() + rectangle.area();

// jstyper end