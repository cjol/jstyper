// adapted from http://dromaeo.com/tests/sunspider-3d-raytrace.html
// main adaptations are removing prototypes and array notation
// jstyper start
// jstyper import Math
function createVector(x,y,z) {
    return [x,y,z];
    // return new Array(x,y,z);
}

function sqrLengthVector(self) {
    return self[0] * self[0] + self[1] * self[1] + self[2] * self[2];
}

function lengthVector(self) {
    return Math.sqrt(self[0] * self[0] + self[1] * self[1] + self[2] * self[2]);
}

function addVector(self, v) {
    self[0] += v[0];
    self[1] += v[1];
    self[2] += v[2];
    return self;
}

function subVector(self, v) {
    self[0] -= v[0];
    self[1] -= v[1];
    self[2] -= v[2];
    return self;
}

function scaleVector(self, scale) {
    self[0] *= scale;
    self[1] *= scale;
    self[2] *= scale;
    return self;
}

function normaliseVector(self) {
    var len = Math.sqrt(self[0] * self[0] + self[1] * self[1] + self[2] * self[2]);
    self[0] /= len;
    self[1] /= len;
    self[2] /= len;
    return self;
}

function add(v1, v2) {
    return [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
}

function sub(v1, v2) {
    return [v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]];
}

function scalev(v1, v2) {
    return [v1[0] * v2[0], v1[1] * v2[1], v1[2] * v2[2]];
}

function dot(v1, v2) {
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}

function scale(v, scale) {
    return [v[0] * scale, v[1] * scale, v[2] * scale];
}

function cross(v1, v2) {
    return [v1[1] * v2[2] - v1[2] * v2[1], 
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0]];

}

function normalise(v) {
    var len = lengthVector(v);
    return [v[0] / len, v[1] / len, v[2] / len];
}

function transformMatrix(self, v) {
    var vals = self;
    var x  = vals[0] * v[0] + vals[1] * v[1] + vals[2] * v[2] + vals[3];
    var y  = vals[4] * v[0] + vals[5] * v[1] + vals[6] * v[2] + vals[7];
    var z  = vals[8] * v[0] + vals[9] * v[1] + vals[10] * v[2] + vals[11];
    return [x, y, z];
}

function invertMatrix(self) {
    // NB temp previously had size initialized to 16
    var temp = [];
    var tx = -self[3];
    var ty = -self[7];
    var tz = -self[11];
    for (h = 0; h < 3; h++) 
        for (v = 0; v < 3; v++) 
            temp[h + v * 4] = self[v + h * 4];
    for (i = 0; i < 11; i++)
        self[i] = temp[i];
    self[3] = tx * self[0] + ty * self[1] + tz * self[2];
    self[7] = tx * self[4] + ty * self[5] + tz * self[6];
    self[11] = tx * self[8] + ty * self[9] + tz * self[10];
    return self;
}


// Triangle intersection using barycentric coord method
function Triangle(p1, p2, p3) {
    var edge1 = sub(p3, p1);
    var edge2 = sub(p2, p1);
    var normal = cross(edge1, edge2);
    var triangle = {};
    if (Math.abs(normal[0]) > Math.abs(normal[1]))
        if (Math.abs(normal[0]) > Math.abs(normal[2]))
            triangle.axis = 0; 
        else 
            triangle.axis = 2;
    else
        if (Math.abs(normal[1]) > Math.abs(normal[2])) 
            triangle.axis = 1;
        else 
            triangle.axis = 2;
    var u = (triangle.axis + 1) % 3;
    var v = (triangle.axis + 2) % 3;
    var u1 = edge1[u];
    var v1 = edge1[v];
    
    var u2 = edge2[u];
    var v2 = edge2[v];
    triangle.normal = normalise(normal);
    triangle.nu = normal[u] / normal[triangle.axis];
    triangle.nv = normal[v] / normal[triangle.axis];
    triangle.nd = dot(normal, p1) / normal[triangle.axis];
    var det = u1 * v2 - v1 * u2;
    triangle.eu = p1[u];
    triangle.ev = p1[v]; 
    triangle.nu1 = u1 / det;
    triangle.nv1 = -v1 / det;
    triangle.nu2 = v2 / det;
    triangle.nv2 = -u2 / det; 
    triangle.material = [0.7, 0.7, 0.7];
    triangle.intersect = triangleIntersect;
    return triangle;
}

