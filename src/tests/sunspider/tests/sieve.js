// jstyper start
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
	var m = shiftLeft(1, i) * 10000;
	var flags = [];
	flags.length = m+1;
	nsieve(m, flags);
}

// jstyper end
function shiftLeft(x, y) {
	return x << y;
}