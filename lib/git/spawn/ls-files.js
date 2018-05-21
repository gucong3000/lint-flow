"use strict";
const gitSpawn = require("./spawn");
const File = require("../file");
function lsFiles (options = {}) {
	return gitSpawn({
		...options,
		args: [
			"ls-files",
			// Instead of showing the full 40-byte hexadecimal object lines, show only a partial prefix. Non default number of digits can be specified with --abbrev=<n>.
			"--abbrev=999",
			// Show staged contents' mode bits, object name and stage number in the output.
			"--stage",
			// Do not list empty directories. Has no effect without --directory.
			"--no-empty-directory",
			// \0 line termination on output and do not quote filenames. See OUTPUT below for more information.
			"-z",
			// After each line that describes a file, add more data about its cache entry. This is intended to show as much information as possible for manual inspection; the exact format may change at any time.
			// "--debug",
		].concat(options.args),
		// 0. [<tag> ]
		// 1. <mode>
		// 2. <object>
		// 3. <stage>
		// 4. <file>
		/* eslint-disable-next-line no-control-regex */
		matcher: /(?:(\w+)\s+)?(\w+)\s+(\w+)\s+(\w+)\t(.+?)\u0000/gu,
		mapper: (
			tag,
			mode,
			blob,
			stage,
			relative
		) => (
			new File({
				cwd: options.cwd,
				tag,
				mode,
				blob,
				stage,
				relative,
			})
		),
	});
}

module.exports = lsFiles;
