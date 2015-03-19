// for reading tests
var fs = require("fs");

// for type-checking and compilation
var jstyper = require("../jstyper");


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

					it('should type the right number of sections', function() {

						expect(result.judgements.length).toEqual(expected.types.length);

					});

					result.judgements.forEach(function(chunk, i) {
						describe('section ' + i, function() {

							it('should type the right number of variables', function() {
								expect(chunk.length).toEqual(expected.types[i].length);
							});

							// types are in reverse order in the output
							// TODO: fix this in the output rather than the test?
							// chunk.reverse();
							console.log(chunk);
							console.log(expected.types[i]);
							console.log();
							chunk.forEach(function(tee, j) {
								describe('variable ' + j, function() {


									var eName = expected.types[i][j][0];
									it('should correctly type \'' + eName + '\'', function() {
										expect(tee.name).toEqual(eName);
										expect(tee.type.type).toEqual(expected.types[i][j][1]);
									});
								});

							});
						});
					});

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