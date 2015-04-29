// lightly adapted from http://dromaeo.com/tests/sunspider-3d-morph.html
// jstyper import Math
var loops = 60;

var nx = 120;

var nz = 120;

function morph(a, f) {
    var PI2nx = mimic({
        kind: "object",
        memberTypes: {
            PI: {
                kind: "primitive",
                type: "number"
            }
        }
    }, Math).PI * 8 / nx;
    var sin = mimic({
        kind: "object",
        memberTypes: {
            sin: {
                kind: "function",
                argTypes: [ {
                    kind: "primitive",
                    type: "undefined"
                }, {
                    kind: "primitive",
                    type: "number"
                } ],
                returnType: {
                    kind: "primitive",
                    type: "number"
                }
            }
        }
    }, Math).sin;
    var f30 = -(50 * sin(f * mimic({
        kind: "object",
        memberTypes: {
            PI: {
                kind: "primitive",
                type: "number"
            }
        }
    }, Math).PI * 2));
    for (var i = 0; i < nz; ++i) {
        for (var j = 0; j < nx; ++j) {
            a[3 * (i * nx + j) + 1] = sin((j - 1) * PI2nx) * -f30;
        }
    }
}

// replace 'new Array()' notation, and
// move up to before use b/c we don't support var hoisting
var a = [];

// initialise array
for (var i = 0; i < nx * nz * 3; ++i) a[i] = 0;

// apply transformatino (this is where the work happens)
for (var i = 0; i < loops; ++i) {
    morph(a, i / loops);
}