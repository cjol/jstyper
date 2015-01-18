/*jshint unused:true, bitwise:true, eqeqeq:true, undef:true, latedef:true, eqnull:true */
/* global require, console, __dirname */

// for the web server
var express = require("express");
var app = express();
var bodyParser = require('body-parser');
var portNumber = 3006;

// for reading tests
var fs = require("fs");

// for type-checking and compilation
var jstyper = require("./jstyper");

// set the default directory for templated pages
app.set("views", __dirname + "/views");

// set the default template engine to ejs - although I'm only using it for static html anyway
app.engine("html", require('ejs').renderFile);

// serve test files in the 'tests' folder under the /tests path
app.use('/tests/', express.static(__dirname + '/tests'));

// serve static files in the 'res' folder under the /assets path
app.use('/assets', express.static(__dirname + '/res'));

// make every request use bodyParser middleware
app.use(bodyParser.text());

// central point for all pages requiring compilation
function handleCompile(src, req, res) {
    res.set('Content-Type', 'application/javascript');
    try {
        var result = jstyper(src);
        res.send(
            result.src
        );
    } catch (e) {
        res.status(400).send(e.stack);
    }
}

// /compile/ will compile arbitrary javascript passed as request body
app.post('/compile/', function(req, res) {
    if (req.body !== undefined && req.body.length > 0) {
        handleCompile(req.body, req, res);
    } else {
        res.status(400).send("Request body missing");
    }
});

// /compile/test1.js will return the compilation  result for test 1 (no req body needed)
app.get('/compile/:test/', function(req, res) {
    var file = __dirname + "/tests/" + req.params.test;
    var src = fs.readFileSync(file, "utf8");
    handleCompile(src, req, res);
});

// /debug/test2.js will return a json object containing debug results from compiling test 2 
app.get('/debug/:test/', function(req, res) {
    var file = __dirname + "/tests/" + req.params.test;
    var src = fs.readFileSync(file, "utf8");
    res.set('Content-Type', 'application/javascript');
    try {
        var result = jstyper(src);
        res.json(
            result
        );
    } catch (e) {
        res.status(400).send(e.message);
    }
});

// the root page serves a blank editor which will make ajax requests to /compile
app.get('/', function(req, res) {

	// render the view with no initial data
    res.render("compile.html", {
        from: '',
        to: ''
    });
});

// requesting a test directly preloads the editor with the test and its result
app.get('/:test', function(req, res) {
	
	// obtain test data
    var file = __dirname + "/tests/" + req.params.test;
    var src = fs.readFileSync(file, "utf8");
    var result;
    try {
        result = jstyper(src);
    } catch (e) {
        result = {src:e.stack};
    }

    // render the view
    res.render("compile.html", {
        from: src,
        to: result.src
    });
});

app.listen(portNumber);