"use strict";
const through = require("through2");
const mm = require("micromatch");
module.exports = function (matcher) {
	if (typeof matcher !== "function") {
		matcher = ((patterns, file) => {
			return mm.any((file.dstFile || file).relative, patterns);
		}).bind(null, matcher);
	}
	// exclude git diff src files from stream
	function transform (file, encoding, done) {
		if (matcher(file)) {
			this.push(file);
		}
		done();
	};
	return through.obj(transform);
};
