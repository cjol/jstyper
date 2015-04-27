// lightly adapted from http://dromaeo.com/tests/sunspider-3d-morph.html
// jstyper import Math
// loops: number
var loops = 60;

// nx: number
var nx = 120;

// nz: number
var nz = 120;

// morph: fn(undefined, [number], number -> undefined)
function morph(a, f) {
    // PI2nx: number
    // nx: number
    var PI2nx = mimic({
        kind: "object",
        memberTypes: {
            PI: {
                kind: "primitive",
                type: "number"
            }
        }
    }, Math).PI * 8 / nx;
    // sin: fn(undefined, number -> number)
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
    // f30: number
    // sin: fn(undefined, number -> number)
    // f: number
    var f30 = -(50 * sin(f * mimic({
        kind: "object",
        memberTypes: {
            PI: {
                kind: "primitive",
                type: "number"
            }
        }
    }, Math).PI * 2));
    for (// i: number
    // i: number
    // nz: number
    // i: number
    var i = 0; i < nz; ++i) {
        for (// j: number
        // j: number
        // nx: number
        // j: number
        var j = 0; j < nx; ++j) {
            // a: [number]
            // i: number
            // nx: number
            // j: number
            // sin: fn(undefined, number -> number)
            // j: number
            // PI2nx: number
            // f30: number
            a[3 * (i * nx + j) + 1] = sin((j - 1) * PI2nx) * -f30;
        }
    }
}

// replace 'new Array()' notation, and
// move up to before use b/c we don't support var hoisting
// a: [number]
var a = [];

// initialise array
for (// i: number
// i: number
// nx: number
// nz: number
// i: number
var i = 0; i < nx * nz * 3; ++i) // a: [number]
// i: number
a[i] = 0;

// apply transformatino (this is where the work happens)
for (// i: number
// i: number
// loops: number
// i: number
var i = 0; i < loops; ++i) {
    // morph: fn(undefined, [number], number -> undefined)
    // a: [number]
    // i: number
    // loops: number
    morph(a, i / loops);
}