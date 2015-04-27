var memwatch = require("memwatch");
var util = require('util');
var fs = require("fs")
var wrapperFunctions = fs.readFileSync("./js/wrappers.js");;

function profile(src) {
	memwatch.gc();
	var start = process.hrtime();
	var hd = new memwatch.HeapDiff();
	var doCount = false;
	eval(wrapperFunctions + "; " + src);
	var memDiff = hd.end();
	var time = process.hrtime(start);
	delete memDiff.change.details;
	return {
		time: time[0] + time[1]/1000000000,
		bytes: memDiff.change.size_bytes,
		alloc: memDiff.change.allocated_nodes,
		dealloc: memDiff.change.freed_nodes
	};
}

var r = profile(fs.readFileSync("./tests/" + process.argv[2] + ".js", "utf8"));
console.log(util.inspect(r, false, null));
