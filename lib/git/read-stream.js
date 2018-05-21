"use strict";
const fileType = require("file-type");

function readStream (stream, options = {}) {
	const rst = [];
	let len = 0;
	let firstChunkLen = 0;
	if (options.skipBin) {
		if (typeof options.skipBin === "number") {
			firstChunkLen = options.skipBin;
		} else {
			firstChunkLen = 4100;
		}
	}

	return new Promise((resolve, reject) => {
		stream.on("data", (data) => {
			rst.push(data);
			len += data.length;
		});
		if (firstChunkLen) {
			stream.on("data", firstChunk);
		}
		stream.once("end", () => {
			const contents = Buffer.concat(rst, len);
			// exclude binary file
			if (!(firstChunkLen && len < firstChunkLen && excludeBinary(contents))) {
				resolve(contents);
			}
		});

		stream.once("error", reject);

		function firstChunk () {
			if (len < firstChunkLen) {
				return;
			}
			stream.removeListener("data", firstChunk);
			excludeBinary(Buffer.concat(rst, len));
		}

		function excludeBinary (buffer) {
			if (fileType(buffer)) {
				// exclude binary file
				resolve(null);
				stream.destroy();
				return true;
			}
		}
	});
}

module.exports = readStream;
