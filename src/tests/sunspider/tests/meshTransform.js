// lightly adapted from http://dromaeo.com/tests/sunspider-3d-morph.html
// jstyper start
// jstyper import Math

var loops = 60;
var nx = 120;
var nz = 120;

function morph(a,f) {
    var PI2nx = Math.PI * 8/nx;
    var sin = Math.sin;
    var f30 = -(50 * sin(f*Math.PI*2));
    
    for (var i = 0; i < nz; ++i) {
        for (var j = 0; j < nx; ++j) {
            a[3*(i*nx+j)+1]    = sin((j-1) * PI2nx ) * -f30;
        }
    }
}
// NB I moved testBody into a function to avoid having to type 'new Date()'
function testBody() {
   for (var i = 0; i < loops; ++i) {
        morph(a, i/loops);
    } 
}
    
// replace 'new Array()' notation
var a = [];
for (var i=0; i < nx*nz*3; ++i) a[i] = 0;

// jstyper end

var startTime=new Date() ;
testBody();
var endTime=new Date() ;
alert("Test took " + (endTime - startTime) + "ms");