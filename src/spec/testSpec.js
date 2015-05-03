// for reading tests
var fs = require("fs");
var util = require('util');

// for type-checking and compilation
var jstyper = require("../jstyper");

var extraMatchers = {
	toHaveProperty: function() {
		return {
			compare: function(actual, expected) {
				if (expected === undefined) {
					throw new Error("Can't check for empty property");
				}
				if (actual[expected] === undefined) {
					return {
						pass: false,
						message: "Expected " + actual + " to have property '" + expected + "'"
					};
				} else {
					return {
						pass: true,
						message: "Expected " + actual + " not to have property '" + expected + "'"
					};

				}
			}
		};
	}
};
var evalResults = [];
var wrapperFunctions = fs.readFileSync("./js/wrappers.js");
testDir('custom', "Custom Test");
testDir('sunspider', "Sunspider Test");
console.log(util.inspect(evalResults, false, null));

function testDir(dir, name) {

	describe(name, function() {
		beforeEach(function() {
			jasmine.addMatchers(extraMatchers);
		});

		console.log("looking at " + "./tests/" + dir + "/tests/");
		var files = fs.readdirSync("./tests/" + dir + "/tests/");

		files.forEach(function(file) {

			var stem = file.slice(0, -3);
			var testPath = "./tests/" + dir + "/tests/" + file;
			var resultPath = "./tests/" + dir + "/results/" + stem + ".json";

			// skip directories
			if (fs.lstatSync(testPath).isDirectory()) {
				return;
			}


			describe("'" + stem + "'", function() {

				if (!fs.existsSync(resultPath)) {
					it("should have a test", function() {
						pending("Test hasn't been written yet");
					});
					return;
				}

				var src = fs.readFileSync(testPath, "utf8");
				var resfile = fs.readFileSync(resultPath, "utf8");
				var expected = JSON.parse(resfile);

				if (expected.incomplete) {
					it("can't be useful until the test framework is upgraded.", function() {
						if (expected.reason === undefined) {
							pending();
						} else {
							pending(expected.reason);
						}
					});
					return;
				}

				var compile;
				var result;
				try {
					result = jstyper(src, true);
					compile = true;
				} catch (e) {
					compile = false;
				}

				it('should' + (expected.success ? '' : ' fail to') + ' compile', function() {
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

					if (expected.evaluate === true) {
						fs.writeFileSync("./tests/" + dir + "/compiled/" + file, result.src);					
					}
					// TODO: Further tests to check gradual typing is correct
					// Further tests to check execution

				}
			});
		});
	});
}

function compareTypes(actual, expected) {
	if (typeof expected === "string") {
		// we're expecting a primitive or abstract type
		expect(actual).toEqual(expected);
	} else {
		// more complex type
		switch (expected.type) {
			case "wrapper":
				compareTypes(actual.innerType, expected.innerType);
				break;
			case "object":
				expect(actual.type).toEqual("object");

				// need to check in both directions
				for (var key in expected.memberTypes) {
					expect(actual.memberTypes).toHaveProperty(key);
					compareTypes(actual.memberTypes[key], expected.memberTypes[key]);
				}
				for (key in actual.memberTypes) {
					if (expected.memberTypes[key] === undefined) {
						expect(actual.memberTypes).not.toHaveProperty(key);
					} else {
						compareTypes(actual.memberTypes[key], expected.memberTypes[key]);
					}
				}
				break;
			case "function":
				expect(actual.type).toEqual("function");
				expect(actual.argTypes.length).toEqual(expected.argTypes.length);
				for (var i = 0; i < expected.argTypes.length; i++) {
					compareTypes(actual.argTypes[i], expected.argTypes[i]);
				}
				compareTypes(actual.returnType, expected.returnType);
				break;
			case "array":
				// expect(actual.type).toEqual("array");
				var arrObjType = {
					"type": "object",
					"memberTypes": {
						"@deref": expected.innerType,
						"length": "number"
					}
				};
				compareTypes(actual, arrObjType);
				break;
			case "recursive":
				expect(actual.type).toEqual("recursive");
				break;
			default:
				throw new Error("Unexpected expectation type: " + expected.type);
		}
	}
}
