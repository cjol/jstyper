var acc = {
    biggestResult: 0,
    totals: 0
};

// jstyper import concat
for (var i = 0; i < 2048; i++) {
    mimic({
        kind: "function",
        argTypes: [ {
            kind: "primitive",
            type: "undefined"
        }, {
            kind: "function",
            argTypes: [ {
                kind: "abstract"
            }, {
                kind: "object",
                memberTypes: {
                    size: {
                        kind: "primitive",
                        type: "number"
                    }
                }
            } ],
            returnType: {
                kind: "primitive",
                type: "number"
            }
        } ],
        returnType: {
            kind: "abstract"
        }
    }, accumulate)(function(x) {
        return x.size * x.size;
    });
    mimic({
        kind: "function",
        argTypes: [ {
            kind: "primitive",
            type: "undefined"
        }, {
            kind: "function",
            argTypes: [ {
                kind: "abstract"
            }, {
                kind: "object",
                memberTypes: {
                    size: {
                        kind: "primitive",
                        type: "number"
                    }
                }
            } ],
            returnType: {
                kind: "primitive",
                type: "number"
            }
        } ],
        returnType: {
            kind: "abstract"
        }
    }, accumulate)(function(x) {
        return x.size % x.size;
    });
    mimic({
        kind: "function",
        argTypes: [ {
            kind: "primitive",
            type: "undefined"
        }, {
            kind: "function",
            argTypes: [ {
                kind: "abstract"
            }, {
                kind: "object",
                memberTypes: {
                    size: {
                        kind: "primitive",
                        type: "number"
                    }
                }
            } ],
            returnType: {
                kind: "primitive",
                type: "number"
            }
        } ],
        returnType: {
            kind: "abstract"
        }
    }, accumulate)(function(x) {
        return x.size / x.size;
    });
    mimic({
        kind: "function",
        argTypes: [ {
            kind: "primitive",
            type: "undefined"
        }, {
            kind: "function",
            argTypes: [ {
                kind: "abstract"
            }, {
                kind: "object",
                memberTypes: {
                    size: {
                        kind: "primitive",
                        type: "number"
                    }
                }
            } ],
            returnType: {
                kind: "primitive",
                type: "number"
            }
        } ],
        returnType: {
            kind: "abstract"
        }
    }, accumulate)(function(x) {
        return x.size - x.size;
    });
    mimic({
        kind: "function",
        argTypes: [ {
            kind: "primitive",
            type: "undefined"
        }, {
            kind: "function",
            argTypes: [ {
                kind: "abstract"
            }, {
                kind: "object",
                memberTypes: {
                    size: {
                        kind: "primitive",
                        type: "number"
                    }
                }
            } ],
            returnType: {
                kind: "primitive",
                type: "number"
            }
        } ],
        returnType: {
            kind: "abstract"
        }
    }, accumulate)(function(x) {
        return x.size + x.size;
    });
    mimic({
        kind: "function",
        argTypes: [ {
            kind: "primitive",
            type: "undefined"
        }, {
            kind: "function",
            argTypes: [ {
                kind: "abstract"
            }, {
                kind: "object",
                memberTypes: {
                    size: {
                        kind: "primitive",
                        type: "number"
                    }
                }
            } ],
            returnType: {
                kind: "primitive",
                type: "number"
            }
        } ],
        returnType: {
            kind: "abstract"
        }
    }, accumulate)(function(x) {
        return 10 * x.size + x.size;
    });
}

function accumulate(f) {
    var o = {
        size: 7
    };
    if (f(o) > acc.biggestResult) {
        acc.bigFunc = f;
        acc.biggestResult = f(o);
    }
    acc.totals += f(o);
}