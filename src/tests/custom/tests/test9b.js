// expected result: pass, with z typechecked as number
function yesIfBiggerThanFive(z) {
	
	// jstyper start 
	// jstyper import z
	var five = 5, test = z - five > 0, returnVal;
	
	if (test) {
		returnVal = 'yes';
	} else {
		returnVal = 'no';		
	}

	// jstyper end
	return returnVal;
}

var result = yesIfBiggerThanFive(true);