function addFoo() {
    t.foo = function() {};
}

var t = {};
addFoo();
t.foo();