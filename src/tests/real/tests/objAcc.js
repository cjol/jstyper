var acc = {
	biggestResult:0,
	totals:0
};
// jstyper start
// jstyper import concat
// jstyper import accumulate
for (var i=0; i<100; i++) {
	accumulate({bigFunc:function(x) {return x.size()*x.size();}});
	accumulate({bigFunc:function(x) {return x.size()%x.size();}});
	accumulate({bigFunc:function(x) {return x.size()/x.size();}});
	accumulate({bigFunc:function(x) {return x.size()-x.size();}});
	accumulate({bigFunc:function(x) {return x.size()+x.size();}});
	accumulate({bigFunc:function(x) {return 10 * x.size()+x.size();}});
}

// jstyper end

function accumulate(obj) {
	var o = {size:function(){return 7;}};
	if (obj.bigFunc(o) > acc.biggestResult) {
		acc.bigFunc = obj.bigFunc;
		acc.biggestResult = obj.bigFunc(o);
	}
	acc.totals += obj.bigFunc(o);
}