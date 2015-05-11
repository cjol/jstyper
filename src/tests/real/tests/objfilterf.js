// jstyper start
// jstyper import predicate
// jstyper import t
// jstyper import f

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
for (var i=0; i<100; i++) {
	var r = filter([{keep:t}, {keep:f},{keep:f},{keep:t},{keep:f}, {keep:f},{keep:f},{keep:t},{keep:f},{keep:t},{keep:f},{keep:t},{keep:f}], 
		predicate);	
	total += r.length;
}
// jstyper end
function t() {return 1;}
function f() {return 0;}

function predicate(item) {
	return item.keep();
}