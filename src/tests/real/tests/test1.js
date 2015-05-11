// jstyper start
// jstyper import JSON

function filter(xs, p) {
	var result = [];
	var item = 0;
	for (var i=0; i<xs.length; i++) {
		if (p(xs[i])) {
			result[item++] = xs[i];
		}
	}
	return result;
}

var total = 0;
for (var i=0; i<2048; i++) {
	var r = filter(["true", "true", "false", "false", "true"], JSON.parse);	
	total += r.length;
}
// jstyper end