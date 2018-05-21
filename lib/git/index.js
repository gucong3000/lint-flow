"use strict";
let GitStream;
try {
	GitStream = require("./nodegit");
} catch (ex) {
	GitStream = require("./spawn");
}

module.exports = (...options) => (
	new GitStream(...options)
);
