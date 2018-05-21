"use strict";
const promiseCache = new WeakMap();

function concatChunk (list) {
	if (list.length) {
		list = Buffer.concat(list).toString().trim();
	} else {
		list = "";
	}
	return list;
}

function promisify (stream) {
	let promise = promiseCache.get(stream);
	if (!promise) {
		promise = new Promise((resolve, reject) => {
			const rst = [];
			stream
				.on("data", (data) => {
					rst.push(data);
				})
				.on("end", () => {
					resolve(rst);
				})
				.on("error", reject);
		});

		if (!stream._readableState.objectMode) {
			promise = promise.then(concatChunk);
		}
		promiseCache.set(stream, promise);
	}

	return promise.then((rst) => {
		return rst;
	});
}

function then () {
	return promisify(this).then(...arguments);
}

function reject () {
	return promisify(this).catch(...arguments);
}

function thenable (module) {
	const proto = module.Readable.prototype;
	if (!proto.then) {
		proto.then = then;
	}
	if (!proto.catch) {
		proto.catch = reject;
	}
}

Object.keys(require.cache).forEach(file => {
	if (/(\/|\\)node_modules\1readable-stream\1readable\.js$/.test(file)) {
		thenable(require.cache[file].exports);
	}
});

thenable(require("stream"));

module.exports = promisify;
