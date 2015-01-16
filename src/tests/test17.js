// jstyper start
var areaCalculators = {};
areaCalculators.rectangle = function(rectangle) {
	return rectangle.height * rectangle.width;
};
areaCalculators.circle = function(circle) {
	return circle.radius * circle.radius;
};

var circle = {radius:3};
var rectangle = {height:2, width:3};
areaCalculators.circle(circle);
areaCalculators.square(circle);
// jstyper end