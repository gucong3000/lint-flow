"use strict";
const through = require("through2");
const cp = require("child_process");
const StringDecoder = require("string_decoder").StringDecoder;

function splitStream (options) {
	const encoding = options.encoding;
	const matcher = options.matcher;
	const mapper = options.mapper;
	const decoder = (encoding || matcher) && new StringDecoder(encoding);
	let lastStr = "";

	matcher.lastIndex = 0;

	function transform (data) {
		data = decoder.write(data);

		if (lastStr) {
			data = lastStr + data;
		}

		let match;
		let lastMatch;

		while ((match = matcher.exec(data))) {
			if (options.debug) {
				console.info(match[0]);
			}
			let matched = Array.prototype.slice.call(match, 1);
			if (mapper) {
				matched = mapper.apply(this, matched);
			}
			if (matched) {
				this.push(matched);
			}

			lastMatch = match;
		}
		if (lastMatch) {
			lastStr = data.slice(lastMatch.index + lastMatch[0].length);
		} else {
			lastStr = data;
		}
	}
	return transform;
}

function readStreamIfy (ps, options = {}) {
	let err = "";

	const stream = options.matcher ? through.obj() : through();

	const transform = options.matcher
		? splitStream(options).bind(stream)
		: stream.push.bind(stream);

	ps.stdout.on("data", transform);

	ps.stderr.on("data", (buf) => {
		err += buf;
	});

	ps.on("close", (code) => {
		// code === null when child_process is killed
		if (code) {
			stream.emit(
				"error",
				new Error(ps.spawnargs.join(" ") + "\n" + err)
			);
		} else {
			stream.end();
		}
	});

	ps.on("error", (err) => {
		stream.emit("error", err);
	});

	const destroy = stream.destroy;
	stream.destroy = function () {
		if (!ps.killed) {
			ps.kill();
		}
		if (destroy) {
			destroy.apply(this, arguments);
		}
	};

	stream.spawnargs = ps.spawnargs;

	// this was needed after switching to through2
	stream.pause();
	process.nextTick(() => stream.resume());
	require("../thenable");
	return stream;
}

function gitSpawn (options = {}) {
	let args = ["--no-pager"];
	if (options.config) {
		Object.keys(options.config).forEach((key) => {
			args.push(
				"-c",
				key + "=" + String(options.config[key])
			);
		});
	}

	options.args = options.args.filter(Boolean);
	args = args.concat(options.args);

	const ps = cp.spawn("git", args, options);

	if (options.debug) {
		console.info(ps.spawnargs.join(" "));
	}

	if (options.input) {
		if (typeof options.input.pipe === "function") {
			options.input.pipe(ps.stdin);
		} else {
			ps.stdin.end(options.input);
		}
	}

	return readStreamIfy(ps, options);
}

module.exports = gitSpawn;
