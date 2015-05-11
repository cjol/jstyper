// jstyper import JSON
function filter(xs, p) {
    var result = [];
    var item = 0;
    for (var i = 0; i < xs.length; i++) {
        if (p(xs[i])) {
            result[item++] = xs[i];
        }
    }
    return result;
}

var total = 0;

for (var i = 0; i < 2048; i++) {
    var r = filter([ "true", "true", "false", "false", "true" ], mimic({
        kind: "object",
        memberTypes: {
            parse: {
                kind: "function",
                argTypes: [ {
                    kind: "primitive",
                    type: "undefined"
                }, {
                    kind: "primitive",
                    type: "string"
                } ],
                returnType: {
                    kind: "primitive",
                    type: "boolean"
                }
            }
        }
    }, JSON).parse);
    total += r.length;
}