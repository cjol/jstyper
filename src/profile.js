// var memwatch = require("memwatch");
var util = require('util');
var fs = require("fs");
var wrapperFunctions = fs.readFileSync("./js/wrappers.js");

// TODO: time compilation

if (process.argv[2][0] === "-") {
	if (process.argv[2] === "-count") {
		var src = fs.readFileSync("./tests/" + process.argv[3], "utf8");
		var doCount = true;
		eval(wrapperFunctions + "; " + src);
		var r = counts;
		console.log(
			r.mimic + ", " +
			r.guard + ", " +
			r.mimicReadProp + ", " +
			r.mimicWriteProp + ", " +
			r.mimicFunCall + ", " +
			r.guardReadProp + ", " +
			r.guardWriteProp + ", " +
			r.guardFunCall
		)
	} else {
		throw Error("Incorrect usage (the only legal parameter is -count)");
	}
} else {
	var src = fs.readFileSync("./tests/" + process.argv[2], "utf8");

	var start = process.hrtime();
	var hd = new memwatch.HeapDiff();
	var doCount = false;
	eval(wrapperFunctions + "; " + src);
	var memDiff = hd.end();
	var time = process.hrtime(start);
	delete memDiff.change.details;
	var r = {
		time: time[0] + time[1]/1000000000,
		bytes: memDiff.change.size_bytes,
		alloc: memDiff.change.allocated_nodes,
		dealloc: memDiff.change.freed_nodes
	};
	console.log(r.time + ", " + r.bytes + ", " + r.alloc + ", " + r.dealloc);
}