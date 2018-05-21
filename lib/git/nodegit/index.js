"use strict";
const Git = require("./git");
const through = require("through2");
const Vinyl = require("vinyl");

function array2stream (files) {
	const stream = through.obj();
	Promise.resolve(files).then(files => {
		files.forEach(file => {
			stream.push(file);
		});
		stream.pause();
		process.nextTick(() => {
			stream.resume();
			stream.end();
		});
	}, stream.emit.bind(stream, "error"));
	return stream;
}

class GitStream {
	constructor (...options) {
		this.repository = new Git(...options);
		require("../thenable");
	}
	lsFiles (...options) {
		return array2stream(this.repository.lsFiles(...options));
	}
	diffWithIndex (diff) {
		let rst;
		if (diff) {
			diff = Array.prototype.slice.call(diff.match(/^(.*?)((?:\.+[^.]*)?)$/), 1);
			rst = this.repository.diffWithIndex(...diff);
		} else {
			rst = this.repository.diffWithIndex();
		}
		return array2stream(rst);
	}
	staged (...options) {
		return array2stream(this.repository.staged(...options));
	}
	unstaged (...options) {
		return array2stream(this.repository.unstaged(...options));
	}
	catFile (options = {}) {
		const repository = this.repository;
		if (options && Vinyl.isVinyl(options)) {
			return repository.catFile.apply(repository, arguments);
		}
		async function transform (file, encoding, done) {
			if (!file.isDirectory() && file.blob !== null) {
				let rawContents;
				try {
					rawContents = await repository.catFile(file, options);
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
	blame (...options) {
		const repository = this.repository;
		if (arguments[0] && Vinyl.isVinyl(arguments[0])) {
			return repository.blame.apply(repository, arguments);
		}
		async function transform (file, encoding, done) {
			if (!file.isDirectory()) {
				try {
					file.blame = await repository.blame(file, ...options);
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
	updateIndex () {
		const repository = this.repository;
		async function transform (file, encoding, done) {
			if (!file.dstFile) {
				if (!file.isDirectory()) {
					try {
						await repository.updateIndex(file);
					} catch (ex) {
						done(ex);
						return;
					}
				}
				this.push(file);
			}
			done();
		}

		async function flush (done) {
			try {
				const index = await repository.index();
				await index.write();
			} catch (ex) {
				done(ex);
				return;
			}
			done();
		}
		return through.obj(transform, flush);
	}
}

module.exports = GitStream;
