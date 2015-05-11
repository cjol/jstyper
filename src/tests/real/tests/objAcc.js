var acc = {
	biggestResult:0,
	totals:0
};
// jstyper start
// jstyper import concat
// jstyper import accumulate
for (var i=0; i<2048; i++) {
	accumulate(function(x) {return x.size*x.size;});
	accumulate(function(x) {return x.size%x.size;});
	accumulate(function(x) {return x.size/x.size;});
	accumulate(function(x) {return x.size-x.size;});
	accumulate(function(x) {return x.size+x.size;});
	accumulate(function(x) {return 10 * x.size+x.size;});
}

// jstyper end

function accumulate(f) {
	var o = {size:7};
	if (f(o) > acc.biggestResult) {
		acc.bigFunc = f;
		acc.biggestResult = f(o);
	}
	acc.totals += f(o);
}