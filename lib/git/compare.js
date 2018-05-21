
"use strict";
const Diff = require("diff");
const reLine = /^.*?$/gm;
function compare (oldFile, newFile) {
	const result = [];
	Diff.diffLines(
		oldFile.contents.toString(),
		newFile.contents.toString(),
		{
			ignoreWhitespace: true,
		}
	).forEach(part => {
		if (part.removed) {
			return;
		}
		const pos = result.length;
		result.fill(Boolean(part.added), pos, pos + part.value.match(reLine).length);
	});
	return result;
};

module.exports = compare;
