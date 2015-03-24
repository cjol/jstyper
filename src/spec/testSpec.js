// for reading tests
var fs = require("fs");

// for type-checking and compilation
var jstyper = require("../jstyper");


function compareTypes(actual, expected) {
	if (typeof expected === "string") {
		if (expected === "abstract") {
			expect(actual.isConcrete).toEqual(false);
		} else {
			// we're expecting a primitive type
			expect(actual.type).toEqual(expected);
			
		}
	} else {
		// more complex type
		switch(expected.type) {
			case "wrapper": 
				compareTypes(actual.innerType, expected.innerType);
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