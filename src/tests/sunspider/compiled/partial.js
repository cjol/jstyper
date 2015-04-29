// jstyper import Math
function partial(n) {
    var a1, a2, a3, a4, a5, a6, a7, a8, a9;
    a1 = a2 = a3 = a4 = a5 = a6 = a7 = a8 = a9 = 0;
    var twothirds = 2 / 3;
    var alt = -1;
    var k2 = k3 = sk = ck = 0;
    for (var k = 1; k <= n; k++) {
        k2 = k * k;
        k3 = k2 * k;
        sk = mimic({
            kind: "object",
            memberTypes: {
                sin: {
                    kind: "function",
                    argTypes: [ {
                        kind: "abstract"
                    }, {
                        kind: "primitive",
                        type: "number"
                    } ],
                    returnType: {
                        kind: "abstract"
                    }
                }
            }
        }, Math).sin(k);
        ck = mimic({
            kind: "object",
            memberTypes: {
                cos: {
                    kind: "function",
                    argTypes: [ {
                        kind: "abstract"
                    }, {
                        kind: "primitive",
                        type: "number"
                    } ],
                    returnType: {
                        kind: "abstract"
                    }
                }
            }
        }, Math).cos(k);
        alt = -alt;
        a1 += mimic({
            kind: "object",
            memberTypes: {
                pow: {
                    kind: "function",
                    argTypes: [ {
                        kind: "abstract"
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
                }
            }
        }, Math).pow(twothirds, k - 1);
        a2 += mimic({
            kind: "object",
            memberTypes: {
                pow: {
                    kind: "function",
                    argTypes: [ {
                        kind: "abstract"
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
                }
            }
        }, Math).pow(k, -.5);
        a3 += 1 / (k * (k + 1));
        a4 += 1 / (k3 * sk * sk);
        a5 += 1 / (k3 * ck * ck);
        a6 += 1 / k;
        a7 += 1 / k2;
        a8 += alt / k;
        a9 += alt / (2 * k - 1);
    }
}

partial(2048 * 16);