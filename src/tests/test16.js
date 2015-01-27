// jstyper start
var x = {
	getHeight: function(x) {
		return x.height;
	}
};
var one = {height:3, width:2};
var two = {height:2, width:3};
var totalHeight = x.getHeight(one) + x.getHeight(2);
// jstyper end