// potential problem: sometimes returns null, sometimes returns number
function triangleIntersect(orig, dir, near, far) {
    var u = (this.axis + 1) % 3;
    var v = (this.axis + 2) % 3;
    var d = dir[this.axis] + this.nu * dir[u] + this.nv * dir[v];
    var t = (this.nd - orig[this.axis] - this.nu * orig[u] - this.nv * orig[v]) / d;
    if (t < near || t > far)
        return null;
    var Pu = orig[u] + t * dir[u] - this.eu;
    var Pv = orig[v] + t * dir[v] - this.ev;
    var a2 = Pv * this.nu1 + Pu * this.nv1;
    if (a2 < 0) 
        return null;
    var a3 = Pu * this.nu2 + Pv * this.nv2;
    if (a3 < 0) 
        return null;

    if ((a2 + a3) > 1) 
        return null;
    return t;
}

function Scene(a_triangles) {
    var scene = {};
    scene.triangles = a_triangles;
    scene.lights = [];
    scene.ambient = [0,0,0];
    scene.background = [0.8,0.8,1];
    scene.intersect = sceneIntersect;
    scene.blocked = sceneBlocked;
    return scene;
}
var zero = [0,0,0];

function sceneIntersect(origin, dir, near, far) {
    var closest = null;
    for (i = 0; i < this.triangles.length; i++) {
        var triangle = this.triangles[i];   

        var d = triangle.intersect(origin, dir, near, far);
        // resolution depends on how we fix triangle.intersect's variadicity
        if (d == null || d > far || d < near)
            continue;
        far = d;
        closest = triangle;
    }
    
    if (!closest)
        return [this.background[0],this.background[1],this.background[2]];
        
    var normal = closest.normal;
    var hit = add(origin, scale(dir, far)); 
    if (dot(dir, normal) > 0)
        normal = [-normal[0], -normal[1], -normal[2]];
    
    var colour = null;
    if (closest.shader) {
        colour = closest.shader(closest, hit, dir);
    } else {
        colour = closest.material;
    }
    
    // do reflection
    var reflected = null;
    if (colour.reflection > 0.001) {
        var reflection = addVector(scale(normal, -2*dot(dir, normal)), dir);
        reflected = this.intersect(hit, reflection, 0.0001, 1000000);
        if (colour.reflection >= 0.999999)
            return reflected;
    }
    
    var l = [this.ambient[0], this.ambient[1], this.ambient[2]];
    for (var i = 0; i < this.lights.length; i++) {
        var light = this.lights[i];
        var toLight = sub(light, hit);
        var distance = lengthVector(toLight);
        scaleVector(toLight, 1.0/distance);
        distance -= 0.0001;
        if (this.blocked(hit, toLight, distance))
            continue;
        var nl = dot(normal, toLight);
        if (nl > 0)
            addVector(l, scale(light.colour, nl));
    }
    l = scalev(l, colour);
    if (reflected) {
        l = addVector(scaleVector(l, 1 - colour.reflection), scaleVector(reflected, colour.reflection));
    }
    return l;
}

function sceneBlocked(O, D, far) {
    var near = 0.0001;
    var closest = null;
    for (i = 0; i < this.triangles.length; i++) {
        var triangle = this.triangles[i];   
        var d = triangle.intersect(O, D, near, far);
        if (d == null || d > far || d < near)
            continue;
        return true;
    }
    
    return false;
}


// this camera code is from notes i made ages ago, it is from *somewhere* -- i cannot remember where
// that somewhere is
function Camera(origin, lookat, up) {
    var zaxis = normaliseVector(subVector(lookat, origin));
    var xaxis = normaliseVector(cross(up, zaxis));
    var yaxis = normaliseVector(cross(xaxis, subVector([0,0,0], zaxis)));
    var m = [];
    m[0] = xaxis[0]; m[1] = xaxis[1]; m[2] = xaxis[2];
    m[4] = yaxis[0]; m[5] = yaxis[1]; m[6] = yaxis[2];
    m[8] = zaxis[0]; m[9] = zaxis[1]; m[10] = zaxis[2];
    invertMatrix(m);
    m[3] = 0; m[7] = 0; m[11] = 0;
    var camera = {};
    camera.origin = origin;
    camera.directions = [];
    camera.directions[0] = normalise([-0.7,  0.7, 1]);
    camera.directions[1] = normalise([ 0.7,  0.7, 1]);
    camera.directions[2] = normalise([ 0.7, -0.7, 1]);
    camera.directions[3] = normalise([-0.7, -0.7, 1]);
    camera.directions[0] = transformMatrix(m, camera.directions[0]);
    camera.directions[1] = transformMatrix(m, camera.directions[1]);
    camera.directions[2] = transformMatrix(m, camera.directions[2]);
    camera.directions[3] = transformMatrix(m, camera.directions[3]);
    camera.generateRayPair = cameraGenerateRayPair;
    camera.render = cameraRender;
    return camera;
}

