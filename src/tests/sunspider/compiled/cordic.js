// jstyper import shiftRight
var AG_CONST = .607252935;

function FIXED(X) {
    return X * 65536;
}

function FLOAT(X) {
    return X / 65536;
}

function DEG2RAD(X) {
    return .017453 * X;
}

var Angles = [ FIXED(45), FIXED(26.565), FIXED(14.0362), FIXED(7.12502), FIXED(3.57633), FIXED(1.78991), FIXED(.895174), FIXED(.447614), FIXED(.223811), FIXED(.111906), FIXED(.055953), FIXED(.027977) ];

function cordicsincos() {
    var X;
    var Y;
    var TargetAngle;
    var CurrAngle;
    var Step;
    X = FIXED(AG_CONST);
    /* AG_CONST * cos(0) */
    Y = 0;
    /* AG_CONST * sin(0) */
    TargetAngle = FIXED(28.027);
    CurrAngle = 0;
    for (Step = 0; Step < 12; Step++) {
        var NewX;
        if (TargetAngle > CurrAngle) {
            NewX = X - mimic({
                kind: "function",
                argTypes: [ {
                    kind: "primitive",
                    type: "undefined"
                }, {
                    kind: "primitive",
                    type: "number"
                }, {
                    kind: "primitive",
                    type: "number"
                } ],
                returnType: {
                    kind: "primitive",
                    type: "number"
                }
            }, shiftRight)(Y, Step);
            Y = mimic({
                kind: "function",
                argTypes: [ {
                    kind: "primitive",
                    type: "undefined"
                }, {
                    kind: "primitive",
                    type: "number"
                }, {
                    kind: "primitive",
                    type: "number"
                } ],
                returnType: {
                    kind: "primitive",
                    type: "number"
                }
            }, shiftRight)(X, Step) + Y;
            X = NewX;
            CurrAngle += Angles[Step];
        } else {
            NewX = X + mimic({
                kind: "function",
                argTypes: [ {
                    kind: "primitive",
                    type: "undefined"
                }, {
                    kind: "primitive",
                    type: "number"
                }, {
                    kind: "primitive",
                    type: "number"
                } ],
                returnType: {
                    kind: "primitive",
                    type: "number"
                }
            }, shiftRight)(Y, Step);
            Y = -mimic({
                kind: "function",
                argTypes: [ {
                    kind: "primitive",
                    type: "undefined"
                }, {
                    kind: "primitive",
                    type: "number"
                }, {
                    kind: "primitive",
                    type: "number"
                } ],
                returnType: {
                    kind: "primitive",
                    type: "number"
                }
            }, shiftRight)(X, Step) + Y;
            X = NewX;
            CurrAngle -= Angles[Step];
        }
    }
}

///// End CORDIC
function cordic(runs) {
    for (var i = 0; i < runs; i++) {
        cordicsincos();
    }
}

cordic(2500);

function shiftRight(x, y) {
    return x >> y;
}