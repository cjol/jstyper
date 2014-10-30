var UglifyJS = require("uglify-js2");

module.exports = function(src) {
	// pre-process source 
	// read all jstyper annotations
	var jstyperComments = /(?:\/\*\s*jstyper\s+((?:[^*]|[\r\n]|(?:\*+(?:[^*\/]|[\r\n])))*)\*+\/)|(?:\/\/\s*jstyper\s+(.*))/g;
	var annotations = [];
	var match;
	var i;
	while (match = jstyperComments.exec(src)) {
		annotations.push({
			content: match[1] || match[2],
			startIndex: match.index,
			endIndex: match.index + match[0].length
		});
	}
	var srcChunks = [];
	var prevIndex = 0;
	var nestingLevel = 0;
	for (i = 0; i < annotations.length; i++) {
		if (annotations[i].content.match(/^start\s*/)) {
			if (nestingLevel > 0) {
				// we are already in a section to be typed, so no need to add the next chunk separately
			} else {
				// we were previously in an untyped section, so add the current chunk
				srcChunks.push(src.substring(prevIndex, annotations[i].startIndex));
				prevIndex = annotations[i].endIndex;
			}
			nestingLevel ++;
		}
		if (annotations[i].content.match(/^end\s.*/)) {
			nestingLevel--;
			if (nestingLevel > 0) {
				// we only want to end a chunk when we reach the top nesting level
			} else if (nestingLevel<0) {
				// we have an unmatched number of starts and ends)
				throw new Error("Unexpected end jstyper annotation");
			} else {
				// we are about to leave a typed region, so add the current chunk
				srcChunks.push(src.substring(prevIndex, annotations[i].startIndex));
				prevIndex = annotations[i].endIndex;
			}
				
		}
	}

	if (nestingLevel > 0) {
		// we have an unmatched number of starts and ends)
		throw new Error("Expected " + nestingLevel + " more end jstyper annotation" + (nestingLevel==1)?"":"s");
	} else  {
		// the end of the file needs accounting for
		srcChunks.push(src.substring(prevIndex, src.length));
	}

	// because typed and untyped chunks are contiguous, we now have chunks to be typed at odd indices
	// console.log(srcChunks);
	var outSrc = "";
	for (i=0; i<srcChunks.length; i++) {
		if (i%2 == 0) {
			// output as-is
			outSrc += srcChunks[i];
		} else {
			// type then output
			
			// obtain AST
			var ast;
			try {
				ast = get_ast(srcChunks[i]);
			} catch (e) {
				e.message = "Parse Error: " + e.message;
				throw e;
			}

			// type check

			// modify AST as appropriate
			
			// regenerate src
			try {
				outSrc += "/* jstyper typed */\n";
				outSrc += get_src(ast);
				outSrc += "\n/* jstyper end typed */\n";
			} catch (e) {
				e.message = "Generation error: " + e.message;
				throw e;
			}
			
		}
	}

	// var croppedSrc;
	// var mostRecentAnnotation;
	// for (var i = 0; i < annotations.length; i++) {
	// 	if (annotations[i].content.match(/^start\s*/)) {
	// 		mostRecentAnnotation = mostRecentAnnotation || annotations[i].endIndex;
	// 	}
	// 	if (annotations[i].content.match(/^end\s.*/)) {
	// 		if (mostRecentAnnotation) {
	// 			croppedSrc += src.substr(mostRecentAnnotation, annotations[i].startIndex - mostRecentAnnotation) + "\n";
	// 			mostRecentAnnotation = undefined;
	// 		}

	// 	}
	// }
	// console.log(croppedSrc);
	return outSrc;
};

function get_ast(src) {
	var ast = UglifyJS.parse(src);
	ast.figure_out_scope();
	return ast;
}

function get_src(ast) {
	var stream = UglifyJS.OutputStream({
		beautify: true
	});
	var src = ast.print(stream);
	return stream.toString();
}