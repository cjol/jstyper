// expected result: success

// jstyper start
function rectangleArea() {
	return this.height * this.width;
}
function circleArea() {
	return this.radius * this.radius;
}

var circle = {radius:3, area: circleArea};

var rectangle = {height:2, width:3, area:rectangleArea};

// var totalArea = circle.area() + 3;
var totalArea = circle.area() + circle.area() ;

// jstyper end