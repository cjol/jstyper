var fs = require("fs");
var http = require("http");
var express = require("express");
var app = express();
var stringify = require("json-stringify-safe");
var bodyParser = require('body-parser');
var jstyper = require("./jstyper");
// set the default directory for templated pages
app.set("views", __dirname + "/views");

// reassign every object property directly so that JSON.stringify shows them
function reassign(obj) {
	// annotate the object with the class name for printing
	// if (obj !== null) {
		// obj.__typeof = obj.constructor.name;
	// }
	function copy(item, key) {
		// recurse if necessary
        if (typeof item[key] === "object")
        	item[key] = reassign(item[key]);
         else 
         	item[key] = item[key];
	}

    var result = Object.create(obj);
	// I want "TYPE" to appear first for clarity
	if (typeof result.TYPE !== "undefined")
		copy(result, "TYPE");
    for(var key in result) {
    	if (key != "TYPE")
    		copy(result, key);	
    }
    return result;
}

// set the default directory for templated pages
app.set("views", __dirname + "/views");

// set the default template engine to ejs - although I'm only using it for static html anyway
app.engine("html", require('ejs').renderFile);
  
// serve test files in the 'tests' folder under the /tests path
app.use('/tests/', express.static(__dirname + '/tests'));

// serve static files in the 'res' folder directly from the root
app.use('/assets', express.static(__dirname + '/res'));

app.use(bodyParser.text());


function handleCompile(src, req, res) {
	res.set('Content-Type', 'application/javascript');
	try {
		var result = jstyper(src);
		res.send(
			result
		);
	} catch(e) {
		res.status(400).send(e.message);
	}
}
var exec = require('child_process').exec;
app.get('/gitpull/', function(req, res) {
    exec("git pull", function(error, stdout, stderr) {
        console.log(error);
        console.log(stdout);
        console.log(stderr);
        res.send(stdout);
    });
});

app.post('/compile/', function (req, res) {
	if (req.body !== undefined && req.body.length > 0) {
		handleCompile(req.body, req, res);
	} else {
		res.status(400).send("Request body missing");
	}
});

app.get('/compile/:test/', function (req, res) {
	var file = "tests/" + req.params.test;
	var src = fs.readFileSync(file, "utf8");
	handleCompile(src, req, res);
});


app.get('/', function(req, res) {
	res.render("compile.html", {from:'', to:''});
});

app.get('/:test', function(req, res) {
	var file = "tests/" + req.params.test;
	var src = fs.readFileSync(file, "utf8");
	var result;
	try {
		result = jstyper(src);
	} catch(e) {
		result = e.message;
	}
	res.render("compile.html", {from:src, to:result});
});

app.listen(3006);
