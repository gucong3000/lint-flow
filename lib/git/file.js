"use strict";
const Vinyl = require("vinyl");
const path = require("path");

function inWorkdir (blob) {
	if (blob) {
		return blob.iszero ? blob.iszero() : /^0+$/.test(blob);
	} else if (blob == null) {
		return true;
	} else {
		return false;
	}
}

class File extends Vinyl {
	constructor (options) {
		if (options.mode && typeof options.mode === "string") {
			options.mode = Number.parseInt(options.mode, 8);
		}
		if (!options.path) {
			options.path = path.resolve(options.cwd, options.relative);
		}

		delete options.relative;
		if (options.inIndex && inWorkdir(options.blob)) {
			options.inWorkdir = true;
		}
		super(options);
	}
	get relative () {
		let relative = super.relative;
		if (path.sep === "\\") {
			relative = relative.split(path.sep).join("/");
		}
		return relative;
	}
}

module.exports = File;
