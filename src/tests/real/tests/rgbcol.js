// jstyper start
// jstyper import getNthColour
// jstyper import getRGBColour
// jstyper import getBrightness
var totalBrightness = 0;
for (var j=0; j<2048/89; j++) {
	for (var i=1; i<89; i++) {
		var s = {
			x:i/10,
			y:i%10,
			colour: getNthColour(i)
		};
		s.rgb = getRGBColour(s);
		s.brightness = getBrightness(s);
		totalBrightness += s.brightness;
	}
}
// jstyper end
function getNthColour(n) {
	return "#" + (n+10) + (10 + n%7 + n%30) + "FF";
}
function getRGBColour(shape) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(shape.colour);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function getBrightness(shape) {
	return (shape.rgb.r + shape.rgb.g + shape.rgb.b) / (255*3);
}