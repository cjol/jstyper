var ret;
// jstyper start
// jstyper import Math
// jstyper import shiftLeft

function TreeNode(left, right, hasChildren, item) {
	var t = {};
	t.left = left;
	t.right = right;
	t.item = item;
	t.hasChildren = hasChildren;
	t.itemCheck = function() {
		if (!hasChildren) return this.item;
		else return this.item + this.left.itemCheck() - this.right.itemCheck();
	};
	return t;
}

function bottomUpTree(item, depth) {
	if (depth > 0) {
		return TreeNode(
			bottomUpTree(2 * item - 1, depth - 1), bottomUpTree(2 * item, depth - 1), true, item
		);
	} else {
		return TreeNode(0, 0, false, item);
	}
}

for (var n = 4; n <= 5; n += 1) {
	var minDepth = 4;
	var maxDepth = Math.max(minDepth + 2, n);
	var stretchDepth = maxDepth + 1;

	var check = bottomUpTree(0, stretchDepth).itemCheck();

	var longLivedTree = bottomUpTree(0, maxDepth);
	for (var depth = minDepth; depth <= maxDepth; depth += 2) {
		var iterations = shiftLeft(i, maxDepth - depth + minDepth);

		check = 0;
		for (var i = 1; i <= iterations; i++) {
			check += bottomUpTree(i, depth).itemCheck();
			check += bottomUpTree(-i, depth).itemCheck();
		}
	}

	ret = longLivedTree.itemCheck();
}

// jstyper end
function shiftLeft(x,y) {
	return x<<y;
}