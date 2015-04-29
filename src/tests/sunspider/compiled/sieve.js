// jstyper import shiftLeft
function nsieve(m, isPrime) {
    var i, k, count;
    for (i = 2; i <= m; i++) {
        isPrime[i] = true;
    }
    count = 0;
    for (i = 2; i <= m; i++) {
        if (isPrime[i]) {
            for (k = i + i; k <= m; k += i) isPrime[k] = false;
            count++;
        }
    }
    return count;
}

for (var i = 1; i <= 2; i++) {
    var m = mimic({
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
    }, shiftLeft)(1, i) * 1e4;
    var flags = [];
    flags.length = m + 1;
    nsieve(m, flags);
}

function shiftLeft(x, y) {
    return x << y;
}