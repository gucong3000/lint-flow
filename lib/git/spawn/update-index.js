"use strict";
const gitSpawn = require("./spawn");
const through = require("through2");

function updateIndex (options = {}) {
	const rst = [];

	async function transform (file, encoding, done) {
		if (!file.dstFile) {
			if (file.blob && !/^0+$/.test(file.blob)) {
				rst.push([
					file.mode ? file.mode.toString(8) : "100644",
					file.blob,
					file.stage || "0",
				].join(" ") + "\t" + file.relative);
			}
			this.push(file);
		}
		done();
	}

	function flush (done) {
		if (!rst.length) {
			done();
			return;
		}
		gitSpawn({
			...options,
			input: rst.join("\u0000"),
			args: [
				"update-index",
				"-z",
			].concat(options.args).concat(
				"--index-info"
			),
		}).then(() => {
			done();
		}, done);
	}
	return through.obj(transform, flush);
}

module.exports = updateIndex;
