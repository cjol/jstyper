// for reading tests
var fs = require("fs");

// for type-checking and compilation
var jstyper = require("../jstyper");

var ignored;
ignored = [];
// ignored = [1,2,3,4,5,6,7,8,9];

function compareTypes(actual, expected) {
	// console.log("Comparing \n");
	// console.log(actual); 
	// console.log(expected);
	// console.log("\n\n\n");

	if (typeof expected === "string") {
		// we're expecting a primitive or abstract type
		expect(actual).toEqual(expected);
	} else {
		// more complex type
		switch(expected.type) {
			case "wrapper": 
				compareTypes(actual.innerType, expected.innerType);
				break;
			case "object":
				expect(actual.type).toEqual("object");
				expect(actual.memberTypes.length).toEqual(expected.memberTypes.length);
				for (var key in expected.memberTypes) {
					compareTypes(actual.memberTypes[key], expected.memberTypes[key]);
				}
				break;
			default:
				throw new Error("Unexpected expectation type");
		}
	}
}

describe("Custom test", function() {
	var files = fs.readdirSync(process.cwd() + '/tests/');

	files.forEach(function(file) {

		var stem = file.slice(0, -3);

		for (var i=0; i<ignored.length; i++) {
			if (stem === "test" + ignored[i]) return;
		}

		try {
			var expected = JSON.parse(fs.readFileSync("./results/" + stem + ".json", "utf8"));
			describe("'" + stem + "'", function() {

				var src = fs.readFileSync("./tests/" + file, "utf8");

				var compile = false;
				var result;
				try {
					result = jstyper(src);
					compile = true;
				} catch (e) {

				}

				if (expected.success) {
					it('should compile', function() {

						expect(compile).toEqual(true);
					});

					var assertCorrect = function (line, col) {
						return function() {
							expect(result.judgements[line]).toBeDefined();
							expect(result.judgements[line][col]).toBeDefined();

							compareTypes(result.judgements[line][col], expected.types[line][col]);
						};
					};

					for (var line in expected.types) {
						for (var col in expected.types[line]) {
							it ('should correctly type the symbol at l' + line + 'c' + col, 
								assertCorrect(line, col));
						}
					}

					// TODO: Further tests to check gradual typing is correct

				} else {
					it('should fail', function() {

						expect(compile).not.toEqual(true);
						// TODO? Be more specific about which errors count as a success
					});
				}
			});
		} catch (e) {
			// probably result didnt exist
			// console.log(e);
		}
	});

});