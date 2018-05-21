"use strict";
const through = require("through2");
const chalk = require("chalk");
const log = require("fancy-log");
const Diff = require("diff");
const title = "lint-flow";
module.exports = function () {
	log.info(title + " " + chalk.green("start"));
	let count = 0;
	function transform (file, encoding, done) {
		const filePath = file.relative;
		const contents = file.contents;
		let output = title + " " + chalk.blue(filePath);
		if (file.rawContents && !contents.equals(file.rawContents)) {
			output = Diff.createPatch(
				filePath,
				file.rawContents.toString(),
				contents.toString()
			)
				.replace(/^.*?(?=\r?\n)/, output)
				.replace(/^\+.*?$/gm, s => chalk.green(s))
				.replace(/^-.*?$/gm, s => chalk.red(s));
		}
		log.info(output);
		count++;
		this.push(file);
		done();
	}
	function flush (callback) {
		log.info(title + " " + chalk.green(count + " " + "item"));
		count = 0;
		callback();
	}
	return through.obj(transform, flush);
};
