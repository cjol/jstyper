// jstyper import predicate
// jstyper import f
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

for (var i = 0; i < 100; i++) {
    var r = filter([ {
        keep: mimic({
            kind: "abstract"
        }, t)
    }, {
        keep: mimic({
            kind: "abstract"
        }, f)
    }, {
        keep: mimic({
            kind: "abstract"
        }, f)
    }, {
        keep: mimic({
            kind: "abstract"
        }, t)
    }, {
        keep: mimic({
            kind: "abstract"
        }, f)
    }, {
        keep: mimic({
            kind: "abstract"
        }, f)
    }, {
        keep: mimic({
            kind: "abstract"
        }, f)
    }, {
        keep: mimic({
            kind: "abstract"
        }, t)
    }, {
        keep: mimic({
            kind: "abstract"
        }, f)
    }, {
        keep: mimic({
            kind: "abstract"
        }, t)
    }, {
        keep: mimic({
            kind: "abstract"
        }, f)
    }, {
        keep: mimic({
            kind: "abstract"
        }, t)
    }, {
        keep: mimic({
            kind: "abstract"
        }, f)
    } ], mimic({
        kind: "function",
        argTypes: [ {
            kind: "primitive",
            type: "undefined"
        }, {
            kind: "object",
            memberTypes: {
                keep: {
                    kind: "abstract"
                }
            }
        } ],
        returnType: {
            kind: "primitive",
            type: "boolean"
        }
    }, predicate));
    total += r.length;
}

function t() {
    return 1;
}

function f() {
    return 0;
}

function predicate(item) {
    return item.keep();
}