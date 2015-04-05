// the fact that statements 2 and 3 aren't executed in f is irrelevant.
// I wanted to test the return type of g when there is already a 'return' in gamma
// jstyper start

function f() {
	return 5;
	var g = function() {

	}
	return 0;
}
function l() {

}
// jstyper end