// jstyper import generateData
var total = 0;

var data = [];

function processData(datum) {
    total += datum.price;
    datum.localCurrency = "gbp";
    data[data.length - 1] = datum;
    return datum;
}

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
                price: {
                    kind: "primitive",
                    type: "number"
                }
            }
        } ],
        returnType: {
            kind: "object",
            memberTypes: {
                localCurrency: {
                    kind: "primitive",
                    type: "string"
                },
                price: {
                    kind: "primitive",
                    type: "number"
                }
            }
        }
    } ],
    returnType: {
        kind: "abstract"
    }
}, generateData)(processData);

function generateData(callback) {
    for (var i = 0; i < 200; i++) {
        callback({
            price: "£12.00"
        });
    }
}