"use strict";
const gitSpawn = require("./spawn");
const File = require("../file");

function diff (options = {}) {
	const dstInIndex = Boolean(options.args && options.args.length);

	return gitSpawn({
		...options,
		// 0. mode for "src"; 000000 if creation or unmerged.
		// 1. mode for "dst"; 000000 if deletion or unmerged.
		// 2. sha1 for "src"; 0{40} if creation or unmerged.
		// 3. sha1 for "dst"; 0{40} if creation, unmerged or "look at work tree".
		// 4. status, followed by optional "score" number.
		// 5. path for "src"
		// 6. path for "dst"; only exists for C or R.
		/* eslint-disable-next-line no-control-regex */
		matcher: /:(\w+)\s+(\w+)\s+(\w+)(?:\.{3})?\s+(\w+)(?:\.{3})?\s+(\w+)\u0000(.+?)\u0000(?:([^:]+?)\u0000)?/gu,
		mapper (
			srcMode,
			dstMode,
			srcBlob,
			dstBlob,
			status,
			src,
			dst
		) {
			if (/^D$/i.test(status)) {
				return;
			}
			const dstFile = new File({
				mode: dstMode,
				blob: dstBlob,
				status,
				relative: dst || src,
				inIndex: !dstInIndex,
				cwd: options.cwd,
			});
			if (!/^0+$/.test(srcBlob)) {
				const srcFile = new File({
					mode: srcMode,
					blob: srcBlob,
					relative: src,
					cwd: options.cwd,
					inIndex: dstInIndex,
					dstFile,
				});
				dstFile.srcFile = srcFile;
				this.push(srcFile);
			}

			return dstFile;
		},
		args: [
			"diff",
			// Instead of showing the full 40-byte hexadecimal object name in diff-raw format output and diff-tree header lines, show only a partial prefix. This is independent of the --full-index option above, which controls the diff-patch output format. Non default number of digits can be specified with --abbrev=<n>.
			"--abbrev=999",
			// Generate the diff in raw format.
			"--raw",
			// When --raw, --numstat, --name-only or --name-status has been given, do not munge pathnames and use NULs as output field terminators.
			"-z",
		].concat(options.args),
	});
}

module.exports = diff;
