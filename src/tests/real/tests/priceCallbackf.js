// jstyper start
// jstyper import generateData
var total = 0;
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
	for (var i=0; i<200; i++) {
		callback({
			price:"£12.00",
		});
	}
}