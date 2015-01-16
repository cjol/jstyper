// jstyper start
var areaCalculators = {};
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