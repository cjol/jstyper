// jstyper start
// jstyper import generateData
var total = 0;
var result = true;
var data = [];
function processData(datum) {
	total += datum.price;
	datum.localCurrency = "gbp";
	data[data.length-1] = datum;
	return datum;
}

generateData(processData);
// jstyper end
function generateData(callback) {
	for (var i=0; i<2048; i++) {
		var d = callback({
			price:i%13
		});
		result = result && d.localCurrency === "gbp";
	}
}