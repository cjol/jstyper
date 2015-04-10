// jstyper start

/* JSTyper infers the types of your JavaScript variables */
var x = 5, y = true, circle = {radius: 4, position: {x:-18, y:10}};
function getName(shape) {
	return shape.name;
}

/* This allows it to detect certain errors before your code ever runs. To see
 * examples, uncomment any of the commented lines below. */

x++;
// y += 1;
// x = circle.position.z;
// getName(circle);

getName({name:"#246810"});


/* JSTyper allows you to add properties to objects even after initialisation.
 * It will even conservatively deduce types from non-straight-line code */
circle.name = "#123456"; 
getName(circle);

if (y) {
	circle.rgb = {
		r:55,
		g:100
	};
	circle.rgb.b = 12;
	circle.extraProp = true;
} else {
	circle.rgb = {
		b:1, r:14, g:200	
	};
	circle.hello = "world";
}

/* note that circle now definitely has rgb, but we cannot rely on it having
 * either 'hello' or 'extraProp' */ 
circle.rgb.r++;
// y = circle.extraProp;

/* JavaScript allows programmers to write dynamic code, in which the type of a
 * variable may change at any point. It is impossible to detect errors in such
 * code, but JSTyper can isolate the well-typed portions of your code, and ensure
 * that those parts, at least, are free from type errors. If the dynamic code
 * behaves incorrectly (e.g. a function returns a string when it should return a
 * number), an error will be thrown before the incorrect type can cause any
 * problems in the well-typed world.
 */ 
// jstyper import returnsYesOrTrue
// jstyper import alert

y = returnsYesOrTrue(0.8);
circle.name = returnsYesOrTrue(0.3);

/* executing the following code would incorrectly set the circle's name to a
 * boolean value. JSTyper prevents this. */
circle.name = returnsYesOrTrue(1);

alert(circle.name);

// jstyper end

function returnsYesOrTrue(n) {
	if (n<0.5) { 
		return 'yes';
	} else {
		return true;
	}
}