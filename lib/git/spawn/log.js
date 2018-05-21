"use strict";
const gitSpawn = require("./spawn");
/* eslint-disable-next-line no-control-regex */
const reDiff = /:(\w+)\s+(\w+)\s+(\w+)(?:\.{3})?\s+(\w+)(?:\.{3})?\s+(\w+)\u0000(.+?)\u0000(?:([^:]+?)\u0000)?/gu;

function splitDiff (output) {
	reDiff.lastIndex = 0;
	let match;
	const rst = [];
	while ((match = reDiff.exec(output))) {
		rst.push({
			src: {
				mode: match[1],
				blob: /^0+$/.test(match[3]) ? null : match[3],
				relative: match[6],
			},
			dst: {
				mode: match[2],
				blob: /^0+$/i.test(match[4]) ? null : match[4],
				relative: match[7] || match[6],
				status: match[5],
			},
		});
	}
	return rst;
}

function log (options = {}) {
	return gitSpawn({
		...options,
		/* eslint-disable-next-line no-control-regex */
		matcher: /\u001D([^\u001D]+\u0000)/gu,
		mapper (
			log
		) {
			log = log.split("\u001E");
			/* eslint-disable-next-line no-control-regex */
			const diff = splitDiff(log[1].replace(/^(\u0000)\n*/, ""));
			log = log[0].split("\u001F");
			return {
				hash: log[0],
				parent: log[1].split(/\s+/g),
				author: {
					name: log[2],
					mail: log[3],
					time: log[4] - 0,
				},
				committer: {
					name: log[5],
					mail: log[6],
					time: log[7] - 0,
				},
				message: log[8],
				diff,
			};
		},
		args: [
			"log",
			"-z",
			"--abbrev=999",
			"--format=%x1D%H%x1F%P%x1F%aN%x1F%aE%x1F%at%x1F%cN%x1F%cE%x1F%ct%x1F%B%x1E",
		].concat(options.args),
	});
};

module.exports = log;
