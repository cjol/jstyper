// for reading tests
var fs = require("fs");

// for type-checking and compilation
var jstyper = require("../jstyper");

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

				// need to check in both directions
				for (var key in expected.memberTypes) {
					expect(actual.memberTypes[key]).toBeDefined();
					compareTypes(actual.memberTypes[key], expected.memberTypes[key]);
				}
				for (key in actual.memberTypes) {
					expect(expected.memberTypes[key]).toBeDefined();
					compareTypes(actual.memberTypes[key], expected.memberTypes[key]);
				}
				break;
			case "function": 
				expect(actual.type).toEqual("function");
				expect(actual.argTypes.length).toEqual(expected.argTypes.length);
				for (var i = 0; i<expected.argTypes.length; i++) {
					compareTypes(actual.argTypes[i], expected.argTypes[i]);
				}
				compareTypes(actual.returnType, expected.returnType);
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

		describe("'" + stem + "'", function() {

			var src = fs.readFileSync("./tests/" + file, "utf8");
			var expected;
			try {
				expected = JSON.parse(fs.readFileSync("./results/" + stem + ".json", "utf8"));
				
			} catch (e) {
				// test hasn't been written yet
				xit("should have a test");
				return;
			}

			if (expected.incomplete) {
				xit("can't be run until the test framework is upgraded.");
				return;
			}

			var compile;
			var result;
			try {
				result = jstyper(src);
				compile = true;
			} catch (e) {
				compile = false;
			}

			it('should' + (expected.success?'':' fail to') + ' compile', function() {
				expect(compile).toEqual(expected.success);
			});

			if (compile && expected.success) {

				var assertCorrect = function(line, col) {
					return function() {
						expect(result.judgements[line]).toBeDefined();
						expect(result.judgements[line][col]).toBeDefined();

						compareTypes(result.judgements[line][col], expected.types[line][col]);
					};
				};

				for (var line in expected.types) {
					for (var col in expected.types[line]) {
						it('should correctly type the symbol at l' + line + 'c' + col,
							assertCorrect(line, col));
					}
				}

				// TODO: Further tests to check gradual typing is correct

			} 
		});
	});

});