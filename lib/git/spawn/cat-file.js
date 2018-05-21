"use strict";
const isBinaryPath = require("is-binary-path");
const readStream = require("../read-stream");
const gitSpawn = require("./spawn");
const through = require("through2");
const Vinyl = require("vinyl");
const fs = require("fs");

async function readContents (file, options = {}) {
	options = {
		skipBin: 4100,
		...options,
	};

	if (options.skipBin && isBinaryPath(file.path)) {
		return null;
	}

	const blob = file.blob;
	let stream;

	if (file.inWorkdir) {
		stream = fs.createReadStream(file.history[0]);
	} else {
		stream = gitSpawn({
			cwd: file.cwd,
			...options,
			args: [
				"cat-file",
				// Typically this matches the real type of <object> but asking for a type that can trivially be dereferenced from the given <object> is also permitted. An example is to ask for a "tree" with <object> being a commit object that contains it, or to ask for a "blob" with <object> being a tag object that points at it.
				"blob",
				blob,
			].concat(options.args),
		});
	}

	const contents = await readStream(stream, options);

	if (contents && file.inIndex && file.inWorkdir == null) {
		try {
			const fsContents = await readStream(fs.createReadStream(file.history[0]));
			file.inWorkdir = fsContents.equals(contents);
		} catch (ex) {
			file.inWorkdir = false;
		}
	}

	return contents;
}

function catFile (options) {
	if (options && Vinyl.isVinyl(options)) {
		return readContents.apply(this, arguments);
	}
	async function transform (file, encoding, done) {
		if (!file.isDirectory() && file.blob !== null) {
			let rawContents;
			try {
				rawContents = await readContents(file, options);
			} catch (ex) {
				done(ex);
				return;
			}
			if (rawContents == null) {
				// exclude binary file
				done();
				return;
			} else {
				file.contents = file.rawContents = rawContents;
			}
		}
		this.push(file);
		done();
	}
	return through.obj(transform);
}

module.exports = catFile;
