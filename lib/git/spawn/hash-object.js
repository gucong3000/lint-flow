"use strict";
const gitSpawn = require("./spawn");
const through = require("through2");
const Vinyl = require("vinyl");

const emptyHash = "0".repeat(40);

async function blob (file, options = {}) {
	if (file.isNull()) {
		return emptyHash;
	} else if (file.blob && !/^0+$/.test(file.blob) && file.rawContents && file.contents.equals(file.rawContents)) {
		return file.blob;
	}
	return gitSpawn({
		cwd: file.cwd,
		...options,
		input: file.contents,
		args: [
			"hash-object",
			"--stdin",
		].concat(options.args),
	});
}

function hashObject (options) {
	if (options) {
		if (Vinyl.isVinyl(options)) {
			return blob.apply(this, arguments);
		}
	} else {
		options = {};
	}

	if (!options.args) {
		options.args = "-w";
	} else if (Array.isArray(options.args)) {
		if (options.args.indexOf("-w") < 0) {
			options.args.push("-w");
		}
	} else if (options.args !== "-w") {
		options.args = [
			options.args,
			"-w",
		];
	}

	async function transform (file, encoding, done) {
		if (!file.dstFile) {
			if (!file.isDirectory()) {
				try {
					file.blob = await blob(file, options);
				} catch (ex) {
					done(ex);
					return;
				}
			}
			this.push(file);
		}
		done();
	}
	return through.obj(transform);
}

module.exports = hashObject;