function cameraGenerateRayPair(y) {
    rays = [{},{}];
    rays[0].origin = this.origin;
    rays[1].origin = this.origin;
    rays[0].dir = addVector(scale(this.directions[0], y), scale(this.directions[3], 1 - y));
    rays[1].dir = addVector(scale(this.directions[1], y), scale(this.directions[2], 1 - y));
    return rays;
}

function renderRows(camera, scene, pixels, width, height, starty, stopy) {
    for (var y = starty; y < stopy; y++) {
        var rays = camera.generateRayPair(y / height);
        for (var x = 0; x < width; x++) {
            var xp = x / width;
            var origin = addVector(scale(rays[0].origin, xp), scale(rays[1].origin, 1 - xp));
            var dir = normaliseVector(addVector(scale(rays[0].dir, xp), scale(rays[1].dir, 1 - xp)));
            var l = scene.intersect(origin, dir);
            pixels[y][x] = l;
        }
    }
}

function cameraRender(scene, pixels, width, height) {
    var cam = this;
    var row = 0;
    renderRows(cam, scene, pixels, width, height, 0, height);
}



function raytraceScene(size)
{
    var numTriangles = 2 * 6;
    var triangles = [];
    var tfl = createVector(-10,  10, -10);
    var tfr = createVector( 10,  10, -10);
    var tbl = createVector(-10,  10,  10);
    var tbr = createVector( 10,  10,  10);
    var bfl = createVector(-10, -10, -10);
    var bfr = createVector( 10, -10, -10);
    var bbl = createVector(-10, -10,  10);
    var bbr = createVector( 10, -10,  10);
    
    // cube!!!
    // front
    var i = 0;
    
    triangles[i++] = Triangle(tfl, tfr, bfr);
    triangles[i++] = Triangle(tfl, bfr, bfl);
    // back
    triangles[i++] = Triangle(tbl, tbr, bbr);
    triangles[i++] = Triangle(tbl, bbr, bbl);

    // left
    triangles[i++] = Triangle(tbl, tfl, bbl);
    triangles[i++] = Triangle(tfl, bfl, bbl);

    // right
    triangles[i++] = Triangle(tbr, tfr, bbr);
    triangles[i++] = Triangle(tfr, bfr, bbr);

    // top
    triangles[i++] = Triangle(tbl, tbr, tfr);
    triangles[i++] = Triangle(tbl, tfr, tfl);

    // bottom
    triangles[i++] = Triangle(bbl, bbr, bfr);
    triangles[i++] = Triangle(bbl, bfr, bfl);
    
    //Floor!!!!
    var green = createVector(0.0, 0.4, 0.0);
    var grey = createVector(0.4, 0.4, 0.4);
    grey.reflection = 1.0;
    var floorShader = function(tri, pos, view) {
        var x = ((pos[0]/32) % 2 + 2) % 2;
        var z = ((pos[2]/32 + 0.3) % 2 + 2) % 2;
        if (x < 1 != z < 1) {
            //in the real world we use the fresnel term...
            //    var angle = 1-dot(view, tri.normal);
            //   angle *= angle;
            //  angle *= angle;
            // angle *= angle;
            //grey.reflection = angle;
            return grey;
        } else 
            return green;
    };
    var ffl = createVector(-1000, -30, -1000);
    var ffr = createVector( 1000, -30, -1000);
    var fbl = createVector(-1000, -30,  1000);
    var fbr = createVector( 1000, -30,  1000);
    triangles[i++] = Triangle(fbl, fbr, ffr);
    triangles[i-1].shader = floorShader;
    triangles[i++] = Triangle(fbl, ffr, ffl);
    triangles[i-1].shader = floorShader;
    
    var _scene = Scene(triangles);
    _scene.lights[0] = createVector(20, 38, -22);
    _scene.lights[0].colour = createVector(0.7, 0.3, 0.3);
    _scene.lights[1] = createVector(-23, 40, 17);
    _scene.lights[1].colour = createVector(0.7, 0.3, 0.3);
    _scene.lights[2] = createVector(23, 20, 17);
    _scene.lights[2].colour = createVector(0.7, 0.7, 0.7);
    _scene.ambient = createVector(0.1, 0.1, 0.1);
    
    var pixels = [];
    for (var y = 0; y < size; y++) {
        pixels[y] = [];
        for (var x = 0; x < size; x++) {
            pixels[y][x] = 0;
        }
    }

    var _camera = Camera(createVector(-40, 40, 40), createVector(0, 0, 0), createVector(0, 1, 0));
    _camera.render(_scene, pixels, size, size);

    return pixels;
}
// jstyper end

var startTime=new Date() ;
var rayoutput = raytraceScene(15);
var endTime=new Date() ;
console.log(startTime, endTime, endTime - startTime);