"use strict";
const gitSpawn = require("./spawn");
const through = require("through2");
const Vinyl = require("vinyl");

function parsePerson (data, result) {
	data.replace(/^\w+-(\w+) (.*)$/gm, (s, key, value) => {
		if (/^e?mail$/i.test(key)) {
			key = "email";
			value = value.replace(/^<(.*)>$/, "$1");
		} else if (key === "time") {
			value = value - 0;
		}
		result[key] = value;
		return "";
	});
	return result;
}

function parseLine (props, result) {
	props.replace(/^(\w+) (.*)(\n(?:\1-\w+ .*\n)+)/gm, (s, role, name, props) => {
		result.rev[role] = parsePerson(props, {
			name,
		});
		return "";
	}).replace(/^summary (.*)$/igm, (s, summary) => {
		result.rev.summary = summary;
		return "";
	}).replace(/^previous (\w+) (.*)$/igm, (s, hash, filename) => {
		result.previous = {
			hash,
			filename,
		};
		return "";
	}).replace(/^(\S+) (.*)$/gm, (s, key, value) => {
		result[key] = value;
		return "";
	});
	return result;
}

function parseBlame (
	revCache,
	hash,
	origLine,
	finalLine,
	props,
	content
) {
	origLine = origLine - 0;
	finalLine = finalLine - 0;
	return parseLine(props, {
		origLine,
		finalLine,
		content,
		rev: revCache[hash] || (revCache[hash] = {
			hash,
		}),
	});
}

function fileBlame (file, options = {}) {
	const revCache = {};
	const args = [
		"blame",
		// Ignore whitespace when comparing the parent’s version and the child’s to find where the lines came from.
		"-w",
		// In addition to -M, detect lines moved or copied from other files that were modified in the same commit. This is useful when you reorganize your program and move code around across files. When this option is given twice, the command additionally looks for copies from other files in the commit that creates the file. When this option is given three times, the command additionally looks for copies from other files in any commit.
		// <num> is optional but it is the lower bound on the number of alphanumeric characters that Git must detect as moving/copying between files for it to associate those lines with the parent commit. And the default value is 40. If there are more than one -C options given, the <num> argument of the last -C will take effect.
		"-C",
		// Detect moved or copied lines within a file. When a commit moves or copies a block of lines (e.g. the orig file has A and then B, and the commit changes it to B and then A), the traditional blame algorithm notices only half of the movement and typically blames the lines that were moved up (i.e. B) to the parent and assigns blame to the lines that were moved down (i.e. A) to the child commit. With this option, both groups of lines are blamed on the parent by running extra passes of inspection.
		// <num> is optional but it is the lower bound on the number of alphanumeric characters that Git must detect as moving/copying within a file for it to associate those lines with the parent commit. The default value is 20.
		"-M",
		// Show in a format designed for machine consumption.
		"--porcelain",
	];

	if (!file.isNull()) {
		args.push(
			"--contents",
			"-"
		);
	}

	args.push(
		"--",
		file.history[0]
	);

	return gitSpawn({
		cwd: file.cwd,
		...options,
		args: args,
		input: file.contents,
		matcher: /^(\w{40,}) (\d+) (\d+)(?: \d+)*\n((?:\S*.*\n)*?)\t(.*)(?:\n|$)/g,
		mapper: parseBlame.bind(null, revCache),
	});
}

function blame (options) {
	if (options && Vinyl.isVinyl(options)) {
		return fileBlame.apply(this, arguments);
	}
	async function transform (file, encoding, done) {
		if (!file.isDirectory()) {
			try {
				file.blame = await fileBlame(file, options);
			} catch (ex) {
				done(ex);
				return;
			}
		}
		this.push(file);
		done();
	}
	return through.obj(transform);
}

module.exports = blame;
